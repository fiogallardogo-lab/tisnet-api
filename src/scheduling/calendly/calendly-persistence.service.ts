import { Prisma } from '@prisma/client';
import { BadRequestException, Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { PrismaService } from '../../prisma/prisma.service';
@Injectable()
export class CalendlyPersistenceService {
  constructor(private readonly prisma: PrismaService) {}
  async process(input: any) {
    for (let attempt = 0; ; attempt++) {
      try {
        return await this.persist(input);
      } catch (error) {
        if (
          attempt < 2 &&
          error instanceof Prisma.PrismaClientKnownRequestError &&
          ['P2002', 'P2034'].includes(error.code)
        )
          continue;
        throw error;
      }
    }
  }
  private async persist(input: any) {
    if (!['invitee.created', 'invitee.canceled'].includes(input?.event))
      throw new BadRequestException('Evento Calendly no soportado');
    const p = input.payload,
      invitee = p?.invitee ?? p,
      se = p?.scheduled_event;
    const occurredAt = new Date(input.created_at),
      start = new Date(se?.start_time),
      end = new Date(se?.end_time);
    if (
      !invitee ||
      typeof se?.uri !== 'string' ||
      !se.uri.startsWith('https://api.calendly.com/scheduled_events/') ||
      typeof invitee.email !== 'string' ||
      !/^\S+@\S+\.\S+$/.test(invitee.email) ||
      invitee.email.length > 150 ||
      typeof invitee.uri !== 'string' ||
      !invitee.uri.startsWith('https://api.calendly.com/scheduled_events/') ||
      invitee.uri.length > 500 ||
      !Number.isFinite(occurredAt.getTime()) ||
      !Number.isFinite(start.getTime()) ||
      !Number.isFinite(end.getTime()) ||
      end <= start
    )
      throw new BadRequestException('Payload Calendly inválido');
    const email = invitee.email.trim().toLowerCase(),
      uri = invitee.uri;
    const eventId =
      'calendly:' +
      createHash('sha256')
        .update(input.event + '|' + uri + '|' + input.created_at)
        .digest('hex');
    const payload = {
      ...input,
      payload: { ...p, invitee, scheduled_event: se },
    };
    const fresh = await this.prisma.$transaction(async (db) => {
      const prospect = await db.prospect.upsert({
        where: { email },
        create: {
          name: String(invitee.name || email).slice(0, 100),
          email,
          source: 'MEETING',
        },
        update: {},
      });
      await db.$queryRaw`SELECT id FROM Prospect WHERE id=${prospect.id} FOR UPDATE`;
      if (
        await db.meetingEvent.findUnique({
          where: { externalEventId: eventId },
        })
      )
        return false;
      const existing = await db.meeting.findUnique({
        where: { externalEventUri: uri },
        include: {
          externalEvents: { orderBy: { occurredAt: 'desc' }, take: 1 },
        },
      });
      // A cancellation arriving first must not be undone by a late creation event.
      if (
        existing &&
        (existing.externalEvents[0]?.occurredAt > occurredAt ||
          (existing.status === 'CANCELLED' &&
            input.event === 'invitee.created'))
      )
        return false;
      const status =
        input.event === 'invitee.canceled' ? 'CANCELLED' : 'SCHEDULED';
      const code = p.tracking?.utm_term;
      const quote =
        typeof code === 'string'
          ? await db.quote.findFirst({
              where: { publicCode: code, contactEmail: email },
              select: { id: true },
            })
          : null;
      const user = await db.user.findFirst({
        where: { email, isActive: true, role: { name: 'CLIENT' } },
        select: { id: true },
      });
      if (user && !prospect.userId)
        await db.prospect.update({
          where: { id: prospect.id },
          data: { userId: user.id },
        });
      const advisorId = Number(p.tracking?.utm_content);
      const advisor =
        Number.isSafeInteger(advisorId) && advisorId > 0
          ? await db.adminProfile.findFirst({
              where: {
                id: advisorId,
                isPublicAdvisor: true,
                user: { isActive: true },
              },
              select: { id: true },
            })
          : null;
      const data = {
        status,
        scheduledAt: start,
        endsAt: end,
        timezone:
          typeof invitee.timezone === 'string'
            ? invitee.timezone.slice(0, 64)
            : 'America/Lima',
        externalProvider: 'CALENDLY',
        externalEventUri: uri,
        ...(quote ? { quoteId: quote.id } : {}),
        ...(advisor ? { advisorProfileId: advisor.id } : {}),
      } as const;
      const meeting = existing
        ? await db.meeting.update({ where: { id: existing.id }, data })
        : await db.meeting.create({
            data: { ...data, prospectId: prospect.id },
          });
      await db.meetingEvent.create({
        data: {
          externalEventId: eventId,
          meetingId: meeting.id,
          status,
          occurredAt,
        },
      });
      if (status === 'SCHEDULED' && typeof invitee.old_invitee === 'string') {
        const old = await db.meeting.findFirst({
          where: {
            externalEventUri: invitee.old_invitee,
            prospectId: prospect.id,
          },
        });
        if (old) {
          await db.meeting.update({
            where: { id: old.id },
            data: { status: 'CANCELLED', bookingKey: null },
          });
          await db.kickoff.updateMany({
            where: { meetingId: old.id },
            data: { meetingId: meeting.id, heldAt: start },
          });
        }
      }
      await db.auditEvent.create({
        data: {
          action:
            'CALENDLY_' + (status === 'CANCELLED' ? 'CANCELLED' : 'SCHEDULED'),
          entityType: 'MEETING',
          entityId: String(meeting.id),
          metadata: {
            externalEventId: eventId,
            rescheduled: !!invitee.old_invitee,
          },
        },
      });
      return true;
    });
    return { fresh, payload };
  }
}

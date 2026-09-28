import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { MeetingStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  SCHEDULING_PROVIDER,
  type SchedulingProvider,
} from '../scheduling/scheduling-provider.interface';
import {
  BookMeetingDto,
  AvailabilityQuery,
  MeetingListQuery,
} from './meeting-persistence.dto';
@Injectable()
export class MeetingPersistenceService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(SCHEDULING_PROVIDER)
    private readonly scheduling: SchedulingProvider,
  ) {}
  private range(start: string, end: string, maximumDays: number) {
    const a = new Date(start),
      b = new Date(end);
    if (
      !Number.isFinite(a.getTime()) ||
      !Number.isFinite(b.getTime()) ||
      a >= b ||
      b.getTime() - a.getTime() > maximumDays * 86400000
    )
      throw new BadRequestException('Intervalo inválido.');
    return { a, b };
  }
  async availability(advisorId: number, query: AvailabilityQuery) {
    let fromStr = query.from;
    let toStr = query.to;

    if ((!fromStr || !toStr) && query.date) {
      const match = query.date.match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (match) {
        const [, y, m, d] = match;
        fromStr = `${y}-${m}-${d}T00:00:00.000Z`;
        toStr = `${y}-${m}-${d}T23:59:59.999Z`;
      } else {
        const parsed = new Date(query.date);
        if (!Number.isFinite(parsed.getTime())) {
          throw new BadRequestException('Fecha inválida.');
        }
        const start = new Date(parsed);
        start.setUTCHours(0, 0, 0, 0);
        const end = new Date(parsed);
        end.setUTCHours(23, 59, 59, 999);
        fromStr = start.toISOString();
        toStr = end.toISOString();
      }
    }

    if (!fromStr || !toStr) {
      throw new BadRequestException('Se requieren parámetros from y to, o date.');
    }

    const { a, b } = this.range(fromStr, toStr, 31);
    const advisor = await this.prisma.adminProfile.findFirst({
      where: { id: advisorId, isPublicAdvisor: true, user: { isActive: true } },
    });
    if (!advisor) throw new NotFoundException('Asesor no disponible');
    const [slots, booked] = await Promise.all([
      this.scheduling.getAvailability({
        advisorId: String(advisorId),
        from: a,
        to: b,
      }),
      this.prisma.meeting.findMany({
        where: {
          advisorProfileId: advisorId,
          status: { in: ['PENDING', 'SCHEDULED'] },
          scheduledAt: { lt: b },
          OR: [
            { endsAt: { gt: a } },
            {
              endsAt: null,
              scheduledAt: { gt: new Date(a.getTime() - 3600000) },
            },
          ],
        },
      }),
    ]);
    return slots.filter(
      (slot) =>
        slot.status === 'AVAILABLE' &&
        slot.start >= a &&
        slot.end <= b &&
        slot.start > new Date() &&
        !booked.some(
          (m) =>
            m.scheduledAt &&
            m.scheduledAt < slot.end &&
            (m.endsAt || new Date(m.scheduledAt.getTime() + 3600000)) >
              slot.start,
        ),
    );
  }
  async book(dto: BookMeetingDto) {
    const { a, b } = this.range(dto.start, dto.end, 1);
    if (a <= new Date())
      throw new BadRequestException('La reunión debe ser futura.');
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM AdminProfile WHERE id = ${dto.advisorId} FOR UPDATE`;
      const advisor = await tx.adminProfile.findFirst({
        where: {
          id: dto.advisorId,
          isPublicAdvisor: true,
          user: { isActive: true },
        },
      });
      if (!advisor) throw new NotFoundException('Asesor no disponible');
      const quote = await tx.quote.findFirst({
        where: {
          OR: [
            { publicCode: dto.quoteId.toUpperCase() },
            { legacyCode: dto.quoteId },
          ],
          contactEmail: dto.email.trim().toLowerCase(),
        },
      });
      if (!quote?.prospectId)
        throw new NotFoundException('Cotización y contacto no encontrados');
      const overlap = await tx.meeting.findFirst({
        where: {
          advisorProfileId: advisor.id,
          status: { in: ['PENDING', 'SCHEDULED'] },
          scheduledAt: { lt: b },
          OR: [
            { endsAt: { gt: a } },
            {
              endsAt: null,
              scheduledAt: { gte: new Date(a.getTime() - 3600000) },
            },
          ],
        },
      });
      if (overlap)
        throw new ConflictException(
          'El asesor ya tiene una reunión en ese intervalo.',
        );
      const meeting = await tx.meeting.create({
        data: {
          advisorProfileId: advisor.id,
          quoteId: quote.id,
          prospectId: quote.prospectId,
          scheduledAt: a,
          endsAt: b,
          bookingKey: `${advisor.id}:${a.toISOString()}`,
          status: 'PENDING',
          timezone: 'America/Lima',
        },
      });
      return {
        id: meeting.id,
        createdAt: meeting.createdAt,
        timezone: meeting.timezone,
        status: meeting.status,
        start: meeting.scheduledAt,
        end: meeting.endsAt,
        quoteId: quote.publicCode,
        advisorId: advisor.id,
      };
    });
  }
  async list(
    query: MeetingListQuery,
    actor?: { id: number; email: string; role: string },
  ) {
    const where = actor
      ? actor.role === 'CLIENT'
        ? { prospect: { userId: actor.id } }
        : { advisorProfile: { userId: actor.id } }
      : {};
    const [items, totalItems] = await this.prisma.$transaction([
      this.prisma.meeting.findMany({
        where,
        orderBy: [{ scheduledAt: 'desc' }, { id: 'desc' }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        include: {
          quote: { select: { publicCode: true } },
          prospect: { select: { name: true, email: true, phone: true } },
          advisorProfile: {
            select: { id: true, user: { select: { name: true } } },
          },
        },
      }),
      this.prisma.meeting.count({ where }),
    ]);
    return {
      items,
      meta: {
        page: query.page,
        limit: query.limit,
        totalItems,
        totalPages: Math.ceil(totalItems / query.limit),
      },
    };
  }
  async manageMeeting(
    id: number,
    actor: { id: number; role: string },
    change: { status: 'SCHEDULED' | 'COMPLETED' | 'CANCELLED' } | { start: string; end: string },
  ) {
    const scope = actor.role === 'SUPER_ADMIN' ? {} : { advisorProfile: { userId: actor.id } };
    return this.prisma.$transaction(async tx => {
      const initial = await tx.meeting.findFirst({ where: { id, ...scope } });
      if (!initial) throw new NotFoundException('Reunión no encontrada para tu cuenta.');
      if ('start' in change && initial.advisorProfileId) {
        await tx.$queryRaw`SELECT id FROM AdminProfile WHERE id = ${initial.advisorProfileId} FOR UPDATE`;
      }
      await tx.$queryRaw`SELECT id FROM Meeting WHERE id = ${id} FOR UPDATE`;
      const meeting = await tx.meeting.findFirst({ where: { id, ...scope } });
      if (!meeting) throw new NotFoundException('Reunión no encontrada.');
      if (meeting.externalProvider || meeting.externalEventUri) {
        throw new ConflictException('Gestiona esta reunión desde el proveedor externo.');
      }
      if ('status' in change) {
        const allowed: Record<MeetingStatus, MeetingStatus[]> = {
          PENDING: ['SCHEDULED', 'CANCELLED'], SCHEDULED: ['COMPLETED', 'CANCELLED'], COMPLETED: [], CANCELLED: [],
        };
        if (meeting.status !== change.status) {
          if (!allowed[meeting.status].includes(change.status)) throw new ConflictException('Transición de reunión inválida.');
          await tx.meeting.update({ where: { id }, data: { status: change.status, ...(change.status === 'CANCELLED' ? { bookingKey: null } : {}) } });
          await tx.meetingEvent.create({ data: { meetingId: id, externalEventId: 'manual:' + actor.id + ':' + randomUUID(), status: change.status, occurredAt: new Date() } });
        }
      } else {
        if (!['PENDING', 'SCHEDULED'].includes(meeting.status) || !meeting.advisorProfileId) throw new ConflictException('La reunión no puede reprogramarse.');
        const { a, b } = this.range(change.start, change.end, 1);
        if (a <= new Date()) throw new BadRequestException('La reunión debe ser futura.');
        const overlap = await tx.meeting.findFirst({ where: {
          id: { not: id }, advisorProfileId: meeting.advisorProfileId, status: { in: ['PENDING', 'SCHEDULED'] }, scheduledAt: { lt: b },
          OR: [{ endsAt: { gt: a } }, { endsAt: null, scheduledAt: { gt: new Date(a.getTime() - 3600000) } }],
        } });
        if (overlap) throw new ConflictException('El horario ya está reservado.');
        await tx.meeting.update({ where: { id }, data: { scheduledAt: a, endsAt: b, bookingKey: meeting.advisorProfileId + ':' + a.toISOString() } });
        await tx.auditEvent.create({ data: { actorId: actor.id, action: 'MEETING_RESCHEDULED', entityType: 'MEETING', entityId: String(id), metadata: { start: a.toISOString(), end: b.toISOString() } } });
      }
      return tx.meeting.findUniqueOrThrow({ where: { id }, include: { prospect: { select: { name: true, email: true, phone: true } }, quote: { select: { publicCode: true } }, advisorProfile: { select: { user: { select: { name: true } } } } } });
    });
  }
  // B calls this after authenticating Calendly events. No external provider implementation here.
  async recordExternalEvent(input: {
    externalEventId: string;
    meetingId: number;
    status: MeetingStatus;
    occurredAt: Date;
  }) {
    if (
      !input.externalEventId.trim() ||
      !Number.isFinite(input.occurredAt.getTime())
    )
      throw new BadRequestException('Evento inválido');
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM Meeting WHERE id = ${input.meetingId} FOR UPDATE`;
      const existing = await tx.meetingEvent.findUnique({
        where: { externalEventId: input.externalEventId },
      });
      if (existing) {
        if (
          existing.meetingId !== input.meetingId ||
          existing.status !== input.status ||
          existing.occurredAt.getTime() !== input.occurredAt.getTime()
        )
          throw new ConflictException('Evento reutilizado con otro contenido');
        return existing;
      }
      const meeting = await tx.meeting.findUnique({
        where: { id: input.meetingId },
        include: {
          externalEvents: { orderBy: { occurredAt: 'desc' }, take: 1 },
        },
      });
      if (!meeting) throw new NotFoundException('Reunión no encontrada');
      if (meeting.externalEvents[0]?.occurredAt > input.occurredAt)
        throw new ConflictException('Evento anterior al estado actual');
      const transitions: Record<MeetingStatus, MeetingStatus[]> = {
        PENDING: ['SCHEDULED', 'CANCELLED'],
        SCHEDULED: ['COMPLETED', 'CANCELLED'],
        COMPLETED: [],
        CANCELLED: [],
      };
      if (!transitions[meeting.status].includes(input.status))
        throw new ConflictException('Transición de reunión inválida');
      await tx.meeting.update({
        where: { id: meeting.id },
        data: {
          status: input.status,
          ...(input.status === 'CANCELLED' ? { bookingKey: null } : {}),
        },
      });
      return tx.meetingEvent.create({ data: input });
    });
  }
}

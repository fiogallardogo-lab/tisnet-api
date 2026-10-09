import { Optional } from '@nestjs/common';
import { CommercialMailService } from '../commercial/commercial-mail.service';
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { escapeHtml } from '../notifications/templates/escape-html';
import { MeetingStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  SCHEDULING_PROVIDER,
  type SchedulingProvider,
} from '../scheduling/scheduling-provider.interface';
import {
  WHATSAPP_NOTIFICATION_PROVIDER,
  type WhatsAppNotificationProvider,
} from '../notifications/whatsapp-notification-provider.interface';
import { CalendarUtils } from '../common/utils/calendar.utils';
import {
  BookMeetingDto,
  AvailabilityQuery,
  MeetingListQuery,
} from './meeting-persistence.dto';
@Injectable()
export class MeetingPersistenceService {
  private readonly logger = new Logger(MeetingPersistenceService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(SCHEDULING_PROVIDER)
    private readonly scheduling: SchedulingProvider,
    @Optional() private readonly mail?: CommercialMailService,
    @Optional()
    @Inject(WHATSAPP_NOTIFICATION_PROVIDER)
    private readonly whatsapp?: WhatsAppNotificationProvider,
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
      this.prisma.advisorAvailabilitySlot.findMany({
        where: { advisorProfileId: advisorId, start: { gte: a }, end: { lte: b } },
        orderBy: { start: 'asc' },
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
    const hasCustomSlots =
      (await this.prisma.advisorAvailabilitySlot.count({
        where: { advisorProfileId: advisorId },
      })) > 0;

    let candidateSlots: Array<{ id: number; start: Date; end: Date }> = slots;
    if (candidateSlots.length === 0 && !hasCustomSlots) {
      // Default business hours in Lima (UTC-5): 09:00, 10:00, 11:00, 15:00, 16:00, 17:00
      // In UTC hours: 14, 15, 16, 20, 21, 22
      const defaultHoursUtc = [14, 15, 16, 20, 21, 22];
      const generated: Array<{ id: number; start: Date; end: Date }> = [];
      const currentDay = new Date(a);
      currentDay.setUTCHours(0, 0, 0, 0);

      let genId = -1;
      while (currentDay <= b) {
        if (currentDay.getUTCDay() !== 0) {
          for (const hour of defaultHoursUtc) {
            const slotStart = new Date(currentDay);
            slotStart.setUTCHours(hour, 0, 0, 0);
            const slotEnd = new Date(currentDay);
            slotEnd.setUTCHours(hour + 1, 0, 0, 0);

            if (slotStart >= a && slotEnd <= b) {
              generated.push({ id: genId--, start: slotStart, end: slotEnd });
            }
          }
        }
        currentDay.setUTCDate(currentDay.getUTCDate() + 1);
      }
      candidateSlots = generated;
    }

    return candidateSlots
      .filter(
        (slot) =>
          slot.start >= a &&
          slot.end <= b &&
          slot.start > new Date() &&
          !booked.some((m) => {
            const mStart = m.scheduledAt ? m.scheduledAt.getTime() : 0;
            const mEnd = m.endsAt
              ? m.endsAt.getTime()
              : mStart + 3600000;
            return mStart < slot.end.getTime() && mEnd > slot.start.getTime();
          }),
      )
      .map((slot) => ({
        id: slot.id,
        start: slot.start,
        end: slot.end,
        label: new Intl.DateTimeFormat('es-PE', {
          timeZone: 'America/Lima',
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
        }).format(slot.start),
      }));
  }
  async ownAvailability(userId: number) {
    const advisor = await this.prisma.adminProfile.findUnique({ where: { userId } });
    if (!advisor) return [];
    return this.prisma.advisorAvailabilitySlot.findMany({
      where: { advisorProfileId: advisor.id, end: { gt: new Date() } },
      orderBy: { start: 'asc' },
    });
  }
  async replaceOwnAvailability(userId: number, input: Array<{ start: string; end: string }>) {
    const advisor = await this.prisma.adminProfile.upsert({
      where: { userId },
      update: { isPublicAdvisor: true },
      create: {
        userId,
        executiveTitle: 'Asesor comercial y técnico',
        specialty: 'Consultoría y soluciones digitales',
        isPublicAdvisor: true,
      },
    });
    const now = new Date();
    const rawSlots = input
      .map((slot) => ({ start: new Date(slot.start), end: new Date(slot.end) }))
      .filter((slot) => Number.isFinite(slot.start.getTime()) && Number.isFinite(slot.end.getTime()));
    const validRawSlots = rawSlots.filter((slot) => slot.end > slot.start);
    if (rawSlots.length > 0 && validRawSlots.length === 0) {
      throw new BadRequestException('La hora de fin debe ser posterior a la de inicio.');
    }
    // Expand each range into 1-hour slots so clients see individual booking hours
    const hourSlots: Array<{ start: Date; end: Date }> = [];
    for (const slot of validRawSlots) {
      let cursor = new Date(slot.start);
      while (cursor.getTime() < slot.end.getTime()) {
        const next = new Date(cursor.getTime() + 3600000);
        if (next > now) {
          hourSlots.push({ start: new Date(cursor), end: next });
        }
        cursor = next;
      }
    }
    const seen = new Set<string>();
    const uniqueSlots = hourSlots.filter((s) => {
      const key = s.start.toISOString();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }).sort((a, b) => a.start.getTime() - b.start.getTime());
    await this.prisma.$transaction(async (tx) => {
      await tx.advisorAvailabilitySlot.deleteMany({
        where: { advisorProfileId: advisor.id, end: { gt: now } },
      });
      await tx.advisorAvailabilitySlot.createMany({
        data: uniqueSlots.map((slot) => ({ ...slot, advisorProfileId: advisor.id })),
      });
      await tx.auditEvent.create({
        data: {
          actorId: userId,
          action: 'ADVISOR_AVAILABILITY_REPLACED',
          entityType: 'ADMIN_PROFILE',
          entityId: String(advisor.id),
          metadata: { slots: uniqueSlots.length },
        },
      });
    });
    return this.ownAvailability(userId);
  }
  async book(dto: BookMeetingDto) {
    const { a, b } = this.range(dto.start, dto.end, 1);
    if (a <= new Date())
      throw new BadRequestException('La reunión debe ser futura.');

    if (dto.notifyWhatsapp && (!dto.phone || !dto.phone.trim())) {
      throw new BadRequestException(
        'Debes ingresar un número de teléfono válido para recibir recordatorios por WhatsApp.',
      );
    }

    const result = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM AdminProfile WHERE id = ${dto.advisorId} FOR UPDATE`;
      const advisor = await tx.adminProfile.findFirst({
        where: {
          id: dto.advisorId,
          isPublicAdvisor: true,
          user: { isActive: true },
        },
        include: {
          user: { select: { id: true, name: true, email: true } },
        },
      });
      if (!advisor) throw new NotFoundException('Asesor no disponible');

      let quote: { id: number; publicCode: string; prospectId: number | null } | null = null;
      let prospectId = 0;

      if (dto.quoteId && dto.quoteId.trim()) {
        const foundQuote = await tx.quote.findFirst({
          where: {
            OR: [
              { publicCode: dto.quoteId.trim().toUpperCase() },
              { legacyCode: dto.quoteId.trim() },
            ],
            contactEmail: dto.email.trim().toLowerCase(),
          },
          select: { id: true, publicCode: true, prospectId: true },
        });
        if (foundQuote) {
          quote = foundQuote;
          if (foundQuote.prospectId) {
            prospectId = foundQuote.prospectId;
          }
        }
      }

      if (!prospectId) {
        let prospect = await tx.prospect.findUnique({
          where: { email: dto.email.trim().toLowerCase() },
        });
        if (!prospect) {
          prospect = await tx.prospect.create({
            data: {
              name: dto.name.trim(),
              email: dto.email.trim().toLowerCase(),
              phone: dto.phone?.trim() || null,
            },
          });
        }
        prospectId = prospect.id;
        if (quote && !quote.prospectId) {
          await tx.quote.update({
            where: { id: quote.id },
            data: { prospectId },
          });
        }
      }

      if (dto.phone?.trim()) {
        await tx.prospect.update({
          where: { id: prospectId },
          data: { phone: dto.phone.trim() },
        });
      }

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
          'El horario seleccionado ya no está disponible. Por favor elige otro horario.',
        );
      const meeting = await tx.meeting.create({
        data: {
          advisorProfileId: advisor.id,
          quoteId: quote?.id ?? null,
          prospectId: prospectId,
          scheduledAt: a,
          endsAt: b,
          bookingKey: `${advisor.id}:${a.toISOString()}`,
          status: 'PENDING',
          timezone: 'America/Lima',
          notes: dto.notifyWhatsapp ? 'CHANNEL:WHATSAPP' : 'CHANNEL:EMAIL',
        },
      });
      return {
        id: meeting.id,
        createdAt: meeting.createdAt,
        timezone: meeting.timezone,
        status: meeting.status,
        start: meeting.scheduledAt,
        end: meeting.endsAt,
        quoteId: quote?.publicCode ?? null,
        advisor: {
          id: advisor.id,
          name: advisor.user.name,
          email: advisor.user.email,
          title: advisor.executiveTitle,
          specialty: advisor.specialty,
        },
      };
    });

    const meetingUrl = `https://app.tisnet.pe/meetings/${result.id}`;
    const advisorName = result.advisor.name;
    const advisorEmail = result.advisor.email;

    const calendarLinks = CalendarUtils.generateLinks({
      title: result.quoteId
        ? `Sesión de Asesoría TISNET (${result.quoteId})`
        : `Sesión de Asesoría TISNET`,
      description: result.quoteId
        ? `Reunión de alineación de cotización y alcance con tu asesor ${advisorName}.\nVideollamada: ${meetingUrl}`
        : `Reunión de asesoría técnica y comercial con tu asesor ${advisorName}.\nVideollamada: ${meetingUrl}`,
      location: meetingUrl,
      startTime: result.start!,
      endTime: result.end!,
      organizerName: advisorName,
      organizerEmail: advisorEmail,
      attendeeName: dto.name.trim(),
      attendeeEmail: dto.email.trim(),
      url: meetingUrl,
    });

    await this.mail?.meeting(result.id);

    if (dto.notifyWhatsapp && dto.phone?.trim()) {
      try {
        const formattedDate = new Date(result.start!).toLocaleString('es-PE', {
          dateStyle: 'full',
          timeStyle: 'short',
          timeZone: 'America/Lima',
        });
        const quoteText = result.quoteId ? ` para revisar tu cotización *${result.quoteId}*` : '';
        const waText =
          `¡Hola ${dto.name.trim()}! 🚀\n\n` +
          `Tu sesión de asesoría comercial y técnica con *${advisorName}*${quoteText} ha sido agendada con éxito.\n\n` +
          `📅 *Fecha y hora:* ${formattedDate}\n` +
          `📍 *Enlace de la reunión:* ${meetingUrl}\n\n` +
          `*Importante:* Te enviaremos un recordatorio con el enlace directo 15 minutos antes de la llamada por este medio. También enviamos la invitación a tu correo *${dto.email.trim()}*.\n\n` +
          `_Equipo TISNET Soluciones Digitales_`;

        await this.whatsapp?.send({
          recipientPhone: dto.phone.trim(),
          message: waText,
        });
      } catch {
        // WhatsApp notification failure is non-blocking
      }
    }

    return {
      id: result.id,
      createdAt: result.createdAt,
      timezone: result.timezone,
      status: result.status,
      start: result.start,
      end: result.end,
      quoteId: result.quoteId ?? undefined,
      advisorId: result.advisor.id,
      advisor: {
        id: result.advisor.id,
        name: result.advisor.name,
        title: result.advisor.title,
        specialty: result.advisor.specialty,
      },
      meetingUrl,
      calendarLinks: {
        googleCalendarUrl: calendarLinks.googleCalendarUrl,
        outlookUrl: calendarLinks.outlookUrl,
        office365Url: calendarLinks.office365Url,
      },
      notifications: {
        email: dto.email.trim(),
        whatsapp:
          dto.notifyWhatsapp && dto.phone?.trim() ? dto.phone.trim() : null,
      },
      message: 'Reunión agendada con éxito.',
    };
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
      items: items.map((m) => ({
        ...m,
        meetingUrl:
          m.externalEventUri ||
          (m.status === 'SCHEDULED'
            ? `https://app.tisnet.pe/meetings/${m.id}`
            : undefined),
        channel: m.notes?.includes('CHANNEL:EMAIL') ? 'EMAIL' : 'WHATSAPP',
      })),
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
    change:
      | { status: 'SCHEDULED' | 'COMPLETED' | 'CANCELLED' }
      | { start: string; end: string },
  ) {
    const scope =
      actor.role === 'SUPER_ADMIN'
        ? {}
        : { advisorProfile: { userId: actor.id } };

    const initial = await this.prisma.meeting.findFirst({
      where: { id, ...scope },
      include: {
        prospect: { select: { name: true, email: true, phone: true } },
        quote: { select: { publicCode: true } },
        advisorProfile: { select: { user: { select: { name: true } } } },
      },
    });
    if (!initial)
      throw new NotFoundException('Reunión no encontrada para tu cuenta.');

    if (initial.externalProvider === 'CALENDLY') {
      throw new ConflictException(
        'Gestiona esta reunión desde el proveedor externo.',
      );
    }

    let generatedMeetingUrl: string | null = initial.externalEventUri;
    let scheduledMeetingId: string | null = null;
    if (
      'status' in change &&
      change.status === 'SCHEDULED' &&
      !initial.externalEventUri &&
      initial.scheduledAt
    ) {
      try {
        const scheduled = await this.scheduling.createMeeting({
          advisorId: String(initial.advisorProfileId || actor.id),
          attendeeName: initial.prospect?.name || 'Cliente TISNET',
          attendeeEmail: initial.prospect?.email || '',
          start: initial.scheduledAt,
          end:
            initial.endsAt ||
            new Date(initial.scheduledAt.getTime() + 3600000),
          quoteId: initial.quote?.publicCode,
        });
        if (scheduled?.meetingUrl) {
          generatedMeetingUrl = scheduled.meetingUrl;
        }
        if (scheduled?.meetingId) {
          scheduledMeetingId = scheduled.meetingId;
        }
      } catch (err: any) {
        this.logger.warn(
          `[MeetingPersistence] Error creating meeting in scheduling provider: ${err?.message}`,
        );
        generatedMeetingUrl = `https://app.tisnet.pe/meetings/${id}`;
      }
    }

    const result = await this.prisma.$transaction(async (tx) => {
      if ('start' in change && initial.advisorProfileId) {
        await tx.$queryRaw`SELECT id FROM AdminProfile WHERE id = ${initial.advisorProfileId} FOR UPDATE`;
      }
      await tx.$queryRaw`SELECT id FROM Meeting WHERE id = ${id} FOR UPDATE`;
      const meeting = await tx.meeting.findFirst({ where: { id, ...scope } });
      if (!meeting) throw new NotFoundException('Reunión no encontrada.');
      if ('status' in change) {
        const allowed: Record<MeetingStatus, MeetingStatus[]> = {
          PENDING: ['SCHEDULED', 'CANCELLED'],
          SCHEDULED: ['COMPLETED', 'CANCELLED'],
          COMPLETED: [],
          CANCELLED: [],
        };
        if (meeting.status !== change.status) {
          if (!allowed[meeting.status].includes(change.status))
            throw new ConflictException('Transición de reunión inválida.');
          await tx.meeting.update({
            where: { id },
            data: {
              status: change.status,
              ...(generatedMeetingUrl
                ? {
                    externalEventUri: generatedMeetingUrl,
                    externalProvider: 'GOOGLE',
                  }
                : {}),
              ...(change.status === 'CANCELLED' ? { bookingKey: null } : {}),
            },
          });
          await tx.meetingEvent.create({
            data: {
              meetingId: id,
              externalEventId: scheduledMeetingId
                ? `google:${scheduledMeetingId}`
                : 'manual:' + actor.id + ':' + randomUUID(),
              status: change.status,
              occurredAt: new Date(),
            },
          });
        }
      } else {
        if (
          !['PENDING', 'SCHEDULED'].includes(meeting.status) ||
          !meeting.advisorProfileId
        )
          throw new ConflictException('La reunión no puede reprogramarse.');
        const { a, b } = this.range(change.start, change.end, 1);
        if (a <= new Date())
          throw new BadRequestException('La reunión debe ser futura.');
        const overlap = await tx.meeting.findFirst({
          where: {
            id: { not: id },
            advisorProfileId: meeting.advisorProfileId,
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
        });
        if (overlap)
          throw new ConflictException('El horario ya está reservado.');
        await tx.meeting.update({
          where: { id },
          data: {
            scheduledAt: a,
            endsAt: b,
            bookingKey: meeting.advisorProfileId + ':' + a.toISOString(),
          },
        });
        await tx.auditEvent.create({
          data: {
            actorId: actor.id,
            action: 'MEETING_RESCHEDULED',
            entityType: 'MEETING',
            entityId: String(id),
            metadata: { start: a.toISOString(), end: b.toISOString() },
          },
        });
      }
      return tx.meeting.findUniqueOrThrow({
        where: { id },
        include: {
          prospect: { select: { name: true, email: true, phone: true } },
          quote: { select: { publicCode: true } },
          advisorProfile: { select: { user: { select: { name: true } } } },
        },
      });
    });
    await this.mail?.meeting(id);

    const meetingUrl =
      result.externalEventUri || `https://app.tisnet.pe/meetings/${result.id}`;

    const notifyViaWhatsapp =
      initial.notes !== 'CHANNEL:EMAIL' && Boolean(result.prospect?.phone);

    if (
      'status' in change &&
      change.status === 'SCHEDULED' &&
      notifyViaWhatsapp &&
      result.prospect?.phone
    ) {
      try {
        const formattedDate = result.scheduledAt
          ? new Date(result.scheduledAt).toLocaleString('es-PE', {
              dateStyle: 'full',
              timeStyle: 'short',
              timeZone: result.timezone || 'America/Lima',
            })
          : 'fecha programada';
        const advisorName = result.advisorProfile?.user?.name || 'tu asesor';
        const quoteInfo = result.quote?.publicCode
          ? ` (${result.quote.publicCode})`
          : '';

        await this.whatsapp?.send({
          recipientPhone: result.prospect.phone,
          message:
            `¡Hola ${result.prospect.name || 'estimado cliente'}! 🎉\n\n` +
            `Tu reunión de asesoría con *${advisorName}*${quoteInfo} ha sido *CONFIRMADA*.\n\n` +
            `📅 *Fecha y hora:* ${formattedDate}\n` +
            `🔗 *Enlace de la videollamada:* ${meetingUrl}\n\n` +
            `También enviamos los detalles a tu correo. Te recordaremos 15 minutos antes por este medio.\n\n` +
            `_Equipo TISNET Soluciones Digitales_`,
        });
      } catch {
        // Non-blocking
      }
    }

    return {
      ...result,
      meetingUrl,
      channel: result.notes?.includes('CHANNEL:EMAIL') ? 'EMAIL' : 'WHATSAPP',
    };
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

  async notifyMeetingLink(
    id: number,
    actor: { id: number; role: string },
    customMessage?: string,
  ) {
    const scope =
      actor.role === 'SUPER_ADMIN'
        ? {}
        : { advisorProfile: { userId: actor.id } };

    const meeting = await this.prisma.meeting.findFirst({
      where: { id, ...scope },
      include: {
        prospect: true,
        advisorProfile: { include: { user: true } },
        externalEvents: true,
      },
    });

    if (!meeting) {
      throw new NotFoundException('Reunión no encontrada para tu cuenta.');
    }

    const recipient = meeting.prospect?.email;
    if (!recipient) {
      throw new BadRequestException('El cliente no tiene un correo registrado.');
    }

    const advisorName = meeting.advisorProfile?.user?.name || 'Tu asesor de TISNET';
    const clientName = meeting.prospect?.name || 'Estimado cliente';
    const dateStr = meeting.scheduledAt
      ? new Date(meeting.scheduledAt).toLocaleString('es-PE', {
          dateStyle: 'full',
          timeStyle: 'short',
          timeZone: meeting.timezone || 'America/Lima',
        })
      : 'por definir';

    const meetingUrl =
      meeting.externalEventUri || `https://app.tisnet.pe/meetings/${meeting.id}`;

    const text =
      `Hola ${clientName},\n\n` +
      `Te enviamos el enlace de acceso directo para tu reunión de asesoría con ${advisorName} programada para el ${dateStr}.\n\n` +
      `Enlace de la videollamada: ${meetingUrl}\n\n` +
      (customMessage ? `Mensaje adicional de tu asesor:\n${customMessage}\n\n` : '') +
      `Si tienes alguna pregunta previa, puedes responder a este correo.\n\n` +
      `Equipo TISNET`;

    const html =
      `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #1e293b;">` +
      `<p>Hola <strong>${escapeHtml(clientName)}</strong>,</p>` +
      `<p>Aquí tienes el enlace de acceso directo para tu reunión de asesoría con <strong>${escapeHtml(advisorName)}</strong> programada para el <strong>${escapeHtml(dateStr)}</strong>.</p>` +
      `<div style="background:#eff6ff;border-left:4px solid #2563eb;padding:16px 20px;margin:20px 0;border-radius:6px;text-align:center;">` +
      `<p style="margin:0 0 12px 0;font-weight:600;color:#1e40af;font-size:15px;">Tu reunión está lista para comenzar</p>` +
      `<a href="${escapeHtml(meetingUrl)}" style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:6px;font-weight:600;font-size:15px;">Unirme a la Videollamada Ahora</a>` +
      `<p style="margin:12px 0 0 0;color:#64748b;font-size:12px;">Enlace: <a href="${escapeHtml(meetingUrl)}" style="color:#2563eb;">${escapeHtml(meetingUrl)}</a></p>` +
      `</div>` +
      (customMessage ? `<p><strong>Mensaje de tu asesor:</strong><br>${escapeHtml(customMessage).replace(/\n/g, '<br>')}</p>` : '') +
      `<p>Si tienes alguna consulta previa, puedes responder a este correo.</p>` +
      `<p>Atentamente,<br><strong>Equipo TISNET</strong></p>` +
      `</div>`;

    const deliveryResult = await this.mail?.send(
      {
        recipient,
        subject: `TISNET · Enlace de tu reunión con ${advisorName}`,
        text,
        html,
      },
      'MEETING_LINK_NOTICE',
      id,
    );

    let googleNotified = false;
    const googleEvent = meeting.externalEvents?.find((e) =>
      e.externalEventId?.startsWith('google:'),
    );
    const googleEventId = googleEvent
      ? googleEvent.externalEventId.replace('google:', '')
      : undefined;

    if (
      typeof (this.scheduling as any)?.sendMeetingNotification === 'function'
    ) {
      try {
        googleNotified = await (this.scheduling as any).sendMeetingNotification(
          {
            eventId: googleEventId,
            meetingUrl: meeting.externalEventUri || undefined,
            attendeeEmail: recipient,
          },
          customMessage,
        );
      } catch (err: any) {
        this.logger.warn(
          `[MeetingPersistence] Google Calendar notification warning: ${err?.message}`,
        );
      }
    }

    let whatsappSent = false;
    if (meeting.prospect?.phone) {
      try {
        const waText =
          `¡Hola ${clientName}! 🔔\n\n` +
          `Aquí tienes el enlace para conectarte a tu sesión de asesoría con *${advisorName}*:\n\n` +
          `🔗 *Ingresar a la videollamada:* ${meetingUrl}\n\n` +
          (customMessage ? `Mensaje de tu asesor: "${customMessage}"\n\n` : '') +
          `¡Te esperamos en sala!\n_Equipo TISNET_`;

        await this.whatsapp?.send({
          recipientPhone: meeting.prospect.phone,
          message: waText,
        });
        whatsappSent = true;
      } catch {
        // Safe catch
      }
    }

    await this.prisma.meetingEvent.create({
      data: {
        meetingId: id,
        externalEventId: 'link_notice:' + actor.id + ':' + randomUUID(),
        status: meeting.status,
        occurredAt: new Date(),
      },
    });

    let message = 'Aviso con enlace enviado al cliente por correo';
    if (googleNotified) {
      message = 'Invitación con enlace despachada al correo del cliente mediante Google Calendar';
    } else if (this.mail?.isRealDeliveryConfigured() && deliveryResult?.delivery === 'SENT') {
      message = 'Aviso con enlace enviado al correo del cliente correctamente';
    } else if (!this.mail?.isRealDeliveryConfigured()) {
      message = 'Aviso procesado en modo local. Para entrega SMTP directa a bandejas externas, configure NOTIFICATION_PROVIDER=smtp en .env';
    }

    if (whatsappSent) {
      message += ' y WhatsApp.';
    } else {
      message += '.';
    }

    return {
      success: true,
      message,
      delivery: deliveryResult?.delivery || (googleNotified ? 'SENT' : 'SIMULATED'),
      googleNotified,
      whatsappSent,
      meetingUrl,
    };
  }
}
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
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
    const { a, b } = this.range(query.from, query.to, 31);
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

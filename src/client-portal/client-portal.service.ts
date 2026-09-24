import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ClientPortalService {
  constructor(private readonly prisma: PrismaService) {}

  async overview(actor: { id: number; email: string }) {
    const [user, projects, quotes, publicQuotes, meetings] = await Promise.all([
      this.prisma.user.findUniqueOrThrow({
        where: { id: actor.id },
        select: { name: true, email: true },
      }),
      this.prisma.project.findMany({
        where: {
          members: { some: { userId: actor.id, memberRole: 'CLIENT', isActive: true } },
          status: { not: 'ARCHIVED' },
        },
        select: {
          id: true,
          name: true,
          shortDescription: true,
          description: true,
          status: true,
          developmentDate: true,
          createdAt: true,
          members: {
            where: { isActive: true, memberRole: { not: 'CLIENT' } },
            select: { id: true },
          },
          deliverables: {
            orderBy: { milestoneOrder: 'asc' },
            select: {
              id: true,
              title: true,
              dueDate: true,
              status: true,
              updatedAt: true,
              submittedAt: true,
            },
          },
        },
        orderBy: { updatedAt: 'desc' },
      }),
      this.prisma.quote.findMany({
        where: { prospect: { userId: actor.id } },
        select: {
          id: true,
          publicCode: true,
          solutionType: true,
          status: true,
          amountMinor: true,
          currency: true,
          notes: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
      // The current public intake stores receipts separately from linked legacy quotes.
      // Match only the authenticated account's email; never accept an email from query parameters.
      this.prisma.publicQuote.findMany({
        where: { contact: { path: '$.email', equals: actor.email.trim().toLowerCase() } },
        select: {
          id: true,
          code: true,
          solutionType: true,
          amountMinor: true,
          currency: true,
          notes: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.meeting.findMany({
        where: { prospect: { userId: actor.id } },
        select: {
          id: true,
          status: true,
          scheduledAt: true,
          timezone: true,
          notes: true,
          createdAt: true,
          updatedAt: true,
          advisorProfile: {
            select: {
              id: true,
              executiveTitle: true,
              specialty: true,
              photoUrl: true,
              calendlyUrl: true,
              user: { select: { name: true, email: true, isActive: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
    ]);
    const ownProjects = projects.map((project) => {
      const total = project.deliverables.length;
      const approved = project.deliverables.filter((item) => item.status === 'APPROVED').length;
      const dates = project.deliverables.map((item) => item.dueDate.getTime());
      return {
        id: project.id,
        name: project.name,
        summary: project.shortDescription,
        description: project.description,
        status: project.status,
        progress: total ? Math.round((approved / total) * 100) : null,
        startedAt: project.developmentDate?.toISOString().slice(0, 10) ?? null,
        estimatedDeliveryAt: dates.length
          ? new Date(Math.max(...dates)).toISOString().slice(0, 10)
          : null,
        teamSize: project.members.length,
        totalDeliverables: total,
        pendingDeliverables: total - approved,
        milestones: project.deliverables.map((item) => ({
          id: item.id,
          title: item.title,
          status: item.status,
          date: item.dueDate.toISOString().slice(0, 10),
        })),
      };
    });
    const ownQuotes = [
      ...quotes.map((quote) => ({
        ...quote,
        id: `quote-${quote.id}`,
        code: quote.publicCode,
        amountMinor: quote.amountMinor?.toString() ?? null,
      })),
      ...publicQuotes.map((quote) => ({
        ...quote,
        id: `public-${quote.id}`,
        status: 'RECEIVED',
        amountMinor: quote.amountMinor?.toString() ?? null,
      })),
    ].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    const advisorProfile = meetings.find(
      (meeting) => meeting.status !== 'CANCELED' && meeting.advisorProfile?.user.isActive
    )?.advisorProfile;
    const advisor = advisorProfile
      ? {
          id: advisorProfile.id,
          name: advisorProfile.user.name,
          email: advisorProfile.user.email,
          executiveTitle: advisorProfile.executiveTitle || 'Asesor de proyectos',
          specialty: advisorProfile.specialty,
          photoUrl: advisorProfile.photoUrl,
          calendlyUrl: advisorProfile.calendlyUrl,
        }
      : null;
    const ownMeetings = meetings.map(({ advisorProfile: profile, ...meeting }) => ({
      ...meeting,
      advisorName: profile?.user.isActive ? profile.user.name : null,
    }));
    const activity = [
      ...ownQuotes.map((quote) => ({
        id: quote.id,
        kind: 'quote',
        title: 'Cotización recibida',
        description: `Tu cotización #${quote.code} fue recibida.`,
        date: quote.createdAt,
        to: '/client/quotes',
      })),
      ...ownMeetings.map((meeting) => ({
        id: `meeting-${meeting.id}`,
        kind: 'meeting',
        title:
          meeting.status === 'CANCELED'
            ? 'Reunión cancelada'
            : meeting.status === 'CONFIRMED'
              ? 'Reunión confirmada'
              : meeting.status === 'COMPLETED'
                ? 'Reunión completada'
                : 'Reunión solicitada',
        description: meeting.advisorName
          ? `Asesor: ${meeting.advisorName}`
          : 'Consulta el detalle de tu reunión.',
        date: meeting.updatedAt,
        to: '/client/meetings',
      })),
      ...projects.flatMap((project) =>
        project.deliverables
          .filter((item) => item.submittedAt)
          .map((item) => ({
            id: `deliverable-${item.id}`,
            kind: 'deliverable',
            title:
              item.status === 'APPROVED'
                ? 'Entregable aprobado'
                : item.status === 'OBSERVED'
                  ? 'Entregable observado'
                  : 'Entregable cargado',
            description: `${item.title} · ${project.name}`,
            date: item.updatedAt,
            to: `/client/deliverables?project=${project.id}`,
          }))
      ),
    ]
      .sort((a, b) => b.date.getTime() - a.date.getTime())
      .slice(0, 30);
    return {
      user,
      projects: ownProjects,
      quotes: ownQuotes,
      meetings: ownMeetings,
      advisor,
      activity,
    };
  }

  async requestMeeting(
    actor: { id: number; email: string },
    input: { advisorId: number; scheduledAt: string; notes?: string }
  ) {
    const scheduledAt = new Date(input.scheduledAt);
    if (!Number.isFinite(scheduledAt.getTime()) || scheduledAt <= new Date())
      throw new BadRequestException('Elige una fecha futura.');
    const advisor = await this.prisma.adminProfile.findFirst({
      where: { id: input.advisorId, isPublicAdvisor: true, user: { isActive: true } },
      select: { id: true },
    });
    if (!advisor) throw new NotFoundException('El asesor ya no está disponible.');
    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.findUniqueOrThrow({
        where: { id: actor.id },
        select: { name: true },
      });
      let prospect = await tx.prospect.findFirst({
        where: { OR: [{ userId: actor.id }, { email: actor.email.trim().toLowerCase() }] },
      });
      if (prospect?.userId && prospect.userId !== actor.id)
        throw new ConflictException('El contacto está vinculado a otra cuenta.');
      prospect = prospect
        ? await tx.prospect.update({ where: { id: prospect.id }, data: { userId: actor.id } })
        : await tx.prospect.create({
            data: {
              userId: actor.id,
              name: user.name,
              email: actor.email.trim().toLowerCase(),
              source: 'MEETING',
            },
          });
      const duplicate = await tx.meeting.findFirst({
        where: {
          prospectId: prospect.id,
          advisorProfileId: advisor.id,
          scheduledAt,
          status: { in: ['REQUESTED', 'CONFIRMED'] },
        },
      });
      if (duplicate)
        throw new ConflictException('Ya tienes una solicitud para ese asesor y horario.');
      // This is a request for the advisor, not a fabricated calendar confirmation.
      return tx.meeting.create({
        data: {
          prospectId: prospect.id,
          advisorProfileId: advisor.id,
          scheduledAt,
          notes: input.notes?.trim() || null,
          timezone: 'America/Lima',
          status: 'REQUESTED',
        },
        select: { id: true, status: true, scheduledAt: true },
      });
    });
  }

  async cancelMeeting(userId: number, id: number) {
    const result = await this.prisma.meeting.updateMany({
      where: { id, prospect: { userId }, status: { in: ['REQUESTED', 'CONFIRMED'] } },
      data: { status: 'CANCELED' },
    });
    if (!result.count)
      throw new NotFoundException('No se encontró una reunión activa de tu cuenta.');
    return { id, status: 'CANCELED' };
  }
}

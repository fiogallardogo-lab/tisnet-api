import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectEnablementService } from '../projects/project-enablement.service';
import { CommercialMailService } from '../commercial/commercial-mail.service';
import {
  WHATSAPP_NOTIFICATION_PROVIDER,
  type WhatsAppNotificationProvider,
} from '../notifications/whatsapp-notification-provider.interface';

@Injectable()
export class ClientPortalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly enablement: ProjectEnablementService,
    @Optional() private readonly mail?: CommercialMailService,
    @Optional()
    @Inject(WHATSAPP_NOTIFICATION_PROVIDER)
    private readonly whatsapp?: WhatsAppNotificationProvider,
  ) {}

  async overview(actor: { id: number; email: string }) {
    try {
      await this.reconcileConfirmedAdvances(actor.id);
    } catch {
      // Keep the portal available if project repair is temporarily blocked.
    }
    const [user, projects, quotes, meetings] = await Promise.all([
      this.prisma.user.findUniqueOrThrow({
        where: { id: actor.id },
        select: { name: true, email: true },
      }),
      this.prisma.project.findMany({
        where: {
          OR: [
            { clientUserId: actor.id },
            {
              members: {
                some: {
                  userId: actor.id,
                  memberRole: 'CLIENT',
                  isActive: true,
                },
              },
            },
          ],
          status: { not: 'ARCHIVED' },
        },
        select: {
          id: true,
          name: true,
          shortDescription: true,
          description: true,
          status: true,
          quote: {
            select: {
              activeVersion: true,
              versions: {
                select: {
                  version: true,
                  acceptedAt: true,
                  author: {
                    select: {
                      name: true,
                      adminProfile: { select: { id: true } },
                    },
                  },
                  schedules: {
                    orderBy: { sequence: 'asc' },
                    select: {
                      sequence: true,
                      milestone: true,
                      amountMinor: true,
                      dueDate: true,
                      payments: {
                        where: { status: 'CONFIRMED' },
                        select: { id: true },
                      },
                      manualPaymentSubmissions: {
                        orderBy: { createdAt: 'desc' },
                        take: 1,
                        select: { status: true },
                      },
                    },
                  },
                },
              },
            },
          },
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
              clientReviewStatus: true,
              updatedAt: true,
              submittedAt: true,
            },
          },
        },
        orderBy: { updatedAt: 'desc' },
      }),
      this.prisma.quote.findMany({
        where: {
          OR: [
            { prospect: { userId: actor.id } },
            { contactEmail: actor.email.trim().toLowerCase() },
          ],
        },
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
    const ownProjects = await Promise.all(
      projects.map(async (project) => {
        const quoteVersion = project.quote?.versions.find(
          (item) => item.version === project.quote?.activeVersion,
        );
        const kickoffAdvisor = quoteVersion?.author.adminProfile
          ? { id: quoteVersion.author.adminProfile.id, name: quoteVersion.author.name }
          : null;
        const total = project.deliverables.length;
        const approved = project.deliverables.filter(
          (item) =>
            item.status === 'APPROVED' && item.clientReviewStatus === 'APPROVED',
        ).length;
        const dates = project.deliverables.map((item) =>
          item.dueDate.getTime(),
        );
        // S14-B03: project is locked until the advance payment is confirmed
        const locked = await this.enablement.isProjectLocked(project.id);
        return {
          id: project.id,
          name: project.name,
          summary: project.shortDescription,
          description: project.description,
          status: project.status,
          kickoffAdvisor,
          locked,
          progress: total ? Math.round((approved / total) * 100) : null,
          startedAt:
            project.developmentDate?.toISOString().slice(0, 10) ?? null,
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
            clientReviewStatus: item.clientReviewStatus,
            date: item.dueDate.toISOString().slice(0, 10),
          })),
        };
      }),
    );
    const ownQuotes = quotes
      .map((quote) => ({
        ...quote,
        id: `quote-${quote.id}`,
        code: quote.publicCode,
        amountMinor: quote.amountMinor?.toString() ?? null,
      }))
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    const advisorProfile = meetings.find(
      (meeting) =>
        meeting.status !== 'CANCELLED' && meeting.advisorProfile?.user.isActive,
    )?.advisorProfile;
    const advisor = advisorProfile
      ? {
          id: advisorProfile.id,
          name: advisorProfile.user.name,
          email: advisorProfile.user.email,
          executiveTitle:
            advisorProfile.executiveTitle || 'Asesor de proyectos',
          specialty: advisorProfile.specialty,
          photoUrl: advisorProfile.photoUrl,
          calendlyUrl: advisorProfile.calendlyUrl,
        }
      : null;
    const ownMeetings = meetings.map(
      ({ advisorProfile: profile, ...meeting }) => ({
        ...meeting,
        advisorName: profile?.user.isActive ? profile.user.name : null,
      }),
    );
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
          meeting.status === 'CANCELLED'
            ? 'Reunión cancelada'
            : meeting.status === 'SCHEDULED'
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
              (item.status === 'APPROVED' && item.clientReviewStatus === 'PENDING') ||
              (item.status === 'OBSERVED' && item.clientReviewStatus === 'OBSERVED')
                ? 'Tu aprobación del entregable está pendiente'
                : item.status === 'APPROVED'
                  ? 'Entregable aprobado'
                : item.status === 'OBSERVED'
                  ? 'Entregable observado'
                  : 'Entrega recibida por el Product Owner',
            description:
              (item.status === 'APPROVED' && item.clientReviewStatus === 'PENDING') ||
              (item.status === 'OBSERVED' && item.clientReviewStatus === 'OBSERVED')
                ? `${item.title} · ${project.name}. Revisa y envía tu aprobación o tus observaciones.`
                : `${item.title} · ${project.name}`,
            date: item.updatedAt,
            to: `/client/deliverables?project=${project.id}`,
          })),
      ),
      ...projects.flatMap((project) => {
        const activeVersion = project.quote?.versions.find(
          (version) => version.version === project.quote?.activeVersion,
        );
        if (!activeVersion?.acceptedAt) return [];
        const schedules = activeVersion.schedules;
        const pending = schedules.find(
          (schedule) =>
            schedule.sequence > 1 &&
            schedule.payments.length === 0 &&
            schedules
              .filter((prior) => prior.sequence < schedule.sequence)
              .every((prior) => prior.payments.length > 0),
        );
        if (!pending) return [];
        return [{
          id: `payment-required-${project.id}-${pending.sequence}`,
          kind: 'payment',
          title: pending.manualPaymentSubmissions[0]?.status === 'SUBMITTED'
            ? `Comprobante en revisión · Hito ${pending.sequence}`
            : `Pago pendiente para continuar · Hito ${pending.sequence}`,
          description: pending.manualPaymentSubmissions[0]?.status === 'SUBMITTED'
            ? `Tu comprobante de ${pending.milestone} está en revisión. La construcción continuará cuando el pago sea confirmado.`
            : `Realiza el abono de ${pending.milestone} para continuar con la construcción del proyecto ${project.name}.`,
          date: new Date(),
          to: '/client/quotes/payments',
        }];
      }),
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

  /**
   * Re-run the idempotent project transition for confirmed first installments.
   * Besides covering normal payment events, this repairs projects that were
   * already present but lacked the CLIENT membership required by this portal.
   */
  private async reconcileConfirmedAdvances(clientUserId: number) {
    const payments = await this.prisma.payment.findMany({
      where: {
        status: 'CONFIRMED',
        schedule: {
          sequence: 1,
          quoteVersion: { quote: { prospect: { userId: clientUserId } } },
        },
      },
      select: { id: true, scheduleId: true },
      orderBy: { createdAt: 'asc' },
    });

    for (const payment of payments) {
      try {
        await this.enablement.enableFromPayment({
          scheduleId: payment.scheduleId,
          paymentId: payment.id,
        });
      } catch {
        // A failed reconciliation must not hide the rest of the client's panel.
        // ProjectEnablementService records the failure; subsequent overview loads retry.
      }
    }
  }

  async requestMeeting(
    actor: { id: number; email: string },
    input: {
      advisorId: number;
      scheduledAt: string;
      endsAt?: string;
      notes?: string;
      notifyWhatsapp?: boolean;
      phone?: string;
    },
  ) {
    const scheduledAt = new Date(input.scheduledAt);
    const endsAt = input.endsAt
      ? new Date(input.endsAt)
      : new Date(scheduledAt.getTime() + 3600000);
    if (!Number.isFinite(scheduledAt.getTime()) || scheduledAt <= new Date())
      throw new BadRequestException('Elige una fecha futura.');
    if (!Number.isFinite(endsAt.getTime()) || endsAt <= scheduledAt)
      throw new BadRequestException('El horario seleccionado no es válido.');
    const advisor = await this.prisma.adminProfile.findFirst({
      where: {
        id: input.advisorId,
        isPublicAdvisor: true,
        user: { isActive: true },
      },
      select: {
        id: true,
        executiveTitle: true,
        specialty: true,
        user: { select: { id: true, name: true, email: true } },
      },
    });
    if (!advisor)
      throw new NotFoundException('El asesor ya no está disponible.');
    const meeting = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM AdminProfile WHERE id = ${advisor.id} FOR UPDATE`;
      const availableSlot = await tx.advisorAvailabilitySlot?.findFirst({
        where: {
          advisorProfileId: advisor.id,
          start: scheduledAt,
          end: endsAt,
        },
      });
      if (tx.advisorAvailabilitySlot && !availableSlot)
        throw new ConflictException(
          'El horario seleccionado ya no está disponible.',
        );
      const user = await tx.user.findUniqueOrThrow({
        where: { id: actor.id },
        select: { name: true },
      });
      let prospect = await tx.prospect.findFirst({
        where: {
          OR: [
            { userId: actor.id },
            { email: actor.email.trim().toLowerCase() },
          ],
        },
      });
      if (prospect?.userId && prospect.userId !== actor.id)
        throw new ConflictException(
          'El contacto está vinculado a otra cuenta.',
        );
      prospect = prospect
        ? await tx.prospect.update({
            where: { id: prospect.id },
            data: {
              userId: actor.id,
              ...(input.phone?.trim() ? { phone: input.phone.trim() } : {}),
            },
          })
        : await tx.prospect.create({
            data: {
              userId: actor.id,
              name: user.name,
              email: actor.email.trim().toLowerCase(),
              source: 'MEETING',
              phone: input.phone?.trim() || null,
            },
          });
      const duplicate = await tx.meeting.findFirst({
        where: {
          advisorProfileId: advisor.id,
          scheduledAt: { lt: endsAt },
          OR: [
            { endsAt: { gt: scheduledAt } },
            {
              endsAt: null,
              scheduledAt: { gte: new Date(scheduledAt.getTime() - 3600000) },
            },
          ],
          status: { in: ['PENDING', 'SCHEDULED'] },
        },
      });
      if (duplicate)
        throw new ConflictException(
          'Ya tienes una solicitud para ese asesor y horario.',
        );
      return tx.meeting.create({
        data: {
          prospectId: prospect.id,
          advisorProfileId: advisor.id,
          scheduledAt,
          endsAt,
          bookingKey: `${advisor.id}:${scheduledAt.toISOString()}`,
          notes: input.notes?.trim() || null,
          timezone: 'America/Lima',
          status: 'PENDING',
        },
        select: {
          id: true,
          status: true,
          scheduledAt: true,
          endsAt: true,
        },
      });
    });

    await this.mail?.meeting(meeting.id);

    if (input.notifyWhatsapp && input.phone?.trim()) {
      try {
        const advisorName = advisor.user?.name || 'tu asesor TISNET';
        const formattedDate = scheduledAt.toLocaleString('es-PE', {
          dateStyle: 'full',
          timeStyle: 'short',
          timeZone: 'America/Lima',
        });
        const meetingUrl = `https://app.tisnet.pe/meetings/${meeting.id}`;

        await this.whatsapp?.send({
          recipientPhone: input.phone.trim(),
          message:
            `¡Hola! 🚀\n\n` +
            `Tu solicitud de reunión con *${advisorName}* ha sido registrada con éxito.\n\n` +
            `📅 *Fecha y hora:* ${formattedDate}\n` +
            `🔗 *Enlace de la videollamada:* ${meetingUrl}\n\n` +
            `Te enviaremos una notificación cuando el asesor confirme la cita y un recordatorio 15 minutos antes de la llamada.\n\n` +
            `_Equipo TISNET Soluciones Digitales_`,
        });
      } catch {
        // Non-blocking
      }
    }

    return meeting;
  }

  async cancelMeeting(userId: number, id: number) {
    const result = await this.prisma.meeting.updateMany({
      where: {
        id,
        prospect: { userId },
        status: { in: ['PENDING', 'SCHEDULED'] },
      },
      data: { status: 'CANCELLED', bookingKey: null },
    });
    if (!result.count)
      throw new NotFoundException(
        'No se encontró una reunión activa de tu cuenta.',
      );
    return { id, status: 'CANCELLED' };
  }
}

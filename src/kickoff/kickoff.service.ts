import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, ProjectMemberRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PaymentsService } from '../payments/payments.service';
import { KickoffDto, ProjectTeamDto } from './kickoff.dto';
import { ReviewKickoffDto } from './kickoff-sprint14.dto';
export function validateParticipation(members: ProjectTeamDto['members']) {
  if (
    !members.length ||
    new Set(members.map((m) => m.userId)).size !== members.length ||
    members.some(
      (m) =>
        !Number.isInteger(m.participationBasisPoints) ||
        m.participationBasisPoints < 1 ||
        m.participationBasisPoints > 10000,
    ) ||
    members.reduce((sum, m) => sum + m.participationBasisPoints, 0) !== 10000 ||
    members.filter((m) => m.role === 'PRODUCT_OWNER').length !== 1
  )
    throw new BadRequestException(
      'El equipo requiere un PO único y participaciones que sumen exactamente 100%.',
    );
}
@Injectable()
export class KickoffService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly payments: PaymentsService,
  ) {}

  async listAssignedProjects(actor: { id: number; role: string }) {
    const projects = await this.prisma.project.findMany({
      where: {
        status: { not: 'ARCHIVED' },
        members: {
          some: {
            userId: actor.id,
            isActive: true,
            memberRole: actor.role as ProjectMemberRole,
          },
        },
      },
      include: {
        members: { where: { isActive: true }, select: { id: true } },
        deliverables: { orderBy: [{ milestoneOrder: 'asc' }, { id: 'asc' }] },
      },
      orderBy: { updatedAt: 'desc' },
    });
    return projects.map((project) => {
      const approved = project.deliverables.filter(
        (item) =>
          item.status === 'APPROVED' && item.clientReviewStatus === 'APPROVED',
      ).length;
      const total = project.deliverables.length;
      const dueDates = project.deliverables.map((item) =>
        item.dueDate.getTime(),
      );
      return {
        id: project.id,
        name: project.name,
        summary: project.shortDescription,
        description: project.description,
        status: project.status,
        progress: total ? Math.round((approved / total) * 100) : 0,
        startedAt: project.developmentDate?.toISOString() ?? null,
        estimatedDeliveryAt: dueDates.length
          ? new Date(Math.max(...dueDates)).toISOString()
          : null,
        teamSize: project.members.length,
        totalDeliverables: total,
        pendingDeliverables: total - approved,
        milestones: project.deliverables.map((item) => ({
          id: item.milestoneId ?? item.id,
          title: item.title,
          status: item.status,
          clientReviewStatus: item.clientReviewStatus,
          date: item.dueDate.toISOString(),
        })),
      };
    });
  }
  private async validateTeam(
    tx: Prisma.TransactionClient,
    members: ProjectTeamDto['members'],
  ) {
    validateParticipation(members);
    const users = await tx.user.findMany({
      where: { id: { in: members.map((m) => m.userId) }, isActive: true },
      select: { id: true, role: { select: { name: true } } },
    });
    if (
      members.some(
        (m) => !users.some((u) => u.id === m.userId && u.role.name === m.role),
      )
    )
      throw new BadRequestException(
        'Cada miembro debe estar activo y tener el rol indicado.',
      );
  }
  async create(actorId: number, dto: KickoffDto) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM Quote WHERE id = ${dto.quoteId} FOR UPDATE`;
        const version = await this.payments.assertInitialPayment(
          dto.quoteId,
          tx,
        );
        const quote = await tx.quote.findUniqueOrThrow({
          where: { id: dto.quoteId },
        });
        const existing = await tx.project.findUnique({
          where: { quoteId: dto.quoteId },
          include: { kickoff: true },
        });
        if (existing?.kickoff)
          throw new ConflictException(
            'Ya existe un proyecto para esta cotización.',
          );
        if (!quote.prospectId)
          throw new ConflictException('La cotización no tiene prospecto.');
        if (
          !(await tx.category.findFirst({
            where: { id: dto.categoryId, isActive: true },
          }))
        )
          throw new BadRequestException('Categoría no disponible');
        await this.validateTeam(tx, dto.members);
        const client = await tx.user.findFirst({
          where: {
            id: version.clientUserId,
            isActive: true,
            role: { name: 'CLIENT' },
          },
        });
        if (!client) throw new ConflictException('Cliente no disponible');
        const schedules = await tx.paymentSchedule.findMany({
          where: { quoteVersionId: version.id },
          orderBy: { sequence: 'asc' },
        });
        const scope = version.scope as { description?: string };
        const poUserId = dto.members.find(
          (m) => m.role === 'PRODUCT_OWNER',
        )!.userId;
        let project: any;
        if (existing) {
          project = await tx.project.update({
            where: { id: existing.id },
            data: {
              name: dto.name,
              slug: dto.slug,
              shortDescription: (scope.description || dto.name).slice(0, 300),
              description: scope.description || dto.name,
              categoryId: dto.categoryId,
              productOwnerId: poUserId,
              developmentDate: new Date(dto.heldAt),
              kickoff: {
                create: {
                  actorId,
                  heldAt: new Date(dto.heldAt),
                  notes: dto.notes,
                },
              },
            },
          });
          await tx.projectMember.upsert({
            where: {
              projectId_userId: { projectId: project.id, userId: client.id },
            },
            create: {
              projectId: project.id,
              userId: client.id,
              memberRole: 'CLIENT',
              participationBasisPoints: 0,
            },
            update: {
              memberRole: 'CLIENT',
              participationBasisPoints: 0,
              isActive: true,
            },
          });
          for (const m of dto.members) {
            await tx.projectMember.upsert({
              where: {
                projectId_userId: { projectId: project.id, userId: m.userId },
              },
              create: {
                projectId: project.id,
                userId: m.userId,
                memberRole: m.role,
                technicalRole: m.technicalRole?.trim() || null,
                participationBasisPoints: m.participationBasisPoints,
                isActive: true,
              },
              update: {
                memberRole: m.role,
                technicalRole: m.technicalRole?.trim() || null,
                participationBasisPoints: m.participationBasisPoints,
                isActive: true,
              },
            });
          }
        } else {
          project = await tx.project.create({
            data: {
              name: dto.name,
              slug: dto.slug,
              shortDescription: (scope.description || dto.name).slice(0, 300),
              description: scope.description || dto.name,
              categoryId: dto.categoryId,
              status: 'IN_DEVELOPMENT',
              quoteId: dto.quoteId,
              clientUserId: client.id,
              prospectId: quote.prospectId,
              productOwnerId: poUserId,
              developmentDate: new Date(dto.heldAt),
              kickoff: {
                create: {
                  actorId,
                  heldAt: new Date(dto.heldAt),
                  notes: dto.notes,
                },
              },
              members: {
                create: [
                  {
                    userId: client.id,
                    memberRole: 'CLIENT',
                    participationBasisPoints: 0,
                  },
                  ...dto.members.map((m) => ({
                    userId: m.userId,
                    memberRole: m.role,
                    technicalRole: m.technicalRole?.trim() || null,
                    participationBasisPoints: m.participationBasisPoints,
                  })),
                ],
              },
            },
          });
        }
        for (const part of schedules) {
          await tx.projectMilestone.upsert({
            where: { paymentScheduleId: part.id },
            update: {},
            create: {
              projectId: project.id,
              paymentScheduleId: part.id,
              title: part.milestone,
              dueDate: part.dueDate,
              sequence: part.sequence,
              deliverables: {
                create: {
                  projectId: project.id,
                  title: part.milestone,
                  description: scope.description || part.milestone,
                  milestoneOrder: part.sequence,
                  dueDate: part.dueDate,
                },
              },
            },
          });
        }
        await tx.auditEvent.create({
          data: {
            actorId,
            action: 'PROJECT_KICKOFF',
            entityType: 'PROJECT',
            entityId: String(project.id),
            metadata: { quoteId: dto.quoteId, version: version.version },
          },
        });
        return tx.project.findUniqueOrThrow({
          where: { id: project.id },
          include: {
            kickoff: true,
            members: true,
            milestones: { include: { deliverables: true } },
          },
        });
      });
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      )
        throw new ConflictException('Slug o cotización ya vinculado.');
      throw e;
    }
  }
  async access(projectId: number, actor: { id: number; role: string }) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
    });
    if (!project) throw new NotFoundException('Proyecto no encontrado');
    if (!['ADMIN', 'SUPER_ADMIN'].includes(actor.role)) {
      const membership = await this.prisma.projectMember.findUnique({
        where: { projectId_userId: { projectId, userId: actor.id } },
      });
      if (!membership?.isActive || membership.memberRole !== actor.role)
        throw new ForbiddenException('No perteneces a este proyecto.');
    }
    return project;
  }
  async detail(projectId: number, actor: { id: number; role: string }) {
    await this.access(projectId, actor);
    return this.prisma.project.findUniqueOrThrow({
      where: { id: projectId },
      include: {
        kickoff: { include: { meeting: true } },
        members: { include: { user: { select: { name: true } } } },
        milestones: { include: { deliverables: true, paymentSchedule: true } },
      },
    });
  }

  async getOperations(projectId: number, actor: { id: number; role: string }) {
    const project = await this.detail(projectId, actor);
    let canStart = false;
    if (project.quoteId) {
      try {
        await this.payments.assertInitialPayment(project.quoteId);
        canStart = true;
      } catch (error) {
        if (!(error instanceof ConflictException)) throw error;
      }
    }
    const candidateUsers = await this.prisma.user.findMany({
      where: {
        isActive: true,
        role: { name: { in: ['DEVELOPER', 'PRODUCT_OWNER'] } },
      },
      include: { role: true },
    });
    const candidates = candidateUsers.map((u) => ({
      id: u.id,
      name: u.name,
      role: u.role.name,
    }));

    const canManageTeam =
      ['ADMIN', 'SUPER_ADMIN'].includes(actor.role) ||
      (actor.role === 'PRODUCT_OWNER' && project.productOwnerId === actor.id);
    const canManageKickoff = canManageTeam;
    const canViewFinance = ['ADMIN', 'SUPER_ADMIN', 'CLIENT'].includes(
      actor.role,
    );

    const kickoffData = project.kickoff
      ? {
          status: project.kickoff.meeting?.status ?? 'SCHEDULED',
          scheduledAt:
            project.kickoff.meeting?.scheduledAt?.toISOString() ??
            (project.kickoff.heldAt
              ? project.kickoff.heldAt.toISOString()
              : null),
          notes: project.kickoff.notes || '',
          canStart,
          blockingReason: canStart
            ? undefined
            : 'Se requiere adelanto confirmado.',
        }
      : {
          status: 'PENDING',
          scheduledAt: null,
          notes: '',
          canStart,
          blockingReason: canStart
            ? undefined
            : 'Se requiere adelanto confirmado.',
        };

    const formattedMembers = project.members.map((m) => ({
      id: m.id,
      userId: m.userId,
      name: m.user.name,
      role: m.memberRole,
      memberRole: m.memberRole,
      technicalRole: m.technicalRole,
      isActive: m.isActive,
      ...(actor.role === 'DEVELOPER' ? {} : {
        participation: m.participationBasisPoints / 100,
        participationBasisPoints: m.participationBasisPoints,
      }),
    }));

    // DoD: "El Product Owner no recibe montos económicos"
    // Strip financial fields from milestones if the actor has no finance access.
    const milestones = project.milestones.map((m) => {
      const base = {
        id: m.id,
        title: m.title,
        dueDate: m.dueDate,
        sequence: m.sequence,
        deliverables: m.deliverables,
      };
      if (canViewFinance) {
        return {
          ...base,
          amountMinor: (m.paymentSchedule as any)?.amountMinor ?? null,
          percentageBasisPoints:
            (m.paymentSchedule as any)?.percentageBasisPoints ?? null,
          paymentScheduleId: m.paymentScheduleId,
        };
      }
      return base; // PO and DEVELOPER: no amounts exposed
    });

    return {
      projectId: project.id,
      name: project.name,
      slug: project.slug,
      shortDescription: project.shortDescription,
      status: project.status,
      developmentDate: project.developmentDate,
      quoteId: canViewFinance ? project.quoteId : undefined,
      clientUserId: canViewFinance ? project.clientUserId : undefined,
      productOwnerId: project.productOwnerId,
      kickoff: kickoffData,
      members: formattedMembers,
      milestones,
      candidates: canManageTeam ? candidates : [],
      canManageTeam,
      canManageKickoff,
      canViewFinance,
    };
  }

  async scheduleKickoff(
    projectId: number,
    actor: { id: number; role: string },
    dto: { scheduledAt: string; notes?: string; advisorId?: number },
  ) {
    await this.access(projectId, actor);
    // The client proposes a date. Administration reviews it using reviewKickoff.
    if (actor.role !== 'CLIENT')
      throw new ForbiddenException(
        'Solo el cliente puede solicitar o cambiar la fecha propuesta del kickoff.',
      );
    const heldAt = new Date(dto.scheduledAt);
    if (isNaN(heldAt.getTime())) {
      throw new BadRequestException('Fecha de kickoff inválida.');
    }

    return this.prisma.$transaction(
      async (tx) => {
        await tx.$queryRaw`SELECT id FROM Project WHERE id = ${projectId} FOR UPDATE`;
        const project = await tx.project.findUniqueOrThrow({
          where: { id: projectId },
        });
        if (!project.quoteId)
          throw new ConflictException(
            'El proyecto no tiene un acuerdo comercial.',
          );
        const activeQuoteVersion = await this.payments.assertInitialPayment(
          project.quoteId,
          tx,
        );
        const existing = await tx.kickoff.findUnique({
          where: { projectId },
          include: { meeting: true },
        });

        let meetingId = existing?.meetingId;
        const advisorId = dto.advisorId ?? existing?.meeting?.advisorProfileId;
        if (!advisorId)
          throw new BadRequestException('Selecciona el asesor del kickoff.');
        if (advisorId) {
          if (!project.prospectId)
            throw new ConflictException('El proyecto no tiene prospecto.');
          const unchanged =
            existing?.meeting?.scheduledAt?.getTime() === heldAt.getTime() &&
            existing.meeting.advisorProfileId === advisorId;
          if (!unchanged) {
            if (heldAt <= new Date())
              throw new BadRequestException('La reunión debe ser futura.');
            if (
              existing?.meeting &&
              (!['PENDING', 'SCHEDULED'].includes(existing.meeting.status) ||
                existing.meeting.externalProvider)
            )
              throw new ConflictException(
                'Esta reunión no puede reprogramarse desde el kickoff.',
              );
            await tx.$queryRaw`SELECT id FROM AdminProfile WHERE id = ${advisorId} FOR UPDATE`;
            const advisor = await tx.adminProfile.findFirst({
              where: {
                id: advisorId,
                userId: activeQuoteVersion.authorId,
                user: { isActive: true },
              },
            });
            if (!advisor) throw new NotFoundException('Asesor no disponible.');
            const endsAt = new Date(heldAt.getTime() + 3600000);
            const overlap = await tx.meeting.findFirst({
              where: {
                ...(meetingId ? { id: { not: meetingId } } : {}),
                advisorProfileId: advisorId,
                status: { in: ['PENDING', 'SCHEDULED'] },
                scheduledAt: { lt: endsAt },
                OR: [
                  { endsAt: { gt: heldAt } },
                  {
                    endsAt: null,
                    scheduledAt: { gt: new Date(heldAt.getTime() - 3600000) },
                  },
                ],
              },
            });
            if (overlap)
              throw new ConflictException(
                'El asesor ya tiene una reunión en ese intervalo.',
              );
            const meetingData = {
              advisorProfileId: advisorId,
              scheduledAt: heldAt,
              endsAt,
              bookingKey: `${advisorId}:${heldAt.toISOString()}`,
              status: 'PENDING' as const,
            };
            const meeting = meetingId
              ? await tx.meeting.update({
                  where: { id: meetingId },
                  data: meetingData,
                })
              : await tx.meeting.create({
                  data: {
                    ...meetingData,
                    prospectId: project.prospectId,
                    quoteId: project.quoteId,
                    notes: dto.notes?.slice(0, 1000),
                    timezone: 'America/Lima',
                  },
                });
            meetingId = meeting.id;
          }
        }

        if (existing) {
          if (
            existing.heldAt.getTime() === heldAt.getTime() &&
            existing.meetingId === meetingId &&
            (dto.notes === undefined ||
              dto.notes === existing.notes
            )
          )
            return existing;
        }
        const result = existing
          ? await tx.kickoff.update({
              where: { projectId },
              data: {
                heldAt,
                meetingId,
                notes: existing.notes,
                actorId: actor.id,
              },
            })
          : await tx.kickoff.create({
              data: {
                projectId,
                heldAt,
                meetingId,
                notes: '',
                actorId: actor.id,
              },
            });
        await tx.auditEvent.create({
          data: {
            actorId: actor.id,
            action: existing ? 'KICKOFF_RESCHEDULED' : 'KICKOFF_SCHEDULED',
            entityType: 'PROJECT',
            entityId: String(projectId),
            metadata: { scheduledAt: heldAt.toISOString() },
          },
        });
        return result;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted },
    );
  }

  async reviewKickoff(
    projectId: number,
    actor: { id: number; role: string },
    dto: ReviewKickoffDto,
  ) {
    if (!['ADMIN', 'SUPER_ADMIN'].includes(actor.role))
      throw new ForbiddenException('Solo administración puede revisar el kickoff.');
    await this.access(projectId, actor);
    if (dto.action === 'RESCHEDULE' && !dto.scheduledAt)
      throw new BadRequestException('Indica la nueva fecha y hora.');
    if (dto.action === 'CONFIRM' && dto.scheduledAt)
      throw new BadRequestException('La confirmación debe conservar la fecha solicitada.');

    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM Project WHERE id = ${projectId} FOR UPDATE`;
      const project = await tx.project.findUniqueOrThrow({
        where: { id: projectId },
        include: { kickoff: { include: { meeting: true } } },
      });
      if (!project.quoteId)
        throw new ConflictException('El proyecto no tiene un acuerdo comercial.');
      await this.payments.assertInitialPayment(project.quoteId, tx);

      const kickoff = project.kickoff;
      const meeting = kickoff?.meeting;
      if (!kickoff || !meeting?.scheduledAt || !meeting.advisorProfileId)
        throw new ConflictException('El cliente todavía no ha solicitado un kickoff.');
      if (meeting.status === 'COMPLETED' || meeting.status === 'CANCELLED')
        throw new ConflictException('Este kickoff ya no puede modificarse.');
      if (dto.action === 'CONFIRM' && meeting.status !== 'PENDING')
        throw new ConflictException('Solo puedes confirmar una solicitud pendiente.');
      if (!['PENDING', 'SCHEDULED'].includes(meeting.status))
        throw new ConflictException('El estado actual del kickoff no permite cambios.');

      const scheduledAt =
        dto.action === 'RESCHEDULE'
          ? new Date(dto.scheduledAt!)
          : meeting.scheduledAt;
      if (!Number.isFinite(scheduledAt.getTime()) || scheduledAt <= new Date())
        throw new BadRequestException('La fecha del kickoff debe ser futura.');
      const endsAt = new Date(scheduledAt.getTime() + 3600000);
      const overlap = await tx.meeting.findFirst({
        where: {
          id: { not: meeting.id },
          advisorProfileId: meeting.advisorProfileId,
          status: { in: ['PENDING', 'SCHEDULED'] },
          scheduledAt: { lt: endsAt },
          OR: [
            { endsAt: { gt: scheduledAt } },
            {
              endsAt: null,
              scheduledAt: { gt: new Date(scheduledAt.getTime() - 3600000) },
            },
          ],
        },
      });
      if (overlap)
        throw new ConflictException('El administrador ya tiene una reunión en ese horario.');

      await tx.meeting.update({
        where: { id: meeting.id },
        data: {
          scheduledAt,
          endsAt,
          status: 'SCHEDULED',
          bookingKey: `${meeting.advisorProfileId}:${scheduledAt.toISOString()}`,
          notes: dto.notes?.trim().slice(0, 1000) || meeting.notes,
        },
      });
      const result = await tx.kickoff.update({
        where: { projectId },
        data: {
          heldAt: scheduledAt,
          actorId: actor.id,
          ...(dto.notes !== undefined ? { notes: dto.notes.trim().slice(0, 2000) } : {}),
        },
      });
      await tx.auditEvent.create({
        data: {
          actorId: actor.id,
          action: dto.action === 'CONFIRM' ? 'KICKOFF_CONFIRMED' : 'KICKOFF_RESCHEDULED',
          entityType: 'PROJECT',
          entityId: String(projectId),
          metadata: {
            scheduledAt: scheduledAt.toISOString(),
            meetingId: meeting.id,
            action: dto.action,
          },
        },
      });
      return result;
    });
  }

  async addMember(
    projectId: number,
    actor: { id: number; role: string },
    dto: {
      userId: number;
      memberRole: string;
      participationBasisPoints?: number;
      technicalRole?: string;
    },
  ) {
    await this.access(projectId, actor);
    if (!['ADMIN', 'SUPER_ADMIN', 'PRODUCT_OWNER'].includes(actor.role)) {
      throw new ForbiddenException(
        'Solo administración o el Product Owner puede agregar miembros.',
      );
    }
    // S14-B06: PRODUCT_OWNER must be the assigned PO of this specific project
    if (actor.role === 'PRODUCT_OWNER') {
      const project = await this.prisma.project.findUnique({
        where: { id: projectId },
        select: { productOwnerId: true },
      });
      if (project?.productOwnerId !== actor.id) {
        throw new ForbiddenException(
          'Solo el Product Owner asignado a este proyecto puede gestionar el equipo.',
        );
      }
    }
    return this.prisma.$transaction(
      async (tx) => {
        await tx.$queryRaw`SELECT id FROM Project WHERE id = ${projectId} FOR UPDATE`;
        const project = await tx.project.findUniqueOrThrow({
          where: { id: projectId },
        });
        if (
          actor.role === 'PRODUCT_OWNER' &&
          project.productOwnerId !== actor.id
        )
          throw new ForbiddenException('El Product Owner asignado cambió.');
        if (!project.quoteId)
          throw new ConflictException(
            'El proyecto no tiene un acuerdo comercial.',
          );
        await this.payments.assertInitialPayment(project.quoteId, tx);
        const user = await tx.user.findFirst({
          where: { id: dto.userId, isActive: true },
          include: { role: true },
        });
        if (!user) {
          throw new NotFoundException('Usuario no encontrado o inactivo.');
        }
        const roleToAssign = dto.memberRole || user.role.name;
        const basisPoints = dto.participationBasisPoints ?? 0;
        if (roleToAssign !== 'DEVELOPER' || user.role.name !== 'DEVELOPER')
          throw new BadRequestException(
            'Esta operación solo permite agregar developers activos. Asigna el PO desde su operación específica.',
          );
        if (
          !Number.isInteger(basisPoints) ||
          basisPoints < 0 ||
          basisPoints > 10000
        )
          throw new BadRequestException('Participación inválida.');
        const others = await tx.projectMember.aggregate({
          where: {
            projectId,
            isActive: true,
            userId: { not: dto.userId },
            memberRole: { not: 'CLIENT' },
          },
          _sum: { participationBasisPoints: true },
        });
        if ((others._sum.participationBasisPoints ?? 0) + basisPoints > 10000)
          throw new BadRequestException(
            'Las participaciones no pueden superar el 100%.',
          );
        const result = await tx.projectMember.upsert({
          where: { projectId_userId: { projectId, userId: dto.userId } },
          create: {
            projectId,
            userId: dto.userId,
            memberRole: 'DEVELOPER',
            technicalRole: dto.technicalRole?.trim() || null,
            participationBasisPoints: basisPoints,
            isActive: true,
          },
          update: {
            memberRole: 'DEVELOPER',
            technicalRole: dto.technicalRole?.trim() || null,
            participationBasisPoints: basisPoints,
            isActive: true,
          },
        });
        await tx.auditEvent.create({
          data: {
            actorId: actor.id,
            action: 'PROJECT_MEMBER_UPDATED',
            entityType: 'PROJECT',
            entityId: String(projectId),
            metadata: {
              userId: dto.userId,
              participationBasisPoints: basisPoints,
            },
          },
        });
        return result;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted },
    );
  }

  async setTeam(
    projectId: number,
    actor: { id: number; role: string },
    dto: ProjectTeamDto,
  ) {
    await this.access(projectId, actor);
    if (!['ADMIN', 'SUPER_ADMIN', 'PRODUCT_OWNER'].includes(actor.role))
      throw new ForbiddenException(
        'Solo administración puede reasignar equipo y participaciones.',
      );
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM Project WHERE id = ${projectId} FOR UPDATE`;
      const project = await tx.project.findUniqueOrThrow({
        where: { id: projectId },
      });
      if (
        actor.role === 'PRODUCT_OWNER' &&
        (project.productOwnerId !== actor.id ||
          dto.members.find((m) => m.role === 'PRODUCT_OWNER')?.userId !==
            actor.id)
      )
        throw new ForbiddenException(
          'El PO solo puede gestionar su equipo sin reasignar su cargo.',
        );
      if (!project.quoteId)
        throw new ConflictException(
          'El proyecto no tiene un acuerdo comercial.',
        );
      await this.payments.assertInitialPayment(project.quoteId, tx);
      await this.validateTeam(tx, dto.members);
      await tx.projectMember.updateMany({
        where: { projectId, memberRole: { not: 'CLIENT' } },
        data: { isActive: false, participationBasisPoints: 0 },
      });
      for (const m of dto.members) {
        await tx.projectMember.upsert({
          where: { projectId_userId: { projectId, userId: m.userId } },
          create: {
            projectId,
            userId: m.userId,
            memberRole: m.role,
            technicalRole: m.technicalRole?.trim() || null,
            participationBasisPoints: m.participationBasisPoints,
          },
          update: {
            memberRole: m.role,
            technicalRole: m.technicalRole?.trim() || null,
            participationBasisPoints: m.participationBasisPoints,
            isActive: true,
          },
        });
      }
      await tx.project.update({
        where: { id: projectId },
        data: {
          productOwnerId: dto.members.find((m) => m.role === 'PRODUCT_OWNER')!
            .userId,
        },
      });
      await tx.auditEvent.create({
        data: {
          actorId: actor.id,
          action: 'PROJECT_TEAM_UPDATED',
          entityType: 'PROJECT',
          entityId: String(projectId),
          metadata: { memberCount: dto.members.length },
        },
      });
      return tx.projectMember.findMany({
        where: { projectId, isActive: true },
      });
    });
  }
}

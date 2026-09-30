import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ProjectMemberRole } from '@prisma/client';
import { PLATFORM_ROLES } from '../common/constants/platform-roles';
import { PrismaService } from '../prisma/prisma.service';
import { SaveContributionsDto } from './dto/save-contributions.dto';

export interface ContributionsActor {
  id: number;
  role: string;
}

const ADMIN_ROLES = new Set<string>([
  PLATFORM_ROLES.ADMIN,
  PLATFORM_ROLES.SUPER_ADMIN,
]);

@Injectable()
export class ContributionsService {
  constructor(private readonly prisma: PrismaService) {}

  private async requireProjectAccess(projectId: number, actor: ContributionsActor) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: {
        id: true,
        clientUserId: true,
        productOwnerId: true,
      },
    });
    if (!project) {
      throw new NotFoundException('Proyecto no encontrado.');
    }

    if (ADMIN_ROLES.has(actor.role)) {
      return { project, memberRole: undefined };
    }

    const membership = await this.prisma.projectMember.findUnique({
      where: {
        projectId_userId: { projectId, userId: actor.id },
      },
    });

    const isClientOwner = project.clientUserId === actor.id;
    const isPoOwner = project.productOwnerId === actor.id;

    if (!membership?.isActive && !isClientOwner && !isPoOwner) {
      throw new ForbiddenException('No tienes acceso a este proyecto.');
    }

    return {
      project,
      memberRole:
        membership?.memberRole ??
        (isPoOwner
          ? ProjectMemberRole.PRODUCT_OWNER
          : isClientOwner
          ? ProjectMemberRole.CLIENT
          : undefined),
    };
  }

  private async findDeliverableOrMilestone(projectId: number, idOrSequence: number, exactDeliverable = false) {
    const deliverable = await this.prisma.projectDeliverable.findFirst({
      where: {
        projectId,
        OR: exactDeliverable ? [{ id: idOrSequence }] : [
          { id: idOrSequence },
          { milestoneId: idOrSequence },
          { milestoneOrder: idOrSequence },
        ],
      },
      include: {
        milestone: true,
      },
    });

    if (deliverable) {
      return {
        deliverableId: deliverable.id,
        milestoneId: deliverable.milestoneId ?? deliverable.milestone?.id ?? null,
        title: deliverable.title,
        milestoneOrder: deliverable.milestoneOrder,
      };
    }

    if (exactDeliverable) {
      throw new NotFoundException('Entregable no encontrado para este proyecto.');
    }

    const milestone = await this.prisma.projectMilestone.findFirst({
      where: {
        projectId,
        OR: [{ id: idOrSequence }, { sequence: idOrSequence }],
      },
    });

    if (milestone) {
      return {
        deliverableId: null,
        milestoneId: milestone.id,
        title: milestone.title,
        milestoneOrder: milestone.sequence,
      };
    }

    throw new NotFoundException('Hito o entregable no encontrado para este proyecto.');
  }

  async recordContributions(
    projectId: number,
    milestoneId: number,
    actor: ContributionsActor,
    dto: SaveContributionsDto,
    exactDeliverable = false,
  ) {
    const { memberRole } = await this.requireProjectAccess(projectId, actor);

    // Only PO, Admin or Super Admin
    if (!ADMIN_ROLES.has(actor.role) && memberRole !== ProjectMemberRole.PRODUCT_OWNER) {
      throw new ForbiddenException(
        'Solo el Product Owner del proyecto o un Administrador puede registrar contribuciones.',
      );
    }

    const target = await this.findDeliverableOrMilestone(projectId, milestoneId, exactDeliverable);

    // Validate percentage sum
    const totalPercentage = dto.contributions.reduce((sum, item) => sum + item.percentage, 0);
    if (totalPercentage !== 100) {
      throw new BadRequestException(
        `La suma de porcentajes debe ser exactamente 100%. Suma actual: ${totalPercentage}%`,
      );
    }

    // Check duplicate users
    const userIds = dto.contributions.map((c) => c.userId);
    if (new Set(userIds).size !== userIds.length) {
      throw new BadRequestException('No se permiten integrantes duplicados en el mismo hito.');
    }

    // Validate members belong to project
    const activeMembers = await this.prisma.projectMember.findMany({
      where: {
        projectId,
        userId: { in: userIds },
        isActive: true,
      },
      select: { userId: true },
    });
    const activeUserIds = new Set(activeMembers.map((m) => m.userId));

    // Also check if PO or Client owner is in project table
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { productOwnerId: true, clientUserId: true },
    });
    if (project?.productOwnerId) activeUserIds.add(project.productOwnerId);
    if (project?.clientUserId) activeUserIds.add(project.clientUserId);

    for (const userId of userIds) {
      if (!activeUserIds.has(userId)) {
        throw new BadRequestException(
          `El usuario con ID ${userId} no es un integrante activo del proyecto.`,
        );
      }
    }

    // Persist in transaction
    return this.prisma.$transaction(async (tx) => {
      // Clear previous contributions for this target
      if (target.deliverableId) {
        await tx.milestoneContribution.deleteMany({
          where: {
            projectId,
            deliverableId: target.deliverableId,
          },
        });
      } else if (target.milestoneId) {
        await tx.milestoneContribution.deleteMany({
          where: {
            projectId,
            milestoneId: target.milestoneId,
          },
        });
      }

      const created = await Promise.all(
        dto.contributions.map((c) =>
          tx.milestoneContribution.create({
            data: {
              projectId,
              deliverableId: target.deliverableId,
              milestoneId: target.milestoneId,
              userId: c.userId,
              percentage: c.percentage,
              description: c.description.trim(),
            },
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  role: { select: { name: true } },
                },
              },
            },
          }),
        ),
      );

      // Audit trail
      await tx.auditEvent.create({
        data: {
          actorId: actor.id,
          action: 'MILESTONE_CONTRIBUTIONS_SAVED',
          entityType: 'PROJECT_MILESTONE',
          entityId: String(target.deliverableId ?? target.milestoneId),
          metadata: {
            projectId,
            milestoneOrder: target.milestoneOrder,
            contributionsCount: created.length,
            breakdown: dto.contributions.map((c) => ({
              userId: c.userId,
              percentage: c.percentage,
            })),
          },
        },
      });

      return created;
    });
  }

  async getMilestoneContributions(
    projectId: number,
    milestoneId: number,
    actor: ContributionsActor,
    exactDeliverable = false,
  ) {
    await this.requireProjectAccess(projectId, actor);
    const target = await this.findDeliverableOrMilestone(projectId, milestoneId, exactDeliverable);

    const where = target.deliverableId
      ? { projectId, deliverableId: target.deliverableId }
      : { projectId, milestoneId: target.milestoneId! };

    return this.prisma.milestoneContribution.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: { select: { name: true } },
          },
        },
      },
      orderBy: { percentage: 'desc' },
    });
  }

  async getProjectContributions(projectId: number, actor: ContributionsActor) {
    await this.requireProjectAccess(projectId, actor);

    const deliverables = await this.prisma.projectDeliverable.findMany({
      where: { projectId },
      orderBy: { milestoneOrder: 'asc' },
      select: {
        id: true,
        title: true,
        milestoneOrder: true,
        status: true,
        dueDate: true,
      },
    });

    const allContributions = await this.prisma.milestoneContribution.findMany({
      where: { projectId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: { select: { name: true } },
          },
        },
      },
    });

    // Compute cumulative breakdown
    const userSummaryMap = new Map<
      number,
      {
        user: { id: number; name: string; email: string; role: string };
        totalPercentageSum: number;
        milestonesCount: number;
        descriptions: string[];
      }
    >();

    for (const item of allContributions) {
      const entry = userSummaryMap.get(item.userId) ?? {
        user: {
          id: item.user.id,
          name: item.user.name,
          email: item.user.email,
          role: item.user.role.name,
        },
        totalPercentageSum: 0,
        milestonesCount: 0,
        descriptions: [],
      };
      entry.totalPercentageSum += item.percentage;
      entry.milestonesCount += 1;
      entry.descriptions.push(item.description);
      userSummaryMap.set(item.userId, entry);
    }

    const totalMilestones = deliverables.length || 1;
    const teamSummary = Array.from(userSummaryMap.values()).map((entry) => ({
      user: entry.user,
      averagePercentage: Math.round((entry.totalPercentageSum / totalMilestones) * 100) / 100,
      milestonesContributed: entry.milestonesCount,
      tasks: entry.descriptions,
    }));

    return {
      projectId,
      totalMilestones: deliverables.length,
      deliverables: deliverables.map((d) => ({
        ...d,
        contributions: allContributions
          .filter((c) => c.deliverableId === d.id)
          .map((c) => ({
            id: c.id,
            userId: c.userId,
            userName: c.user.name,
            userRole: c.user.role.name,
            percentage: c.percentage,
            description: c.description,
          })),
      })),
      teamSummary,
    };
  }
}

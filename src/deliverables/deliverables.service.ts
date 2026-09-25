import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DeliverableStatus, Prisma, ProjectMemberRole } from '@prisma/client';
import { PLATFORM_ROLES } from '../common/constants/platform-roles';
import { PrismaService } from '../prisma/prisma.service';
import { CreateDeliverableDto } from './dto/create-deliverable.dto';
import {
  DeliverableReviewDecision,
  ReviewDeliverableDto,
} from './dto/review-deliverable.dto';
import { SubmitDeliverableDto } from './dto/submit-deliverable.dto';

export interface DeliverablesActor {
  id: number;
  role: string;
}

const ADMIN_ROLES = new Set<string>([
  PLATFORM_ROLES.ADMIN,
  PLATFORM_ROLES.SUPER_ADMIN,
]);
const deliverableInclude = {
  reviewedBy: { select: { id: true, name: true } },
} satisfies Prisma.ProjectDeliverableInclude;

@Injectable()
export class DeliverablesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(projectId: number, actor: DeliverablesActor) {
    await this.requireProjectAccess(projectId, actor);
    return this.prisma.projectDeliverable.findMany({
      where: { projectId },
      include: deliverableInclude,
      orderBy: [{ milestoneOrder: 'asc' }, { id: 'asc' }],
    });
  }

  async create(
    projectId: number,
    actor: DeliverablesActor,
    dto: CreateDeliverableDto,
  ) {
    const membership = await this.requireProjectAccess(projectId, actor);
    this.requirePermission(actor, membership?.memberRole, [
      ProjectMemberRole.PRODUCT_OWNER,
    ]);
    const commercialProject = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { quoteId: true },
    });
    const milestone = commercialProject?.quoteId
      ? await this.prisma.projectMilestone.findUnique({
          where: {
            projectId_sequence: { projectId, sequence: dto.milestoneOrder },
          },
        })
      : null;
    if (commercialProject?.quoteId && !milestone)
      throw new BadRequestException(
        'El hito debe existir en el acuerdo comercial oficial.',
      );
    if (
      milestone &&
      (dto.title.trim() !== milestone.title ||
        new Date(dto.dueDate).getTime() !== milestone.dueDate.getTime())
    )
      throw new BadRequestException(
        'El título y la fecha deben coincidir con el hito acordado.',
      );
    try {
      return await this.prisma.projectDeliverable.create({
        data: {
          projectId,
          ...(milestone ? { milestoneId: milestone.id } : {}),
          title: dto.title.trim(),
          description: dto.description.trim(),
          milestoneOrder: dto.milestoneOrder,
          dueDate: new Date(dto.dueDate),
        },
        include: deliverableInclude,
      });
    } catch (error) {
      this.rethrowKnownPrismaError(error);
    }
  }

  async submit(
    projectId: number,
    deliverableId: number,
    actor: DeliverablesActor,
    dto: SubmitDeliverableDto,
  ) {
    const membership = await this.requireProjectAccess(projectId, actor);
    this.requirePermission(actor, membership?.memberRole, [
      ProjectMemberRole.DEVELOPER,
      ProjectMemberRole.PRODUCT_OWNER,
    ]);
    const deliverable = await this.findDeliverable(projectId, deliverableId);
    if (
      deliverable.status !== DeliverableStatus.DRAFT &&
      deliverable.status !== DeliverableStatus.OBSERVED
    ) {
      throw new ConflictException(
        'El entregable no puede enviarse desde su estado actual',
      );
    }
    const fileUrl = dto.fileUrl?.trim() || deliverable.fileUrl;
    const externalLink = dto.externalLink?.trim() || deliverable.externalLink;
    if (!fileUrl && !externalLink) {
      throw new BadRequestException(
        'Debes proporcionar fileUrl o externalLink como evidencia',
      );
    }
    return this.prisma.projectDeliverable.update({
      where: { id: deliverableId },
      data: {
        fileUrl,
        externalLink,
        status: DeliverableStatus.IN_REVIEW,
        submittedAt: new Date(),
        reviewedAt: null,
        reviewedById: null,
        feedbackNotes: null,
      },
      include: deliverableInclude,
    });
  }

  async review(
    projectId: number,
    deliverableId: number,
    actor: DeliverablesActor,
    dto: ReviewDeliverableDto,
  ) {
    const membership = await this.requireProjectAccess(projectId, actor);
    this.requirePermission(actor, membership?.memberRole, [
      ProjectMemberRole.PRODUCT_OWNER,
      ProjectMemberRole.CLIENT,
    ]);
    const deliverable = await this.findDeliverable(projectId, deliverableId);
    if (deliverable.status !== DeliverableStatus.IN_REVIEW) {
      throw new ConflictException(
        'Solo se pueden revisar entregables en estado IN_REVIEW',
      );
    }
    const observed = dto.decision === DeliverableReviewDecision.OBSERVE;
    const feedbackNotes = dto.feedbackNotes?.trim();
    if (observed && !feedbackNotes) {
      throw new BadRequestException(
        'Las observaciones requieren feedbackNotes',
      );
    }
    return this.prisma.projectDeliverable.update({
      where: { id: deliverableId },
      data: {
        status: observed
          ? DeliverableStatus.OBSERVED
          : DeliverableStatus.APPROVED,
        feedbackNotes: observed ? feedbackNotes : null,
        reviewedAt: new Date(),
        reviewedById: actor.id,
      },
      include: deliverableInclude,
    });
  }

  private async requireProjectAccess(
    projectId: number,
    actor: DeliverablesActor,
  ) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true },
    });
    if (!project) throw new NotFoundException('Proyecto no encontrado');
    if (ADMIN_ROLES.has(actor.role)) return null;
    const membership = await this.prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId: actor.id } },
    });
    if (!membership?.isActive || membership.memberRole !== actor.role) {
      throw new ForbiddenException(
        'No tienes una membresía activa en este proyecto',
      );
    }
    return membership;
  }

  private requirePermission(
    actor: DeliverablesActor,
    memberRole: ProjectMemberRole | undefined,
    allowedMembers: ProjectMemberRole[],
  ) {
    if (ADMIN_ROLES.has(actor.role)) return;
    if (!memberRole || !allowedMembers.includes(memberRole)) {
      throw new ForbiddenException(
        'No tienes permisos para realizar esta acción',
      );
    }
  }

  private async findDeliverable(projectId: number, deliverableId: number) {
    const deliverable = await this.prisma.projectDeliverable.findFirst({
      where: { id: deliverableId, projectId },
    });
    if (!deliverable) throw new NotFoundException('Entregable no encontrado');
    return deliverable;
  }

  private rethrowKnownPrismaError(error: unknown): never {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new ConflictException(
        'Ya existe un entregable con ese orden en el proyecto',
      );
    }
    throw error;
  }
}

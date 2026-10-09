import { RemindersService } from '../commercial-operations/reminders.service';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  Optional,
  StreamableFile,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import * as nodePath from 'node:path';
import { DeliverableStatus, Prisma, ProjectMemberRole } from '@prisma/client';
import { PLATFORM_ROLES } from '../common/constants/platform-roles';
import { PrismaService } from '../prisma/prisma.service';
import {
  STORAGE_PROVIDER,
  type StorageProvider,
} from '../storage/storage-provider.interface';
import { CreateDeliverableDto } from './dto/create-deliverable.dto';
import {
  DeliverableReviewDecision,
  ReviewDeliverableDto,
} from './dto/review-deliverable.dto';
import { SubmitDeliverableDto } from './dto/submit-deliverable.dto';
import { SubmitEvidenceDto } from './dto/submit-evidence.dto';

export interface DeliverablesActor {
  id: number;
  role: string;
}

export interface DeliverableFile {
  buffer: Buffer;
  size: number;
  mimetype: string;
  originalname: string;
}

const ADMIN_ROLES = new Set<string>([
  PLATFORM_ROLES.ADMIN,
  PLATFORM_ROLES.SUPER_ADMIN,
]);
const deliverableInclude = {
  reviewedBy: { select: { id: true, name: true } },
  clientReviewedBy: { select: { id: true, name: true } },
} satisfies Prisma.ProjectDeliverableInclude;

@Injectable()
export class DeliverablesService {
  constructor(
    private readonly prisma: PrismaService,
    @Optional()
    @Inject(STORAGE_PROVIDER)
    private readonly storageProvider?: StorageProvider,
    @Optional() private readonly reminders?: RemindersService,
  ) {}

  async list(projectId: number, actor: DeliverablesActor) {
    await this.requireProjectAccess(projectId, actor);
    const items = await this.prisma.projectDeliverable.findMany({
      where: { projectId },
      include: {
        ...deliverableInclude,
        milestone: {
          include: {
            paymentSchedule: {
              include: {
                payments: { where: { status: 'CONFIRMED' }, select: { id: true } },
                quoteVersion: { select: { currency: true } },
              },
            },
          },
        },
      },
      orderBy: [{ milestoneOrder: 'asc' }, { id: 'asc' }],
    });
    return items.map((item) => ({
      ...item,
      paymentGate: item.milestone
        ? {
            sequence: item.milestone.sequence,
            milestone: item.milestone.title,
            amountMinor: Number(item.milestone.paymentSchedule.amountMinor),
            currency: item.milestone.paymentSchedule.quoteVersion.currency,
            paid: item.milestone.paymentSchedule.payments.length > 0,
          }
        : null,
    }));
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
    await this.assertMilestonePaid(projectId, deliverable.milestoneOrder);
    if (
      deliverable.status !== DeliverableStatus.DRAFT &&
      deliverable.status !== DeliverableStatus.OBSERVED
    ) {
      throw new ConflictException(
        'El entregable no puede enviarse desde su estado actual',
      );
    }
    const notes = dto.notes?.trim() || null;
    const fileUrl = dto.fileUrl?.trim() || deliverable.fileUrl;
    const externalLink = dto.externalLink?.trim() || deliverable.externalLink;
    if (!fileUrl && !externalLink) {
      throw new BadRequestException(
        'Debes proporcionar fileUrl o externalLink como evidencia',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const locked = await tx.$queryRawUnsafe<Array<{ status: string }>>(
        'SELECT id, status FROM ProjectDeliverable WHERE id = ? FOR UPDATE',
        deliverable.id,
      );
      if (locked?.[0] && !['DRAFT', 'OBSERVED'].includes(locked[0].status))
        throw new ConflictException(
          'El entregable cambió de estado; recarga antes de continuar.',
        );
      const updated = await tx.projectDeliverable.update({
        where: { id: deliverable.id },
        data: {
          fileUrl,
          externalLink,
          status: DeliverableStatus.IN_REVIEW,
          clientReviewStatus: 'PENDING',
          submittedAt: new Date(),
          reviewedAt: null,
          reviewedById: null,
          feedbackNotes: null,
        },
        include: deliverableInclude,
      });

      await tx.deliverableHistory.create({
        data: {
          deliverableId: deliverable.id,
          actorId: actor.id,
          action: 'SUBMITTED',
          fileUrl,
          externalLink,
          feedbackNotes: notes,
        },
      });

      await tx.auditEvent.create({
        data: {
          actorId: actor.id,
          action: 'DELIVERABLE_SUBMITTED',
          entityType: 'PROJECT_DELIVERABLE',
          entityId: String(deliverable.id),
          metadata: {
            projectId,
            milestoneOrder: deliverable.milestoneOrder,
            hasPdf: !!fileUrl,
            hasVideo: !!externalLink,
            hasNotes: !!notes,
          },
        },
      });

      await this.reminders?.schedule(tx, deliverable.id, 'SUBMITTED', actor.id);
      return updated;
    });
  }

  async submitEvidence(
    projectId: number,
    milestoneOrDeliverableId: number,
    actor: DeliverablesActor,
    file?: DeliverableFile,
    dto?: SubmitEvidenceDto,
  ) {
    const membership = await this.requireProjectAccess(projectId, actor);
    this.requirePermission(actor, membership?.memberRole, [
      ProjectMemberRole.DEVELOPER,
      ProjectMemberRole.PRODUCT_OWNER,
    ]);
    const deliverable = await this.findDeliverable(
      projectId,
      milestoneOrDeliverableId,
    );
    await this.assertMilestonePaid(projectId, deliverable.milestoneOrder);
    if (
      deliverable.status !== DeliverableStatus.DRAFT &&
      deliverable.status !== DeliverableStatus.OBSERVED
    ) {
      throw new ConflictException(
        'El entregable no puede enviarse desde su estado actual',
      );
    }

    let fileUrl =
      dto?.pdfUrl?.trim() || dto?.fileUrl?.trim() || deliverable.fileUrl;

    if (file) {
      if (file.mimetype !== 'application/pdf') {
        throw new BadRequestException(
          'El archivo de evidencia técnica debe ser un documento PDF.',
        );
      }
      if (file.size > 50 * 1024 * 1024) {
        throw new BadRequestException(
          'El archivo PDF no puede exceder los 50 MB.',
        );
      }
      const uploaded = await this.uploadFile(
        projectId,
        deliverable.id,
        actor,
        file,
      );
      fileUrl = uploaded.url;
    }

    const videoUrl = dto?.videoUrl?.trim() || deliverable.externalLink;

    if (!fileUrl) {
      throw new BadRequestException(
        'El PDF técnico es obligatorio para enviar el hito a revisión.',
      );
    }
    if (!videoUrl) {
      throw new BadRequestException(
        'El video o enlace de demostración es obligatorio para enviar el hito a revisión.',
      );
    }

    try {
      const parsedUrl = new URL(videoUrl);
      if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
        throw new Error();
      }
    } catch {
      throw new BadRequestException(
        'El enlace de video/demostración debe ser una URL válida (http/https).',
      );
    }

    const notes = dto?.notes?.trim() || null;

    return this.prisma.$transaction(async (tx) => {
      const locked = await tx.$queryRawUnsafe<Array<{ status: string }>>(
        'SELECT id, status FROM ProjectDeliverable WHERE id = ? FOR UPDATE',
        deliverable.id,
      );
      if (locked?.[0] && !['DRAFT', 'OBSERVED'].includes(locked[0].status))
        throw new ConflictException(
          'El entregable cambió de estado; recarga antes de continuar.',
        );
      const updated = await tx.projectDeliverable.update({
        where: { id: deliverable.id },
        data: {
          fileUrl,
          externalLink: videoUrl,
          status: DeliverableStatus.IN_REVIEW,
          clientReviewStatus: 'PENDING',
          submittedAt: new Date(),
          reviewedAt: null,
          reviewedById: null,
          feedbackNotes: notes,
        },
        include: deliverableInclude,
      });

      await tx.deliverableHistory.create({
        data: {
          deliverableId: deliverable.id,
          actorId: actor.id,
          action: 'SUBMITTED',
          fileUrl,
          externalLink: videoUrl,
          feedbackNotes: notes,
        },
      });

      await tx.auditEvent.create({
        data: {
          actorId: actor.id,
          action: 'DELIVERABLE_EVIDENCE_SUBMITTED',
          entityType: 'PROJECT_DELIVERABLE',
          entityId: String(deliverable.id),
          metadata: {
            projectId,
            milestoneOrder: deliverable.milestoneOrder,
            hasPdf: !!fileUrl,
            hasVideo: !!videoUrl,
            hasNotes: !!notes,
          },
        },
      });

      await this.reminders?.schedule(tx, deliverable.id, 'SUBMITTED', actor.id);
      return {
        id: updated.id,
        milestoneId: updated.milestoneId ?? updated.milestoneOrder,
        projectId,
        title: updated.title,
        status: updated.status,
        pdfUrl: updated.fileUrl,
        videoUrl: updated.externalLink,
        notes: updated.feedbackNotes,
        submittedAt: updated.submittedAt,
      };
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
    await this.assertMilestonePaid(projectId, deliverable.milestoneOrder);
    const isClientReview = actor.role === PLATFORM_ROLES.CLIENT;
    if (
      isClientReview &&
      !(
        deliverable.status === DeliverableStatus.APPROVED &&
        deliverable.clientReviewStatus === 'PENDING'
      ) &&
      !(
        deliverable.status === DeliverableStatus.OBSERVED &&
        deliverable.clientReviewStatus === 'OBSERVED'
      )
    ) {
      throw new ConflictException(
        'El cliente puede aprobar u observar la entrega después de la aprobación técnica del Product Owner.',
      );
    }
    if (!isClientReview && deliverable.status !== DeliverableStatus.IN_REVIEW) {
      throw new ConflictException(
        'Solo se pueden revisar entregables en estado IN_REVIEW',
      );
    }
    if (!Object.values(DeliverableReviewDecision).includes(dto.decision)) {
      throw new BadRequestException('decision debe ser APPROVE u OBSERVE');
    }
    const isObserved = dto.decision === DeliverableReviewDecision.OBSERVE;
    const feedbackNotes = dto.feedbackNotes?.trim() || dto.comments?.trim();
    if (isObserved && !feedbackNotes) {
      throw new BadRequestException(
        'Las observaciones requieren feedbackNotes o comments',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const locked = await tx.$queryRawUnsafe<Array<{ status: string; clientReviewStatus: string }>>(
        'SELECT id, status, clientReviewStatus FROM ProjectDeliverable WHERE id = ? FOR UPDATE',
        deliverable.id,
      );
      const canReviewNow = isClientReview
        ? (locked?.[0]?.status === 'APPROVED' && locked[0].clientReviewStatus === 'PENDING') ||
          (locked?.[0]?.status === 'OBSERVED' && locked[0].clientReviewStatus === 'OBSERVED')
        : locked?.[0]?.status === 'IN_REVIEW';
      if (locked?.[0] && !canReviewNow)
        throw new ConflictException(
          'El entregable cambió de estado; recarga antes de continuar.',
        );
      const updated = await tx.projectDeliverable.update({
        where: { id: deliverable.id },
        data: {
          ...(isClientReview
            ? {
                clientReviewStatus: isObserved ? 'OBSERVED' : 'APPROVED',
                clientReviewedAt: new Date(),
                clientReviewedById: actor.id,
                clientFeedbackNotes: isObserved ? feedbackNotes : null,
                ...(isObserved
                  ? {}
                  : {
                      status: DeliverableStatus.APPROVED,
                      feedbackNotes: null,
                    }),
              }
            : {
                status: isObserved
                  ? DeliverableStatus.OBSERVED
                  : DeliverableStatus.APPROVED,
                feedbackNotes: isObserved ? feedbackNotes : null,
                reviewedAt: new Date(),
                reviewedById: actor.id,
                ...(!isObserved ? { clientReviewStatus: 'PENDING' } : {}),
              }),
        },
        include: deliverableInclude,
      });

      await tx.deliverableHistory.create({
        data: {
          deliverableId: deliverable.id,
          actorId: actor.id,
          action: isClientReview
            ? isObserved ? 'OBSERVED' : 'APPROVED'
            : isObserved ? 'OBSERVED' : 'APPROVED',
          fileUrl: deliverable.fileUrl,
          externalLink: deliverable.externalLink,
          feedbackNotes: feedbackNotes || null,
        },
      });

      await tx.auditEvent.create({
        data: {
          actorId: actor.id,
          action: isClientReview
            ? isObserved ? 'CLIENT_DELIVERABLE_OBSERVED' : 'CLIENT_DELIVERABLE_APPROVED'
            : isObserved ? 'DELIVERABLE_OBSERVED' : 'DELIVERABLE_APPROVED',
          entityType: 'PROJECT_DELIVERABLE',
          entityId: String(deliverable.id),
          metadata: {
            projectId,
            milestoneOrder: deliverable.milestoneOrder,
            hasFeedback: !!feedbackNotes,
            reviewBy: isClientReview ? 'CLIENT' : 'PRODUCT_OWNER',
          },
        },
      });

      if (!isObserved && !isClientReview)
        await this.reminders?.schedule(
          tx,
          deliverable.id,
          'APPROVED',
          actor.id,
        );
      return updated;
    });
  }

  async getHistory(
    projectId: number,
    deliverableIdOrMilestone: number,
    actor: DeliverablesActor,
  ) {
    await this.requireProjectAccess(projectId, actor);
    const deliverable = await this.findDeliverable(
      projectId,
      deliverableIdOrMilestone,
    );
    const history = await this.prisma.deliverableHistory.findMany({
      where: { deliverableId: deliverable.id },
      include: {
        actor: {
          select: {
            id: true,
            name: true,

            role: { select: { name: true } },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    return history.map((item) => ({
      id: item.id,
      action: item.action,
      actorId: item.actorId,
      actorName: item.actor.name,
      actorRole: item.actor.role.name,
      fileUrl: item.fileUrl,
      videoUrl: item.externalLink,
      comments: item.feedbackNotes,
      timestamp: item.createdAt,
    }));
  }

  async uploadFile(
    projectId: number,
    deliverableId: number,
    actor: DeliverablesActor,
    file: {
      buffer: Buffer;
      mimetype: string;
      originalname: string;
      size: number;
    },
  ) {
    const membership = await this.requireProjectAccess(projectId, actor);
    this.requirePermission(actor, membership?.memberRole, [
      ProjectMemberRole.DEVELOPER,
      ProjectMemberRole.PRODUCT_OWNER,
    ]);
    const deliverable = await this.findDeliverable(projectId, deliverableId);
    await this.assertMilestonePaid(projectId, deliverable.milestoneOrder);

    const allowedMimes = ['application/pdf', 'video/mp4', 'video/webm'];
    if (!allowedMimes.includes(file.mimetype)) {
      throw new BadRequestException(
        'Formato no permitido. Solo se aceptan archivos PDF, MP4 o WebM.',
      );
    }

    if (file.size > 100 * 1024 * 1024) {
      throw new BadRequestException('El archivo no puede exceder los 100 MB.');
    }

    const ext =
      nodePath.extname(file.originalname) ||
      (file.mimetype === 'application/pdf' ? '.pdf' : '.mp4');
    const key = `deliverable-${projectId}-${deliverableId}-${randomUUID()}${ext}`;

    let url: string;
    let storageKey = key;

    if (this.storageProvider) {
      const stored = await this.storageProvider.save({
        key,
        content: file.buffer,
        mimeType: file.mimetype,
        metadata: {
          projectId: String(projectId),
          deliverableId: String(deliverableId),
          originalName: file.originalname,
        },
      });
      storageKey = stored.storageKey;
    } else {
      throw new NotFoundException('El almacenamiento de archivos no está disponible.');
    }
    const storageBaseUrl =
      process.env.STORAGE_BASE_URL || 'http://localhost:3000/storage';
    url = `${storageBaseUrl.replace(/\/+$/, '')}/deliverables/${encodeURIComponent(storageKey)}`;

    return {
      url,
      storageKey,
      filename: file.originalname,
      sizeBytes: file.size,
      mimeType: file.mimetype,
    };
  }

  async getFile(
    projectId: number,
    deliverableId: number,
    actor: DeliverablesActor,
  ) {
    const membership = await this.requireProjectAccess(projectId, actor);
    this.requirePermission(actor, membership?.memberRole, [
      ProjectMemberRole.CLIENT,
      ProjectMemberRole.DEVELOPER,
      ProjectMemberRole.PRODUCT_OWNER,
    ]);
    const deliverable = await this.findDeliverable(projectId, deliverableId);
    if (!deliverable.fileUrl || !this.storageProvider) {
      throw new NotFoundException('El archivo del entregable no está disponible.');
    }

    let storageKey: string;
    try {
      const parsed = new URL(deliverable.fileUrl, 'http://localhost');
      storageKey = decodeURIComponent(parsed.pathname.split('/').filter(Boolean).pop() ?? '');
    } catch {
      throw new NotFoundException('No se encontró el archivo del entregable.');
    }
    if (!storageKey || storageKey.includes('/') || storageKey.includes('\\')) {
      throw new NotFoundException('No se encontró el archivo del entregable.');
    }
    const stored = await this.storageProvider.get(storageKey);
    if (!stored) throw new NotFoundException('El contenido del archivo no está disponible.');

    const filename = storageKey.replace(/[\r\n"\\]/g, '_');
    return new StreamableFile(stored.content, {
      type: stored.mimeType,
      disposition: `inline; filename="${filename}"`,
      length: stored.content.length,
    });
  }

  private async assertMilestonePaid(projectId: number, sequence: number) {
    const milestone = await this.prisma.projectMilestone.findFirst({
      where: { projectId, sequence },
      include: {
        paymentSchedule: {
          include: {
            payments: { where: { status: 'CONFIRMED' }, select: { id: true } },
          },
        },
      },
    });
    if (milestone && milestone.paymentSchedule.payments.length === 0) {
      throw new ConflictException(
        `No se puede continuar con el Hito ${sequence} hasta que el cliente confirme el abono correspondiente.`,
      );
    }
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

  async findDeliverable(projectId: number, deliverableIdOrMilestone: number) {
    let deliverable = await this.prisma.projectDeliverable.findFirst({
      where: { id: deliverableIdOrMilestone, projectId },
    });
    if (!deliverable) {
      deliverable = await this.prisma.projectDeliverable.findFirst({
        where: {
          projectId,
          OR: [
            { milestoneId: deliverableIdOrMilestone },
            { milestoneOrder: deliverableIdOrMilestone },
          ],
        },
      });
    }
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

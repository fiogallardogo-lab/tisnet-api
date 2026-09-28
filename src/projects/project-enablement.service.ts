import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { auditRecord } from '../audit/audit.service';

export interface EnableFromPaymentOptions {
  /** The PaymentSchedule that was just confirmed */
  scheduleId: number;
  /** The Payment.id that was created */
  paymentId: number;
  /** Optional actor (webhook user); null for automated events */
  actorId?: number;
}

/**
 * S14-B01 / S14-B02
 *
 * Responsible for the transition:
 *   Confirmed advance payment → Project created / enabled (IN_DEVELOPMENT)
 *
 * Design invariants:
 *  - Idempotent: calling with the same scheduleId twice is safe (returns existing project).
 *  - Uses SELECT FOR UPDATE to prevent race conditions (S14-B09).
 *  - Only fires when the confirmed schedule is sequence=1 (the advance payment).
 *  - Emits PROJECT_ENABLED audit event exactly once.
 */
@Injectable()
export class ProjectEnablementService {
  private readonly logger = new Logger(ProjectEnablementService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Called by PaymentsService after recording a CONFIRMED payment.
   * Must be called inside the same transaction as the payment, or as a
   * separate, idempotent follow-up call.
   */
  async enableFromPayment(opts: EnableFromPaymentOptions): Promise<void> {
    const { scheduleId, paymentId, actorId } = opts;

    try {
      await this.prisma.$transaction(async (tx) => {
        // Lock the schedule row to serialise concurrent webhooks for the same quote
        await tx.$queryRaw`SELECT id FROM PaymentSchedule WHERE id = ${scheduleId} FOR UPDATE`;

        const schedule = await tx.paymentSchedule.findUnique({
          where: { id: scheduleId },
          include: {
            quoteVersion: {
              include: {
                quote: { include: { prospect: true } },
              },
            },
          },
        });

        if (!schedule) {
          this.logger.warn(`[Enablement] Schedule ${scheduleId} not found, skipping.`);
          return;
        }

        // Only the advance payment (sequence=1) triggers project enablement
        if (schedule.sequence !== 1) {
          this.logger.log(`[Enablement] Schedule ${scheduleId} is sequence=${schedule.sequence}, not the advance. Skipping.`);
          return;
        }

        const { quoteVersion } = schedule;
        const quote = quoteVersion.quote;

        // Guard: only the active version should trigger enablement
        if (quote.activeVersion !== quoteVersion.version) {
          this.logger.warn(`[Enablement] Quote ${quote.id} active version mismatch. Skipping.`);
          return;
        }

        // Idempotency check: project may already exist for this quote
        const existing = await tx.project.findUnique({
          where: { quoteId: quote.id },
          select: { id: true },
        });

        if (existing) {
          this.logger.log(
            `[Enablement] Project ${existing.id} already exists for quote ${quote.id}. Idempotent skip.`,
          );
          return;
        }

        // Require the quote to have a prospect (contact person)
        if (!quote.prospectId || !quote.prospect) {
          throw new ConflictException(
            `Quote ${quote.id} has no prospect. Cannot enable project automatically.`,
          );
        }

        // Resolve the CLIENT user attached to this quote version
        const client = await tx.user.findFirst({
          where: {
            id: quoteVersion.clientUserId,
            isActive: true,
            role: { name: 'CLIENT' },
          },
          select: { id: true, name: true },
        });

        if (!client) {
          throw new ConflictException(
            `Client user ${quoteVersion.clientUserId} is not available for project enablement.`,
          );
        }

        // Derive default category: use first active category
        const defaultCategory = await tx.category.findFirst({
          where: { isActive: true },
          orderBy: { id: 'asc' },
          select: { id: true },
        });

        if (!defaultCategory) {
          throw new ConflictException('No active category found to assign to the project.');
        }

        const scope = quoteVersion.scope as { description?: string };
        const projectName = scope.description?.slice(0, 150) || `Proyecto ${quote.publicCode}`;
        const baseSlug = quote.publicCode.toLowerCase().replace(/[^a-z0-9]+/g, '-');

        // Ensure slug uniqueness
        const slug = await this.uniqueSlug(tx, baseSlug);

        const project = await tx.project.create({
          data: {
            name: projectName,
            slug,
            shortDescription: (scope.description || projectName).slice(0, 300),
            description: scope.description || projectName,
            categoryId: defaultCategory.id,
            status: 'IN_DEVELOPMENT',
            quoteId: quote.id,
            clientUserId: client.id,
            prospectId: quote.prospectId,
            // PO not yet assigned at enablement; assigned in a separate step (S14-B05)
            members: {
              create: [
                {
                  userId: client.id,
                  memberRole: 'CLIENT',
                  participationBasisPoints: 0,
                },
              ],
            },
          },
          select: { id: true },
        });

        await auditRecord(tx, {
          actorId,
          action: 'PROJECT_ENABLED',
          entityType: 'PROJECT',
          entityId: String(project.id),
          metadata: {
            quoteId: quote.id,
            scheduleId,
            paymentId,
            triggeredBy: actorId ? 'ADMIN' : 'WEBHOOK',
          },
        });

        this.logger.log(
          `[Enablement] Project ${project.id} created and enabled for quote ${quote.id} (payment scheduleId=${scheduleId}).`,
        );
      });
    } catch (err: any) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        // Unique constraint on quoteId — project was created by a concurrent request
        this.logger.log(
          `[Enablement] Concurrent project creation detected for scheduleId=${scheduleId}. Safe idempotent skip.`,
        );
        return;
      }
      this.logger.error(
        `[Enablement] Error enabling project for scheduleId=${scheduleId}: ${err.message}`,
        err.stack,
      );
      throw err;
    }
  }

  /**
   * S14-B05: Assign a Product Owner to an existing project.
   * Admin-only. Creates or updates the PO membership and sets project.productOwnerId.
   * Emits PO_ASSIGNED audit event.
   */
  async assignProductOwner(
    projectId: number,
    poUserId: number,
    actorId: number,
  ): Promise<{ projectId: number; productOwnerId: number }> {
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM Project WHERE id = ${projectId} FOR UPDATE`;

      const project = await tx.project.findUnique({
        where: { id: projectId },
        select: { id: true, productOwnerId: true },
      });

      if (!project) throw new NotFoundException('Proyecto no encontrado.');

      const po = await tx.user.findFirst({
        where: { id: poUserId, isActive: true, role: { name: 'PRODUCT_OWNER' } },
        select: { id: true },
      });

      if (!po) {
        throw new ConflictException(
          'El usuario no existe, está inactivo, o no tiene rol PRODUCT_OWNER.',
        );
      }

      // Deactivate previous PO membership if different
      if (project.productOwnerId && project.productOwnerId !== poUserId) {
        await tx.projectMember.updateMany({
          where: { projectId, memberRole: 'PRODUCT_OWNER' },
          data: { isActive: false, participationBasisPoints: 0 },
        });
      }

      // Upsert new PO membership
      await tx.projectMember.upsert({
        where: { projectId_userId: { projectId, userId: poUserId } },
        create: {
          projectId,
          userId: poUserId,
          memberRole: 'PRODUCT_OWNER',
          participationBasisPoints: 0,
          isActive: true,
        },
        update: {
          memberRole: 'PRODUCT_OWNER',
          isActive: true,
        },
      });

      await tx.project.update({
        where: { id: projectId },
        data: { productOwnerId: poUserId },
      });

      await auditRecord(tx, {
        actorId,
        action: 'PO_ASSIGNED',
        entityType: 'PROJECT',
        entityId: String(projectId),
        metadata: { productOwnerId: poUserId },
      });

      return { projectId, productOwnerId: poUserId };
    });
  }

  /**
   * S14-B03: Returns whether a project is locked (no confirmed advance payment).
   */
  async isProjectLocked(projectId: number): Promise<boolean> {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { quoteId: true },
    });

    if (!project?.quoteId) return true;

    const quote = await this.prisma.quote.findUnique({
      where: { id: project.quoteId },
      select: { activeVersion: true },
    });

    if (!quote?.activeVersion) return true;

    const advancePayment = await this.prisma.paymentSchedule.findFirst({
      where: {
        sequence: 1,
        quoteVersion: { quoteId: project.quoteId, version: quote.activeVersion },
        payments: { some: { status: 'CONFIRMED' } },
      },
      select: { id: true },
    });

    return !advancePayment;
  }

  // ─── Helpers ────────────────────────────────────────────────────────────────

  private async uniqueSlug(
    tx: Prisma.TransactionClient,
    base: string,
  ): Promise<string> {
    let candidate = base.slice(0, 180);
    let attempt = 0;
    while (true) {
      const existing = await tx.project.findFirst({
        where: { slug: candidate },
        select: { id: true },
      });
      if (!existing) return candidate;
      attempt++;
      const suffix = `-${attempt}`;
      candidate = `${base.slice(0, 180 - suffix.length)}${suffix}`;
    }
  }
}

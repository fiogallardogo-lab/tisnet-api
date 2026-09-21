import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { DeliverableStatus, ProjectMemberRole } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../prisma/prisma.service';
import { DeliverablesService } from './deliverables.service';
import { DeliverableReviewDecision } from './dto/review-deliverable.dto';

describe('DeliverablesService', () => {
  const prisma = {
    project: { findUnique: vi.fn() },
    projectMember: { findUnique: vi.fn() },
    projectDeliverable: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  };
  const service = new DeliverablesService(prisma as unknown as PrismaService);
  const admin = { id: 1, role: 'ADMIN' };
  const developer = { id: 2, role: 'DEVELOPER' };
  const productOwner = { id: 3, role: 'PRODUCT_OWNER' };
  const client = { id: 4, role: 'CLIENT' };

  const deliverable = {
    id: 10,
    projectId: 7,
    title: 'Hito uno',
    description: 'Descripción',
    milestoneOrder: 1,
    dueDate: new Date('2026-10-15'),
    status: DeliverableStatus.DRAFT,
    fileUrl: null,
    externalLink: null,
    feedbackNotes: null,
    submittedAt: null,
    reviewedAt: null,
    reviewedById: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    prisma.project.findUnique.mockResolvedValue({ id: 7 });
    prisma.projectDeliverable.findFirst.mockResolvedValue(deliverable);
    prisma.projectDeliverable.findMany.mockResolvedValue([deliverable]);
    prisma.projectDeliverable.create.mockResolvedValue(deliverable);
    prisma.projectDeliverable.update.mockImplementation(({ data }) => ({
      ...deliverable,
      ...data,
    }));
  });

  function membership(memberRole: ProjectMemberRole, isActive = true) {
    prisma.projectMember.findUnique.mockResolvedValue({
      id: 1,
      projectId: 7,
      userId:
        memberRole === ProjectMemberRole.DEVELOPER
          ? 2
          : memberRole === ProjectMemberRole.PRODUCT_OWNER
            ? 3
            : 4,
      memberRole,
      isActive,
      createdAt: new Date(),
    });
  }

  it('permite listar a un miembro activo y ordena por milestoneOrder', async () => {
    membership(ProjectMemberRole.DEVELOPER);
    await expect(service.list(7, developer)).resolves.toEqual([deliverable]);
    expect(prisma.projectDeliverable.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { projectId: 7 } }),
    );
  });

  it('permite a administradores listar sin membresía', async () => {
    await service.list(7, admin);
    expect(prisma.projectMember.findUnique).not.toHaveBeenCalled();
  });

  it('rechaza acceso sin membresía activa o con rol inconsistente', async () => {
    membership(ProjectMemberRole.DEVELOPER, false);
    await expect(service.list(7, developer)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    membership(ProjectMemberRole.CLIENT);
    await expect(service.list(7, developer)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('responde 404 si el proyecto no existe', async () => {
    prisma.project.findUnique.mockResolvedValue(null);
    await expect(service.list(999, admin)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('solo permite crear hitos a PO asignado o administradores', async () => {
    membership(ProjectMemberRole.PRODUCT_OWNER);
    await service.create(7, productOwner, {
      title: '  Hito uno  ',
      description: '  Descripción  ',
      milestoneOrder: 1,
      dueDate: '2026-10-15',
    });
    expect(prisma.projectDeliverable.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ title: 'Hito uno' }),
      }),
    );

    membership(ProjectMemberRole.DEVELOPER);
    await expect(
      service.create(7, developer, {
        title: 'Hito',
        description: 'Descripción',
        milestoneOrder: 2,
        dueDate: '2026-10-16',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('exige evidencia y permite submit desde DRAFT', async () => {
    membership(ProjectMemberRole.DEVELOPER);
    await expect(service.submit(7, 10, developer, {})).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await service.submit(7, 10, developer, {
      externalLink: 'https://example.com/demo',
    });
    expect(prisma.projectDeliverable.update).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: DeliverableStatus.IN_REVIEW }),
      }),
    );
  });

  it('permite reenvío desde OBSERVED y limpia la revisión anterior', async () => {
    membership(ProjectMemberRole.PRODUCT_OWNER);
    prisma.projectDeliverable.findFirst.mockResolvedValue({
      ...deliverable,
      status: DeliverableStatus.OBSERVED,
      feedbackNotes: 'Corregir',
    });
    await service.submit(7, 10, productOwner, {
      fileUrl: 'https://example.com/v2.pdf',
    });
    expect(prisma.projectDeliverable.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          feedbackNotes: null,
          reviewedById: null,
        }),
      }),
    );
  });

  it('rechaza submit desde IN_REVIEW o APPROVED con 409', async () => {
    membership(ProjectMemberRole.DEVELOPER);
    for (const status of [
      DeliverableStatus.IN_REVIEW,
      DeliverableStatus.APPROVED,
    ]) {
      prisma.projectDeliverable.findFirst.mockResolvedValue({
        ...deliverable,
        status,
      });
      await expect(
        service.submit(7, 10, developer, {
          fileUrl: 'https://example.com/file.pdf',
        }),
      ).rejects.toBeInstanceOf(ConflictException);
    }
  });

  it('permite al cliente o PO revisar un entregable IN_REVIEW', async () => {
    membership(ProjectMemberRole.CLIENT);
    prisma.projectDeliverable.findFirst.mockResolvedValue({
      ...deliverable,
      status: DeliverableStatus.IN_REVIEW,
    });
    await service.review(7, 10, client, {
      decision: DeliverableReviewDecision.APPROVE,
    });
    expect(prisma.projectDeliverable.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: DeliverableStatus.APPROVED,
          reviewedById: client.id,
        }),
      }),
    );
  });

  it('exige notas al observar y bloquea revisiones fuera de IN_REVIEW', async () => {
    membership(ProjectMemberRole.PRODUCT_OWNER);
    prisma.projectDeliverable.findFirst.mockResolvedValue({
      ...deliverable,
      status: DeliverableStatus.IN_REVIEW,
    });
    await expect(
      service.review(7, 10, productOwner, {
        decision: DeliverableReviewDecision.OBSERVE,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    prisma.projectDeliverable.findFirst.mockResolvedValue({
      ...deliverable,
      status: DeliverableStatus.APPROVED,
    });
    await expect(
      service.review(7, 10, productOwner, {
        decision: DeliverableReviewDecision.APPROVE,
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('impide a developer revisar y a cliente enviar evidencia', async () => {
    membership(ProjectMemberRole.DEVELOPER);
    await expect(
      service.review(7, 10, developer, {
        decision: DeliverableReviewDecision.APPROVE,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);

    membership(ProjectMemberRole.CLIENT);
    await expect(
      service.submit(7, 10, client, {
        fileUrl: 'https://example.com/file.pdf',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});

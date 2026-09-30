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
    $queryRawUnsafe: vi.fn(),
    project: { findUnique: vi.fn() },
    projectMember: { findUnique: vi.fn() },
    projectDeliverable: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    deliverableHistory: {
      create: vi.fn(),
      findMany: vi.fn(),
    },
    auditEvent: {
      create: vi.fn(),
    },
    $transaction: vi.fn(async (cb) => cb(prisma)),
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

  describe('Sprint 15 B: Evidencia completa e historial', () => {
    it('S15-B01: exige PDF y video en submitEvidence para pasar a IN_REVIEW', async () => {
      membership(ProjectMemberRole.DEVELOPER);

      // Falta video
      await expect(
        service.submitEvidence(7, 10, developer, undefined, {
          pdfUrl: 'https://example.com/doc.pdf',
          videoUrl: '',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);

      // Falta PDF
      await expect(
        service.submitEvidence(7, 10, developer, undefined, {
          videoUrl: 'https://loom.com/share/demo',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);

      // Con ambos válidos
      const result = await service.submitEvidence(7, 10, developer, undefined, {
        pdfUrl: 'https://example.com/doc.pdf',
        videoUrl: 'https://loom.com/share/demo',
        notes: 'Notas de entrega',
      });

      expect(result.status).toBe(DeliverableStatus.IN_REVIEW);
      expect(result.pdfUrl).toBe('https://example.com/doc.pdf');
      expect(result.videoUrl).toBe('https://loom.com/share/demo');
      expect(prisma.deliverableHistory.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'SUBMITTED',
            fileUrl: 'https://example.com/doc.pdf',
            externalLink: 'https://loom.com/share/demo',
          }),
        }),
      );
    });

    it('S15-B05: registra historial cronológico y retorna eventos formateados', async () => {
      membership(ProjectMemberRole.CLIENT);
      prisma.deliverableHistory.findMany.mockResolvedValue([
        {
          id: 1,
          action: 'SUBMITTED',
          actorId: 2,
          actor: {
            id: 2,
            name: 'Dev User',
            email: 'dev@test.com',
            role: { name: 'DEVELOPER' },
          },
          fileUrl: 'https://example.com/doc.pdf',
          externalLink: 'https://loom.com/share/demo',
          feedbackNotes: null,
          createdAt: new Date('2026-10-01T10:00:00Z'),
        },
        {
          id: 2,
          action: 'OBSERVED',
          actorId: 4,
          actor: {
            id: 4,
            name: 'Client User',
            email: 'cli@test.com',
            role: { name: 'CLIENT' },
          },
          fileUrl: 'https://example.com/doc.pdf',
          externalLink: 'https://loom.com/share/demo',
          feedbackNotes: 'Ajustar contraste',
          createdAt: new Date('2026-10-01T12:00:00Z'),
        },
      ]);

      const history = await service.getHistory(7, 10, client);
      expect(history.length).toBe(2);
      expect(history[0].action).toBe('SUBMITTED');
      expect(history[1].action).toBe('OBSERVED');
      expect(history[1].comments).toBe('Ajustar contraste');
    });

    it('permite review con formato de Responsable C (status y comments)', async () => {
      membership(ProjectMemberRole.PRODUCT_OWNER);
      prisma.projectDeliverable.findFirst.mockResolvedValue({
        ...deliverable,
        status: DeliverableStatus.IN_REVIEW,
      });

      await service.review(7, 10, productOwner, {
        status: 'APPROVED',
        comments: 'Aprobación oficial',
      });

      expect(prisma.projectDeliverable.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: DeliverableStatus.APPROVED,
          }),
        }),
      );
      expect(prisma.deliverableHistory.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'APPROVED',
          }),
        }),
      );
    });
  });
});

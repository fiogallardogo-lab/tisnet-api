import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../prisma/prisma.service';
import { ContributionsService } from './contributions.service';

describe('ContributionsService', () => {
  let service: ContributionsService;
  let prisma: any;

  const po = { id: 3, role: 'PRODUCT_OWNER' };
  const dev1 = { id: 10, role: 'DEVELOPER' };

  const mockProject = {
    id: 100,
    clientUserId: 4,
    productOwnerId: 3,
  };

  const mockDeliverable = {
    id: 50,
    projectId: 100,
    milestoneId: 5,
    milestoneOrder: 1,
    title: 'Hito 1',
  };

  beforeEach(() => {
    prisma = {
      project: {
        findUnique: vi.fn().mockResolvedValue(mockProject),
      },
      projectMember: {
        findUnique: vi.fn(),
        findMany: vi.fn(),
      },
      projectDeliverable: {
        findFirst: vi.fn().mockResolvedValue(mockDeliverable),
        findMany: vi.fn(),
      },
      projectMilestone: {
        findFirst: vi.fn().mockResolvedValue(null),
      },
      milestoneContribution: {
        deleteMany: vi.fn(),
        create: vi.fn(),
        findMany: vi.fn(),
      },
      auditEvent: {
        create: vi.fn(),
      },
      $transaction: vi.fn(async (cb) => cb(prisma)),
    };

    service = new ContributionsService(prisma as unknown as PrismaService);
  });

  it('permite al PO registrar contribuciones válidas sumando 100%', async () => {
    prisma.projectMember.findUnique.mockResolvedValue({
      projectId: 100,
      userId: 3,
      memberRole: 'PRODUCT_OWNER',
      isActive: true,
    });
    prisma.projectMember.findMany.mockResolvedValue([
      { userId: 10 },
      { userId: 12 },
    ]);

    prisma.milestoneContribution.create.mockImplementation(({ data }: any) => ({
      id: Math.floor(Math.random() * 1000),
      ...data,
      user: {
        id: data.userId,
        name: data.userId === 10 ? 'Dev 10' : 'Dev 12',
        email: `dev${data.userId}@test.com`,
        role: { name: 'DEVELOPER' },
      },
    }));

    const result = await service.recordContributions(100, 1, po, {
      contributions: [
        { userId: 10, percentage: 70, description: 'Backend comercial' },
        { userId: 12, percentage: 30, description: 'Frontend QA' },
      ],
    });

    expect(result.length).toBe(2);
    expect(prisma.milestoneContribution.deleteMany).toHaveBeenCalled();
    expect(prisma.milestoneContribution.create).toHaveBeenCalledTimes(2);
    expect(prisma.auditEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'MILESTONE_CONTRIBUTIONS_SAVED',
          entityType: 'PROJECT_MILESTONE',
        }),
      }),
    );
  });

  it('rechaza si la suma de porcentajes no es 100%', async () => {
    prisma.projectMember.findUnique.mockResolvedValue({
      projectId: 100,
      userId: 3,
      memberRole: 'PRODUCT_OWNER',
      isActive: true,
    });

    await expect(
      service.recordContributions(100, 1, po, {
        contributions: [
          { userId: 10, percentage: 60, description: 'Backend' },
          { userId: 12, percentage: 30, description: 'Frontend' },
        ],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rechaza si hay usuarios duplicados en el mismo hito', async () => {
    prisma.projectMember.findUnique.mockResolvedValue({
      projectId: 100,
      userId: 3,
      memberRole: 'PRODUCT_OWNER',
      isActive: true,
    });

    await expect(
      service.recordContributions(100, 1, po, {
        contributions: [
          { userId: 10, percentage: 50, description: 'Tarea 1' },
          { userId: 10, percentage: 50, description: 'Tarea 2' },
        ],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rechaza si un integrante no pertenece al proyecto', async () => {
    prisma.projectMember.findUnique.mockResolvedValue({
      projectId: 100,
      userId: 3,
      memberRole: 'PRODUCT_OWNER',
      isActive: true,
    });
    prisma.projectMember.findMany.mockResolvedValue([{ userId: 10 }]);

    await expect(
      service.recordContributions(100, 1, po, {
        contributions: [
          { userId: 10, percentage: 50, description: 'Tarea 1' },
          { userId: 99, percentage: 50, description: 'Tarea 2' },
        ],
      }),
    ).rejects.toThrow(/no es un integrante activo/);
  });

  it('rechaza si un DEVELOPER intenta registrar contribuciones de otros integrantes', async () => {
    prisma.projectMember.findUnique.mockResolvedValue({
      projectId: 100,
      userId: 10,
      memberRole: 'DEVELOPER',
      isActive: true,
    });

    await expect(
      service.recordContributions(100, 1, dev1, {
        contributions: [
          { userId: 20, percentage: 100, description: 'Desarrollo' },
        ],
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('calcula acumulados del equipo en getProjectContributions', async () => {
    prisma.projectMember.findUnique.mockResolvedValue({
      projectId: 100,
      userId: 10,
      memberRole: 'DEVELOPER',
      isActive: true,
    });

    prisma.projectDeliverable.findMany.mockResolvedValue([
      { id: 50, title: 'Hito 1', milestoneOrder: 1, status: 'APPROVED', dueDate: new Date() },
      { id: 51, title: 'Hito 2', milestoneOrder: 2, status: 'IN_REVIEW', dueDate: new Date() },
    ]);

    prisma.milestoneContribution.findMany.mockResolvedValue([
      {
        id: 1,
        deliverableId: 50,
        userId: 10,
        percentage: 60,
        description: 'Backend 1',
        user: { id: 10, name: 'Dev 10', email: 'd10@test.com', role: { name: 'DEVELOPER' } },
      },
      {
        id: 2,
        deliverableId: 50,
        userId: 12,
        percentage: 40,
        description: 'Frontend 1',
        user: { id: 12, name: 'Dev 12', email: 'd12@test.com', role: { name: 'DEVELOPER' } },
      },
      {
        id: 3,
        deliverableId: 51,
        userId: 10,
        percentage: 80,
        description: 'Backend 2',
        user: { id: 10, name: 'Dev 10', email: 'd10@test.com', role: { name: 'DEVELOPER' } },
      },
      {
        id: 4,
        deliverableId: 51,
        userId: 12,
        percentage: 20,
        description: 'Frontend 2',
        user: { id: 12, name: 'Dev 12', email: 'd12@test.com', role: { name: 'DEVELOPER' } },
      },
    ]);

    const report = await service.getProjectContributions(100, dev1);
    expect(report.totalMilestones).toBe(2);
    expect(report.teamSummary.length).toBe(2);

    const dev10Summary = report.teamSummary.find((s) => s.user.id === 10);
    expect(dev10Summary?.averagePercentage).toBe(70); // (60 + 80) / 2
    expect(dev10Summary?.milestonesContributed).toBe(2);
  });

  it('exact ID lookup never falls back to a colliding milestone or sequence', async () => {
    prisma.projectDeliverable.findFirst.mockImplementation(({ where }: any) =>
      where.OR.length === 1 && where.OR[0].id === 5 ? null : mockDeliverable);
    await expect(service.getMilestoneContributions(100, 5, po, true)).rejects.toThrow('Entregable no encontrado');
    expect(prisma.projectMilestone.findFirst).not.toHaveBeenCalled();
    expect(prisma.milestoneContribution.findMany).not.toHaveBeenCalled();
  });
  it('exact write rejects a colliding ID before deleting contributions', async () => {
    prisma.projectDeliverable.findFirst.mockResolvedValue(null);
    await expect(service.recordContributions(100, 5, po, {contributions:[{userId:10,percentage:100,description:'Trabajo'}]}, true)).rejects.toThrow('Entregable no encontrado');
    expect(prisma.milestoneContribution.deleteMany).not.toHaveBeenCalled();
  });
});

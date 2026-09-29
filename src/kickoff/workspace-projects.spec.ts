import { describe, expect, it, vi } from 'vitest';
import { KickoffService } from './kickoff.service';

describe('Workspace assigned projects', () => {
  it('returns only operational data and calculates progress from approvals', async () => {
    const prisma = {
      project: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: 12,
            name: 'Plataforma TISNET',
            shortDescription: 'Gestión integral',
            description: 'Proyecto privado',
            status: 'IN_DEVELOPMENT',
            developmentDate: new Date('2026-09-01T00:00:00.000Z'),
            updatedAt: new Date(),
            members: [{ id: 1 }, { id: 2 }],
            deliverables: [
              {
                id: 1,
                milestoneId: 21,
                title: 'Diseño',
                status: 'APPROVED',
                milestoneOrder: 1,
                dueDate: new Date('2026-09-15T00:00:00.000Z'),
              },
              {
                id: 2,
                milestoneId: 22,
                title: 'Backend',
                status: 'DRAFT',
                milestoneOrder: 2,
                dueDate: new Date('2026-09-30T00:00:00.000Z'),
              },
            ],
          },
        ]),
      },
    };
    const service = new KickoffService(prisma as never, {} as never);
    const result = await service.listAssignedProjects({
      id: 8,
      role: 'DEVELOPER',
    });
    expect(prisma.project.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          status: { not: 'ARCHIVED' },
          members: {
            some: { userId: 8, isActive: true, memberRole: 'DEVELOPER' },
          },
        },
      }),
    );
    expect(result[0]).toMatchObject({
      id: 12,
      progress: 50,
      teamSize: 2,
      totalDeliverables: 2,
      pendingDeliverables: 1,
    });
    expect(result[0]).not.toHaveProperty('quoteId');
  });
});

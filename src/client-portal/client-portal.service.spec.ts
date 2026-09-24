import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ClientPortalService } from './client-portal.service';
import type { PrismaService } from '../prisma/prisma.service';

describe('ClientPortalService', () => {
  const prisma = {
    user: { findUniqueOrThrow: vi.fn() },
    project: { findMany: vi.fn() },
    quote: { findMany: vi.fn() },
    publicQuote: { findMany: vi.fn() },
    meeting: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn(), updateMany: vi.fn() },
    adminProfile: { findFirst: vi.fn() },
    prospect: { findFirst: vi.fn(), update: vi.fn(), create: vi.fn() },
    $transaction: vi.fn(),
  };
  const service = new ClientPortalService(prisma as unknown as PrismaService);
  beforeEach(() => {
    vi.resetAllMocks();
    prisma.user.findUniqueOrThrow.mockResolvedValue({ name: 'Lucía', email: 'lucia@example.test' });
    prisma.project.findMany.mockResolvedValue([]);
    prisma.quote.findMany.mockResolvedValue([]);
    prisma.publicQuote.findMany.mockResolvedValue([]);
    prisma.meeting.findMany.mockResolvedValue([]);
    prisma.$transaction.mockImplementation((callback) => callback(prisma));
  });
  it('scopes all private records to the authenticated client and never returns internal user fields', async () => {
    const result = await service.overview({ id: 7, email: 'lucia@example.test' });
    expect(prisma.project.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          members: { some: { userId: 7, memberRole: 'CLIENT', isActive: true } },
          status: { not: 'ARCHIVED' },
        },
      })
    );
    expect(prisma.quote.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { prospect: { userId: 7 } } })
    );
    expect(prisma.meeting.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { prospect: { userId: 7 } } })
    );
    expect(prisma.publicQuote.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { contact: { path: '$.email', equals: 'lucia@example.test' } },
      })
    );
    expect(prisma.user.findUniqueOrThrow).toHaveBeenCalledWith({
      where: { id: 7 },
      select: { name: true, email: true },
    });
    expect(result).toMatchObject({ projects: [], meetings: [], advisor: null, activity: [] });
  });
  it('calculates progress from approved deliverables and avoids invented dates', async () => {
    prisma.project.findMany.mockResolvedValue([
      {
        id: 3,
        name: 'Web',
        shortDescription: 'Proyecto',
        description: 'Detalles',
        status: 'IN_DEVELOPMENT',
        developmentDate: null,
        members: [{ id: 1 }],
        deliverables: [
          {
            id: 1,
            title: 'Diseño',
            status: 'APPROVED',
            dueDate: new Date('2026-11-01'),
            updatedAt: new Date('2026-10-01'),
            submittedAt: new Date('2026-10-01'),
          },
          {
            id: 2,
            title: 'Desarrollo',
            status: 'DRAFT',
            dueDate: new Date('2026-12-01'),
            updatedAt: new Date('2026-10-01'),
            submittedAt: null,
          },
        ],
      },
    ]);
    const result = await service.overview({ id: 7, email: 'lucia@example.test' });
    expect(result.projects[0]).toMatchObject({
      progress: 50,
      startedAt: null,
      teamSize: 1,
      pendingDeliverables: 1,
      estimatedDeliveryAt: '2026-12-01',
    });
    expect(result.activity).toHaveLength(1);
  });
  it('cannot cancel another client’s meeting or a completed meeting', async () => {
    prisma.meeting.updateMany.mockResolvedValue({ count: 0 });
    await expect(service.cancelMeeting(7, 99)).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.meeting.updateMany).toHaveBeenCalledWith({
      where: { id: 99, prospect: { userId: 7 }, status: { in: ['REQUESTED', 'CONFIRMED'] } },
      data: { status: 'CANCELED' },
    });
  });
  it('rejects a past date without writing anything', async () => {
    await expect(
      service.requestMeeting(
        { id: 7, email: 'lucia@example.test' },
        { advisorId: 2, scheduledAt: '2020-01-01' }
      )
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
  it('persists a request under the current account without claiming it is confirmed', async () => {
    prisma.adminProfile.findFirst.mockResolvedValue({ id: 2 });
    prisma.prospect.findFirst.mockResolvedValue({ id: 10, userId: 7 });
    prisma.prospect.update.mockResolvedValue({ id: 10, userId: 7 });
    prisma.meeting.findFirst.mockResolvedValue(null);
    prisma.meeting.create.mockResolvedValue({ id: 22, status: 'REQUESTED' });
    const result = await service.requestMeeting(
      { id: 7, email: 'lucia@example.test' },
      { advisorId: 2, scheduledAt: '2099-10-01T15:00:00Z', notes: 'Avance' }
    );
    expect(prisma.meeting.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          prospectId: 10,
          advisorProfileId: 2,
          status: 'REQUESTED',
          notes: 'Avance',
        }),
      })
    );
    expect(result.status).toBe('REQUESTED');
  });
});

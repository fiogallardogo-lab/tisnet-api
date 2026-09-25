import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { TeamApplicationsService } from './team-applications.service.js';

const now = new Date('2026-09-23T15:00:00.000Z');

function application(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    code: 'TEAM-12345678',
    email: 'andrea@example.com',
    dni: '12345678',
    requestedRole: 'DEVELOPER',
    profile: {
      fullName: 'Andrea Mendoza',
      specialty: 'FULL_STACK',
      phone: '999999999',
    },
    status: 'PENDING_REVIEW',
    cvName: 'cv-andrea.pdf',
    photoMime: 'image/jpeg',
    consent: true,
    interviewAssignedAt: null,
    rejectionReason: null,
    rejectedAt: null,
    createdAt: now,
    updatedAt: now,
    assignedAdminProfile: null,
    reviewedByUser: null,
    ...overrides,
  };
}

function createService() {
  const prisma = {
    $transaction: vi.fn(async (operations: Promise<unknown>[]) =>
      Promise.all(operations),
    ),
    teamApplication: {
      findMany: vi.fn(),
      count: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      updateMany: vi.fn(),
    },
    adminProfile: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
    },
  };
  const notifications = { send: vi.fn() };
  return {
    service: new TeamApplicationsService(
      prisma as never,
      notifications as never,
    ),
    prisma,
    notifications,
  };
}

describe('TeamApplicationsService', () => {
  it('lists applications without exposing private file bytes', async () => {
    const { service, prisma } = createService();
    prisma.teamApplication.findMany.mockResolvedValue([application()]);
    prisma.teamApplication.count.mockResolvedValue(1);

    const result = await service.findAll({
      page: 1,
      limit: 10,
      search: 'Andrea',
    });

    expect(result.meta).toEqual({
      page: 1,
      limit: 10,
      totalItems: 1,
      totalPages: 1,
    });
    expect(result.items[0]).toMatchObject({
      id: 1,
      fullName: 'Andrea Mendoza',
      specialty: 'FULL_STACK',
      status: 'PENDING_REVIEW',
    });
    expect(result.items[0]).not.toHaveProperty('cv');
    expect(result.items[0]).not.toHaveProperty('photo');
    expect(prisma.teamApplication.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ OR: expect.any(Array) }),
        skip: 0,
        take: 10,
      }),
    );
  });

  it('rejects a missing application detail', async () => {
    const { service, prisma } = createService();
    prisma.teamApplication.findUnique.mockResolvedValue(null);

    await expect(service.findOne(999)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('assigns an active ADMIN and notifies the applicant', async () => {
    const { service, prisma, notifications } = createService();
    const pending = application();
    const assignedAdmin = {
      id: 4,
      executiveTitle: 'Asesor técnico',
      specialty: 'Soluciones web',
      calendlyUrl: 'https://calendly.com/tisnet/entrevista',
      user: {
        id: 8,
        name: 'Administrador TISNET',
        email: 'admin@tisnet.com',
        isActive: true,
        role: { name: 'ADMIN' },
      },
    };
    prisma.teamApplication.findUnique
      .mockResolvedValueOnce(pending)
      .mockResolvedValueOnce(
        application({
          status: 'INTERVIEW_ASSIGNED',
          assignedAdminProfile: assignedAdmin,
          interviewAssignedAt: now,
          reviewedByUser: {
            id: 99,
            name: 'Super Admin',
            email: 'superadmin@tisnet.com',
          },
        }),
      );
    prisma.adminProfile.findUnique.mockResolvedValue(assignedAdmin);
    prisma.teamApplication.updateMany.mockResolvedValue({ count: 1 });
    notifications.send.mockResolvedValue({
      messageId: 'fake-1',
      recipient: pending.email,
      sentAt: now,
    });

    const result = await service.assignInterview(1, 4, 99);

    expect(prisma.teamApplication.updateMany).toHaveBeenCalledWith({
      where: { id: 1, status: 'PENDING_REVIEW' },
      data: expect.objectContaining({
        status: 'INTERVIEW_ASSIGNED',
        assignedAdminProfileId: 4,
        reviewedByUserId: 99,
      }),
    });
    expect(notifications.send).toHaveBeenCalledWith(
      expect.objectContaining({
        recipient: 'andrea@example.com',
        subject: 'Entrevista asignada — Postulación TEAM-12345678',
        metadata: {
          type: 'INTERVIEW_ASSIGNED',
          applicationCode: 'TEAM-12345678',
        },
      }),
    );
    expect(result.notificationStatus).toBe('SENT');
  });

  it('persists rejection and reports a failed notification safely', async () => {
    const { service, prisma, notifications } = createService();
    const pending = application();
    prisma.teamApplication.findUnique
      .mockResolvedValueOnce(pending)
      .mockResolvedValueOnce(
        application({
          status: 'REJECTED',
          rejectionReason:
            'Actualmente buscamos mayor experiencia en producción.',
          rejectedAt: now,
          reviewedByUser: {
            id: 99,
            name: 'Super Admin',
            email: 'superadmin@tisnet.com',
          },
        }),
      );
    prisma.teamApplication.updateMany.mockResolvedValue({ count: 1 });
    notifications.send.mockRejectedValue(new Error('SMTP unavailable'));

    const result = await service.reject(
      1,
      'Actualmente buscamos mayor experiencia en producción.',
      99,
    );

    expect(prisma.teamApplication.updateMany).toHaveBeenCalledWith({
      where: { id: 1, status: 'PENDING_REVIEW' },
      data: expect.objectContaining({
        status: 'REJECTED',
        reviewedByUserId: 99,
        assignedAdminProfileId: null,
      }),
    });
    expect(result.notificationStatus).toBe('FAILED');
  });

  it('only returns interviews assigned to the authenticated admin profile', async () => {
    const { service, prisma } = createService();
    prisma.adminProfile.findUnique.mockResolvedValue({ id: 4 });
    prisma.teamApplication.findMany.mockResolvedValue([
      application({
        status: 'INTERVIEW_ASSIGNED',
        assignedAdminProfile: {
          id: 4,
          user: { id: 8, name: 'Admin', email: 'admin@tisnet.test' },
        },
      }),
    ]);

    const result = await service.findAssignedInterviews(8);

    expect(prisma.teamApplication.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { assignedAdminProfileId: 4 } }),
    );
    expect(result).toHaveLength(1);
  });

  it('does not expose files from an interview assigned to another admin', async () => {
    const { service, prisma } = createService();
    prisma.adminProfile.findUnique.mockResolvedValue({ id: 4 });
    prisma.teamApplication.findFirst.mockResolvedValue(null);

    await expect(service.getAssignedCv(8, 99)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(prisma.teamApplication.findUnique).not.toHaveBeenCalled();
  });

  it('requires a rejection reason even when the service is called directly', async () => {
    const { service, prisma } = createService();

    await expect(
      service.completeAssignedInterview(8, 1, 'REJECTED'),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.adminProfile.findUnique).not.toHaveBeenCalled();
  });

  it('blocks a second decision for an already processed application', async () => {
    const { service, prisma } = createService();
    prisma.teamApplication.findUnique.mockResolvedValue(
      application({ status: 'REJECTED' }),
    );

    await expect(
      service.reject(
        1,
        'Actualmente buscamos mayor experiencia en producción.',
        99,
      ),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.teamApplication.updateMany).not.toHaveBeenCalled();
  });
});

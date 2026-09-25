import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { PLATFORM_ROLES } from '../common/constants/platform-roles.js';
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
    interviewCompletedAt: null,
    rejectionReason: null,
    rejectedAt: null,
    decidedAt: null,
    decidedByUserId: null,
    decisionReason: null,
    resultingUserId: null,
    createdAt: now,
    updatedAt: now,
    assignedAdminProfile: null,
    assignedAdminProfileId: null,
    reviewedByUser: null,
    decidedBy: null,
    resultingUser: null,
    ...overrides,
  };
}

function createService() {
  const prisma: any = {
    $transaction: vi.fn(async (arg: any) => {
      if (typeof arg === 'function') {
        return arg(prisma);
      }
      return Promise.all(arg);
    }),
    teamApplication: {
      findMany: vi.fn(),
      count: vi.fn(),
      findUnique: vi.fn(),
      updateMany: vi.fn(),
      update: vi.fn(),
    },
    adminProfile: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    role: {
      findUnique: vi.fn(),
    },
    developerProfile: {
      create: vi.fn(),
    },
    productOwnerProfile: {
      create: vi.fn(),
    },
    auditEvent: {
      create: vi.fn(),
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
        subject: 'TISNET: entrevista asignada',
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
        decidedByUserId: 99,
      }),
    });
    expect(prisma.auditEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        actorId: 99,
        action: 'TEAM_APPLICATION_REJECTED',
        entityType: 'TEAM_APPLICATION',
        entityId: '1',
      }),
    });
    expect(result.notificationStatus).toBe('FAILED');
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

  describe('Sprint 11 Acceptance and Decision Domain Logic', () => {
    it('accepts application, creates User with role DEVELOPER, links resultingUser, and audits inside tx', async () => {
      const { service, prisma, notifications } = createService();
      const appRecord = application({
        status: 'INTERVIEW_ASSIGNED',
        assignedAdminProfileId: 10,
        requestedRole: 'DEVELOPER',
      });

      prisma.teamApplication.findUnique
        .mockResolvedValueOnce(appRecord)
        .mockResolvedValueOnce({
          ...appRecord,
          status: 'ACCEPTED',
          resultingUserId: 42,
          decidedByUserId: 8,
          decidedAt: now,
          resultingUser: {
            id: 42,
            name: 'Andrea Mendoza',
            email: 'andrea@example.com',
            role: { name: 'DEVELOPER' },
          },
        });

      prisma.adminProfile.findUnique.mockResolvedValue({ id: 10, userId: 8 });
      prisma.teamApplication.updateMany.mockResolvedValue({ count: 1 });
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.role.findUnique.mockResolvedValue({ id: 2, name: 'DEVELOPER' });
      prisma.user.create.mockResolvedValue({
        id: 42,
        name: 'Andrea Mendoza',
        email: 'andrea@example.com',
        roleId: 2,
      });
      notifications.send.mockResolvedValue({ messageId: 'm-1' });

      const result = await service.completeAssignedInterview(
        8,
        PLATFORM_ROLES.ADMIN,
        1,
        'ACCEPTED',
        'Candidato con excelente perfil técnico',
      );

      expect(prisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            name: 'Andrea Mendoza',
            email: 'andrea@example.com',
            roleId: 2,
            developerProfile: { create: {} },
          }),
        }),
      );

      expect(prisma.teamApplication.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { resultingUserId: 42 },
      });

      expect(prisma.auditEvent.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          actorId: 8,
          action: 'TEAM_APPLICATION_ACCEPTED',
          entityType: 'TEAM_APPLICATION',
          entityId: '1',
          metadata: expect.objectContaining({
            status: 'ACCEPTED',
            role: 'DEVELOPER',
            resultingUserId: 42,
          }),
        }),
      });

      expect(prisma.auditEvent.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          actorId: 8,
          action: 'TEAM_APPLICATION_USER_LINKED',
          entityType: 'TEAM_APPLICATION',
          entityId: '1',
          metadata: expect.objectContaining({
            status: 'ACCEPTED',
            role: 'DEVELOPER',
            resultingUserId: 42,
          }),
        }),
      });

      expect(result.status).toBe('ACCEPTED');
      expect(result.resultingUserId).toBe(42);
      expect(result.notificationStatus).toBe('SENT');
    });

    it('creates PRODUCT_OWNER user when requestedRole is PRODUCT_OWNER', async () => {
      const { service, prisma } = createService();
      const appRecord = application({
        status: 'INTERVIEW_ASSIGNED',
        assignedAdminProfileId: 10,
        requestedRole: 'PRODUCT_OWNER',
        profile: { fullName: 'Carlos Sanchez' },
      });

      prisma.teamApplication.findUnique
        .mockResolvedValueOnce(appRecord)
        .mockResolvedValueOnce({
          ...appRecord,
          status: 'ACCEPTED',
          resultingUserId: 77,
        });

      prisma.adminProfile.findUnique.mockResolvedValue({ id: 10, userId: 8 });
      prisma.teamApplication.updateMany.mockResolvedValue({ count: 1 });
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.role.findUnique.mockResolvedValue({ id: 3, name: 'PRODUCT_OWNER' });
      prisma.user.create.mockResolvedValue({
        id: 77,
        name: 'Carlos Sanchez',
        email: 'andrea@example.com',
        roleId: 3,
      });

      await service.completeAssignedInterview(
        8,
        PLATFORM_ROLES.ADMIN,
        1,
        'ACCEPTED',
      );

      expect(prisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            name: 'Carlos Sanchez',
            roleId: 3,
            productOwnerProfile: { create: {} },
          }),
        }),
      );
    });

    it('links existing User with matching role and avoids duplicate user creation', async () => {
      const { service, prisma } = createService();
      const appRecord = application({
        status: 'INTERVIEW_ASSIGNED',
        assignedAdminProfileId: 10,
        requestedRole: 'DEVELOPER',
      });

      prisma.teamApplication.findUnique
        .mockResolvedValueOnce(appRecord)
        .mockResolvedValueOnce({
          ...appRecord,
          status: 'ACCEPTED',
          resultingUserId: 15,
        });

      prisma.adminProfile.findUnique.mockResolvedValue({ id: 10, userId: 8 });
      prisma.teamApplication.updateMany.mockResolvedValue({ count: 1 });
      prisma.user.findUnique.mockResolvedValue({
        id: 15,
        email: 'andrea@example.com',
        role: { name: 'DEVELOPER' },
        developerProfile: null,
      });

      await service.completeAssignedInterview(
        8,
        PLATFORM_ROLES.ADMIN,
        1,
        'ACCEPTED',
      );

      expect(prisma.user.create).not.toHaveBeenCalled();
      expect(prisma.developerProfile.create).toHaveBeenCalledWith({
        data: { userId: 15 },
      });
      expect(prisma.teamApplication.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { resultingUserId: 15 },
      });
    });

    it('rejects acceptance if existing user has incompatible role', async () => {
      const { service, prisma } = createService();
      const appRecord = application({
        status: 'INTERVIEW_ASSIGNED',
        assignedAdminProfileId: 10,
        requestedRole: 'DEVELOPER',
      });

      prisma.teamApplication.findUnique.mockResolvedValue(appRecord);
      prisma.adminProfile.findUnique.mockResolvedValue({ id: 10, userId: 8 });
      prisma.teamApplication.updateMany.mockResolvedValue({ count: 1 });
      prisma.user.findUnique.mockResolvedValue({
        id: 20,
        email: 'andrea@example.com',
        role: { name: 'CLIENT' },
      });

      await expect(
        service.completeAssignedInterview(
          8,
          PLATFORM_ROLES.ADMIN,
          1,
          'ACCEPTED',
        ),
      ).rejects.toThrow(ConflictException);
    });

    it('rejects interview, sets actor, date, reason, audits and creates no user', async () => {
      const { service, prisma } = createService();
      const appRecord = application({
        status: 'INTERVIEW_ASSIGNED',
        assignedAdminProfileId: 10,
        requestedRole: 'DEVELOPER',
      });

      prisma.teamApplication.findUnique
        .mockResolvedValueOnce(appRecord)
        .mockResolvedValueOnce({
          ...appRecord,
          status: 'REJECTED',
          decisionReason: 'No cumple con los requisitos técnicos exigidos.',
          decidedByUserId: 8,
          decidedAt: now,
          resultingUserId: null,
        });

      prisma.adminProfile.findUnique.mockResolvedValue({ id: 10, userId: 8 });
      prisma.teamApplication.updateMany.mockResolvedValue({ count: 1 });

      const reason = 'No cumple con los requisitos técnicos exigidos.';
      const result = await service.completeAssignedInterview(
        8,
        PLATFORM_ROLES.ADMIN,
        1,
        'REJECTED',
        reason,
      );

      expect(prisma.user.create).not.toHaveBeenCalled();
      expect(prisma.auditEvent.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          actorId: 8,
          action: 'TEAM_APPLICATION_REJECTED',
          entityType: 'TEAM_APPLICATION',
          entityId: '1',
          metadata: {
            status: 'REJECTED',
            role: 'DEVELOPER',
          },
        }),
      });
      expect(result.status).toBe('REJECTED');
      expect(result.resultingUserId).toBeNull();
    });

    it('handles concurrency when updateMany count is 0', async () => {
      const { service, prisma } = createService();
      const appRecord = application({
        status: 'INTERVIEW_ASSIGNED',
        assignedAdminProfileId: 10,
      });

      prisma.teamApplication.findUnique.mockResolvedValue(appRecord);
      prisma.adminProfile.findUnique.mockResolvedValue({ id: 10, userId: 8 });
      prisma.teamApplication.updateMany.mockResolvedValue({ count: 0 });

      await expect(
        service.completeAssignedInterview(
          8,
          PLATFORM_ROLES.ADMIN,
          1,
          'ACCEPTED',
        ),
      ).rejects.toThrow('La postulación ya fue procesada');
    });

    it('handles Prisma P2002 error gracefully during user creation', async () => {
      const { service, prisma } = createService();
      const appRecord = application({
        status: 'INTERVIEW_ASSIGNED',
        assignedAdminProfileId: 10,
        requestedRole: 'DEVELOPER',
      });

      prisma.teamApplication.findUnique.mockResolvedValue(appRecord);
      prisma.adminProfile.findUnique.mockResolvedValue({ id: 10, userId: 8 });
      prisma.teamApplication.updateMany.mockResolvedValue({ count: 1 });
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.role.findUnique.mockResolvedValue({ id: 2, name: 'DEVELOPER' });

      const p2002Error = new Prisma.PrismaClientKnownRequestError(
        'Unique constraint failed',
        { code: 'P2002', clientVersion: '5.0.0' },
      );
      prisma.user.create.mockRejectedValue(p2002Error);

      await expect(
        service.completeAssignedInterview(
          8,
          PLATFORM_ROLES.ADMIN,
          1,
          'ACCEPTED',
        ),
      ).rejects.toThrow('El correo ya está registrado');
    });

    it('blocks ADMIN from deciding an interview assigned to another admin (RBAC)', async () => {
      const { service, prisma } = createService();
      const appRecord = application({
        status: 'INTERVIEW_ASSIGNED',
        assignedAdminProfileId: 999, // Assigned to admin profile 999
      });

      prisma.teamApplication.findUnique.mockResolvedValue(appRecord);
      prisma.adminProfile.findUnique.mockResolvedValue({ id: 10, userId: 8 }); // Caller is admin profile 10

      await expect(
        service.completeAssignedInterview(
          8,
          PLATFORM_ROLES.ADMIN,
          1,
          'ACCEPTED',
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('allows SUPER_ADMIN to decide interview regardless of assigned admin profile', async () => {
      const { service, prisma } = createService();
      const appRecord = application({
        status: 'INTERVIEW_ASSIGNED',
        assignedAdminProfileId: 999,
        requestedRole: 'DEVELOPER',
      });

      prisma.teamApplication.findUnique
        .mockResolvedValueOnce(appRecord)
        .mockResolvedValueOnce({
          ...appRecord,
          status: 'ACCEPTED',
          resultingUserId: 50,
        });

      prisma.teamApplication.updateMany.mockResolvedValue({ count: 1 });
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.role.findUnique.mockResolvedValue({ id: 2, name: 'DEVELOPER' });
      prisma.user.create.mockResolvedValue({ id: 50, email: 'andrea@example.com' });

      const result = await service.completeAssignedInterview(
        1,
        PLATFORM_ROLES.SUPER_ADMIN,
        1,
        'ACCEPTED',
      );

      expect(result.status).toBe('ACCEPTED');
    });

    it('throws ForbiddenException if non-admin and non-super-admin tries to decide', async () => {
      const { service, prisma } = createService();
      const appRecord = application({
        status: 'INTERVIEW_ASSIGNED',
        assignedAdminProfileId: 10,
      });

      prisma.teamApplication.findUnique.mockResolvedValue(appRecord);

      await expect(
        service.completeAssignedInterview(
          5,
          PLATFORM_ROLES.CLIENT,
          1,
          'ACCEPTED',
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ProjectEnablementService } from './project-enablement.service';

// ─── Minimal Prisma mock factory ────────────────────────────────────────────

function makeQuote(overrides: Record<string, any> = {}) {
  return {
    id: 10,
    publicCode: 'COT-001',
    activeVersion: 1,
    prospectId: 5,
    prospect: { id: 5, userId: 3 },
    ...overrides,
  };
}

function makeSchedule(overrides: Record<string, any> = {}) {
  return {
    id: 1,
    sequence: 1,
    quoteVersion: {
      id: 100,
      version: 1,
      clientUserId: 3,
      scope: { description: 'Sistema de gestión' },
      quote: makeQuote(),
    },
    ...overrides,
  };
}

function buildPrisma(overrides: Record<string, any> = {}) {
  const tx = {
    $queryRaw: vi.fn().mockResolvedValue([]),
    paymentSchedule: {
      findUnique: vi.fn().mockResolvedValue(makeSchedule()),
    },
    project: {
      findUnique: vi.fn().mockResolvedValue(null), // no existing project
      create: vi.fn().mockResolvedValue({ id: 99 }),
      findFirst: vi.fn().mockResolvedValue(null),
      update: vi.fn().mockResolvedValue({ id: 99 }),
    },
    user: {
      findFirst: vi.fn().mockResolvedValue({ id: 3, name: 'Client User' }),
    },
    category: {
      findFirst: vi.fn().mockResolvedValue({ id: 1 }),
    },
    auditEvent: {
      create: vi.fn().mockResolvedValue({}),
    },
    projectMember: {
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      upsert: vi.fn().mockResolvedValue({}),
    },
    ...overrides,
  };

  return {
    $transaction: vi.fn().mockImplementation((fn) => fn(tx)),
    ...overrides._outer,
    _tx: tx,
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('ProjectEnablementService.enableFromPayment', () => {
  let prisma: ReturnType<typeof buildPrisma>;
  let service: ProjectEnablementService;

  beforeEach(() => {
    prisma = buildPrisma();
    service = new ProjectEnablementService(prisma as any);
  });

  it('creates a project when advance payment is confirmed (happy path)', async () => {
    await expect(
      service.enableFromPayment({ scheduleId: 1, paymentId: 50 }),
    ).resolves.toBeUndefined();

    expect(prisma._tx.project.create).toHaveBeenCalledOnce();
    expect(prisma._tx.auditEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: 'PROJECT_ENABLED' }),
      }),
    );
  });

  it('is idempotent: skips project creation if project already exists (S14-B02)', async () => {
    prisma._tx.project.findUnique.mockResolvedValue({ id: 77 }); // already exists

    await expect(
      service.enableFromPayment({ scheduleId: 1, paymentId: 51 }),
    ).resolves.toBeUndefined();

    expect(prisma._tx.project.create).not.toHaveBeenCalled();
    expect(prisma._tx.auditEvent.create).not.toHaveBeenCalled();
  });

  it('skips enablement when schedule is not sequence=1 (not the advance payment)', async () => {
    prisma._tx.paymentSchedule.findUnique.mockResolvedValue(
      makeSchedule({ sequence: 2 }),
    );

    await expect(
      service.enableFromPayment({ scheduleId: 2, paymentId: 52 }),
    ).resolves.toBeUndefined();

    expect(prisma._tx.project.create).not.toHaveBeenCalled();
  });

  it('skips enablement when quote version is not the active one', async () => {
    const schedule = makeSchedule();
    schedule.quoteVersion.quote.activeVersion = 2; // version mismatch

    prisma._tx.paymentSchedule.findUnique.mockResolvedValue(schedule);

    await expect(
      service.enableFromPayment({ scheduleId: 1, paymentId: 53 }),
    ).resolves.toBeUndefined();

    expect(prisma._tx.project.create).not.toHaveBeenCalled();
  });

  it('throws ConflictException when quote has no prospect', async () => {
    const schedule = makeSchedule();
    schedule.quoteVersion.quote.prospectId = null;
    schedule.quoteVersion.quote.prospect = null;
    prisma._tx.paymentSchedule.findUnique.mockResolvedValue(schedule);

    await expect(
      service.enableFromPayment({ scheduleId: 1, paymentId: 54 }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('throws ConflictException when CLIENT user is not found', async () => {
    prisma._tx.user.findFirst.mockResolvedValue(null);

    await expect(
      service.enableFromPayment({ scheduleId: 1, paymentId: 55 }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('handles concurrent P2002 gracefully — safe idempotent skip (S14-B09)', async () => {
    const uniqueError = new Prisma.PrismaClientKnownRequestError(
      'Unique constraint failed',
      { code: 'P2002', clientVersion: '5.0.0' },
    );
    // Simulate $transaction itself throwing P2002 (as happens with concurrent inserts)
    prisma.$transaction.mockRejectedValueOnce(uniqueError);

    await expect(
      service.enableFromPayment({ scheduleId: 1, paymentId: 56 }),
    ).resolves.toBeUndefined();
  });

  it('re-throws non-P2002 errors (unknown failures are propagated)', async () => {
    prisma._tx.project.create.mockRejectedValue(new Error('DB connection lost'));

    await expect(
      service.enableFromPayment({ scheduleId: 1, paymentId: 57 }),
    ).rejects.toThrow('DB connection lost');
  });
});

describe('ProjectEnablementService.assignProductOwner', () => {
  let prisma: ReturnType<typeof buildPrisma>;
  let service: ProjectEnablementService;

  beforeEach(() => {
    prisma = buildPrisma();
    service = new ProjectEnablementService(prisma as any);
  });

  it('assigns a PO to a project and emits PO_ASSIGNED audit (S14-B05)', async () => {
    prisma._tx.project.findUnique.mockResolvedValue({ id: 10, productOwnerId: null });
    prisma._tx.user.findFirst.mockResolvedValue({ id: 20 });
    prisma._tx.project.update.mockResolvedValue({ id: 10 });

    const result = await service.assignProductOwner(10, 20, 1);

    expect(result).toEqual({ projectId: 10, productOwnerId: 20 });
    expect(prisma._tx.projectMember.upsert).toHaveBeenCalled();
    expect(prisma._tx.auditEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: 'PO_ASSIGNED' }),
      }),
    );
  });

  it('throws NotFoundException when project does not exist', async () => {
    prisma._tx.project.findUnique.mockResolvedValue(null);

    await expect(service.assignProductOwner(999, 20, 1)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('throws ConflictException when user is not an active PRODUCT_OWNER', async () => {
    prisma._tx.project.findUnique.mockResolvedValue({ id: 10, productOwnerId: null });
    prisma._tx.user.findFirst.mockResolvedValue(null); // not a PO

    await expect(service.assignProductOwner(10, 99, 1)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('deactivates old PO membership when replacing the PO', async () => {
    prisma._tx.project.findUnique.mockResolvedValue({ id: 10, productOwnerId: 15 }); // different PO
    prisma._tx.user.findFirst.mockResolvedValue({ id: 20 });
    prisma._tx.project.update.mockResolvedValue({ id: 10 });

    await service.assignProductOwner(10, 20, 1);

    expect(prisma._tx.projectMember.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ projectId: 10, memberRole: 'PRODUCT_OWNER' }),
        data: expect.objectContaining({ isActive: false }),
      }),
    );
  });

  it('does not deactivate old PO if same user is re-assigned (idempotent)', async () => {
    prisma._tx.project.findUnique.mockResolvedValue({ id: 10, productOwnerId: 20 }); // same PO
    prisma._tx.user.findFirst.mockResolvedValue({ id: 20 });
    prisma._tx.project.update.mockResolvedValue({ id: 10 });

    await service.assignProductOwner(10, 20, 1);

    expect(prisma._tx.projectMember.updateMany).not.toHaveBeenCalled();
  });
});

describe('ProjectEnablementService.isProjectLocked (S14-B03)', () => {
  it('returns true when project has no quoteId', async () => {
    const prismaInst = {
      project: { findUnique: vi.fn().mockResolvedValue({ quoteId: null }) },
    };
    const svc = new ProjectEnablementService(prismaInst as any);
    await expect(svc.isProjectLocked(1)).resolves.toBe(true);
  });

  it('returns true when quote has no active version', async () => {
    const prismaInst = {
      project: { findUnique: vi.fn().mockResolvedValue({ quoteId: 5 }) },
      quote: { findUnique: vi.fn().mockResolvedValue({ activeVersion: 0 }) },
    };
    const svc = new ProjectEnablementService(prismaInst as any);
    await expect(svc.isProjectLocked(1)).resolves.toBe(true);
  });

  it('returns false when advance payment exists', async () => {
    const prismaInst = {
      project: { findUnique: vi.fn().mockResolvedValue({ quoteId: 5 }) },
      quote: { findUnique: vi.fn().mockResolvedValue({ activeVersion: 1 }) },
      paymentSchedule: {
        findFirst: vi.fn().mockResolvedValue({ id: 1 }),
      },
    };
    const svc = new ProjectEnablementService(prismaInst as any);
    await expect(svc.isProjectLocked(1)).resolves.toBe(false);
  });
});

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ClientActivationRequestsService } from './client-activation-requests.service';

describe('ClientActivationRequestsService', () => {
  let prisma: any;
  let service: ClientActivationRequestsService;

  beforeEach(() => {
    prisma = {
      prospect: {
        findUnique: vi.fn().mockResolvedValue({
          id: 12,
          userId: null,
          status: 'NEW',
          email: 'visitor@example.test',
        }),
      },
      user: { findUnique: vi.fn().mockResolvedValue(null) },
      clientActivationRequest: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({
          id: 5,
          status: 'PENDING',
          createdAt: new Date('2026-10-02T12:00:00.000Z'),
        }),
        findUnique: vi.fn(),
        findMany: vi.fn().mockResolvedValue([]),
      },
      auditEvent: { create: vi.fn().mockResolvedValue({}) },
    };
    prisma.$transaction = vi.fn((callback) => callback(prisma));
    service = new ClientActivationRequestsService(prisma);
  });

  it('creates and audits a pending request without creating or inviting a user', async () => {
    await expect(service.create(12, 7)).resolves.toMatchObject({
      id: 5,
      prospectId: 12,
      status: 'PENDING',
      alreadyPending: false,
    });
    expect(prisma.clientActivationRequest.create).toHaveBeenCalledWith({
      data: { prospectId: 12, requesterId: 7 },
      select: { id: true, status: true, createdAt: true },
    });
    expect(prisma.auditEvent.create).toHaveBeenCalled();
  });

  it('returns the existing pending request rather than creating a duplicate', async () => {
    prisma.clientActivationRequest.findFirst.mockResolvedValue({
      id: 5,
      status: 'PENDING',
      createdAt: new Date('2026-10-02T12:00:00.000Z'),
    });
    await expect(service.create(12, 7)).resolves.toMatchObject({
      id: 5,
      prospectId: 12,
      alreadyPending: true,
    });
    expect(prisma.clientActivationRequest.create).not.toHaveBeenCalled();
  });


  it('shows the global pending queue only to the Super Admin', async () => {
    await service.list(99, 'SUPER_ADMIN');
    expect(prisma.clientActivationRequest.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { status: 'PENDING' } }),
    );
    await service.list(7, 'ADMIN');
    expect(prisma.clientActivationRequest.findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({ where: { requesterId: 7 } }),
    );
  });
});

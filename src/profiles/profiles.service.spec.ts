import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PLATFORM_ROLES } from '../common/constants/platform-roles';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { ProfilesService } from './profiles.service';

describe('ProfilesService', () => {
  const users = { updateOwnName: vi.fn() };
  const prisma = {
    user: { findUnique: vi.fn() },
    clientProfile: { upsert: vi.fn() },
    productOwnerProfile: { upsert: vi.fn() },
    adminProfile: { upsert: vi.fn() },
    $transaction: vi.fn(),
  };
  let service: ProfilesService;

  beforeEach(() => {
    vi.resetAllMocks();
    service = new ProfilesService(
      users as unknown as UsersService,
      prisma as unknown as PrismaService,
    );
  });

  it.each(Object.values(PLATFORM_ROLES))(
    'returns safe own identity for %s without a profile',
    async (role) => {
      prisma.user.findUnique.mockResolvedValue({
        id: 7,
        name: 'Ejemplo',
        email: 'example@tisnet.test',
        isActive: true,
        role: { name: role },
        passwordHash: 'private',
        tokenVersion: 10,
        clientProfile: null,
        developerProfile: null,
        productOwnerProfile: null,
        adminProfile: null,
      });

      const result = await service.getOwnProfile(7);

      expect(prisma.user.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 7 } }),
      );
      expect(result).toEqual({
        user: {
          id: 7,
          name: 'Ejemplo',
          email: 'example@tisnet.test',
          role,
          isActive: true,
        },
        profile: null,
      });
      expect(JSON.stringify(result)).not.toContain('passwordHash');
      expect(JSON.stringify(result)).not.toContain('tokenVersion');
    },
  );

  it('returns only the profile associated with the current role', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 7,
      name: 'Cliente',
      email: 'client@tisnet.test',
      isActive: true,
      role: { name: PLATFORM_ROLES.CLIENT },
      clientProfile: { id: 2, userId: 7, phone: '+51999999999' },
      developerProfile: { id: 99, userId: 7, technologies: [] },
      productOwnerProfile: null,
      adminProfile: null,
    });

    const result = await service.getOwnProfile(7);

    expect(result.profile).toEqual({
      type: PLATFORM_ROLES.CLIENT,
      id: 2,
      phone: '+51999999999',
    });
    expect(JSON.stringify(result)).not.toContain('userId');
  });

  it('creates or updates only the authenticated client profile', async () => {
    prisma.clientProfile.upsert.mockResolvedValue({
      id: 4,
      userId: 7,
      district: 'Lima',
    });

    const result = await service.updateClientProfile(7, {
      district: 'Lima',
    });

    expect(prisma.clientProfile.upsert).toHaveBeenCalledWith({
      where: { userId: 7 },
      create: { userId: 7, district: 'Lima' },
      update: { district: 'Lima' },
    });
    expect(result).not.toHaveProperty('userId');
  });

  it('rejects inactive technologies before updating a developer profile', async () => {
    const transaction = {
      technology: { count: vi.fn().mockResolvedValue(1) },
    };
    prisma.$transaction.mockImplementation(
      async (callback: (tx: typeof transaction) => unknown) =>
        callback(transaction),
    );

    await expect(
      service.updateDeveloperProfile(7, { technologyIds: [1, 2] }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects missing users', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    await expect(service.getOwnProfile(7)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('rejects inactive users', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 7, isActive: false });
    await expect(service.getOwnProfile(7)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
});

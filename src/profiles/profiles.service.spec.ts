import {
  BadRequestException,
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PLATFORM_ROLES } from '../common/constants/platform-roles';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { ProfilesService } from './profiles.service';

describe('ProfilesService', () => {
  const users = { updateOwnUser: vi.fn() };
  const config = { get: vi.fn() };
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
      config as unknown as ConfigService,
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

  it('validates and persists renewed acceptance together with the name', async () => {
    config.get.mockReturnValue('v2');
    users.updateOwnUser.mockResolvedValue({
      id: 7,
      name: 'Nuevo',
      role: { name: 'CLIENT' },
    });
    await service.updateOwnUser(7, {
      name: 'Nuevo',
      acceptedTerms: true,
      termsVersion: 'v2',
      privacyVersion: 'v2',
    });
    expect(users.updateOwnUser).toHaveBeenCalledWith(7, {
      name: 'Nuevo',
      termsVersion: 'v2',
      privacyVersion: 'v2',
      acceptedTermsAt: expect.any(Date),
    });
  });

  it('preserves existing acceptance on name-only updates even without legal configuration', async () => {
    users.updateOwnUser.mockResolvedValue({ id: 7, role: { name: 'CLIENT' } });
    await service.updateOwnUser(7, { name: 'Nuevo' });
    expect(users.updateOwnUser).toHaveBeenCalledWith(7, { name: 'Nuevo' });
    expect(config.get).not.toHaveBeenCalled();
  });

  it('rejects unauthorized versions before writing the user', async () => {
    config.get.mockReturnValue('v2');
    await expect(
      service.updateOwnUser(7, {
        name: 'No guardar',
        acceptedTerms: true,
        termsVersion: 'old',
        privacyVersion: 'v2',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(users.updateOwnUser).not.toHaveBeenCalled();
  });

  it('rejects an empty update or acceptance without consent', async () => {
    for (const dto of [{}, { termsVersion: 'v2', privacyVersion: 'v2' }]) {
      await expect(service.updateOwnUser(7, dto)).rejects.toBeInstanceOf(
        BadRequestException,
      );
    }
    expect(users.updateOwnUser).not.toHaveBeenCalled();
  });

  it.each([
    ['updateClientProfile', 'clientProfile'],
    ['updateProductOwnerProfile', 'productOwnerProfile'],
    ['updateAdminProfile', 'adminProfile'],
  ] as const)(
    '%s translates P2002 and preserves unrelated errors',
    async (method, model) => {
      prisma[model].upsert.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('Unique constraint', {
          code: 'P2002',
          clientVersion: '6.19.3',
          meta: { target: `${model}_userId_key` },
        }),
      );
      await expect(service[method](7, {})).rejects.toBeInstanceOf(
        ConflictException,
      );
      const failure = new Error('Database unavailable');
      prisma[model].upsert.mockRejectedValue(failure);
      await expect(service[method](7, {})).rejects.toBe(failure);
    },
  );

  it('translates a developer transaction unique conflict', async () => {
    prisma.$transaction.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Unique constraint', {
        code: 'P2002',
        clientVersion: '6.19.3',
        meta: { target: 'DeveloperProfile_userId_key' },
      }),
    );
    await expect(service.updateDeveloperProfile(7, {})).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('rejects inactive users', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 7, isActive: false });
    await expect(service.getOwnProfile(7)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
});

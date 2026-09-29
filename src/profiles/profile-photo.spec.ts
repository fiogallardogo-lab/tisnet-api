import { BadRequestException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { ProfilesService } from './profiles.service';

describe('ProfilesService profile photo', () => {
  const stored = {
    storageKey: 'profile-7.webp',
    url: 'https://files.test/profile-7.webp',
    sizeBytes: 4,
    mimeType: 'image/webp',
    storedAt: new Date(),
  };
  const storage = { save: vi.fn().mockResolvedValue(stored), delete: vi.fn() };
  const prisma = {
    developerProfile: { upsert: vi.fn() },
    productOwnerProfile: { upsert: vi.fn() },
    adminProfile: { upsert: vi.fn() },
  };
  const service = new ProfilesService(
    {} as never,
    prisma as never,
    {} as never,
    storage as never,
  );

  it('stores and links a Product Owner photo', async () => {
    await expect(
      service.uploadProfilePhoto(7, 'PRODUCT_OWNER', {
        buffer: Buffer.from('webp'),
        mimetype: 'image/webp',
        size: 4,
        originalname: 'avatar.webp',
      }),
    ).resolves.toEqual({ photoUrl: stored.url });
    expect(prisma.productOwnerProfile.upsert).toHaveBeenCalledWith({
      where: { userId: 7 },
      create: { userId: 7, photoUrl: stored.url },
      update: { photoUrl: stored.url },
    });
  });

  it('rejects unsupported files before storing them', async () => {
    await expect(
      service.uploadProfilePhoto(7, 'PRODUCT_OWNER', {
        buffer: Buffer.from('x'),
        mimetype: 'image/svg+xml',
        size: 1,
        originalname: 'avatar.svg',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

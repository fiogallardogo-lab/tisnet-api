import { describe, expect, it, vi } from 'vitest';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ProfilesController } from './profiles.controller';
import { ProfilesService } from './profiles.service';

describe('ProfilesController', () => {
  it('uses the authenticated id, not a request body id', () => {
    const service = {
      getOwnProfile: vi.fn().mockReturnValue({ profile: null }),
    };
    const controller = new ProfilesController(
      service as unknown as ProfilesService,
    );
    controller.getOwnProfile({
      user: { id: 7, email: 'example@tisnet.test', role: 'ADMIN' },
    });
    expect(service.getOwnProfile).toHaveBeenCalledWith(7);
  });

  it('protects all controller routes with JWT', () => {
    expect(Reflect.getMetadata(GUARDS_METADATA, ProfilesController)).toContain(
      JwtAuthGuard,
    );
  });
});

import { describe, expect, it } from 'vitest';
import { Test } from '@nestjs/testing';
import { ProfilesModule } from './profiles.module';
import { ProfilesController } from './profiles.controller';
import { UsersService } from '../users/users.service';
import { PrismaService } from '../prisma/prisma.service';

describe('ProfilesModule wiring', () => {
  it('resolves the controller and JWT guard dependencies without database access', async () => {
    const module = await Test.createTestingModule({ imports: [ProfilesModule] })
      .overrideProvider(UsersService)
      .useValue({ findById: async () => null })
      .overrideProvider(PrismaService)
      .useValue({})
      .compile();
    expect(module.get(ProfilesController)).toBeDefined();
    await module.close();
  });
});

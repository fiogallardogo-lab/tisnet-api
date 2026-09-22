import { Test, TestingModule } from '@nestjs/testing';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { PLATFORM_ROLES } from '../common/constants/platform-roles';

import { UsersController } from './users.controller';
import { UsersService } from './users.service';

describe('UsersController', () => {
  let controller: UsersController;

  const usersServiceMock = {
    createAdministrativeUser: vi.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        {
          provide: UsersService,
          useValue: usersServiceMock,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: () => true,
      })
      .overrideGuard(RolesGuard)
      .useValue({
        canActivate: () => true,
      })
      .compile();

    controller = module.get<UsersController>(UsersController);

    vi.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('delegates administrative user creation to UsersService', async () => {
    const dto = {
      name: 'Developer TISNET',
      email: 'developer@tisnet.com',
      password: 'password123',
      role: PLATFORM_ROLES.DEVELOPER,
      acceptedTerms: true as const,
      termsVersion: 'v1.0',
      privacyVersion: 'v1.0',
    };

    const expected = {
      id: 20,
      name: dto.name,
      email: dto.email,
      role: dto.role,
      isActive: true,
      acceptedTermsAt: new Date(),
      termsVersion: dto.termsVersion,
      privacyVersion: dto.privacyVersion,
    };

    usersServiceMock.createAdministrativeUser.mockResolvedValue(expected);

    const result = await controller.createUser(dto);

    expect(usersServiceMock.createAdministrativeUser).toHaveBeenCalledTimes(1);

    expect(usersServiceMock.createAdministrativeUser).toHaveBeenCalledWith(dto);

    expect(result).toEqual(expected);
  });
});

import {
  BadRequestException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { Prisma } from '@prisma/client';

import { PLATFORM_ROLES } from '../common/constants/platform-roles';
import { PrismaService } from '../prisma/prisma.service';

import { UsersService } from './users.service';

describe('UsersService', () => {
  let service: UsersService;

  const txMock = {
    role: {
      findUnique: vi.fn(),
    },
    user: {
      create: vi.fn(),
    },
  };

  const prismaMock = {
    $transaction: vi.fn(
      async (callback: (tx: typeof txMock) => Promise<unknown>) =>
        callback(txMock),
    ),
  };

  const configServiceMock = {
    get: vi.fn((key: string) => {
      if (key === 'TERMS_VERSION') {
        return 'v1.0';
      }

      if (key === 'PRIVACY_VERSION') {
        return 'v1.0';
      }

      return undefined;
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: PrismaService,
          useValue: prismaMock,
        },
        {
          provide: ConfigService,
          useValue: configServiceMock,
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);

    vi.clearAllMocks();

    configServiceMock.get.mockImplementation((key: string) => {
      if (key === 'TERMS_VERSION') {
        return 'v1.0';
      }

      if (key === 'PRIVACY_VERSION') {
        return 'v1.0';
      }

      return undefined;
    });
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('creates a CLIENT administratively with current legal versions', async () => {
    txMock.role.findUnique.mockResolvedValue({
      id: 1,
      name: PLATFORM_ROLES.CLIENT,
    });

    txMock.user.create.mockResolvedValue({
      id: 10,
      name: 'Cliente TISNET',
      email: 'cliente@tisnet.com',
      role: {
        name: PLATFORM_ROLES.CLIENT,
      },
      isActive: true,
      acceptedTermsAt: new Date(),
      termsVersion: 'v1.0',
      privacyVersion: 'v1.0',
    });

    const result = await service.createAdministrativeUser({
      name: 'Cliente TISNET',
      email: 'cliente@tisnet.com',
      password: 'password123',
      role: PLATFORM_ROLES.CLIENT,
      acceptedTerms: true,
      termsVersion: 'v1.0',
      privacyVersion: 'v1.0',
    });

    expect(txMock.role.findUnique).toHaveBeenCalledWith({
      where: {
        name: PLATFORM_ROLES.CLIENT,
      },
    });

    expect(txMock.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          name: 'Cliente TISNET',
          email: 'cliente@tisnet.com',
          roleId: 1,
          termsVersion: 'v1.0',
          privacyVersion: 'v1.0',
          clientProfile: {
            create: {},
          },
        }),
      }),
    );

    expect(result.role).toBe(PLATFORM_ROLES.CLIENT);
  });

  it('creates a DEVELOPER with DeveloperProfile', async () => {
    txMock.role.findUnique.mockResolvedValue({
      id: 2,
      name: PLATFORM_ROLES.DEVELOPER,
    });

    txMock.user.create.mockResolvedValue({
      id: 11,
      name: 'Developer TISNET',
      email: 'developer@tisnet.com',
      role: {
        name: PLATFORM_ROLES.DEVELOPER,
      },
      isActive: true,
      acceptedTermsAt: new Date(),
      termsVersion: 'v1.0',
      privacyVersion: 'v1.0',
    });

    await service.createAdministrativeUser({
      name: 'Developer TISNET',
      email: 'developer@tisnet.com',
      password: 'password123',
      role: PLATFORM_ROLES.DEVELOPER,
      acceptedTerms: true,
      termsVersion: 'v1.0',
      privacyVersion: 'v1.0',
    });

    expect(txMock.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          developerProfile: {
            create: {},
          },
        }),
      }),
    );
  });

  it('creates a PRODUCT_OWNER with ProductOwnerProfile', async () => {
    txMock.role.findUnique.mockResolvedValue({
      id: 3,
      name: PLATFORM_ROLES.PRODUCT_OWNER,
    });

    txMock.user.create.mockResolvedValue({
      id: 12,
      name: 'PO TISNET',
      email: 'po@tisnet.com',
      role: {
        name: PLATFORM_ROLES.PRODUCT_OWNER,
      },
      isActive: true,
      acceptedTermsAt: new Date(),
      termsVersion: 'v1.0',
      privacyVersion: 'v1.0',
    });

    await service.createAdministrativeUser({
      name: 'PO TISNET',
      email: 'po@tisnet.com',
      password: 'password123',
      role: PLATFORM_ROLES.PRODUCT_OWNER,
      acceptedTerms: true,
      termsVersion: 'v1.0',
      privacyVersion: 'v1.0',
    });

    expect(txMock.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          productOwnerProfile: {
            create: {},
          },
        }),
      }),
    );
  });

  it('creates an ADMIN with AdminProfile', async () => {
    txMock.role.findUnique.mockResolvedValue({
      id: 4,
      name: PLATFORM_ROLES.ADMIN,
    });

    txMock.user.create.mockResolvedValue({
      id: 13,
      name: 'Admin TISNET',
      email: 'admin@tisnet.com',
      role: {
        name: PLATFORM_ROLES.ADMIN,
      },
      isActive: true,
      acceptedTermsAt: new Date(),
      termsVersion: 'v1.0',
      privacyVersion: 'v1.0',
    });

    await service.createAdministrativeUser({
      name: 'Admin TISNET',
      email: 'admin@tisnet.com',
      password: 'password123',
      role: PLATFORM_ROLES.ADMIN,
      acceptedTerms: true,
      termsVersion: 'v1.0',
      privacyVersion: 'v1.0',
    });

    expect(txMock.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          adminProfile: {
            create: {},
          },
        }),
      }),
    );
  });

  it('rejects outdated legal versions', async () => {
    await expect(
      service.createAdministrativeUser({
        name: 'Usuario',
        email: 'usuario@tisnet.com',
        password: 'password123',
        role: PLATFORM_ROLES.CLIENT,
        acceptedTerms: true,
        termsVersion: 'v0.9',
        privacyVersion: 'v1.0',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects creation when legal versions are not configured', async () => {
    configServiceMock.get.mockReturnValue(undefined);

    await expect(
      service.createAdministrativeUser({
        name: 'Usuario',
        email: 'usuario@tisnet.com',
        password: 'password123',
        role: PLATFORM_ROLES.CLIENT,
        acceptedTerms: true,
        termsVersion: 'v1.0',
        privacyVersion: 'v1.0',
      }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('returns 409 when the email already exists', async () => {
    txMock.role.findUnique.mockResolvedValue({
      id: 1,
      name: PLATFORM_ROLES.CLIENT,
    });

    const prismaError = new Prisma.PrismaClientKnownRequestError(
      'Unique constraint failed',
      {
        code: 'P2002',
        clientVersion: '6.19.3',
        meta: {
          target: 'User_email_key',
        },
      },
    );

    txMock.user.create.mockRejectedValue(prismaError);

    await expect(
      service.createAdministrativeUser({
        name: 'Duplicado',
        email: 'duplicado@tisnet.com',
        password: 'password123',
        role: PLATFORM_ROLES.CLIENT,
        acceptedTerms: true,
        termsVersion: 'v1.0',
        privacyVersion: 'v1.0',
      }),
    ).rejects.toMatchObject({
      status: 409,
    });
  });
});

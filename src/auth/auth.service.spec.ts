import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { UnauthorizedException } from '@nestjs/common';

import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';

describe('AuthService', () => {
  let service: AuthService;

  const usersServiceMock = {
    findByEmail: vi.fn(),
    findById: vi.fn(),
    incrementTokenVersion: vi.fn(),
  };

  const jwtServiceMock = {
    sign: vi.fn(),
    verify: vi.fn(),
  };

  const configServiceMock = {
    get: vi.fn(),
    getOrThrow: vi.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: UsersService,
          useValue: usersServiceMock,
        },
        {
          provide: JwtService,
          useValue: jwtServiceMock,
        },
        {
          provide: ConfigService,
          useValue: configServiceMock,
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('rechaza credenciales cuando el usuario no existe', async () => {
    usersServiceMock.findByEmail.mockResolvedValue(null);

    await expect(service.validateUser('missing@tisnet.test', 'secret')).rejects.toBeInstanceOf(
      UnauthorizedException
    );
  });

  it('valida la contraseña y no devuelve passwordHash', async () => {
    const passwordHash = await bcrypt.hash('Secret123!', 4);
    usersServiceMock.findByEmail.mockResolvedValue({
      id: 1,
      email: 'admin@tisnet.test',
      passwordHash,
      isActive: true,
      tokenVersion: 0,
      role: { name: 'SUPER_ADMIN' },
    });

    const user = await service.validateUser('admin@tisnet.test', 'Secret123!');

    expect(user).not.toHaveProperty('passwordHash');
    expect(user.email).toBe('admin@tisnet.test');
  });

  it('genera access y refresh token con el rol actual', async () => {
    const passwordHash = await bcrypt.hash('Secret123!', 4);
    usersServiceMock.findByEmail.mockResolvedValue({
      id: 1,
      email: 'admin@tisnet.test',
      passwordHash,
      isActive: true,
      tokenVersion: 2,
      role: { name: 'SUPER_ADMIN' },
    });
    configServiceMock.get.mockReturnValue('7d');
    configServiceMock.getOrThrow.mockReturnValue('refresh-secret');
    jwtServiceMock.sign.mockReturnValueOnce('access-token').mockReturnValueOnce('refresh-token');

    const result = await service.login({ email: 'admin@tisnet.test', password: 'Secret123!' });

    expect(result.accessToken).toBe('access-token');
    expect(result.refreshToken).toBe('refresh-token');
    expect(result.user).toEqual({ id: 1, email: 'admin@tisnet.test', role: 'SUPER_ADMIN' });
  });

  it('rechaza un refresh token cuya versión fue revocada', async () => {
    jwtServiceMock.verify.mockReturnValue({ sub: 1, tokenVersion: 1 });
    configServiceMock.getOrThrow.mockReturnValue('refresh-secret');
    usersServiceMock.findById.mockResolvedValue({
      id: 1,
      email: 'admin@tisnet.test',
      isActive: true,
      tokenVersion: 2,
      role: { name: 'SUPER_ADMIN' },
    });

    await expect(service.refresh('old-refresh-token')).rejects.toBeInstanceOf(
      UnauthorizedException
    );
  });

  it('incrementa tokenVersion al cerrar sesión', async () => {
    usersServiceMock.incrementTokenVersion.mockResolvedValue({ id: 1 });

    const result = await service.logout(1);

    expect(usersServiceMock.incrementTokenVersion).toHaveBeenCalledWith(1);
    expect(result.success).toBe(true);
  });
});

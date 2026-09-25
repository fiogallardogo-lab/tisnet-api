import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import {
  BadRequestException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';

import { AuthService } from './auth.service';
import { NOTIFICATION_PROVIDER } from '../notifications/notification-provider.interface';

import { UsersService } from '../users/users.service';

describe('AuthService', () => {
  let service: AuthService;

    const notificationProviderMock = {
    send: vi.fn().mockResolvedValue({ messageId: 'msg_1', recipient: 'test@example.com', sentAt: new Date() }),
  };

  const usersServiceMock = {
    findByEmail: vi.fn(),
    findById: vi.fn(),
    incrementTokenVersion: vi.fn(),
    createClient: vi.fn(),
    updatePassword: vi.fn(),
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
    vi.resetAllMocks();
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
        {
          provide: NOTIFICATION_PROVIDER,
          useValue: notificationProviderMock,
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

    await expect(
      service.validateUser('missing@tisnet.test', 'secret'),
    ).rejects.toBeInstanceOf(UnauthorizedException);
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
    jwtServiceMock.sign
      .mockReturnValueOnce('access-token')
      .mockReturnValueOnce('refresh-token');

    const result = await service.login({
      email: 'admin@tisnet.test',
      password: 'Secret123!',
    });

    expect(result.accessToken).toBe('access-token');
    expect(result.refreshToken).toBe('refresh-token');
    expect(result.user).toEqual({
      id: 1,
      email: 'admin@tisnet.test',
      role: 'SUPER_ADMIN',
    });
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
      UnauthorizedException,
    );
  });

  it('incrementa tokenVersion al cerrar sesión', async () => {
    usersServiceMock.incrementTokenVersion.mockResolvedValue({ id: 1 });

    const result = await service.logout(1);

    expect(usersServiceMock.incrementTokenVersion).toHaveBeenCalledWith(1);
    expect(result.success).toBe(true);
  });

  it('registra exclusivamente un cliente con las versiones legales vigentes', async () => {
    configServiceMock.get.mockImplementation((key: string) =>
      key === 'TERMS_VERSION' || key === 'PRIVACY_VERSION' ? 'v1.0' : undefined,
    );
    usersServiceMock.createClient.mockResolvedValue({
      id: 8,
      name: 'Cliente',
      email: 'cliente@tisnet.test',
      isActive: true,
      acceptedTermsAt: new Date('2026-09-16T10:00:00.000Z'),
      termsVersion: 'v1.0',
      privacyVersion: 'v1.0',
      role: { name: 'CLIENT' },
    });

    const result = await service.register({
      name: 'Cliente',
      email: 'cliente@tisnet.test',
      password: 'Secret123!',
      acceptedTerms: true,
      termsVersion: 'v1.0',
      privacyVersion: 'v1.0',
    });

    expect(usersServiceMock.createClient).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Cliente',
        email: 'cliente@tisnet.test',
        termsVersion: 'v1.0',
        privacyVersion: 'v1.0',
      }),
    );
    expect(
      usersServiceMock.createClient.mock.calls[0][0].passwordHash,
    ).not.toBe('Secret123!');
    expect(result.role).toBe('CLIENT');
  });

  it('rechaza registro cuando faltan versiones legales en el servidor', async () => {
    configServiceMock.get.mockReturnValue(undefined);

    await expect(
      service.register({
        name: 'Cliente',
        email: 'cliente@tisnet.test',
        password: 'Secret123!',
        acceptedTerms: true,
        termsVersion: 'v1.0',
        privacyVersion: 'v1.0',
      }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('rechaza versiones legales desactualizadas', async () => {
    configServiceMock.get.mockReturnValue('v2.0');

    await expect(
      service.register({
        name: 'Cliente',
        email: 'cliente@tisnet.test',
        password: 'Secret123!',
        acceptedTerms: true,
        termsVersion: 'v1.0',
        privacyVersion: 'v1.0',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  describe('forgotPassword', () => {
    it('envía correo con enlace firmado cuando el usuario existe y está activo', async () => {
      usersServiceMock.findByEmail.mockResolvedValue({
        id: 10,
        email: 'cliente@tisnet.pe',
        name: 'Cliente Activo',
        tokenVersion: 2,
        isActive: true,
      });

      configServiceMock.get.mockImplementation((key: string) => {
        if (key === 'FRONTEND_URL') return 'https://tisnet.pe';
        if (key === 'JWT_RESET_PASSWORD_SECRET') return 'reset-secret';
        return null;
      });
      configServiceMock.getOrThrow.mockReturnValue('default-secret');
      jwtServiceMock.sign.mockReturnValue('jwt_reset_token_xyz');

      const res = await service.forgotPassword({ email: 'cliente@tisnet.pe' });

      expect(res.success).toBe(true);
      expect(jwtServiceMock.sign).toHaveBeenCalledWith(
        expect.objectContaining({
          sub: 10,
          email: 'cliente@tisnet.pe',
          tokenVersion: 2,
          purpose: 'password_reset',
        }),
        expect.objectContaining({ expiresIn: '15m' }),
      );
      expect(notificationProviderMock.send).toHaveBeenCalledWith(
        expect.objectContaining({
          recipient: 'cliente@tisnet.pe',
          subject: expect.stringContaining('Restablecimiento de contraseña'),
          html: expect.stringContaining('https://tisnet.pe/auth/reset-password?token=jwt_reset_token_xyz'),
        }),
      );
    });

    it('devuelve éxito genérico sin enviar correo cuando el usuario no existe', async () => {
      usersServiceMock.findByEmail.mockResolvedValue(null);

      const res = await service.forgotPassword({ email: 'inexistente@tisnet.pe' });

      expect(res.success).toBe(true);
      expect(notificationProviderMock.send).not.toHaveBeenCalled();
    });

    it('devuelve éxito genérico sin enviar correo cuando el usuario está inactivo', async () => {
      usersServiceMock.findByEmail.mockResolvedValue({
        id: 11,
        email: 'inactivo@tisnet.pe',
        isActive: false,
      });

      const res = await service.forgotPassword({ email: 'inactivo@tisnet.pe' });

      expect(res.success).toBe(true);
      expect(notificationProviderMock.send).not.toHaveBeenCalled();
    });
  });

  describe('resetPassword', () => {
    it('restablece la contraseña exitosamente cuando el token es válido y no ha sido usado', async () => {
      configServiceMock.get.mockReturnValue('reset-secret');
      configServiceMock.getOrThrow.mockReturnValue('reset-secret');

      jwtServiceMock.verify.mockReturnValue({
        sub: 5,
        email: 'usuario@tisnet.pe',
        tokenVersion: 3,
        purpose: 'password_reset',
      });

      usersServiceMock.findById.mockResolvedValue({
        id: 5,
        email: 'usuario@tisnet.pe',
        isActive: true,
        tokenVersion: 3,
      });
      usersServiceMock.updatePassword.mockResolvedValue({ id: 5 });

      const res = await service.resetPassword({
        token: 'valid_token_abc',
        newPassword: 'NuevaPassword123!',
      });

      expect(res.success).toBe(true);
      expect(usersServiceMock.updatePassword).toHaveBeenCalledWith(
        5,
        expect.any(String),
      );
    });

    it('lanza BadRequestException si el token está expirado o corrupto', async () => {
      configServiceMock.get.mockReturnValue('reset-secret');
      jwtServiceMock.verify.mockImplementation(() => {
        throw new Error('jwt expired');
      });

      await expect(
        service.resetPassword({
          token: 'expired_token',
          newPassword: 'NuevaPassword123!',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('lanza BadRequestException si el tokenVersion no coincide (token ya usado)', async () => {
      configServiceMock.get.mockReturnValue('reset-secret');
      jwtServiceMock.verify.mockReturnValue({
        sub: 5,
        email: 'usuario@tisnet.pe',
        tokenVersion: 1, // outdated
        purpose: 'password_reset',
      });

      usersServiceMock.findById.mockResolvedValue({
        id: 5,
        isActive: true,
        tokenVersion: 2, // current is 2
      });

      await expect(
        service.resetPassword({
          token: 'already_used_token',
          newPassword: 'NuevaPassword123!',
        }),
      ).rejects.toThrow('Este enlace ya fue utilizado o ha sido invalidado.');
    });

    it('lanza BadRequestException si el purpose del token no es password_reset', async () => {
      configServiceMock.get.mockReturnValue('reset-secret');
      jwtServiceMock.verify.mockReturnValue({
        sub: 5,
        tokenVersion: 1,
        purpose: 'login', // wrong purpose
      });

      await expect(
        service.resetPassword({
          token: 'wrong_purpose_token',
          newPassword: 'NuevaPassword123!',
        }),
      ).rejects.toThrow('Token de tipo inválido.');
    });
  });
});

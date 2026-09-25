import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';

import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

describe('AuthController', () => {
  let controller: AuthController;

  const authServiceMock = {
    login: vi.fn(),
    refresh: vi.fn(),
    forgotPassword: vi.fn(),
    resetPassword: vi.fn(),
  };

  beforeEach(async () => {
    vi.resetAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: authServiceMock,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: vi.fn(() => true),
      })
      .compile();

    controller = module.get<AuthController>(AuthController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('delegates forgotPassword to AuthService', async () => {
    const dto = { email: 'user@example.com' };
    authServiceMock.forgotPassword.mockResolvedValue({
      success: true,
      message: 'Instrucciones enviadas',
    });

    const res = await controller.forgotPassword(dto);
    expect(authServiceMock.forgotPassword).toHaveBeenCalledWith(dto);
    expect(res.success).toBe(true);
  });

  it('delegates resetPassword to AuthService', async () => {
    const dto = { token: 'jwt.token.here', newPassword: 'NewPassword123!' };
    authServiceMock.resetPassword.mockResolvedValue({
      success: true,
      message: 'Contraseña actualizada',
    });

    const res = await controller.resetPassword(dto);
    expect(authServiceMock.resetPassword).toHaveBeenCalledWith(dto);
    expect(res.success).toBe(true);
  });
});

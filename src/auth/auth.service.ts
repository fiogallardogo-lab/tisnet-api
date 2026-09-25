import { BadRequestException, Inject, Injectable, Optional, UnauthorizedException } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { JwtService, type JwtSignOptions } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { validateLegalVersions } from '../common/legal/legal-versions';
import {
  NOTIFICATION_PROVIDER,
  type NotificationProvider,
} from '../notifications/notification-provider.interface';
import { renderPasswordResetEmail } from '../notifications/templates/password-reset-notification';

interface RefreshTokenPayload {
  sub: number;
  tokenVersion: number;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    @Inject(NOTIFICATION_PROVIDER)
    private readonly notificationProvider: NotificationProvider,
    @Optional()
    private readonly auditService?: AuditService,
  ) {}

  async validateUser(email: string, pass: string) {
    const user = await this.usersService.findByEmail(email);

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    const isMatch = await bcrypt.compare(pass, user.passwordHash);

    if (!isMatch) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    const { passwordHash: _passwordHash, ...result } = user;
    return result;
  }

  async login(loginDto: LoginDto) {
    const user = await this.validateUser(loginDto.email, loginDto.password);

    const payload = {
      email: user.email,
      sub: user.id,
      role: user.role.name,
      tokenVersion: user.tokenVersion,
    };

    const accessToken = this.jwtService.sign(payload);

    const refreshExpiration = (this.configService.get<string>(
      'JWT_REFRESH_EXPIRATION',
    ) ?? '7d') as JwtSignOptions['expiresIn'];

    const refreshToken = this.jwtService.sign(
      {
        sub: user.id,
        tokenVersion: user.tokenVersion,
      },
      {
        secret: this.configService.getOrThrow<string>('JWT_REFRESH_SECRET'),
        expiresIn: refreshExpiration,
      },
    );

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        role: user.role.name,
      },
    };
  }

  async refresh(refreshToken: string) {
    try {
      const payload = this.jwtService.verify<RefreshTokenPayload>(
        refreshToken,
        {
          secret: this.configService.getOrThrow<string>('JWT_REFRESH_SECRET'),
        },
      );

      const user = await this.usersService.findById(payload.sub);

      if (!user || !user.isActive) {
        throw new UnauthorizedException('Usuario inactivo o no existe');
      }

      if (user.tokenVersion !== payload.tokenVersion) {
        throw new UnauthorizedException('Refresh token revocado');
      }

      const newPayload = {
        email: user.email,
        sub: user.id,
        role: user.role.name,
        tokenVersion: user.tokenVersion,
      };

      const newAccessToken = this.jwtService.sign(newPayload);

      return {
        accessToken: newAccessToken,
      };
    } catch {
      throw new UnauthorizedException('Refresh token inválido o expirado');
    }
  }

  async logout(userId: number) {
    await this.usersService.incrementTokenVersion(userId);

    return {
      success: true,
      message: 'Sesión cerrada correctamente',
      data: null,
    };
  }

  async register(registerDto: RegisterDto) {
    const { termsVersion, privacyVersion } = validateLegalVersions(
      this.configService,
      registerDto,
    );

    const passwordHash = await bcrypt.hash(registerDto.password, 12);
    const user = await this.usersService.createClient({
      name: registerDto.name,
      email: registerDto.email,
      passwordHash,
      termsVersion,
      privacyVersion,
    });

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role.name,
      isActive: user.isActive,
      acceptedTermsAt: user.acceptedTermsAt,
      termsVersion: user.termsVersion,
      privacyVersion: user.privacyVersion,
    };
  }

  async forgotPassword(dto: ForgotPasswordDto): Promise<{ success: boolean; message: string }> {
    const genericResponse = {
      success: true,
      message:
        'Si el correo electrónico está registrado, se han enviado las instrucciones para restablecer la contraseña.',
    };

    const user = await this.usersService.findByEmail(dto.email);
    if (!user || !user.isActive) {
      return genericResponse;
    }

    const resetSecret =
      this.configService.get<string>('JWT_RESET_PASSWORD_SECRET') ??
      this.configService.getOrThrow<string>('JWT_SECRET');

    const resetToken = this.jwtService.sign(
      {
        sub: user.id,
        email: user.email,
        tokenVersion: user.tokenVersion,
        purpose: 'password_reset',
      },
      {
        secret: resetSecret,
        expiresIn: '15m',
      },
    );

    const frontendBaseUrl = (
      this.configService.get<string>('FRONTEND_URL') ??
      'https://tisnet.pe'
    ).replace(/\/+$/, '');

    const resetUrl = `${frontendBaseUrl}/auth/reset-password?token=${encodeURIComponent(resetToken)}`;

    const { subject, html, text } = renderPasswordResetEmail({
      recipientEmail: user.email,
      recipientName: user.name,
      resetUrl,
      expiresInMinutes: 15,
    });

    try {
      void this.auditService?.logAuthEvent({
        action: 'PASSWORD_RESET_REQUESTED',
        email: user.email,
        userId: user.id,
      });

      await this.notificationProvider.send({
        recipient: user.email,
        subject,
        html,
        text,
      });
    } catch {
      // Resilient: do not break generic response if notification transport fails
    }

    return genericResponse;
  }

  async resetPassword(dto: ResetPasswordDto): Promise<{ success: boolean; message: string }> {
    const resetSecret =
      this.configService.get<string>('JWT_RESET_PASSWORD_SECRET') ??
      this.configService.getOrThrow<string>('JWT_SECRET');

    let payload: {
      sub: number;
      email: string;
      tokenVersion: number;
      purpose: string;
    };

    try {
      payload = this.jwtService.verify(dto.token, {
        secret: resetSecret,
      });
    } catch {
      throw new BadRequestException('El enlace de recuperación es inválido o ha expirado.');
    }

    if (payload.purpose !== 'password_reset') {
      throw new BadRequestException('Token de tipo inválido.');
    }

    const user = await this.usersService.findById(payload.sub);
    if (!user || !user.isActive) {
      throw new BadRequestException('Usuario no válido o inactivo.');
    }

    if (user.tokenVersion !== payload.tokenVersion) {
      throw new BadRequestException('Este enlace ya fue utilizado o ha sido invalidado.');
    }

    const newHash = await bcrypt.hash(dto.newPassword, 12);
    await this.usersService.updatePassword(user.id, newHash);

    void this.auditService?.logAuthEvent({
      action: 'PASSWORD_RESET_SUCCESS',
      email: user.email,
      userId: user.id,
    });

    return {
      success: true,
      message:
        'Contraseña actualizada correctamente. Ya puedes iniciar sesión con tu nueva contraseña.',
    };
  }
}

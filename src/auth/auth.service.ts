import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService, type JwtSignOptions } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';

import { UsersService } from '../users/users.service';
import { LoginDto } from './dto/login.dto';

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
  ) { }

  async validateUser(email: string, pass: string) {
    const user = await this.usersService.findByEmail(email);

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    const isMatch = await bcrypt.compare(pass, user.passwordHash);

    if (!isMatch) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    const { passwordHash, ...result } = user;

    return result;
  }

  async login(loginDto: LoginDto) {
    const user = await this.validateUser(
      loginDto.email,
      loginDto.password,
    );

    const payload = {
      email: user.email,
      sub: user.id,
      role: user.role.name,
      tokenVersion: user.tokenVersion,
    };

    const accessToken = this.jwtService.sign(payload);

    const refreshExpiration =
      (this.configService.get<string>('JWT_REFRESH_EXPIRATION') ??
        '7d') as JwtSignOptions['expiresIn'];

    const refreshToken = this.jwtService.sign(
      {
        sub: user.id,
        tokenVersion: user.tokenVersion,
      },
      {
        secret:
          this.configService.getOrThrow<string>(
            'JWT_REFRESH_SECRET',
          ),
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
      const payload =
        this.jwtService.verify<RefreshTokenPayload>(
          refreshToken,
          {
            secret:
              this.configService.getOrThrow<string>(
                'JWT_REFRESH_SECRET',
              ),
          },
        );

      const user = await this.usersService.findById(payload.sub);

      if (!user || !user.isActive) {
        throw new UnauthorizedException(
          'Usuario inactivo o no existe',
        );
      }

      if (user.tokenVersion !== payload.tokenVersion) {
        throw new UnauthorizedException(
          'Refresh token revocado',
        );
      }

      const newPayload = {
        email: user.email,
        sub: user.id,
        role: user.role.name,
        tokenVersion: user.tokenVersion,
      };

      const newAccessToken =
        this.jwtService.sign(newPayload);

      return {
        accessToken: newAccessToken,
      };
    } catch {
      throw new UnauthorizedException(
        'Refresh token inválido o expirado',
      );
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
}
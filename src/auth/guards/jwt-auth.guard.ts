import { Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  handleRequest<TUser = unknown>(
    err: Error | null,
    user: TUser | false | null,
    _info: Error | null,
  ): TUser {
    if (err || !user) {
      throw err || new UnauthorizedException('No autorizado');
    }

    return user;
  }
}
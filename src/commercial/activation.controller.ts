import {
  Body,
  Controller,
  HttpCode,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiTags,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import {
  ActivationDto,
  InviteClientDto,
  RequestActivationDto,
} from './commercial.dto';
import { ActivationService } from './activation.service';
@ApiTags('Account activation')
@ApiResponse({
  status: 400,
  description: 'DTO/token inválido, vencido o versión legal incorrecta',
})
@ApiResponse({ status: 409, description: 'Token usado o correo existente' })
@Controller('auth')
export class ActivationController {
  constructor(private readonly service: ActivationService) {}
  @ApiResponse({
    status: 200,
    description:
      'data: { activated: true }; contraseña y consentimiento guardados, token invalidado',
  })
  @ApiResponse({
    status: 503,
    description: 'Versiones legales no configuradas',
  })
  @Post('activate')
  @HttpCode(200)
  @Throttle({ auth: { ttl: 60000, limit: 5 } })
  @ApiOperation({
    summary: 'Activar una cuenta una sola vez con consentimiento legal',
  })
  activate(@Body() dto: ActivationDto) {
    return this.service.activate(dto);
  }
  @ApiResponse({
    status: 200,
    description:
      'data: { requested: true, message: string }; respuesta genérica para todas las cuentas',
  })
  @Post('request-activation')
  @HttpCode(200)
  @Throttle({ auth: { ttl: 60000, limit: 3 } })
  @ApiOperation({
    summary: 'Solicitar correo de activación sin enumerar cuentas',
  })
  request(@Body() dto: RequestActivationDto) {
    return this.service.request(dto.email);
  }
  @ApiResponse({
    status: 201,
    description:
      'data: { id, email, isActive: false, delivery: SENT|FAILED, messageId? }; nunca devuelve token ni contraseña',
  })
  @ApiResponse({ status: 401, description: 'Sesión requerida' })
  @ApiResponse({ status: 403, description: 'Solo ADMIN y SUPER_ADMIN' })
  @ApiResponse({ status: 503, description: 'Rol CLIENT o proveedor de correo real no configurado' })
  @Post('client-invitations')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'SUPER_ADMIN')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Crear cliente inactivo e invitar por correo; no retorna el token',
  })
  invite(
    @Body() dto: InviteClientDto,
    @Request() req: { user: { id: number } },
  ) {
    return this.service.invite(dto, req.user.id);
  }
}

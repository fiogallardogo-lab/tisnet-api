import {
  Body,
  Controller,
  Get,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { PLATFORM_ROLES } from '../common/constants/platform-roles';
import { CreateClientActivationRequestDto } from './commercial.dto';
import { ClientActivationRequestsService } from './client-activation-requests.service';

type AuthenticatedRequest = {
  user: { id: number; role: string };
};

@ApiTags('Client activation requests')
@ApiBearerAuth()
@Controller('admin/client-activation-requests')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ClientActivationRequestsController {
  constructor(private readonly service: ClientActivationRequestsService) {}

  @Post()
  @Roles(PLATFORM_ROLES.ADMIN, PLATFORM_ROLES.SUPER_ADMIN)
  @ApiOperation({ summary: 'Solicitar activación de cuenta para un visitante' })
  create(
    @Body() dto: CreateClientActivationRequestDto,
    @Request() request: AuthenticatedRequest,
  ) {
    return this.service.create(dto.prospectId, request.user.id);
  }

  @Get()
  @Roles(PLATFORM_ROLES.ADMIN, PLATFORM_ROLES.SUPER_ADMIN)
  @ApiOperation({
    summary:
      'Listar solicitudes propias para ADMIN o pendientes globales para SUPER_ADMIN',
  })
  list(@Request() request: AuthenticatedRequest) {
    return this.service.list(request.user.id, request.user.role);
  }
}

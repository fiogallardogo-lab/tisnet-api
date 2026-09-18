import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { PLATFORM_ROLES } from '../common/constants/platform-roles';
import { LinkQuoteDto } from './dto/link-quote.dto';
import { ListProspectsQueryDto } from './dto/list-prospects-query.dto';
import { UpdateProspectStatusDto } from './dto/update-prospect-status.dto';
import { ProspectsService } from './prospects.service';

interface AuthenticatedRequest {
  user: { id: number; email: string; role: string };
}

@ApiTags('Prospects')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('prospects')
export class ProspectsController {
  constructor(private readonly prospectsService: ProspectsService) {}

  @Post('link-quote')
  @Roles(PLATFORM_ROLES.CLIENT)
  @ApiOperation({ summary: 'Vincular una cotización previa al cliente actual' })
  @ApiResponse({
    status: 201,
    description: 'Cotización vinculada correctamente',
  })
  @ApiResponse({
    status: 403,
    description: 'El correo de la cotización no coincide',
  })
  @ApiResponse({ status: 404, description: 'Cotización no encontrada' })
  @ApiResponse({
    status: 409,
    description: 'La cotización ya pertenece a otro prospecto',
  })
  linkQuote(
    @Request() request: AuthenticatedRequest,
    @Body() dto: LinkQuoteDto,
  ) {
    return this.prospectsService.linkQuote(
      request.user.id,
      request.user.email,
      dto.publicCode,
    );
  }

  @Get('me')
  @Roles(PLATFORM_ROLES.CLIENT)
  @ApiOperation({ summary: 'Consultar el prospecto del cliente actual' })
  findOwn(@Request() request: AuthenticatedRequest) {
    return this.prospectsService.findOwn(request.user.id);
  }

  @Get()
  @Roles(PLATFORM_ROLES.ADMIN, PLATFORM_ROLES.SUPER_ADMIN)
  @ApiOperation({ summary: 'Listar prospectos para gestión administrativa' })
  findAll(@Query() query: ListProspectsQueryDto) {
    return this.prospectsService.findAll(query);
  }

  @Get(':id')
  @Roles(PLATFORM_ROLES.ADMIN, PLATFORM_ROLES.SUPER_ADMIN)
  @ApiOperation({ summary: 'Consultar el detalle administrativo de un prospecto' })
  @ApiResponse({ status: 200, description: 'Prospecto encontrado' })
  @ApiResponse({ status: 404, description: 'Prospecto no encontrado' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.prospectsService.findOne(id);
  }

  @Patch(':id/status')
  @Roles(PLATFORM_ROLES.ADMIN, PLATFORM_ROLES.SUPER_ADMIN)
  @ApiOperation({ summary: 'Actualizar el estado comercial de un prospecto' })
  @ApiResponse({ status: 200, description: 'Estado actualizado correctamente' })
  @ApiResponse({ status: 404, description: 'Prospecto no encontrado' })
  updateStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateProspectStatusDto,
  ) {
    return this.prospectsService.updateStatus(id, dto.status);
  }
}

import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Query,
  Request,
  Res,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConsumes,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiProduces,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { PLATFORM_ROLES } from '../common/constants/platform-roles.js';
import { AssignInterviewDto } from './dto/assign-interview.dto.js';
import { ListTeamApplicationsQueryDto } from './dto/list-team-applications-query.dto.js';
import { RejectTeamApplicationDto } from './dto/reject-team-application.dto.js';
import { TeamApplicationsService } from './team-applications.service.js';

interface AuthenticatedRequest {
  user: { id: number; email: string; role: string };
}

@ApiTags('Team Applications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(PLATFORM_ROLES.SUPER_ADMIN)
@Controller('team-applications')
export class TeamApplicationsController {
  constructor(private readonly service: TeamApplicationsService) {}

  @Get()
  @ApiOperation({
    summary: 'Listar postulaciones para revisión administrativa',
  })
  @ApiOkResponse({ description: 'Listado paginado de postulaciones' })
  @ApiUnauthorizedResponse({ description: 'JWT ausente o inválido' })
  @ApiForbiddenResponse({ description: 'Acceso exclusivo de SUPER_ADMIN' })
  findAll(@Query() query: ListTeamApplicationsQueryDto) {
    return this.service.findAll(query);
  }

  @Get('interviewers')
  @ApiOperation({ summary: 'Listar administradores activos para entrevistas' })
  @ApiOkResponse({ description: 'Administradores entrevistadores disponibles' })
  findInterviewers() {
    return this.service.findInterviewers();
  }

  @Get(':id/photo')
  @ApiOperation({ summary: 'Consultar la fotografía privada del postulante' })
  @ApiProduces('image/jpeg', 'image/png', 'image/webp')
  @ApiOkResponse({ description: 'Fotografía del postulante' })
  @ApiNotFoundResponse({ description: 'Postulación no encontrada' })
  async getPhoto(
    @Param('id', ParseIntPipe) id: number,
    @Res({ passthrough: true }) response: Response,
  ) {
    const file = await this.service.getPhoto(id);
    response.set({
      'Content-Type': file.mimeType,
      'Cache-Control': 'private, no-store',
      'Content-Disposition': 'inline',
    });
    return new StreamableFile(file.content);
  }

  @Get(':id/cv')
  @ApiOperation({ summary: 'Descargar el CV privado del postulante' })
  @ApiProduces('application/pdf')
  @ApiOkResponse({ description: 'CV del postulante' })
  @ApiNotFoundResponse({ description: 'Postulación no encontrada' })
  async getCv(
    @Param('id', ParseIntPipe) id: number,
    @Res({ passthrough: true }) response: Response,
  ) {
    const file = await this.service.getCv(id);
    const safeName = file.filename.replace(/[^a-zA-Z0-9._-]/g, '_');
    response.set({
      'Content-Type': 'application/pdf',
      'Cache-Control': 'private, no-store',
      'Content-Disposition': `attachment; filename="${safeName}"`,
    });
    return new StreamableFile(file.content);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Consultar el perfil completo de una postulación' })
  @ApiOkResponse({ description: 'Detalle administrativo de la postulación' })
  @ApiNotFoundResponse({ description: 'Postulación no encontrada' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.service.findOne(id);
  }

  @Patch(':id/assign-interview')
  @ApiConsumes('application/json')
  @ApiOperation({ summary: 'Asignar un administrador para la entrevista' })
  @ApiOkResponse({
    description: 'Entrevistador asignado y notificación procesada',
  })
  assignInterview(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AssignInterviewDto,
    @Request() request: AuthenticatedRequest,
  ) {
    return this.service.assignInterview(
      id,
      dto.adminProfileId,
      request.user.id,
    );
  }

  @Patch(':id/reject')
  @ApiConsumes('application/json')
  @ApiOperation({ summary: 'Rechazar una postulación con motivo' })
  @ApiOkResponse({
    description: 'Postulación rechazada y notificación procesada',
  })
  reject(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: RejectTeamApplicationDto,
    @Request() request: AuthenticatedRequest,
  ) {
    return this.service.reject(id, dto.reason, request.user.id);
  }
}

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
  BadRequestException,
  ForbiddenException,
  Optional,
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
import { InterviewDecisionDto } from './dto/interview-decision.dto.js';
import { TeamApplicationsService } from './team-applications.service.js';
import { SignedUrlService } from '../common/signed-urls/signed-url.service.js';
import { AuditService } from '../audit/audit.service.js';

interface AuthenticatedRequest {
  user: { id: number; email: string; role: string };
}

@ApiTags('Team Applications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(PLATFORM_ROLES.SUPER_ADMIN)
@Controller('team-applications')
export class TeamApplicationsController {
  constructor(
    private readonly service: TeamApplicationsService,
    @Optional() private readonly signedUrlService?: SignedUrlService,
    @Optional() private readonly auditService?: AuditService,
  ) {}

  @Get('my-interviews')
  @Roles(PLATFORM_ROLES.ADMIN, PLATFORM_ROLES.SUPER_ADMIN)
  @ApiOperation({
    summary: 'Listar entrevistas asignadas al administrador autenticado',
  })
  findMyInterviews(@Request() request: AuthenticatedRequest) {
    return this.service.findAssignedInterviews(request.user.id);
  }

  @Get('my-interviews/:id/photo')
  @Roles(PLATFORM_ROLES.ADMIN, PLATFORM_ROLES.SUPER_ADMIN)
  async getMyInterviewPhoto(
    @Param('id', ParseIntPipe) id: number,
    @Request() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: Response,
  ) {
    const file = await this.service.getAssignedPhoto(request.user.id, id);
    response.set({
      'Content-Type': file.mimeType,
      'Cache-Control': 'private, no-store',
    });
    return new StreamableFile(file.content);
  }

  @Get('my-interviews/:id/cv')
  @Roles(PLATFORM_ROLES.ADMIN, PLATFORM_ROLES.SUPER_ADMIN)
  async getMyInterviewCv(
    @Param('id', ParseIntPipe) id: number,
    @Request() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: Response,
  ) {
    const file = await this.service.getAssignedCv(request.user.id, id);
    const safeName = file.filename.replace(/[^a-zA-Z0-9._-]/g, '_');
    response.set({
      'Content-Type': 'application/pdf',
      'Cache-Control': 'private, no-store',
      'Content-Disposition': `attachment; filename="${safeName}"`,
    });
    return new StreamableFile(file.content);
  }

  @Get('my-interviews/:id')
  @Roles(PLATFORM_ROLES.ADMIN, PLATFORM_ROLES.SUPER_ADMIN)
  findMyInterview(
    @Param('id', ParseIntPipe) id: number,
    @Request() request: AuthenticatedRequest,
  ) {
    return this.service.findAssignedInterview(request.user.id, id);
  }

  @Patch('my-interviews/:id/decision')
  @Roles(PLATFORM_ROLES.ADMIN, PLATFORM_ROLES.SUPER_ADMIN)
  @ApiOperation({
    summary: 'Registrar el resultado de una entrevista asignada',
  })
  decideMyInterview(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: InterviewDecisionDto,
    @Request() request: AuthenticatedRequest,
  ) {
    return this.service.completeAssignedInterview(
      request.user.id,
      request.user.role,
      id,
      dto.decision,
      dto.reason,
    );
  }

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
  @Roles(PLATFORM_ROLES.SUPER_ADMIN)
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
  @Roles(PLATFORM_ROLES.SUPER_ADMIN)
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

  @Get(':id/signed-url')
  @ApiOperation({ summary: 'Generar URL firmada temporal para descarga segura de CV o fotografía' })
  getSignedUrl(
    @Param('id', ParseIntPipe) id: number,
    @Query('fileType') fileType: 'cv' | 'photo',
    @Request() request: any,
  ) {
    if (fileType !== 'cv' && fileType !== 'photo') {
      throw new BadRequestException('fileType debe ser "cv" o "photo"');
    }

    if (!this.signedUrlService) {
      throw new BadRequestException('SignedUrlService no está configurado');
    }

    const host = request.get ? request.get('host') : 'localhost:3000';
    const protocol = request.protocol ?? 'https';
    const baseUrl = `${protocol}://${host}`;

    const { signedUrl, expiresAt } = this.signedUrlService.generateSignedUrl(
      baseUrl,
      id,
      fileType,
      900,
    );

    return {
      signedUrl,
      expiresAt,
      expiresInSeconds: 900,
    };
  }

  @Get(':id/secure-download')
  @ApiOperation({ summary: 'Descargar archivo mediante token firmado temporal con expiración' })
  async downloadSecureFile(
    @Param('id', ParseIntPipe) id: number,
    @Query('token') token: string,
    @Query('fileType') fileType: 'cv' | 'photo',
    @Res({ passthrough: true }) response: Response,
  ) {
    if (fileType !== 'cv' && fileType !== 'photo') {
      throw new BadRequestException('fileType debe ser "cv" o "photo"');
    }

    if (!this.signedUrlService) {
      throw new BadRequestException('SignedUrlService no está disponible');
    }

    const verification = this.signedUrlService.verifyToken(token, id, fileType);
    if (!verification.valid) {
      throw new ForbiddenException(verification.error ?? 'Enlace de descarga no autorizado o expirado.');
    }

    void this.auditService?.record({
      action: 'SECURE_FILE_DOWNLOADED',
      entityType: 'TeamApplication',
      entityId: id,
      metadata: { fileType },
    });

    if (fileType === 'photo') {
      const file = await this.service.getPhoto(id);
      response.set({
        'Content-Type': file.mimeType,
        'Cache-Control': 'private, no-store',
        'Content-Disposition': 'inline',
      });
      return new StreamableFile(file.content);
    } else {
      const file = await this.service.getCv(id);
      const safeName = file.filename.replace(/[^a-zA-Z0-9._-]/g, '_');
      response.set({
        'Content-Type': 'application/pdf',
        'Cache-Control': 'private, no-store',
        'Content-Disposition': `attachment; filename="${safeName}"`,
      });
      return new StreamableFile(file.content);
    }
  }

  @Patch(':id/decision')
  @Roles(PLATFORM_ROLES.SUPER_ADMIN)
  @ApiConsumes('application/json')
  @ApiOperation({
    summary:
      'Registrar decisión sobre una postulación en entrevista por SUPER_ADMIN',
  })
  decideApplication(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: InterviewDecisionDto,
    @Request() request: AuthenticatedRequest,
  ) {
    return this.service.completeAssignedInterview(
      request.user.id,
      request.user.role,
      id,
      dto.decision,
      dto.reason,
    );
  }

  @Patch(':id/accept')
  @Roles(PLATFORM_ROLES.SUPER_ADMIN)
  @ApiOperation({
    summary: 'Aceptar una postulación en entrevista por SUPER_ADMIN',
  })
  accept(
    @Param('id', ParseIntPipe) id: number,
    @Request() request: AuthenticatedRequest,
    @Body() body?: { reason?: string },
  ) {
    return this.service.completeAssignedInterview(
      request.user.id,
      request.user.role,
      id,
      'ACCEPTED',
      body?.reason,
    );
  }
}

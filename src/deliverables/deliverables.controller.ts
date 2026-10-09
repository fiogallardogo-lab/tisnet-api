import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Request,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { PLATFORM_ROLES } from '../common/constants/platform-roles';
import {
  DeliverablesService,
  type DeliverablesActor,
  type DeliverableFile,
} from './deliverables.service';
import { CreateDeliverableDto } from './dto/create-deliverable.dto';
import { ReviewDeliverableDto } from './dto/review-deliverable.dto';
import { SubmitDeliverableDto } from './dto/submit-deliverable.dto';
import { SubmitEvidenceDto } from './dto/submit-evidence.dto';

interface AuthenticatedRequest {
  user: DeliverablesActor & { email: string };
}

const ALLOWED_ROLES = [
  PLATFORM_ROLES.CLIENT,
  PLATFORM_ROLES.DEVELOPER,
  PLATFORM_ROLES.PRODUCT_OWNER,
  PLATFORM_ROLES.ADMIN,
  PLATFORM_ROLES.SUPER_ADMIN,
];

@ApiTags('Project deliverables')
@ApiBearerAuth()
@Controller('projects/:projectId/deliverables')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...ALLOWED_ROLES)
export class DeliverablesController {
  constructor(private readonly deliverablesService: DeliverablesService) {}

  @Get()
  @ApiOperation({ summary: 'Listar entregables de un proyecto accesible' })
  @ApiParam({ name: 'projectId', type: Number })
  @ApiResponse({ status: 200, description: 'Entregables ordenados por hito' })
  @ApiResponse({ status: 401, description: 'Sesión ausente o inválida' })
  @ApiResponse({ status: 403, description: 'Membresía insuficiente' })
  @ApiResponse({ status: 404, description: 'Proyecto no encontrado' })
  list(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Request() request: AuthenticatedRequest,
  ) {
    return this.deliverablesService.list(projectId, request.user);
  }

  @Post()
  @ApiOperation({ summary: 'Crear un hito entregable' })
  @ApiResponse({
    status: 201,
    description: 'Entregable creado en estado DRAFT',
  })
  @ApiResponse({ status: 400, description: 'Payload inválido' })
  @ApiResponse({ status: 403, description: 'Rol o membresía insuficiente' })
  @ApiResponse({ status: 404, description: 'Proyecto no encontrado' })
  @ApiResponse({ status: 409, description: 'Orden de hito duplicado' })
  create(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Request() request: AuthenticatedRequest,
    @Body() dto: CreateDeliverableDto,
  ) {
    return this.deliverablesService.create(projectId, request.user, dto);
  }

  @Patch(':deliverableId/submit')
  @ApiOperation({ summary: 'Enviar o reenviar evidencia para revisión' })
  @ApiResponse({ status: 200, description: 'Entregable enviado a IN_REVIEW' })
  @ApiResponse({ status: 400, description: 'Evidencia ausente o URL inválida' })
  @ApiResponse({ status: 403, description: 'Rol o membresía insuficiente' })
  @ApiResponse({
    status: 404,
    description: 'Proyecto o entregable no encontrado',
  })
  @ApiResponse({ status: 409, description: 'Transición de estado inválida' })
  submit(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('deliverableId', ParseIntPipe) deliverableId: number,
    @Request() request: AuthenticatedRequest,
    @Body() dto: SubmitDeliverableDto,
  ) {
    return this.deliverablesService.submit(
      projectId,
      deliverableId,
      request.user,
      dto,
    );
  }

  @Patch(':deliverableId/review')
  @ApiOperation({ summary: 'Aprobar u observar un entregable en revisión' })
  @ApiResponse({ status: 200, description: 'Revisión persistida' })
  @ApiResponse({ status: 400, description: 'Observación sin notas' })
  @ApiResponse({ status: 403, description: 'Rol o membresía insuficiente' })
  @ApiResponse({
    status: 404,
    description: 'Proyecto o entregable no encontrado',
  })
  @ApiResponse({ status: 409, description: 'Transición de estado inválida' })
  review(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('deliverableId', ParseIntPipe) deliverableId: number,
    @Request() request: AuthenticatedRequest,
    @Body() dto: ReviewDeliverableDto,
  ) {
    return this.deliverablesService.review(
      projectId,
      deliverableId,
      request.user,
      dto,
    );
  }

  @Post(':deliverableId/review')
  @ApiOperation({ summary: 'Aprobar u observar un entregable (alias POST)' })
  reviewPost(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('deliverableId', ParseIntPipe) deliverableId: number,
    @Request() request: AuthenticatedRequest,
    @Body() dto: ReviewDeliverableDto,
  ) {
    return this.deliverablesService.review(
      projectId,
      deliverableId,
      request.user,
      dto,
    );
  }

  @Post(':deliverableId/evidence')
  @ApiOperation({ summary: 'Subir evidencia completa (PDF + Video)' })
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 50 * 1024 * 1024 },
    }),
  )
  submitEvidence(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('deliverableId', ParseIntPipe) deliverableId: number,
    @Request() request: AuthenticatedRequest,
    @UploadedFile() file?: DeliverableFile,
    @Body() dto?: SubmitEvidenceDto,
  ) {
    return this.deliverablesService.submitEvidence(
      projectId,
      deliverableId,
      request.user,
      file,
      dto,
    );
  }

  @Get(':deliverableId/history')
  @ApiOperation({ summary: 'Consultar historial y trazabilidad del entregable' })
  getHistory(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('deliverableId', ParseIntPipe) deliverableId: number,
    @Request() request: AuthenticatedRequest,
  ) {
    return this.deliverablesService.getHistory(
      projectId,
      deliverableId,
      request.user,
    );
  }

  @Post(':id/files')
  @ApiOperation({ summary: 'Subir archivo de entregable (PDF o video)' })
  @ApiParam({ name: 'projectId', type: Number })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: 201, description: 'Archivo subido exitosamente' })
  @ApiResponse({ status: 400, description: 'Archivo o formato inválido' })
  @ApiResponse({ status: 403, description: 'Membresía insuficiente' })
  @ApiResponse({ status: 404, description: 'Entregable no encontrado' })
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 100 * 1024 * 1024 },
    }),
  )
  uploadFile(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('id', ParseIntPipe) deliverableId: number,
    @UploadedFile() file: DeliverableFile,
    @Request() request: AuthenticatedRequest,
  ) {
    if (!file) {
      throw new BadRequestException('El archivo es obligatorio.');
    }
    return this.deliverablesService.uploadFile(
      projectId,
      deliverableId,
      request.user,
      file,
    );
  }

  @Get(':deliverableId/files')
  @ApiOperation({ summary: 'Ver archivo de evidencia de un entregable' })
  @ApiParam({ name: 'projectId', type: Number })
  @ApiParam({ name: 'deliverableId', type: Number })
  getFile(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('deliverableId', ParseIntPipe) deliverableId: number,
    @Request() request: AuthenticatedRequest,
  ) {
    return this.deliverablesService.getFile(
      projectId,
      deliverableId,
      request.user,
    );
  }
}

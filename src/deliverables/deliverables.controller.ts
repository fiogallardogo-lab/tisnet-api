import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
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
} from './deliverables.service';
import { CreateDeliverableDto } from './dto/create-deliverable.dto';
import { ReviewDeliverableDto } from './dto/review-deliverable.dto';
import { SubmitDeliverableDto } from './dto/submit-deliverable.dto';

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
}

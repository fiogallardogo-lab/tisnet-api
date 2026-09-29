import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Request,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiConsumes,
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
import { ReviewDeliverableDto } from './dto/review-deliverable.dto';
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

@ApiTags('Project milestones (Sprint 15)')
@ApiBearerAuth()
@Controller('projects/:projectId/milestones')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...ALLOWED_ROLES)
export class MilestonesController {
  constructor(private readonly deliverablesService: DeliverablesService) {}

  @Post([':milestoneId/evidence', ':milestoneId/evidence/pdf'])
  @ApiOperation({ summary: 'Subir evidencia completa (PDF + Video) para revisión del hito' })
  @ApiParam({ name: 'projectId', type: Number })
  @ApiParam({ name: 'milestoneId', type: Number })
  @ApiConsumes('multipart/form-data', 'application/json')
  @ApiResponse({ status: 201, description: 'Evidencia registrada y enviada a IN_REVIEW' })
  @ApiResponse({ status: 400, description: 'Falta PDF o enlace de video' })
  @ApiResponse({ status: 403, description: 'Membresía o rol insuficiente' })
  @ApiResponse({ status: 404, description: 'Hito o proyecto no encontrado' })
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 50 * 1024 * 1024 },
    }),
  )
  submitEvidence(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('milestoneId', ParseIntPipe) milestoneId: number,
    @Request() req: AuthenticatedRequest,
    @UploadedFile() file?: DeliverableFile,
    @Body() dto?: SubmitEvidenceDto,
  ) {
    return this.deliverablesService.submitEvidence(
      projectId,
      milestoneId,
      req.user,
      file,
      dto,
    );
  }

  @Post(':milestoneId/review')
  @ApiOperation({ summary: 'Aprobar u observar un hito en revisión' })
  @ApiParam({ name: 'projectId', type: Number })
  @ApiParam({ name: 'milestoneId', type: Number })
  @ApiResponse({ status: 200, description: 'Revisión registrada con éxito' })
  @ApiResponse({ status: 400, description: 'Observación sin notas/comentarios' })
  @ApiResponse({ status: 403, description: 'Rol insuficiente (solo Cliente, PO o Admin)' })
  review(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('milestoneId', ParseIntPipe) milestoneId: number,
    @Request() req: AuthenticatedRequest,
    @Body() dto: ReviewDeliverableDto,
  ) {
    return this.deliverablesService.review(
      projectId,
      milestoneId,
      req.user,
      dto,
    );
  }

  @Get(':milestoneId/history')
  @ApiOperation({ summary: 'Consultar historial y trazabilidad de un hito' })
  @ApiParam({ name: 'projectId', type: Number })
  @ApiParam({ name: 'milestoneId', type: Number })
  @ApiResponse({ status: 200, description: 'Línea de tiempo de eventos y evidencias' })
  getHistory(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('milestoneId', ParseIntPipe) milestoneId: number,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.deliverablesService.getHistory(
      projectId,
      milestoneId,
      req.user,
    );
  }
}

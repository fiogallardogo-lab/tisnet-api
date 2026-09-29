import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
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
import { ContributionsService } from './contributions.service';
import { SaveContributionsDto } from './dto/save-contributions.dto';

interface AuthenticatedRequest {
  user: { id: number; role: string; email: string };
}

const ALL_PLATFORM_ROLES = [
  PLATFORM_ROLES.CLIENT,
  PLATFORM_ROLES.DEVELOPER,
  PLATFORM_ROLES.PRODUCT_OWNER,
  PLATFORM_ROLES.ADMIN,
  PLATFORM_ROLES.SUPER_ADMIN,
];

@ApiTags('Project contributions')
@ApiBearerAuth()
@Controller('projects/:projectId')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...ALL_PLATFORM_ROLES)
export class ContributionsController {
  constructor(private readonly contributionsService: ContributionsService) {}

  @Post('milestones/:milestoneId/contributions')
  @ApiOperation({ summary: 'Registrar contribuciones del equipo para un hito (PO)' })
  @ApiParam({ name: 'projectId', type: Number })
  @ApiParam({ name: 'milestoneId', type: Number })
  @ApiResponse({ status: 201, description: 'Contribuciones registradas exitosamente' })
  @ApiResponse({ status: 400, description: 'Suma de porcentajes inválida o integrante no pertenece' })
  @ApiResponse({ status: 403, description: 'Solo el PO o Admin puede registrar contribuciones' })
  recordMilestoneContributions(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('milestoneId', ParseIntPipe) milestoneId: number,
    @Request() req: AuthenticatedRequest,
    @Body() dto: SaveContributionsDto,
  ) {
    return this.contributionsService.recordContributions(
      projectId,
      milestoneId,
      req.user,
      dto,
    );
  }

  @Post('deliverables/:deliverableId/contributions')
  @ApiOperation({ summary: 'Alias para registrar contribuciones por ID de entregable' })
  recordDeliverableContributions(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('deliverableId', ParseIntPipe) deliverableId: number,
    @Request() req: AuthenticatedRequest,
    @Body() dto: SaveContributionsDto,
  ) {
    return this.contributionsService.recordContributions(
      projectId,
      deliverableId,
      req.user,
      dto,
    );
  }

  @Get('milestones/:milestoneId/contributions')
  @ApiOperation({ summary: 'Consultar contribuciones de un hito' })
  getMilestoneContributions(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('milestoneId', ParseIntPipe) milestoneId: number,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.contributionsService.getMilestoneContributions(
      projectId,
      milestoneId,
      req.user,
    );
  }

  @Get('deliverables/:deliverableId/contributions')
  @ApiOperation({ summary: 'Alias para consultar contribuciones por entregable' })
  getDeliverableContributions(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('deliverableId', ParseIntPipe) deliverableId: number,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.contributionsService.getMilestoneContributions(
      projectId,
      deliverableId,
      req.user,
    );
  }

  @Get('contributions')
  @ApiOperation({ summary: 'Consultar reporte acumulado de contribuciones del proyecto' })
  @ApiResponse({ status: 200, description: 'Resumen de contribuciones y desglose del equipo' })
  getProjectContributions(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.contributionsService.getProjectContributions(
      projectId,
      req.user,
    );
  }
}

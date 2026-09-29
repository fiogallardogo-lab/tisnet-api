import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Query,
  Request,
  Response,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Response as ExpressResponse } from 'express';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { PLATFORM_ROLES } from '../common/constants/platform-roles';
import { ReportsService } from './reports.service';

const ALL_ROLES = [
  PLATFORM_ROLES.CLIENT,
  PLATFORM_ROLES.DEVELOPER,
  PLATFORM_ROLES.PRODUCT_OWNER,
  PLATFORM_ROLES.ADMIN,
  PLATFORM_ROLES.SUPER_ADMIN,
];

@ApiTags('Reports')
@ApiBearerAuth()
@Controller('reports')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('projects')
  @Roles(...ALL_ROLES)
  getProjectsReport(
    @Query('projectId') projectId: string | undefined,
    @Request() req: { user: { id: number; role: string } },
  ) {
    const id = projectId ? parseInt(projectId, 10) : undefined;
    return this.reportsService.getProjectsReport(req.user, isNaN(id!) ? undefined : id);
  }

  @Get('projects/:projectId/report')
  @Roles(...ALL_ROLES)
  @ApiOperation({ summary: 'Generar y descargar informe de trazabilidad del proyecto (S15-B06)' })
  @ApiQuery({ name: 'format', required: false, enum: ['json', 'pdf'] })
  @ApiResponse({ status: 200, description: 'Informe generado en formato JSON o PDF' })
  async getProjectReport(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Query('format') format: string | undefined,
    @Request() req: { user: { id: number; role: string } },
    @Response({ passthrough: true }) res: ExpressResponse,
  ) {
    const data = await this.reportsService.getProjectTraceabilityReport(req.user, projectId);

    if (format === 'pdf' || (!format && req.user.role === 'CLIENT')) {
      const pdfBuffer = await this.reportsService.renderProjectReportPdf(data);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="informe-proyecto-${projectId}.pdf"`,
      );
      res.send(pdfBuffer);
      return;
    }

    return {
      success: true,
      message: 'Informe de trazabilidad generado exitosamente',
      data,
    };
  }
}

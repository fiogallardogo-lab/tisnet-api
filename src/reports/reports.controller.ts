import { Controller, Get, Query, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { ReportsService } from './reports.service';

@ApiTags('Reports')
@ApiBearerAuth()
@Controller('reports')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('projects')
  @Roles('ADMIN', 'SUPER_ADMIN', 'CLIENT', 'PRODUCT_OWNER', 'DEVELOPER')
  getProjectsReport(
    @Query('projectId') projectId: string | undefined,
    @Request() req: { user: { id: number; role: string } }
  ) {
    const id = projectId ? parseInt(projectId, 10) : undefined;
    return this.reportsService.getProjectsReport(req.user, isNaN(id!) ? undefined : id);
  }
}

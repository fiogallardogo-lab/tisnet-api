import { ApiWorkErrors } from '../work/work-errors';
import { Controller, Get, Request, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiExtraModels,
  ApiOkResponse,
  ApiTags,
  getSchemaPath,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { DashboardService } from './dashboard.service';
import { WorkActor } from '../work/work.service';
import {
  ClientDashboardDto,
  DeveloperDashboardDto,
  ProductOwnerDashboardDto,
  AdminDashboardDto,
  SuperAdminDashboardDto,
} from './dashboard.dto';
const response = (dto: Function) => ({
  schema: {
    type: 'object',
    required: ['success', 'message', 'data'],
    properties: {
      success: { type: 'boolean', enum: [true] },
      message: { type: 'string' },
      data: { $ref: getSchemaPath(dto) },
    },
  },
});
@ApiWorkErrors()
@ApiTags('Dashboards')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('dashboard')
@ApiExtraModels(
  ClientDashboardDto,
  DeveloperDashboardDto,
  ProductOwnerDashboardDto,
  AdminDashboardDto,
  SuperAdminDashboardDto,
)
export class DashboardController {
  constructor(private readonly service: DashboardService) {}
  @Get('client')
  @Roles('CLIENT')
  @ApiOkResponse(response(ClientDashboardDto))
  client(@Request() r: { user: WorkActor }) {
    return this.service.get(r.user, 'CLIENT');
  }
  @Get('developer')
  @Roles('DEVELOPER')
  @ApiOkResponse(response(DeveloperDashboardDto))
  developer(@Request() r: { user: WorkActor }) {
    return this.service.get(r.user, 'DEVELOPER');
  }
  @Get('po')
  @Roles('PRODUCT_OWNER')
  @ApiOkResponse(response(ProductOwnerDashboardDto))
  po(@Request() r: { user: WorkActor }) {
    return this.service.get(r.user, 'PRODUCT_OWNER');
  }
  @Get('admin')
  @Roles('ADMIN')
  @ApiOkResponse(response(AdminDashboardDto))
  admin(@Request() r: { user: WorkActor }) {
    return this.service.get(r.user, 'ADMIN');
  }
  @Get('superadmin')
  @Roles('SUPER_ADMIN')
  @ApiOkResponse(response(SuperAdminDashboardDto))
  superadmin(@Request() r: { user: WorkActor }) {
    return this.service.get(r.user, 'SUPER_ADMIN');
  }
}

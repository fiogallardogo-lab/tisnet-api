import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { PLATFORM_ROLES } from '../common/constants/platform-roles.js';
import { AdminQuotesService } from './admin-quotes.service.js';

@Controller('admin/quotes')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(PLATFORM_ROLES.ADMIN, PLATFORM_ROLES.SUPER_ADMIN)
export class AdminQuotesController {
  constructor(private readonly service: AdminQuotesService) {}
  @Get() list(
    @Query()
    query: {
      page?: number;
      limit?: number;
      search?: string;
      status?: string;
    },
  ) {
    return this.service.list(query);
  }
  @Get(':id') findOne(@Param('id', ParseIntPipe) id: number) {
    return this.service.findOne(id);
  }
}

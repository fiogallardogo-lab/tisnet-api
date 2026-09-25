import {
  Controller,
  Get,
  Query,
  Res,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { AuditService } from './audit.service';
import { AuditQuery } from './audit.dto';
@Controller('admin/audit')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPER_ADMIN')
export class AuditController {
  constructor(private readonly service: AuditService) {}
  @Get() list(@Query() query: AuditQuery) {
    return this.service.list(query);
  }
  @Get('report') report(@Query() query: AuditQuery) {
    return this.service.report(query);
  }
  @Get('payments') payments() {
    return this.service.financialSummary();
  }
  @Get('export') async export(
    @Query() query: AuditQuery,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.service.export(query);
    if (result.nextCursor)
      res.setHeader('X-Next-Cursor', String(result.nextCursor));
    return new StreamableFile(Buffer.from('\uFEFF' + result.content), {
      type: 'text/csv; charset=utf-8',
      disposition: 'attachment; filename="audit.csv"',
    });
  }
}

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
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { PaymentsService } from './payments.service';
import { OfficialQuoteDto, PaymentEventDto } from './payments.dto';
@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'SUPER_ADMIN')
export class PaymentsController {
  constructor(private readonly service: PaymentsService) {}
  @Post('quotes/:id/versions') officialize(
    @Param('id', ParseIntPipe) id: number,
    @Request() req: { user: { id: number } },
    @Body() dto: OfficialQuoteDto,
  ) {
    return this.service.officialize(id, req.user.id, dto);
  }
  @Get('quotes/:id/versions') versions(@Param('id', ParseIntPipe) id: number) {
    return this.service.versions(id);
  }
  // Authenticated administrative reconciliation; deliberately NOT an unsigned public webhook.
  @Post('payments/events') record(
    @Body() dto: PaymentEventDto,
    @Request() req: { user: { id: number } },
  ) {
    return this.service.processEvent(dto, req.user.id);
  }
}

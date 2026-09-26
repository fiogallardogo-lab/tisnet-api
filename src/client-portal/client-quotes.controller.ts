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
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { ClientQuotesService } from './client-quotes.service';

@ApiTags('Client portal')
@ApiBearerAuth()
@Controller('client')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('CLIENT')
export class ClientQuotesController {
  constructor(private readonly service: ClientQuotesService) {}

  @Get('quotes/:id/agreement')
  getAgreement(
    @Request() request: { user: { id: number } },
    @Param('id', ParseIntPipe) quoteId: number,
  ) {
    return this.service.getAgreement(quoteId, request.user.id);
  }

  @Post('quotes/:id/accept')
  acceptAgreement(
    @Request() request: { user: { id: number } },
    @Param('id', ParseIntPipe) quoteId: number,
    @Body() body: { versionId: number; accepted: boolean },
  ) {
    if (!body.accepted) {
      throw new Error('Debe aceptar el acuerdo.');
    }
    return this.service.acceptAgreement(quoteId, request.user.id, body.versionId);
  }
}

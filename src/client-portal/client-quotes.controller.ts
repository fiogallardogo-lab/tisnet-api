import { AcceptQuoteDto } from '../commercial/commercial.dto';
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiTags,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';
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
    @Request() request: { user: { id: number; email: string } },
    @Param('id') rawId: string,
  ) {
    const quoteId = Number(String(rawId).replace(/^quote-/, ''));
    if (!Number.isFinite(quoteId) || quoteId <= 0) {
      throw new BadRequestException('Validation failed (numeric string is expected)');
    }
    return this.service.getAgreement(quoteId, request.user.id, request.user.email);
  }

  @ApiOperation({
    summary:
      'Aceptar por ID persistido de versión activa; repetición idempotente',
  })
  @ApiResponse({
    status: 201,
    description:
      'data: { accepted: true, acceptedAt: ISODate }; reintentos conservan la misma fecha',
  })
  @ApiResponse({
    status: 400,
    description: 'accepted debe ser true y versionId un entero positivo',
  })
  @ApiResponse({ status: 401, description: 'Sesión requerida' })
  @ApiResponse({ status: 403, description: 'Solo CLIENT' })
  @ApiResponse({
    status: 404,
    description: 'Cotización no accesible o versión inexistente',
  })
  @ApiResponse({ status: 409, description: 'La versión ha sido sustituida' })
  @Post('quotes/:id/accept')
  acceptAgreement(
    @Request() request: { user: { id: number } },
    @Param('id') rawId: string,
    @Body() body: AcceptQuoteDto,
  ) {
    const quoteId = Number(String(rawId).replace(/^quote-/, ''));
    if (!Number.isFinite(quoteId) || quoteId <= 0) {
      throw new BadRequestException('Validation failed (numeric string is expected)');
    }
    return this.service.acceptAgreement(
      quoteId,
      request.user.id,
      body.versionId,
    );
  }
}

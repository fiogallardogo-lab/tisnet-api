import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
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
@ApiTags('Commercial official versions')
@ApiBearerAuth()
@ApiResponse({
  status: 400,
  description: 'Cliente, alcance, importe o cuotas inválidos',
})
@ApiResponse({ status: 401, description: 'Sesión requerida' })
@ApiResponse({ status: 403, description: 'Solo ADMIN y SUPER_ADMIN' })
@ApiResponse({ status: 404, description: 'Cotización inexistente' })
@ApiResponse({
  status: 409,
  description: 'Cotización sin prospecto o con pagos confirmados',
})
@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'SUPER_ADMIN')
export class PaymentsController {
  constructor(private readonly service: PaymentsService) {}
  @ApiOperation({
    summary: 'Crear una nueva versión oficial inmutable con 1 a 5 cuotas',
  })
  @ApiResponse({
    status: 201,
    description:
      'Versión persistida con id, version, scope y schedules; envío PDF intentado después de guardar',
  })
  @Post('quotes/:id/versions')
  officialize(
    @Param('id', ParseIntPipe) id: number,
    @Request() req: { user: { id: number } },
    @Body() dto: OfficialQuoteDto,
  ) {
    return this.service.officialize(id, req.user.id, dto);
  }
  @ApiOperation({ summary: 'Listar historial de versiones con cronograma' })
  @ApiResponse({
    status: 200,
    description: 'Array de versiones en orden descendente',
  })
  @Get('quotes/:id/versions')
  versions(@Param('id', ParseIntPipe) id: number) {
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

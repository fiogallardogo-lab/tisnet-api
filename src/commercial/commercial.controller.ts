import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
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
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CommercialService } from './commercial.service';
import { CommercialMailService } from './commercial-mail.service';
import { ContactDto, EditQuoteDto, ObservationDto } from './commercial.dto';
@ApiTags('Sprint 14 Commercial')
@ApiBearerAuth()
@ApiResponse({ status: 400, description: 'Validación incorrecta' })
@ApiResponse({ status: 401, description: 'Sesión requerida' })
@ApiResponse({ status: 403, description: 'Rol o propietario incorrecto' })
@ApiResponse({ status: 404, description: 'Cotización o versión inexistente' })
@ApiResponse({ status: 409, description: 'Estado o revisión en conflicto' })
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller()
export class CommercialController {
  constructor(
    private readonly service: CommercialService,
    private readonly mail: CommercialMailService,
  ) {}
  @ApiResponse({
    status: 200,
    description:
      'data: cabecera persistida de Quote con updatedAt para la siguiente edición',
  })
  @Patch('admin/quotes/:id')
  @Roles('ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Editar borrador sin alterar versiones oficiales' })
  edit(
    @Param('id', ParseIntPipe) id: number,
    @Request() req: { user: { id: number } },
    @Body() dto: EditQuoteDto,
  ) {
    return this.service.edit(id, req.user.id, dto);
  }
  @ApiResponse({
    status: 200,
    description:
      'data: { items: [{ id, quoteId, versionId, authorId, text, createdAt }] }',
  })
  @Get('admin/quotes/:id/observations')
  @Roles('ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Leer historial inmutable de observaciones' })
  adminObservations(@Param('id', ParseIntPipe) id: number) {
    return this.service.observations(id);
  }
  @ApiResponse({
    status: 201,
    description:
      'data: { delivery: SENT|FAILED, messageId? }; SENT significa aceptación por proveedor, no lectura del destinatario',
  })
  @Post('admin/quotes/:id/send')
  @Roles('ADMIN', 'SUPER_ADMIN')
  @ApiOperation({
    summary: 'Enviar o reintentar cotización con PDF al contacto persistido',
  })
  send(@Param('id', ParseIntPipe) id: number) {
    return this.mail.quote(id);
  }
  @ApiResponse({
    status: 201,
    description:
      'data: { id, quoteId, versionId, authorId, text, createdAt }; observación y auditoría atómicas',
  })
  @Post('client/quotes/:id/observations')
  @Roles('CLIENT')
  @ApiOperation({
    summary: 'Registrar observación auditada sobre la versión activa',
  })
  observe(
    @Param('id', ParseIntPipe) id: number,
    @Request() req: { user: { id: number } },
    @Body() dto: ObservationDto,
  ) {
    return this.service.observe(id, req.user.id, dto);
  }
  @ApiResponse({
    status: 200,
    description:
      'data: { items: [{ id, quoteId, versionId, authorId, text, createdAt }] }; solo cotización propia',
  })
  @Get('client/quotes/:id/observations')
  @Roles('CLIENT')
  observations(
    @Param('id', ParseIntPipe) id: number,
    @Request() req: { user: { id: number } },
  ) {
    return this.service.observations(id, req.user.id);
  }
}
@ApiTags('Public contact')
@Controller('public/contact')
export class ContactController {
  constructor(private readonly service: CommercialService) {}
  @Post()
  @Throttle({ public: { ttl: 60000, limit: 5 } })
  @ApiOperation({
    summary:
      'Persistir consulta y devolver código verificable; no afirma envío por correo',
  })
  @ApiResponse({
    status: 201,
    description:
      'Consulta persistida: data.code, data.status=RECEIVED, data.createdAt',
  })
  @ApiResponse({ status: 400, description: 'Datos inválidos' })
  @ApiResponse({ status: 429, description: 'Demasiadas consultas' })
  contact(@Body() dto: ContactDto) {
    return this.service.contact(dto);
  }
}

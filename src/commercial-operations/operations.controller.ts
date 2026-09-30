import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { approvedLegalContent } from './legal-content';
import { PublicTeamService } from './public-team.service';
import { PublicTeamDto, PublicTeamQuery } from './operations.dto';
import { FinancialService } from './financial.service';
import { RemindersService } from './reminders.service';
type ActorRequest = { user: { id: number; role: string } };
@ApiTags('Sprint 15 public')
@Controller('public')
export class CommercialPublicController {
  constructor(
    private readonly config: ConfigService,
    private readonly team: PublicTeamService,
  ) {}
  @Get('legal/policy')
  @ApiOperation({
    summary: 'Consultar texto plano legal aprobado y versiones vigentes',
  })
  @ApiResponse({
    status: 200,
    description:
      'data: terms{version,text}, privacy{version,text}, approvedAt, contentHash',
  })
  @ApiResponse({
    status: 503,
    description: 'Contenido aprobado no configurado',
  })
  legal() {
    return approvedLegalContent(this.config);
  }
  @Get('team')
  @ApiOperation({ summary: 'Directorio aprobado sin datos privados' })
  @ApiResponse({
    status: 200,
    description:
      'data: items[id,displayName,biography,specialty,photoUrl,role,advisorId,cta],page,hasMore',
  })
  list(@Query() q: PublicTeamQuery) {
    return this.team.list(q.page, q.limit);
  }
}
@ApiTags('Sprint 15 commercial operations')
@ApiBearerAuth()
@ApiResponse({ status: 400, description: 'DTO o recurso público inválido' })
@ApiResponse({ status: 401, description: 'Sesión requerida' })
@ApiResponse({ status: 403, description: 'Rol o propietario no autorizado' })
@ApiResponse({ status: 404, description: 'Recurso inexistente' })
@ApiResponse({ status: 409, description: 'Conflicto de estado' })
@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
export class CommercialOperationsController {
  constructor(
    private readonly team: PublicTeamService,
    private readonly financial: FinancialService,
    private readonly reminders: RemindersService,
  ) {}
  @Put('admin/public-team/:userId')
  @Roles('ADMIN', 'SUPER_ADMIN')
  @ApiOperation({
    summary:
      'Aprobar/retirar presentación pública con consentimiento explícito',
  })
  @ApiResponse({ status: 200, description: 'data: id,approved,updatedAt' })
  publish(
    @Param('userId', ParseIntPipe) id: number,
    @Request() req: ActorRequest,
    @Body() dto: PublicTeamDto,
  ) {
    return this.team.publish(id, req.user.id, dto);
  }
  @Get('quotes/:id/financial-status')
  @Roles('ADMIN', 'SUPER_ADMIN', 'CLIENT')
  @ApiOperation({
    summary:
      'Cierre económico de versión vigente; no concede montos a PO/Developer',
  })
  @ApiResponse({
    status: 200,
    description:
      'data: quoteId,versionId,version,currency,state,complete,totalMinor,paidMinor,outstandingMinor,installments',
  })
  financialStatus(
    @Param('id', ParseIntPipe) id: number,
    @Request() req: ActorRequest,
  ) {
    return this.financial.forQuote(id, req.user);
  }
  @Get('quotes/:id/payment-reminders')
  @Roles('ADMIN', 'SUPER_ADMIN', 'CLIENT')
  @ApiResponse({
    status: 200,
    description:
      'data: recordatorios persistidos, vencimiento Lima y estado de entrega; cliente solo ve sus envíos',
  })
  async listReminders(
    @Param('id', ParseIntPipe) id: number,
    @Request() req: ActorRequest,
  ) {
    await this.financial.forQuote(id, req.user);
    return this.reminders.list(
      id,
      req.user.role === 'CLIENT' ? req.user.id : undefined,
    );
  }
  @Post('admin/payment-reminders/:id/retry')
  @Roles('ADMIN', 'SUPER_ADMIN')
  @ApiResponse({
    status: 201,
    description: 'data: queued=true; worker revalida deuda antes de enviar',
  })
  retry(@Param('id', ParseIntPipe) id: number, @Request() req: ActorRequest) {
    return this.reminders.retry(id, req.user.id);
  }
}

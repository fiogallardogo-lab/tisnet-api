import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Request,
  Response,
  UseGuards,
} from '@nestjs/common';
import type { Response as ExpressResponse } from 'express';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { PLATFORM_ROLES } from '../common/constants/platform-roles';
import { ReportsService } from '../reports/reports.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { ListProjectsQueryDto } from './dto/list-projects-query.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { ProjectsService } from './projects.service';

@ApiTags('Projects')
@ApiBearerAuth()
@Controller('projects')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'SUPER_ADMIN')
export class ProjectsController {
  constructor(
    private readonly projectsService: ProjectsService,
    private readonly reportsService: ReportsService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Crear un proyecto administrativo' })
  @ApiResponse({ status: 201, description: 'Proyecto creado correctamente' })
  @ApiResponse({
    status: 400,
    description: 'Solicitud inválida o reglas de negocio incumplidas',
  })
  @ApiResponse({
    status: 401,
    description: 'Token JWT ausente, inválido o expirado',
  })
  @ApiResponse({ status: 403, description: 'No tienes permisos suficientes' })
  @ApiResponse({ status: 409, description: 'El slug ya está registrado' })
  create(@Body() dto: CreateProjectDto) {
    return this.projectsService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Listar proyectos administrativos' })
  @ApiResponse({
    status: 200,
    description: 'Operación realizada correctamente',
  })
  @ApiResponse({
    status: 401,
    description: 'Token JWT ausente, inválido o expirado',
  })
  @ApiResponse({ status: 403, description: 'No tienes permisos suficientes' })
  findAll(@Query() query: ListProjectsQueryDto) {
    return this.projectsService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Consultar un proyecto administrativo' })
  @ApiResponse({
    status: 200,
    description: 'Operación realizada correctamente',
  })
  @ApiResponse({
    status: 400,
    description: 'Solicitud inválida o reglas de negocio incumplidas',
  })
  @ApiResponse({
    status: 401,
    description: 'Token JWT ausente, inválido o expirado',
  })
  @ApiResponse({ status: 403, description: 'No tienes permisos suficientes' })
  @ApiResponse({ status: 404, description: 'Proyecto no encontrado' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.projectsService.findOne(id);
  }

  @Patch(':id')
  @Roles('ADMIN', 'SUPER_ADMIN', 'DEVELOPER', 'PRODUCT_OWNER')
  @ApiOperation({ summary: 'Editar un proyecto administrativo' })
  @ApiResponse({
    status: 200,
    description: 'Operación realizada correctamente',
  })
  @ApiResponse({
    status: 400,
    description: 'Solicitud inválida o reglas de negocio incumplidas',
  })
  @ApiResponse({
    status: 401,
    description: 'Token JWT ausente, inválido o expirado',
  })
  @ApiResponse({ status: 403, description: 'No tienes permisos suficientes' })
  @ApiResponse({ status: 404, description: 'Proyecto no encontrado' })
  @ApiResponse({ status: 409, description: 'El slug ya está registrado' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateProjectDto,
    @Request() req: { user: { id: number; role: string } },
  ) {
    return this.projectsService.update(id, dto, req.user);
  }

  @Patch(':id/publish')
  @ApiOperation({ summary: 'Publicar un proyecto' })
  @ApiResponse({
    status: 200,
    description: 'Operación realizada correctamente',
  })
  @ApiResponse({
    status: 400,
    description: 'Solicitud inválida o reglas de negocio incumplidas',
  })
  @ApiResponse({
    status: 401,
    description: 'Token JWT ausente, inválido o expirado',
  })
  @ApiResponse({ status: 403, description: 'No tienes permisos suficientes' })
  @ApiResponse({ status: 404, description: 'Proyecto no encontrado' })
  publish(@Param('id', ParseIntPipe) id: number) {
    return this.projectsService.publish(id);
  }

  @Patch(':id/unpublish')
  @ApiOperation({ summary: 'Despublicar un proyecto' })
  @ApiResponse({
    status: 200,
    description: 'Operación realizada correctamente',
  })
  @ApiResponse({
    status: 401,
    description: 'Token JWT ausente, inválido o expirado',
  })
  @ApiResponse({ status: 403, description: 'No tienes permisos suficientes' })
  @ApiResponse({ status: 404, description: 'Proyecto no encontrado' })
  unpublish(@Param('id', ParseIntPipe) id: number) {
    return this.projectsService.unpublish(id);
  }

  @Patch(':id/archive')
  @ApiOperation({ summary: 'Archivar un proyecto sin eliminarlo' })
  @ApiResponse({
    status: 200,
    description: 'Operación realizada correctamente',
  })
  @ApiResponse({
    status: 401,
    description: 'Token JWT ausente, inválido o expirado',
  })
  @ApiResponse({ status: 403, description: 'No tienes permisos suficientes' })
  @ApiResponse({ status: 404, description: 'Proyecto no encontrado' })
  archive(@Param('id', ParseIntPipe) id: number) {
    return this.projectsService.archive(id);
  }

  @Post(':id/close')
  @Roles(PLATFORM_ROLES.ADMIN, PLATFORM_ROLES.SUPER_ADMIN, PLATFORM_ROLES.PRODUCT_OWNER)
  @ApiOperation({ summary: 'Cerrar formalmente un proyecto (S15-B07)' })
  @ApiResponse({ status: 200, description: 'Proyecto cerrado exitosamente' })
  @ApiResponse({ status: 400, description: 'Hitos no aprobados o cuotas de pago impagas' })
  @ApiResponse({ status: 403, description: 'Solo el PO o Admin puede cerrar el proyecto' })
  close(
    @Param('id', ParseIntPipe) id: number,
    @Request() req: { user: { id: number; role: string } },
  ) {
    return this.projectsService.closeProject(id, req.user);
  }

  @Get(':id/report')
  @Roles(
    PLATFORM_ROLES.CLIENT,
    PLATFORM_ROLES.DEVELOPER,
    PLATFORM_ROLES.PRODUCT_OWNER,
    PLATFORM_ROLES.ADMIN,
    PLATFORM_ROLES.SUPER_ADMIN,
  )
  @ApiOperation({ summary: 'Descargar informe oficial de trazabilidad del proyecto (S15-B06)' })
  @ApiResponse({ status: 200, description: 'Informe en JSON o PDF descargable' })
  async getReport(
    @Param('id', ParseIntPipe) id: number,
    @Query('format') format: string | undefined,
    @Request() req: { user: { id: number; role: string } },
    @Response({ passthrough: true }) res: ExpressResponse,
  ) {
    const data = await this.reportsService.getProjectTraceabilityReport(req.user, id);

    if (format === 'pdf' || (!format && req.user.role === 'CLIENT')) {
      const pdfBuffer = await this.reportsService.renderProjectReportPdf(data);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="informe-proyecto-${id}.pdf"`,
      );
      res.send(pdfBuffer);
      return;
    }

    return {
      success: true,
      message: 'Informe de trazabilidad generado exitosamente',
      data,
    };
  }
}


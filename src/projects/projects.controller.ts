import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
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
  constructor(private readonly projectsService: ProjectsService) {}

  @Post()
  @ApiOperation({ summary: 'Crear un proyecto administrativo' })
  @ApiResponse({ status: 201, description: 'Proyecto creado correctamente' })
  @ApiResponse({ status: 400, description: 'Solicitud inválida o reglas de negocio incumplidas' })
  @ApiResponse({ status: 401, description: 'Token JWT ausente, inválido o expirado' })
  @ApiResponse({ status: 403, description: 'No tienes permisos suficientes' })
  @ApiResponse({ status: 409, description: 'El slug ya está registrado' })
  create(@Body() dto: CreateProjectDto) {
    return this.projectsService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Listar proyectos administrativos' })
  @ApiResponse({ status: 200, description: 'Operación realizada correctamente' })
  @ApiResponse({ status: 401, description: 'Token JWT ausente, inválido o expirado' })
  @ApiResponse({ status: 403, description: 'No tienes permisos suficientes' })
  findAll(@Query() query: ListProjectsQueryDto) {
    return this.projectsService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Consultar un proyecto administrativo' })
  @ApiResponse({ status: 200, description: 'Operación realizada correctamente' })
  @ApiResponse({ status: 400, description: 'Solicitud inválida o reglas de negocio incumplidas' })
  @ApiResponse({ status: 401, description: 'Token JWT ausente, inválido o expirado' })
  @ApiResponse({ status: 403, description: 'No tienes permisos suficientes' })
  @ApiResponse({ status: 404, description: 'Proyecto no encontrado' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.projectsService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Editar un proyecto administrativo' })
  @ApiResponse({ status: 200, description: 'Operación realizada correctamente' })
  @ApiResponse({ status: 400, description: 'Solicitud inválida o reglas de negocio incumplidas' })
  @ApiResponse({ status: 401, description: 'Token JWT ausente, inválido o expirado' })
  @ApiResponse({ status: 403, description: 'No tienes permisos suficientes' })
  @ApiResponse({ status: 404, description: 'Proyecto no encontrado' })
  @ApiResponse({ status: 409, description: 'El slug ya está registrado' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateProjectDto,
  ) {
    return this.projectsService.update(id, dto);
  }

  @Patch(':id/publish')
  @ApiOperation({ summary: 'Publicar un proyecto' })
  @ApiResponse({ status: 200, description: 'Operación realizada correctamente' })
  @ApiResponse({ status: 400, description: 'Solicitud inválida o reglas de negocio incumplidas' })
  @ApiResponse({ status: 401, description: 'Token JWT ausente, inválido o expirado' })
  @ApiResponse({ status: 403, description: 'No tienes permisos suficientes' })
  @ApiResponse({ status: 404, description: 'Proyecto no encontrado' })
  publish(@Param('id', ParseIntPipe) id: number) {
    return this.projectsService.publish(id);
  }

  @Patch(':id/unpublish')
  @ApiOperation({ summary: 'Despublicar un proyecto' })
  @ApiResponse({ status: 200, description: 'Operación realizada correctamente' })
  @ApiResponse({ status: 401, description: 'Token JWT ausente, inválido o expirado' })
  @ApiResponse({ status: 403, description: 'No tienes permisos suficientes' })
  @ApiResponse({ status: 404, description: 'Proyecto no encontrado' })
  unpublish(@Param('id', ParseIntPipe) id: number) {
    return this.projectsService.unpublish(id);
  }

  @Patch(':id/archive')
  @ApiOperation({ summary: 'Archivar un proyecto sin eliminarlo' })
  @ApiResponse({ status: 200, description: 'Operación realizada correctamente' })
  @ApiResponse({ status: 401, description: 'Token JWT ausente, inválido o expirado' })
  @ApiResponse({ status: 403, description: 'No tienes permisos suficientes' })
  @ApiResponse({ status: 404, description: 'Proyecto no encontrado' })
  archive(@Param('id', ParseIntPipe) id: number) {
    return this.projectsService.archive(id);
  }
}

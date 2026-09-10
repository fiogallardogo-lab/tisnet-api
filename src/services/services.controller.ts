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
import { CreateServiceDto } from './dto/create-service.dto';
import { ListServicesQueryDto } from './dto/list-services-query.dto';
import { UpdateServiceDto } from './dto/update-service.dto';
import { ServicesService } from './services.service';

@ApiTags('Services')
@ApiBearerAuth()
@Controller('services')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'SUPER_ADMIN')
export class ServicesController {
  constructor(private readonly servicesService: ServicesService) {}

  @Post()
  @ApiOperation({ summary: 'Crear un servicio administrativo' })
  @ApiResponse({ status: 201, description: 'Servicio creado correctamente' })
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
  create(@Body() dto: CreateServiceDto) {
    return this.servicesService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Listar servicios administrativos' })
  @ApiResponse({
    status: 200,
    description: 'Operación realizada correctamente',
  })
  @ApiResponse({
    status: 400,
    description: 'Solicitud inválida o parámetros incorrectos',
  })
  @ApiResponse({
    status: 401,
    description: 'Token JWT ausente, inválido o expirado',
  })
  @ApiResponse({ status: 403, description: 'No tienes permisos suficientes' })
  findAll(@Query() query: ListServicesQueryDto) {
    return this.servicesService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Consultar un servicio administrativo' })
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
  @ApiResponse({ status: 404, description: 'Servicio no encontrado' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.servicesService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Editar un servicio administrativo' })
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
  @ApiResponse({ status: 404, description: 'Servicio no encontrado' })
  @ApiResponse({ status: 409, description: 'El slug ya está registrado' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateServiceDto,
  ) {
    return this.servicesService.update(id, dto);
  }

  @Patch(':id/activate')
  @ApiOperation({ summary: 'Activar un servicio' })
  @ApiResponse({ status: 200, description: 'Servicio activado correctamente' })
  @ApiResponse({
    status: 400,
    description: 'Solicitud inválida o reglas de negocio incumplidas',
  })
  @ApiResponse({
    status: 401,
    description: 'Token JWT ausente, inválido o expirado',
  })
  @ApiResponse({ status: 403, description: 'No tienes permisos suficientes' })
  @ApiResponse({ status: 404, description: 'Servicio no encontrado' })
  activate(@Param('id', ParseIntPipe) id: number) {
    return this.servicesService.activate(id);
  }

  @Patch(':id/deactivate')
  @ApiOperation({ summary: 'Desactivar un servicio' })
  @ApiResponse({
    status: 200,
    description: 'Servicio desactivado correctamente',
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
  @ApiResponse({ status: 404, description: 'Servicio no encontrado' })
  deactivate(@Param('id', ParseIntPipe) id: number) {
    return this.servicesService.deactivate(id);
  }
}

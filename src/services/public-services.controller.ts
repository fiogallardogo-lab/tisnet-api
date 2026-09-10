import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ListPublicServicesQueryDto } from './dto/list-public-services-query.dto';
import { ServicesService } from './services.service';

@ApiTags('Public Services')
@Controller('public/services')
export class PublicServicesController {
  constructor(private readonly servicesService: ServicesService) {}

  @Get()
  @ApiOperation({ summary: 'Listar servicios activos del catálogo público' })
  @ApiResponse({
    status: 200,
    description: 'Operación realizada correctamente',
  })
  @ApiResponse({
    status: 400,
    description: 'Solicitud inválida o parámetros incorrectos',
  })
  findAll(@Query() query: ListPublicServicesQueryDto) {
    return this.servicesService.findPublic(query);
  }

  @Get(':slug')
  @ApiOperation({ summary: 'Consultar un servicio activo por slug' })
  @ApiResponse({
    status: 200,
    description: 'Operación realizada correctamente',
  })
  @ApiResponse({ status: 404, description: 'Servicio no encontrado' })
  findOne(@Param('slug') slug: string) {
    return this.servicesService.findPublicBySlug(slug);
  }
}

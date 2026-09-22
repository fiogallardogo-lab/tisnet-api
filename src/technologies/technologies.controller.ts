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
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

import { TechnologiesService } from './technologies.service';
import { CreateTechnologyDto } from './dto/create-technology.dto';
import { UpdateTechnologyDto } from './dto/update-technology.dto';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { ActiveFilterQueryDto } from '../common/dto/active-filter-query.dto';
import { CatalogQueryDto } from './dto/catalog-query.dto';

@ApiTags('Technologies')
@ApiBearerAuth()
@Controller('technologies')
@UseGuards(JwtAuthGuard)
export class TechnologiesController {
  constructor(private readonly technologiesService: TechnologiesService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'SUPER_ADMIN')
  create(@Body() createTechnologyDto: CreateTechnologyDto) {
    return this.technologiesService.create(createTechnologyDto);
  }

  @Get()
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'SUPER_ADMIN')
  @ApiQuery({ name: 'isActive', required: false, type: Boolean })
  findAll(@Query() query: ActiveFilterQueryDto) {
    return this.technologiesService.findAll(query.isActive);
  }

  @Get('catalog')
  @ApiOperation({
    summary: 'Catálogo activo para cualquier usuario autenticado',
    description:
      'Devuelve únicamente tecnologías activas. Permite filtrar por nombre mediante search, por categoría mediante categoryId o combinar ambos filtros.',
  })
  @ApiQuery({
    name: 'search',
    required: false,
    type: String,
    description: 'Texto de búsqueda por nombre de tecnología.',
    example: 'react',
  })
  @ApiQuery({
    name: 'categoryId',
    required: false,
    type: Number,
    description: 'Identificador de la categoría tecnológica.',
    example: 1,
  })
  @ApiOkResponse({
    description:
      'Devuelve tecnologías activas ordenadas por nombre e id. Si no existen coincidencias, data es un arreglo vacío.',
    schema: {
      type: 'object',
      properties: {
        success: {
          type: 'boolean',
          example: true,
        },
        message: {
          type: 'string',
        },
        data: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: {
                type: 'integer',
                example: 1,
              },
              name: {
                type: 'string',
                example: 'React',
              },
              icon: {
                type: 'string',
                nullable: true,
                example: 'react.svg',
              },
              categoryId: {
                type: 'integer',
                nullable: true,
                example: 1,
              },
              categoryName: {
                type: 'string',
                nullable: true,
                example: 'Frontend',
              },
              isActive: {
                type: 'boolean',
                enum: [true],
                example: true,
              },
            },
          },
        },
      },
    },
  })
  @ApiBadRequestResponse({
    description:
      'Parámetros de consulta inválidos, como categoryId no entero, menor que 1 o parámetros no soportados.',
  })
  @ApiUnauthorizedResponse({
    description: 'JWT ausente o inválido.',
  })
  catalog(@Query() query: CatalogQueryDto) {
    return this.technologiesService.catalog(query);
  }

  @Get(':id')
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'SUPER_ADMIN')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.technologiesService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'SUPER_ADMIN')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateTechnologyDto: UpdateTechnologyDto,
  ) {
    return this.technologiesService.update(id, updateTechnologyDto);
  }
}

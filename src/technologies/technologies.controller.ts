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
    ApiQuery,
    ApiTags,
    ApiOperation,
    ApiOkResponse,
    ApiBadRequestResponse,
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
            'Admite search por nombre. categoryId está bloqueado: Technology no tiene relación con Category. Enviar categoryId (solo o junto con search) devuelve 400; categoryId/categoryName no se incluyen en la respuesta.',
    })
    @ApiOkResponse({
        description:
            'Envelope success/message/data; data contiene id, name, icon (nullable), isActive=true. Orden name asc, id asc; sin resultados: [].',
        schema: {
            type: 'object',
            properties: {
                success: { type: 'boolean' },
                message: { type: 'string' },
                data: {
                    type: 'array',
                    items: {
                        type: 'object',
                        properties: {
                            id: { type: 'integer' },
                            name: { type: 'string' },
                            icon: { type: 'string', nullable: true },
                            isActive: { type: 'boolean', enum: [true] },
                        },
                    },
                },
            },
        },
    })
    @ApiBadRequestResponse({
        description:
            'search inválido o query no soportada, incluido categoryId.',
    })
    @ApiUnauthorizedResponse({ description: 'JWT ausente o inválido.' })
    catalog(@Query() query: CatalogQueryDto) {
        return this.technologiesService.catalog(query.search);
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

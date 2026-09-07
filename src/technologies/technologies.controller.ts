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
import { ApiBearerAuth, ApiQuery, ApiTags } from '@nestjs/swagger';

import { TechnologiesService } from './technologies.service';
import { CreateTechnologyDto } from './dto/create-technology.dto';
import { UpdateTechnologyDto } from './dto/update-technology.dto';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { ActiveFilterQueryDto } from '../common/dto/active-filter-query.dto';

@ApiTags('Technologies')
@ApiBearerAuth()
@Controller('technologies')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TechnologiesController {
    constructor(private readonly technologiesService: TechnologiesService) { }

    @Post()
    @Roles('ADMIN', 'SUPER_ADMIN')
    create(@Body() createTechnologyDto: CreateTechnologyDto) {
        return this.technologiesService.create(createTechnologyDto);
    }

    @Get()
    @Roles('ADMIN', 'SUPER_ADMIN')
    @ApiQuery({ name: 'isActive', required: false, type: Boolean })
    findAll(@Query() query: ActiveFilterQueryDto) {
        return this.technologiesService.findAll(query.isActive);
    }

    @Get(':id')
    @Roles('ADMIN', 'SUPER_ADMIN')
    findOne(@Param('id', ParseIntPipe) id: number) {
        return this.technologiesService.findOne(id);
    }

    @Patch(':id')
    @Roles('ADMIN', 'SUPER_ADMIN')
    update(
        @Param('id', ParseIntPipe) id: number,
        @Body() updateTechnologyDto: UpdateTechnologyDto,
    ) {
        return this.technologiesService.update(id, updateTechnologyDto);
    }
}

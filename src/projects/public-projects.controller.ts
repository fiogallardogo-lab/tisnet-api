import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ListPublicProjectsQueryDto } from './dto/list-public-projects-query.dto';
import { ProjectsService } from './projects.service';

@ApiTags('Public Projects')
@Controller('public/projects')
export class PublicProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Get()
  @ApiOperation({ summary: 'Listar proyectos publicados del portafolio' })
  findAll(@Query() query: ListPublicProjectsQueryDto) {
    return this.projectsService.findPublic(query);
  }

  @Get(':slug')
  @ApiOperation({ summary: 'Consultar un proyecto publicado por slug' })
  @ApiResponse({ status: 404, description: 'Proyecto público no encontrado' })
  findOne(@Param('slug') slug: string) {
    return this.projectsService.findPublicBySlug(slug);
  }
}

import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ProspectsService } from './prospects.service';

@ApiTags('Public Advisors')
@Controller('public/advisors')
export class PublicAdvisorsController {
  constructor(private readonly prospectsService: ProspectsService) {}

  @Get()
  @ApiOperation({ summary: 'Listar asesores públicos activos' })
  findAll() {
    return this.prospectsService.findPublicAdvisors();
  }
}

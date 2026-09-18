import {
  Body,
  Controller,
  Param,
  ParseIntPipe,
  Patch,
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
import { PLATFORM_ROLES } from '../common/constants/platform-roles';
import { SetAdvisorVisibilityDto } from './dto/set-advisor-visibility.dto';
import { ProspectsService } from './prospects.service';

@ApiTags('Advisors')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(PLATFORM_ROLES.ADMIN, PLATFORM_ROLES.SUPER_ADMIN)
@Controller('advisors')
export class AdvisorsAdminController {
  constructor(private readonly prospectsService: ProspectsService) {}

  @Patch(':profileId/public-visibility')
  @ApiOperation({ summary: 'Publicar u ocultar un perfil de asesor' })
  @ApiResponse({ status: 200, description: 'Visibilidad actualizada' })
  @ApiResponse({ status: 404, description: 'Perfil de asesor no encontrado' })
  @ApiResponse({ status: 409, description: 'El usuario del perfil está inactivo' })
  setVisibility(
    @Param('profileId', ParseIntPipe) profileId: number,
    @Body() dto: SetAdvisorVisibilityDto,
  ) {
    return this.prospectsService.setAdvisorVisibility(
      profileId,
      dto.isPublicAdvisor,
    );
  }
}

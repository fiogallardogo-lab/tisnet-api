import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { KickoffService } from './kickoff.service';
import { KickoffDto, ProjectTeamDto } from './kickoff.dto';
type ActorRequest = { user: { id: number; role: string } };
@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
export class KickoffController {
  constructor(private readonly service: KickoffService) {}
  @Post('kickoff') @Roles('ADMIN', 'SUPER_ADMIN') create(
    @Request() r: ActorRequest,
    @Body() dto: KickoffDto,
  ) {
    return this.service.create(r.user.id, dto);
  }
  @Get('projects/:id/operations')
  @Roles('ADMIN', 'SUPER_ADMIN', 'CLIENT', 'DEVELOPER', 'PRODUCT_OWNER')
  detail(@Param('id', ParseIntPipe) id: number, @Request() r: ActorRequest) {
    return this.service.detail(id, r.user);
  }
  @Get('projects/:id/members')
  @Roles('ADMIN', 'SUPER_ADMIN', 'CLIENT', 'DEVELOPER', 'PRODUCT_OWNER')
  async members(
    @Param('id', ParseIntPipe) id: number,
    @Request() r: ActorRequest,
  ) {
    return (await this.service.detail(id, r.user)).members;
  }
  @Patch('projects/:id/members') @Roles('ADMIN', 'SUPER_ADMIN') setTeam(
    @Param('id', ParseIntPipe) id: number,
    @Request() r: ActorRequest,
    @Body() dto: ProjectTeamDto,
  ) {
    return this.service.setTeam(id, r.user, dto);
  }
}

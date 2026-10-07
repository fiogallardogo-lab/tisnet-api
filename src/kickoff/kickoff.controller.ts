import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Put,
  Request,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { KickoffService } from './kickoff.service';
import { KickoffDto, ProjectTeamDto } from './kickoff.dto';
import {
  ScheduleKickoffDto,
  AddMemberDto,
  AssignProductOwnerDto,
} from './kickoff-sprint14.dto';
import { ProjectEnablementService } from '../projects/project-enablement.service';

type ActorRequest = { user: { id: number; role: string } };

@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
export class KickoffController {
  constructor(
    private readonly service: KickoffService,
    private readonly enablement: ProjectEnablementService,
  ) {}

  /**
   * Legacy all-in-one kickoff (creates project + kickoff + team in one call).
   * Kept for backward compat with existing tests. New Sprint 14 flow uses
   * the separated endpoints below.
   */
  @Post('kickoff')
  @Roles('ADMIN', 'SUPER_ADMIN')
  create(@Request() r: ActorRequest, @Body() dto: KickoffDto) {
    return this.service.create(r.user.id, dto);
  }

  // ─── Project Operations ──────────────────────────────────────────────────────

  @Get('workspace/projects')
  @Roles('DEVELOPER', 'PRODUCT_OWNER')
  assignedProjects(@Request() r: ActorRequest) {
    return this.service.listAssignedProjects(r.user);
  }

  @Get('projects/:id/operations')
  @Roles('ADMIN', 'SUPER_ADMIN', 'CLIENT', 'DEVELOPER', 'PRODUCT_OWNER')
  detail(@Param('id', ParseIntPipe) id: number, @Request() r: ActorRequest) {
    return this.service.getOperations(id, r.user);
  }

  // ─── Kickoff scheduling ──────────────────────────────────────────────────────

  /**
   * S14-B04: CLIENT/ADMIN/PO can request or update the kickoff date for a project.
   * Uses the validated ScheduleKickoffDto.
   */
  @Post('projects/:id/kickoff')
  @Roles('ADMIN', 'SUPER_ADMIN', 'PRODUCT_OWNER', 'CLIENT')
  scheduleKickoff(
    @Param('id', ParseIntPipe) id: number,
    @Request() r: ActorRequest,
    @Body() dto: ScheduleKickoffDto,
  ) {
    return this.service.scheduleKickoff(id, r.user, dto);
  }

  @Patch('projects/:id/kickoff')
  @Roles('ADMIN', 'SUPER_ADMIN', 'PRODUCT_OWNER', 'CLIENT')
  updateKickoff(
    @Param('id', ParseIntPipe) id: number,
    @Request() r: ActorRequest,
    @Body() dto: ScheduleKickoffDto,
  ) {
    return this.service.scheduleKickoff(id, r.user, dto);
  }

  // ─── Team management ────────────────────────────────────────────────────────

  @Get('projects/:id/members')
  @Roles('ADMIN', 'SUPER_ADMIN', 'CLIENT', 'DEVELOPER', 'PRODUCT_OWNER')
  async members(
    @Param('id', ParseIntPipe) id: number,
    @Request() r: ActorRequest,
  ) {
    return (await this.service.detail(id, r.user)).members;
  }

  /**
   * S14-B06/B07: Add a single member with validated AddMemberDto.
   * PRODUCT_OWNER can only add to the project they are assigned to.
   */
  @Post('projects/:id/members')
  @Roles('PRODUCT_OWNER')
  addMember(
    @Param('id', ParseIntPipe) id: number,
    @Request() r: ActorRequest,
    @Body() dto: AddMemberDto,
  ) {
    return this.service.addMember(id, r.user, dto);
  }

  /**
   * Bulk replace team: the assigned Product Owner replaces all non-CLIENT members atomically.
   */
  @Patch('projects/:id/members')
  @Roles('PRODUCT_OWNER')
  setTeam(
    @Param('id', ParseIntPipe) id: number,
    @Request() r: ActorRequest,
    @Body() dto: ProjectTeamDto,
  ) {
    return this.service.setTeam(id, r.user, dto);
  }

  /**
   * S14-B05: Admin assigns exactly one active PRODUCT_OWNER to a project.
   * Creates a PO membership and emits PO_ASSIGNED audit.
   */
  @Put('projects/:id/product-owner')
  @Roles('ADMIN', 'SUPER_ADMIN')
  assignProductOwner(
    @Param('id', ParseIntPipe) id: number,
    @Request() r: ActorRequest,
    @Body() dto: AssignProductOwnerDto,
  ) {
    return this.enablement.assignProductOwner(id, dto.userId, r.user.id);
  }
}

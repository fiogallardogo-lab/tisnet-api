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
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsBoolean, IsDateString, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { ClientPortalService } from './client-portal.service';
import { KickoffService } from '../kickoff/kickoff.service';
import { ScheduleKickoffDto } from '../kickoff/kickoff-sprint14.dto';

export class RequestClientMeetingDto {
  @IsInt() @Min(1) advisorId!: number;
  @IsDateString() scheduledAt!: string;
  @IsOptional() @IsDateString() endsAt?: string;
  @IsOptional() @IsString() @MaxLength(1000) notes?: string;
  @IsOptional() @IsBoolean() notifyWhatsapp?: boolean;
  @IsOptional() @IsString() @MaxLength(30) phone?: string;
}

@ApiTags('Client portal')
@ApiBearerAuth()
@Controller('client')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('CLIENT')
export class ClientPortalController {
  constructor(
    private readonly portal: ClientPortalService,
    private readonly kickoffService: KickoffService,
  ) {}

  @Get('overview')
  overview(@Request() request: { user: { id: number; email: string } }) {
    return this.portal.overview(request.user);
  }

  @Post('meetings')
  requestMeeting(
    @Request() request: { user: { id: number; email: string } },
    @Body() body: RequestClientMeetingDto
  ) {
    return this.portal.requestMeeting(request.user, body);
  }

  @Patch('meetings/:id/cancel')
  cancelMeeting(
    @Request() request: { user: { id: number } },
    @Param('id', ParseIntPipe) id: number
  ) {
    return this.portal.cancelMeeting(request.user.id, id);
  }

  /**
   * S14-B04: CLIENT views kickoff status for their project.
   */
  @Get('projects/:id/kickoff')
  getKickoff(
    @Param('id', ParseIntPipe) id: number,
    @Request() r: { user: { id: number; role: string } },
  ) {
    return this.kickoffService.getOperations(id, r.user);
  }

  /**
   * S14-B04: CLIENT requests/updates a kickoff date for their project.
   */
  @Post('projects/:id/kickoff')
  scheduleKickoff(
    @Param('id', ParseIntPipe) id: number,
    @Request() r: { user: { id: number; role: string } },
    @Body() dto: ScheduleKickoffDto,
  ) {
    return this.kickoffService.scheduleKickoff(id, r.user, dto);
  }
}

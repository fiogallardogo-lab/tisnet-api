import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Put,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import {
  AvailabilityQuery,
  BookMeetingDto,
  MeetingListQuery,
  UpdateMeetingStatusDto,
  RescheduleMeetingDto,
  ReplaceAdvisorAvailabilityDto,
  NotifyMeetingLinkDto,
} from './meeting-persistence.dto';
import { MeetingPersistenceService } from './meeting-persistence.service';
@Controller('public')
export class CommercialMeetingsPublicController {
  constructor(private readonly service: MeetingPersistenceService) {}
  @Get('advisors/:id/availability') availability(
    @Param('id', ParseIntPipe) id: number,
    @Query() query: AvailabilityQuery,
  ) {
    return this.service.availability(id, query);
  }
  @Post('meetings') book(@Body() dto: BookMeetingDto) {
    return this.service.book(dto);
  }
}
@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
export class CommercialMeetingsController {
  constructor(private readonly service: MeetingPersistenceService) {}
  @Get('meetings/my/availability')
  @Roles('ADMIN', 'SUPER_ADMIN')
  ownAvailability(@Request() req: { user: { id: number; role: string } }) {
    return this.service.ownAvailability(req.user.id);
  }
  @Put('meetings/my/availability')
  @Roles('ADMIN', 'SUPER_ADMIN')
  replaceOwnAvailability(
    @Body() dto: ReplaceAdvisorAvailabilityDto,
    @Request() req: { user: { id: number; role: string } },
  ) {
    return this.service.replaceOwnAvailability(req.user.id, dto.slots);
  }
  @Patch('meetings/:id/status')
  @Roles('ADMIN', 'SUPER_ADMIN')
  updateStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateMeetingStatusDto,
    @Request() req: { user: { id: number; role: string } },
  ) {
    return this.service.manageMeeting(id, req.user, { status: dto.status });
  }
  @Patch('meetings/:id/reschedule')
  @Roles('ADMIN', 'SUPER_ADMIN')
  reschedule(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: RescheduleMeetingDto,
    @Request() req: { user: { id: number; role: string } },
  ) {
    return this.service.manageMeeting(id, req.user, dto);
  }
  @Post('meetings/:id/notify-link')
  @Roles('ADMIN', 'SUPER_ADMIN')
  notifyLink(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: NotifyMeetingLinkDto,
    @Request() req: { user: { id: number; role: string } },
  ) {
    return this.service.notifyMeetingLink(id, req.user, dto?.message);
  }
  @Get('meetings/my') @Roles('CLIENT', 'ADMIN', 'SUPER_ADMIN') own(
    @Query() query: MeetingListQuery,
    @Request() req: { user: { id: number; email: string; role: string } },
  ) {
    return this.service.list(query, req.user);
  }
  @Get('admin/meetings') @Roles('ADMIN', 'SUPER_ADMIN') all(
    @Query() query: MeetingListQuery,
  ) {
    return this.service.list(query);
  }
}

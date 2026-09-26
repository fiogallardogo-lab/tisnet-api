import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
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

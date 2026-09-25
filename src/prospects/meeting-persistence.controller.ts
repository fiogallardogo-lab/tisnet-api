import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
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

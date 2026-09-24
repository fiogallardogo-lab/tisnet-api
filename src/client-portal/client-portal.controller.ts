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
import { IsDateString, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { ClientPortalService } from './client-portal.service';

export class RequestClientMeetingDto {
  @IsInt() @Min(1) advisorId!: number;
  @IsDateString() scheduledAt!: string;
  @IsOptional() @IsString() @MaxLength(1000) notes?: string;
}

@ApiTags('Client portal')
@ApiBearerAuth()
@Controller('client')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('CLIENT')
export class ClientPortalController {
  constructor(private readonly portal: ClientPortalService) {}

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
}

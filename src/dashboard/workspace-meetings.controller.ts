import { ApiWorkErrors } from '../work/work-errors';
import {
  BadRequestException,
  Controller,
  Get,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiProperty, ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../prisma/prisma.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { WorkActor } from '../work/work.service';
import { WorkspaceMeetingsQuery } from './workspace-meetings.dto';
import { ApiWorkResponse } from '../work/work-swagger';
import { PageDto } from '../work/work-response.dto';
import { DashboardMeetingDto } from './dashboard.dto';
class MeetingsPageDto extends PageDto {
  @ApiProperty({ type: [DashboardMeetingDto] }) items!: DashboardMeetingDto[];
}
@ApiWorkErrors()
@ApiTags('Workspace meetings')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('DEVELOPER', 'PRODUCT_OWNER')
@Controller('workspace')
export class WorkspaceMeetingsController {
  constructor(private readonly prisma: PrismaService) {}
  @Get('meetings')
  @ApiWorkResponse(MeetingsPageDto)
  async meetings(
    @Request() r: { user: WorkActor },
    @Query() q: WorkspaceMeetingsQuery,
  ) {
    if (q.from && q.to && new Date(q.from) > new Date(q.to))
      throw new BadRequestException('Rango inválido');
    const where = {
      kickoff: {
        project: {
          members: {
            some: {
              userId: r.user.id,
              isActive: true,
              memberRole: r.user.role as 'DEVELOPER' | 'PRODUCT_OWNER',
            },
          },
        },
      },
      ...(q.from || q.to
        ? {
            scheduledAt: {
              gte: q.from ? new Date(q.from) : undefined,
              lte: q.to ? new Date(q.to) : undefined,
            },
          }
        : {}),
    };
    const [items, totalItems] = await this.prisma.$transaction([
      this.prisma.meeting.findMany({
        where,
        select: { id: true, status: true, scheduledAt: true, timezone: true },
        orderBy: [{ scheduledAt: 'asc' }, { id: 'asc' }],
        skip: (q.page - 1) * q.limit,
        take: q.limit,
      }),
      this.prisma.meeting.count({ where }),
    ]);
    return {
      items,
      page: q.page,
      limit: q.limit,
      totalItems,
      totalPages: Math.ceil(totalItems / q.limit),
    };
  }
}

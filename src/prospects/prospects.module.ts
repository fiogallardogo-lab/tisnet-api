import { SchedulingModule } from '../scheduling/scheduling.module';
import { MeetingPersistenceService } from './meeting-persistence.service';
import {
  CommercialMeetingsController,
  CommercialMeetingsPublicController,
} from './meeting-persistence.controller';
import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { PrismaModule } from '../prisma/prisma.module';
import { ProspectsController } from './prospects.controller';
import { ProspectsService } from './prospects.service';
import { PublicAdvisorsController } from './public-advisors.controller';
import { AdvisorsAdminController } from './advisors-admin.controller';

@Module({
  imports: [
    SchedulingModule,
    PrismaModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
  ],
  controllers: [
    ProspectsController,
    CommercialMeetingsController,
    CommercialMeetingsPublicController,
    PublicAdvisorsController,
    AdvisorsAdminController,
  ],
  providers: [
    MeetingPersistenceService,
    ProspectsService,
    JwtAuthGuard,
    RolesGuard,
  ],
  exports: [ProspectsService, MeetingPersistenceService],
})
export class ProspectsModule {}

import { WorkspaceMeetingsController } from './workspace-meetings.controller';
import { PassportModule } from '@nestjs/passport';
import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
@Module({
  imports: [PassportModule.register({ defaultStrategy: 'jwt' }), PrismaModule],
  controllers: [DashboardController, WorkspaceMeetingsController],
  providers: [DashboardService],
})
export class DashboardModule {}

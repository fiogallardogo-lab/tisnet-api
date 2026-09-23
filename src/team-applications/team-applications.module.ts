import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { TeamApplicationsController } from './team-applications.controller.js';
import { TeamApplicationsService } from './team-applications.service.js';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    NotificationsModule,
  ],
  controllers: [TeamApplicationsController],
  providers: [TeamApplicationsService, JwtAuthGuard, RolesGuard],
  exports: [TeamApplicationsService],
})
export class TeamApplicationsModule {}

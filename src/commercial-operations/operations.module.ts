import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PassportModule } from '@nestjs/passport';
import { PrismaModule } from '../prisma/prisma.module';
import { NotificationsModule } from '../notifications/notifications.module';
import {
  CommercialPublicController,
  CommercialOperationsController,
} from './operations.controller';
import { FinancialService } from './financial.service';
import { RemindersService } from './reminders.service';
import { PublicTeamService } from './public-team.service';
@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    NotificationsModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
  ],
  controllers: [CommercialPublicController, CommercialOperationsController],
  providers: [FinancialService, RemindersService, PublicTeamService],
  exports: [FinancialService, RemindersService],
})
export class CommercialOperationsModule {}

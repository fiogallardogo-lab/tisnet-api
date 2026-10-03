import { PassportModule } from '@nestjs/passport';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PrismaModule } from '../prisma/prisma.module';
import { DocumentsModule } from '../documents/documents.module';
import { NotificationsModule } from '../notifications/notifications.module';
import {
  CommercialController,
  ContactController,
} from './commercial.controller';
import { CommercialService } from './commercial.service';
import { CommercialMailService } from './commercial-mail.service';
import { ActivationService } from './activation.service';
import { ActivationController } from './activation.controller';
import { ClientActivationRequestsController } from './client-activation-requests.controller';
import { ClientActivationRequestsService } from './client-activation-requests.service';
@Module({
  imports: [
    ConfigModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    PrismaModule,
    DocumentsModule,
    NotificationsModule,
    JwtModule.register({}),
  ],
  controllers: [
    CommercialController,
    ContactController,
    ActivationController,
    ClientActivationRequestsController,
  ],
  providers: [
    CommercialService,
    CommercialMailService,
    ActivationService,
    ClientActivationRequestsService,
  ],
  exports: [CommercialMailService],
})
export class CommercialModule {}

import { PrismaModule } from '../../prisma/prisma.module';
import { CalendlyPersistenceService } from './calendly-persistence.service';
import { Module } from '@nestjs/common';
import { NotificationsModule } from '../../notifications/notifications.module';
import { CalendlySignatureService } from './calendly-signature.service';
import { CalendlyWebhookController } from './calendly-webhook.controller';
import { CalendlyWebhookService } from './calendly-webhook.service';

/**
 * Self-contained Calendly integration module.
 * Register in AppModule when CALENDLY_WEBHOOK_SECRET is available.
 * B instructs A to add CalendlyWebhookModule to AppModule.imports.
 */
@Module({
  imports: [NotificationsModule, PrismaModule],
  controllers: [CalendlyWebhookController],
  providers: [
    CalendlyPersistenceService,
    CalendlySignatureService,
    CalendlyWebhookService,
  ],
})
export class CalendlyWebhookModule {}

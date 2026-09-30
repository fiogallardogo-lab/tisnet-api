import { Module } from '@nestjs/common';
import { CalendlyWebhookModule } from './calendly/calendly-webhook.module';
import { FakeSchedulingProvider } from './fake-scheduling.provider';
import { SCHEDULING_PROVIDER } from './scheduling-provider.interface';

@Module({
  imports: [CalendlyWebhookModule],
  providers: [
    {
      provide: SCHEDULING_PROVIDER,
      useClass: FakeSchedulingProvider,
    },
  ],
  exports: [SCHEDULING_PROVIDER, CalendlyWebhookModule],
})
export class SchedulingModule {}
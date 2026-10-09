import { Module } from '@nestjs/common';
import { CalendlyWebhookModule } from './calendly/calendly-webhook.module';
import { FakeSchedulingProvider } from './fake-scheduling.provider';
import { SCHEDULING_PROVIDER } from './scheduling-provider.interface';
import { GoogleCalendarModule } from './google/google-calendar.module';
import { GoogleCalendarProvider } from './google/google-calendar.provider';

@Module({
  imports: [CalendlyWebhookModule, GoogleCalendarModule],
  providers: [
    FakeSchedulingProvider,
    {
      provide: SCHEDULING_PROVIDER,
      inject: [FakeSchedulingProvider, GoogleCalendarProvider],
      useFactory: (
        fakeProvider: FakeSchedulingProvider,
        googleProvider: GoogleCalendarProvider,
      ) => {
        const driver = process.env.SCHEDULING_DRIVER;
        if (
          driver === 'google' &&
          process.env.GOOGLE_CLIENT_ID &&
          process.env.GOOGLE_CLIENT_SECRET
        ) {
          return googleProvider;
        }
        return fakeProvider;
      },
    },
  ],
  exports: [SCHEDULING_PROVIDER, CalendlyWebhookModule, GoogleCalendarModule],
})
export class SchedulingModule {}
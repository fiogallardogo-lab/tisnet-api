import { Module } from '@nestjs/common';
import { GoogleCalendarService } from './google-calendar.service';
import { GoogleCalendarProvider } from './google-calendar.provider';
import { GoogleCalendarController } from './google-calendar.controller';

@Module({
  controllers: [GoogleCalendarController],
  providers: [GoogleCalendarService, GoogleCalendarProvider],
  exports: [GoogleCalendarService, GoogleCalendarProvider],
})
export class GoogleCalendarModule {}

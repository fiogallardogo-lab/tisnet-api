import { Injectable } from '@nestjs/common';
import {
  CreateMeetingInput,
  GetAvailabilityInput,
  ScheduledMeetingResult,
  SchedulingProvider,
  TimeSlot,
} from '../scheduling-provider.interface';
import { GoogleCalendarService } from './google-calendar.service';

@Injectable()
export class GoogleCalendarProvider implements SchedulingProvider {
  constructor(private readonly service: GoogleCalendarService) {}

  async getAvailability(input: GetAvailabilityInput): Promise<TimeSlot[]> {
    return this.service.getAvailability(input);
  }

  async createMeeting(
    input: CreateMeetingInput,
  ): Promise<ScheduledMeetingResult> {
    return this.service.createMeeting(input);
  }
}

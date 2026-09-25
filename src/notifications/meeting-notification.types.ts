import type { SendNotificationInput } from './notification-provider.interface';

export type MeetingNotificationType =
  | 'MEETING_CONFIRMED'
  | 'MEETING_CANCELLED'
  | 'MEETING_RESCHEDULED';

interface BaseMeetingNotification {
  recipient: string;
  attendeeName: string;
  advisorName: string;
  startIso: string;
  endIso: string;
  meetingUrl: string;
  quoteCode?: string;
}

export interface MeetingConfirmedNotification extends BaseMeetingNotification {
  type: 'MEETING_CONFIRMED';
}

export interface MeetingCancelledNotification extends BaseMeetingNotification {
  type: 'MEETING_CANCELLED';
  cancellationReason?: string;
}

export interface MeetingRescheduledNotification extends BaseMeetingNotification {
  type: 'MEETING_RESCHEDULED';
  previousStartIso: string;
}

export type MeetingNotification =
  | MeetingConfirmedNotification
  | MeetingCancelledNotification
  | MeetingRescheduledNotification;

export type MeetingNotificationMessage = SendNotificationInput & {
  text: string;
  html: string;
  metadata: {
    type: MeetingNotificationType;
    meetingUrl: string;
  };
};
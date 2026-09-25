// Calendly webhook event payload types (v2 API).
// Reference: https://developer.calendly.com/api-docs/ZG9jOjM2MzE2MDM4-webhook-data

export type CalendlyEventType =
  | 'invitee.created'      // booking confirmed
  | 'invitee.canceled'     // booking cancelled
  | 'invitee_no_show.created'; // attendee no-show

export interface CalendlyInvitee {
  uri: string;
  email: string;
  name: string;
  status: 'active' | 'canceled';
  cancel_url?: string;
  reschedule_url?: string;
  /** ISO-8601 when the booking was created/cancelled. */
  created_at: string;
  updated_at: string;
  cancellation?: {
    canceled_by: string;
    reason?: string;
    canceler_type: 'invitee' | 'host';
  };
}

export interface CalendlyScheduledEvent {
  uri: string;
  name: string;
  status: 'active' | 'canceled';
  /** ISO-8601 start time of the scheduled event. */
  start_time: string;
  /** ISO-8601 end time of the scheduled event. */
  end_time: string;
  location?: {
    type: string;
    join_url?: string;
    location?: string;
  };
  event_guests?: Array<{ email: string; created_at: string; updated_at: string }>;
}

export interface CalendlyWebhookPayload {
  event: CalendlyEventType;
  /** ISO-8601 timestamp when Calendly generated the event. */
  created_at: string;
  payload: {
    event: string;             // URI of the ScheduledEvent
    event_type: string;        // URI of the EventType
    invitee: CalendlyInvitee;
    scheduled_event: CalendlyScheduledEvent;
    /** Tracking values set on the booking page (e.g. advisorId, quoteCode). */
    tracking?: {
      utm_source?: string;
      utm_medium?: string;
      utm_campaign?: string;
      utm_content?: string;
      utm_term?: string;
      salesforce_uuid?: string;
    };
  };
}

/** Normalized internal representation after validating a Calendly event. */
export interface NormalizedCalendlyEvent {
  type: CalendlyEventType;
  meetingId: string;          // derived from the ScheduledEvent URI
  attendeeEmail: string;
  attendeeName: string;
  startIso: string;
  endIso: string;
  meetingUrl: string;          // join_url from location, or reschedule_url fallback
  cancellationReason?: string;
  /** advisorId extracted from utm_content or utm_campaign tracking param. */
  advisorId?: string;
  quoteCode?: string;          // from utm_term
}
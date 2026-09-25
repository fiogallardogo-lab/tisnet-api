import { Inject, Injectable, Logger } from '@nestjs/common';
import type {
  CalendlyWebhookPayload,
  NormalizedCalendlyEvent,
} from './calendly-webhook.types';
import {
  NOTIFICATION_PROVIDER,
  NotificationProvider,
} from '../../notifications/notification-provider.interface';
import { describeNotificationFailure } from '../../notifications/notification-errors';
import {
  renderMeetingCancelled,
  renderMeetingConfirmed,
  renderMeetingRescheduled,
} from '../../notifications/templates/meeting-notifications';

@Injectable()
export class CalendlyWebhookService {
  private readonly logger = new Logger(CalendlyWebhookService.name);

  constructor(
    @Inject(NOTIFICATION_PROVIDER)
    private readonly notification: NotificationProvider,
  ) {}

  /**
   * Processes a validated Calendly webhook payload.
   * Sends notifications to the attendee; failures are logged without
   * propagating the error (fire-and-forget pattern).
   */
  async process(payload: CalendlyWebhookPayload): Promise<void> {
    const event = this.normalize(payload);
    if (!event) return;

    this.logger.log(
      '[Calendly] Processing event=' + event.type +
      ' meetingId=' + event.meetingId +
      ' attendee=' + event.attendeeEmail,
    );

    await this.sendAttendeeNotification(event);
  }

  // ─── Normalization ───────────────────────────────────────────────────────

  private normalize(payload: CalendlyWebhookPayload): NormalizedCalendlyEvent | null {
    const { event, payload: p } = payload;
    const { invitee, scheduled_event: se } = p;

    if (!invitee?.email || !se?.start_time || !se?.end_time) {
      this.logger.warn('[Calendly] Incomplete payload, skipping');
      return null;
    }

    const meetingId = se.uri.split('/').pop() ?? se.uri;
    const joinUrl =
      se.location?.join_url ??
      invitee.reschedule_url ??
      'https://app.tisnet.pe/meetings/' + meetingId;

    const tracking = p.tracking ?? {};
    return {
      type: event,
      meetingId,
      attendeeEmail: invitee.email,
      attendeeName: invitee.name || invitee.email,
      startIso: se.start_time,
      endIso: se.end_time,
      meetingUrl: joinUrl,
      cancellationReason: invitee.cancellation?.reason,
      advisorId: tracking.utm_content ?? tracking.utm_campaign,
      quoteCode: tracking.utm_term,
    };
  }

  // ─── Notification dispatch ───────────────────────────────────────────────

  private async sendAttendeeNotification(event: NormalizedCalendlyEvent): Promise<void> {
    // Advisor name will come from the advisor profile lookup once A's Meeting
    // model is available. For now we use a safe placeholder.
    const advisorName = 'tu asesor TISNET';

    let message;
    try {
      if (event.type === 'invitee.created') {
        message = renderMeetingConfirmed({
          type: 'MEETING_CONFIRMED',
          recipient: event.attendeeEmail,
          attendeeName: event.attendeeName,
          advisorName,
          startIso: event.startIso,
          endIso: event.endIso,
          meetingUrl: event.meetingUrl,
          quoteCode: event.quoteCode,
        });
      } else if (event.type === 'invitee.canceled') {
        message = renderMeetingCancelled({
          type: 'MEETING_CANCELLED',
          recipient: event.attendeeEmail,
          attendeeName: event.attendeeName,
          advisorName,
          startIso: event.startIso,
          endIso: event.endIso,
          meetingUrl: event.meetingUrl,
          cancellationReason: event.cancellationReason,
        });
      } else {
        // invitee_no_show — log only, no attendee email.
        this.logger.log('[Calendly] No-show registered for meetingId=' + event.meetingId);
        return;
      }
    } catch (renderError) {
      this.logger.warn(
        '[Calendly] Failed to render notification template event=' + event.type +
        ' meetingId=' + event.meetingId,
      );
      return;
    }

    try {
      await this.notification.send(message);
    } catch (error) {
      const failure = describeNotificationFailure(error);
      this.logger.warn(
        '[Calendly] Notification delivery failed event=' + event.type +
        ' meetingId=' + event.meetingId +
        ' code=' + failure.code +
        ' retryable=' + String(failure.retryable),
      );
      // Notification failure never rolls back the webhook processing.
    }
  }
}
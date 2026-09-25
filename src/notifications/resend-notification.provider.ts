import { randomUUID } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';

import type { ResendNotificationConfig } from '../config/notification.validation';
import {
  NotificationDeliveryError,
  NotificationProvider,
  NotificationResult,
  SendNotificationInput,
} from './notification-provider.interface';
import {
  NotificationPermanentError,
  NotificationTimeoutError,
  NotificationTransientError,
} from './notification-errors';

const SEND_TIMEOUT_MS = 10_000;
const PERMANENT_HTTP_CODES = new Set([400, 401, 403, 422]);

@Injectable()
export class ResendNotificationProvider implements NotificationProvider {
  private readonly logger = new Logger(ResendNotificationProvider.name);
  private readonly apiKey: string;
  private readonly mailFrom: string;

  constructor(config: ResendNotificationConfig) {
    this.apiKey = config.resendApiKey;
    this.mailFrom = config.mailFrom;
  }

  async send(input: SendNotificationInput): Promise<NotificationResult> {
    const messageId = randomUUID();
    const attachments = input.attachments?.map((att) => ({
      filename: att.filename,
      content: att.content.toString('base64'),
    }));
    const body = JSON.stringify({
      from: this.mailFrom,
      to: [input.recipient],
      subject: input.subject,
      text: input.text,
      html: input.html,
      attachments,
    });

    let response: Response;
    try {
      const fetchPromise = fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer ' + this.apiKey,
          'Content-Type': 'application/json',
        },
        body,
      });
      response = await Promise.race([
        fetchPromise,
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new NotificationTimeoutError()), SEND_TIMEOUT_MS),
        ),
      ]);
    } catch (error) {
      if (error instanceof NotificationDeliveryError) throw error;
      throw new NotificationTransientError();
    }

    if (!response.ok) {
      if (PERMANENT_HTTP_CODES.has(response.status)) throw new NotificationPermanentError();
      throw new NotificationTransientError();
    }

    this.logger.log('[Resend] Delivered messageId=' + messageId + ' to=' + input.recipient);
    return { messageId, recipient: input.recipient, sentAt: new Date() };
  }
}
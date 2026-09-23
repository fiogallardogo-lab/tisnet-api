import { Injectable } from '@nestjs/common';
import type { ApplicationNotificationAttempt } from './application-notification.types';

import {
  NotificationDeliveryError,
  NotificationProvider,
  NotificationResult,
  SendNotificationInput,
} from './notification-provider.interface';

@Injectable()
export class FakeNotificationProvider implements NotificationProvider {
  readonly sentNotifications: SendNotificationInput[] = [];
  private readonly applicationAttempts: ApplicationNotificationAttempt[] = [];

  private shouldFail = false;
  private failureError: Error | null = null;
  private sequence = 0;

  async send(input: SendNotificationInput): Promise<NotificationResult> {
    const type = input.metadata?.type;
    const isApplication =
      type === 'INTERVIEW_ASSIGNED' || type === 'APPLICATION_REJECTED';
    if (isApplication) {
      if (!input.metadata?.applicationCode?.trim()) {
        throw new NotificationDeliveryError('applicationCode is required');
      }
      this.applicationAttempts.push({
        type,
        recipient: input.recipient,
        applicationCode: input.metadata.applicationCode,
      });
    }
    if (this.shouldFail) {
      throw (
        this.failureError ??
        new NotificationDeliveryError('Simulated notification delivery failure')
      );
    }

    const storedInput: SendNotificationInput = isApplication
      ? {
          recipient: input.recipient,
          subject: 'Application notification (content omitted)',
          metadata: {
            type,
            applicationCode: input.metadata!.applicationCode,
          },
        }
      : {
          ...input,
          attachments: input.attachments?.map((attachment) => ({
            ...attachment,
            content: Buffer.from(attachment.content),
          })),
          metadata: input.metadata ? { ...input.metadata } : undefined,
        };

    this.sentNotifications.push(storedInput);

    this.sequence += 1;

    return {
      messageId: `fake-message-${this.sequence}`,
      recipient: input.recipient,
      sentAt: new Date(),
    };
  }

  getSentNotifications(): ReadonlyArray<SendNotificationInput> {
    return this.sentNotifications;
  }

  getLastNotification(): SendNotificationInput | undefined {
    return this.sentNotifications.at(-1);
  }

  getApplicationAttempts(): ReadonlyArray<ApplicationNotificationAttempt> {
    return this.applicationAttempts.map((attempt) => ({ ...attempt }));
  }

  simulateFailure(shouldFail: boolean, error?: Error): void {
    this.shouldFail = shouldFail;
    this.failureError = shouldFail
      ? (error ??
        new NotificationDeliveryError(
          'Simulated notification delivery failure',
        ))
      : null;
  }

  clear(): void {
    this.sentNotifications.length = 0;
    this.applicationAttempts.length = 0;
    this.shouldFail = false;
    this.failureError = null;
    this.sequence = 0;
  }
}

import { Injectable } from '@nestjs/common';

import {
    NotificationDeliveryError,
    NotificationProvider,
    NotificationResult,
    SendNotificationInput,
} from './notification-provider.interface';

@Injectable()
export class FakeNotificationProvider implements NotificationProvider {
    readonly sentNotifications: SendNotificationInput[] = [];

    private shouldFail = false;
    private failureError: Error | null = null;
    private sequence = 0;

    async send(input: SendNotificationInput): Promise<NotificationResult> {
        if (this.shouldFail) {
            throw (
                this.failureError ??
                new NotificationDeliveryError(
                    'Simulated notification delivery failure',
                )
            );
        }

        const storedInput: SendNotificationInput = {
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
        this.shouldFail = false;
        this.failureError = null;
        this.sequence = 0;
    }
}
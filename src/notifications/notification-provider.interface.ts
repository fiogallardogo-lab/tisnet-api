export const NOTIFICATION_PROVIDER = Symbol('NOTIFICATION_PROVIDER');

export interface NotificationAttachment {
    filename: string;
    mimeType: string;
    content: Buffer;
}

export interface SendNotificationInput {
    recipient: string;
    subject: string;
    text?: string;
    html?: string;
    attachments?: NotificationAttachment[];
    metadata?: Record<string, string>;
}

export interface NotificationResult {
    messageId: string;
    recipient: string;
    sentAt: Date;
}

export interface NotificationProvider {
    send(input: SendNotificationInput): Promise<NotificationResult>;
}

export class NotificationDeliveryError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'NotificationDeliveryError';
    }
}
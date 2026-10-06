export const WHATSAPP_NOTIFICATION_PROVIDER = Symbol(
  'WHATSAPP_NOTIFICATION_PROVIDER',
);

export interface SendWhatsAppInput {
  recipientPhone: string;
  message: string;
  templateName?: string;
  templateParams?: Record<string, string>;
}

export interface WhatsAppNotificationResult {
  messageId: string;
  recipientPhone: string;
  sentAt: Date;
  status: 'SENT' | 'SIMULATED' | 'FAILED';
}

export interface WhatsAppNotificationProvider {
  readonly deliveryMode: 'real' | 'simulated';
  send(input: SendWhatsAppInput): Promise<WhatsAppNotificationResult>;
}

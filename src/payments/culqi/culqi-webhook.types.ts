export type CulqiWebhookEventType =
  | 'charge.creation.succeeded'
  | 'charge.creation.failed'
  | 'order.status.changed'
  | 'refund.creation.succeeded';

export interface CulqiWebhookPayload {
  object: string; // 'event'
  type: CulqiWebhookEventType;
  data: Record<string, any>;
  id?: string;
}

export interface CulqiProcessedEvent {
  eventId?: string;
  eventType: CulqiWebhookEventType;
  chargeId?: string;
  orderId?: string;
  amount?: number;
  currency?: string;
  customerEmail?: string;
  metadata?: Record<string, any>;
  status: 'SUCCEEDED' | 'FAILED' | 'PENDING' | 'IGNORED';
  processedAt: Date;
}

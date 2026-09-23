import { NotificationDeliveryError } from './notification-provider.interface';

export class NotificationTransientError extends NotificationDeliveryError {
  constructor() {
    super('Temporary notification delivery failure');
    this.name = 'NotificationTransientError';
  }
}

export class NotificationPermanentError extends NotificationDeliveryError {
  constructor() {
    super('Permanent notification delivery failure');
    this.name = 'NotificationPermanentError';
  }
}

export class NotificationTimeoutError extends NotificationDeliveryError {
  constructor() {
    super('Notification delivery timed out');
    this.name = 'NotificationTimeoutError';
  }
}

export interface NotificationFailure {
  code:
    | 'NOTIFICATION_TRANSIENT'
    | 'NOTIFICATION_PERMANENT'
    | 'NOTIFICATION_TIMEOUT'
    | 'NOTIFICATION_UNKNOWN';
  /** Classification only, never permission to retry a potentially delivered message. */
  retryable: boolean;
}

/** Safe projection: do not log a provider's raw message, stack, cause or response. */
export function describeNotificationFailure(
  error: unknown,
): NotificationFailure {
  if (error instanceof NotificationTimeoutError) {
    return { code: 'NOTIFICATION_TIMEOUT', retryable: true };
  }
  if (error instanceof NotificationTransientError) {
    return { code: 'NOTIFICATION_TRANSIENT', retryable: true };
  }
  if (error instanceof NotificationPermanentError) {
    return { code: 'NOTIFICATION_PERMANENT', retryable: false };
  }
  // Existing NotificationDeliveryError(message) and unexpected errors remain compatible.
  return { code: 'NOTIFICATION_UNKNOWN', retryable: false };
}

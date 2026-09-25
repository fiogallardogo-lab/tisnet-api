import { registerAs } from '@nestjs/config';
import { validateNotificationConfig } from './notification.validation';
export type { NotificationConfig } from './notification.validation';

export const notificationConfig = registerAs('notification', () =>
  validateNotificationConfig(process.env),
);
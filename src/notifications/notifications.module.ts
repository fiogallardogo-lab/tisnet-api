import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { notificationConfig } from '../config/notification.config';
import type {
  NotificationConfig,
  SmtpNotificationConfig,
  ResendNotificationConfig,
} from '../config/notification.validation';

import { FakeNotificationProvider } from './fake-notification.provider';
import { SmtpNotificationProvider } from './smtp-notification.provider';
import { ResendNotificationProvider } from './resend-notification.provider';
import { NOTIFICATION_PROVIDER } from './notification-provider.interface';

@Module({
  imports: [ConfigModule.forFeature(notificationConfig)],
  providers: [
    FakeNotificationProvider,
    {
      provide: NOTIFICATION_PROVIDER,
      inject: [notificationConfig.KEY, FakeNotificationProvider],
      useFactory: (
        config: NotificationConfig,
        fake: FakeNotificationProvider,
      ) => {
        if (config.provider === 'smtp') {
          return new SmtpNotificationProvider(config as SmtpNotificationConfig);
        }
        if (config.provider === 'resend') {
          return new ResendNotificationProvider(config as ResendNotificationConfig);
        }
        return fake;
      },
    },
  ],
  exports: [NOTIFICATION_PROVIDER, FakeNotificationProvider],
})
export class NotificationsModule {}
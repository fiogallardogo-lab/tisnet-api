import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { notificationConfig } from '../config/notification.config';
import type { NotificationConfig } from '../config/notification.validation';

import { FakeNotificationProvider } from './fake-notification.provider';
import { NOTIFICATION_PROVIDER } from './notification-provider.interface';

@Module({
  imports: [ConfigModule.forFeature(notificationConfig)],
  providers: [
    FakeNotificationProvider,
    {
      provide: NOTIFICATION_PROVIDER,
      inject: [notificationConfig.KEY, FakeNotificationProvider],
      useFactory: (
        _config: NotificationConfig,
        fake: FakeNotificationProvider,
      ) => fake,
    },
  ],
  exports: [NOTIFICATION_PROVIDER, FakeNotificationProvider],
})
export class NotificationsModule {}

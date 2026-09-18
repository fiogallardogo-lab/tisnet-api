import { Module } from '@nestjs/common';

import { FakeNotificationProvider } from './fake-notification.provider';
import { NOTIFICATION_PROVIDER } from './notification-provider.interface';

@Module({
    providers: [
        {
            provide: NOTIFICATION_PROVIDER,
            useClass: FakeNotificationProvider,
        },
    ],
    exports: [NOTIFICATION_PROVIDER],
})
export class NotificationsModule { }
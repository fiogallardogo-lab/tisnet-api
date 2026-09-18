import { Module } from '@nestjs/common';

import { FakeSchedulingProvider } from './fake-scheduling.provider';
import { SCHEDULING_PROVIDER } from './scheduling-provider.interface';

@Module({
    providers: [
        {
            provide: SCHEDULING_PROVIDER,
            useClass: FakeSchedulingProvider,
        },
    ],
    exports: [SCHEDULING_PROVIDER],
})
export class SchedulingModule { }
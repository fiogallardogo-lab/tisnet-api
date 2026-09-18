import { Module } from '@nestjs/common';

import { SchedulingModule } from '../scheduling/scheduling.module';
import { MeetingsService } from './meetings.service';

@Module({
    imports: [
        SchedulingModule,
    ],
    providers: [
        MeetingsService,
    ],
    exports: [
        MeetingsService,
    ],
})
export class MeetingsModule { }
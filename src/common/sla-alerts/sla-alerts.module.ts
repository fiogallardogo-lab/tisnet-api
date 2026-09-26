import { Global, Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { SlaAlertsService } from './sla-alerts.service';
import { SlaJobsService } from './sla-jobs.service';

@Global()
@Module({
  imports: [ScheduleModule.forRoot()],
  providers: [SlaAlertsService, SlaJobsService],
  exports: [SlaAlertsService],
})
export class SlaAlertsModule {}

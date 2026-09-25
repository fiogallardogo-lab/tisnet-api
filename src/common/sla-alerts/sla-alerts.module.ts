import { Global, Module } from '@nestjs/common';
import { SlaAlertsService } from './sla-alerts.service';

@Global()
@Module({
  providers: [SlaAlertsService],
  exports: [SlaAlertsService],
})
export class SlaAlertsModule {}

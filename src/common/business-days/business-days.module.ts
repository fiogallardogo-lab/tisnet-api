import { Global, Module } from '@nestjs/common';
import { BusinessDaysService } from './business-days.service';

@Global()
@Module({
  providers: [BusinessDaysService],
  exports: [BusinessDaysService],
})
export class BusinessDaysModule {}

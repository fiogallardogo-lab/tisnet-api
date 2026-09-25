import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { PrismaModule } from '../prisma/prisma.module';
import { PaymentsModule } from '../payments/payments.module';
import { KickoffService } from './kickoff.service';
import { KickoffController } from './kickoff.controller';
@Module({
  imports: [
    PrismaModule,
    PaymentsModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
  ],
  providers: [KickoffService],
  controllers: [KickoffController],
  exports: [KickoffService],
})
export class KickoffModule {}

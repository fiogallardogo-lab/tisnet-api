import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';

import { PrismaModule } from '../prisma/prisma.module';
import { paymentsConfig, validatePaymentsConfig } from '../config/payments.config';
import type { PaymentsConfig } from '../config/payments.config';

import { PAYMENT_PROVIDER } from './payment-provider.interface';
import { FakePaymentProvider } from './fake-payment.provider';
import { CulqiPaymentProvider } from './culqi/culqi-payment.provider';
import { CulqiWebhookController } from './culqi/culqi-webhook.controller';
import { CulqiWebhookService } from './culqi/culqi-webhook.service';
import { PaymentsService } from './payments.service';
import { PaymentsController } from './payments.controller';

@Module({
  imports: [
    PrismaModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    ConfigModule.forFeature(paymentsConfig),
  ],
  controllers: [PaymentsController, CulqiWebhookController],
  providers: [
    PaymentsService,
    FakePaymentProvider,
    CulqiWebhookService,
    {
      provide: PAYMENT_PROVIDER,
      inject: [ConfigService, FakePaymentProvider],
      useFactory: (
        configService: ConfigService,
        fakeProvider: FakePaymentProvider,
      ) => {
        let config: PaymentsConfig;
        try {
          config =
            configService.get<PaymentsConfig>('payments') ??
            validatePaymentsConfig(process.env);
        } catch {
          config = { driver: 'fake' };
        }

        if (config.driver === 'culqi' && config.secretKey) {
          return new CulqiPaymentProvider({
            secretKey: config.secretKey,
          });
        }

        return fakeProvider;
      },
    },
  ],
  exports: [
    PaymentsService,
    PAYMENT_PROVIDER,
    FakePaymentProvider,
    CulqiWebhookService,
  ],
})
export class PaymentsModule {}

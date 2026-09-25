import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';

import { paymentsConfig, validatePaymentsConfig } from '../config/payments.config';
import type { PaymentsConfig } from '../config/payments.config';

import { PAYMENT_PROVIDER } from './payment-provider.interface';
import { FakePaymentProvider } from './fake-payment.provider';
import { CulqiPaymentProvider } from './culqi/culqi-payment.provider';
import { CulqiWebhookController } from './culqi/culqi-webhook.controller';
import { CulqiWebhookService } from './culqi/culqi-webhook.service';

@Module({
  imports: [ConfigModule.forFeature(paymentsConfig)],
  controllers: [CulqiWebhookController],
  providers: [
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
  exports: [PAYMENT_PROVIDER, FakePaymentProvider, CulqiWebhookService],
})
export class PaymentsModule {}

import { registerAs } from '@nestjs/config';

export interface PaymentsConfig {
  driver: 'fake' | 'culqi';
  publicKey?: string;
  secretKey?: string;
  webhookSecret?: string;
}

export function validatePaymentsConfig(
  env: Record<string, string | undefined>,
): PaymentsConfig {
  const driver = (env.PAYMENT_DRIVER ?? 'fake').trim().toLowerCase();

  if (driver !== 'fake' && driver !== 'culqi') {
    throw new Error(
      `[Payments] Invalid PAYMENT_DRIVER="${driver}". Valid values: fake | culqi`,
    );
  }

  const secretKey = env.CULQI_SECRET_KEY?.trim();
  const publicKey = env.CULQI_PUBLIC_KEY?.trim();
  const webhookSecret = env.CULQI_WEBHOOK_SECRET?.trim();

  if (driver === 'culqi' && !secretKey) {
    throw new Error(
      '[Payments] CULQI_SECRET_KEY is required when PAYMENT_DRIVER="culqi".',
    );
  }

  return {
    driver: driver as 'fake' | 'culqi',
    publicKey,
    secretKey,
    webhookSecret,
  };
}

export const paymentsConfig = registerAs('payments', () =>
  validatePaymentsConfig(process.env),
);

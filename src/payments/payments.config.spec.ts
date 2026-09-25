import { validatePaymentsConfig } from '../config/payments.config';

describe('validatePaymentsConfig', () => {
  it('should default to driver "fake" when no env vars provided', () => {
    const config = validatePaymentsConfig({});
    expect(config.driver).toBe('fake');
    expect(config.secretKey).toBeUndefined();
  });

  it('should allow driver "fake" explicitly', () => {
    const config = validatePaymentsConfig({ PAYMENT_DRIVER: 'fake' });
    expect(config.driver).toBe('fake');
  });

  it('should throw when driver is "culqi" but no CULQI_SECRET_KEY is provided', () => {
    expect(() => validatePaymentsConfig({ PAYMENT_DRIVER: 'culqi' })).toThrow(
      'CULQI_SECRET_KEY is required',
    );
  });

  it('should succeed when driver is "culqi" and secret key is given', () => {
    const config = validatePaymentsConfig({
      PAYMENT_DRIVER: 'culqi',
      CULQI_SECRET_KEY: 'sk_test_12345',
      CULQI_PUBLIC_KEY: 'pk_test_67890',
      CULQI_WEBHOOK_SECRET: 'wh_sec_abc',
    });
    expect(config.driver).toBe('culqi');
    expect(config.secretKey).toBe('sk_test_12345');
    expect(config.publicKey).toBe('pk_test_67890');
    expect(config.webhookSecret).toBe('wh_sec_abc');
  });

  it('should throw on unknown driver', () => {
    expect(() => validatePaymentsConfig({ PAYMENT_DRIVER: 'stripe' })).toThrow(
      'Invalid PAYMENT_DRIVER',
    );
  });
});

import { ConfigService } from '@nestjs/config';
import { ClientPaymentsService } from './client-payments.service';
import { PrismaService } from '../prisma/prisma.service';
import { PaymentProvider } from '../payments/payment-provider.interface';

describe('ClientPaymentsService payment boundaries', () => {
  const actor = { id: 7, email: 'client@example.test' };
  function setup(enabled = false) {
    const schedule = {
      id: 1,
      amountMinor: 10000n,
      sequence: 1,
      milestone: 'Inicio',
      payments: [{ amountMinor: 2000n }],
      quoteVersion: {
        version: 2,
        acceptedAt: new Date(),
        currency: 'PEN',
        quote: {
          activeVersion: 2,
          publicCode: 'Q-TEST',
          prospect: { userId: 7 },
        },
      },
    };
    const db = {
      paymentSchedule: { findUnique: vi.fn().mockResolvedValue(schedule) },
    };
    const provider = {
      createCharge: vi
        .fn()
        .mockResolvedValue({ id: 'chr_test', status: 'SUCCEEDED' }),
      createOrder: vi.fn(),
    };
    const values = enabled
      ? {
          CULQI_ENABLED: 'true',
          PAYMENT_DRIVER: 'culqi',
          CULQI_PUBLIC_KEY: 'unit-public',
          CULQI_SECRET_KEY: 'unit-secret',
          CULQI_WEBHOOK_BASIC_AUTH: 'unit-auth',
        }
      : {};
    const service = new ClientPaymentsService(
      db as unknown as PrismaService,
      new ConfigService(values),
      provider as unknown as PaymentProvider,
    );
    return { service, schedule, provider };
  }
  it('rejects cards and CIP without credentials and never invokes any provider', async () => {
    const { service, provider } = setup();
    await expect(
      service.createCharge(1, actor, 'tkn_test_unit'),
    ).rejects.toMatchObject({ status: 503 });
    await expect(service.createCheckout(1, actor)).rejects.toMatchObject({
      status: 503,
    });
    expect(provider.createCharge).not.toHaveBeenCalled();
    expect(provider.createOrder).not.toHaveBeenCalled();
  });
  it('rejects another client before charging', async () => {
    const { service, provider } = setup(true);
    await expect(
      service.createCharge(1, { ...actor, id: 8 }, 'tkn_test_unit'),
    ).rejects.toMatchObject({ status: 403 });
    expect(provider.createCharge).not.toHaveBeenCalled();
  });
  it('rejects obsolete agreements and already paid schedules', async () => {
    const { service, schedule, provider } = setup(true);
    schedule.quoteVersion.quote.activeVersion = 3;
    await expect(
      service.createCharge(1, actor, 'tkn_test_unit'),
    ).rejects.toMatchObject({ status: 409 });
    await expect(service.createCheckout(1, actor)).rejects.toMatchObject({
      status: 409,
    });
    expect(provider.createOrder).not.toHaveBeenCalled();
    schedule.quoteVersion.quote.activeVersion = 2;
    schedule.payments[0].amountMinor = 10000n;
    await expect(
      service.createCharge(1, actor, 'tkn_test_unit'),
    ).rejects.toMatchObject({ status: 409 });
    expect(provider.createCharge).not.toHaveBeenCalled();
  });
  it('derives outstanding amount from the database and does not report payment confirmed', async () => {
    const { service, provider } = setup(true);
    await expect(
      service.createCharge(1, actor, 'tkn_test_unit'),
    ).resolves.toEqual({
      chargeId: 'chr_test',
      status: 'PENDING_CONFIRMATION',
    });
    expect(provider.createCharge).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 8000,
        currency: 'PEN',
        email: actor.email,
        metadata: { scheduleId: 1 },
      }),
    );
  });
});

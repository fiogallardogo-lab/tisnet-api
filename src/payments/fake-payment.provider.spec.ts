import { FakePaymentProvider } from './fake-payment.provider';
import { PaymentProviderError } from './payment-provider.interface';

describe('FakePaymentProvider', () => {
  let provider: FakePaymentProvider;

  beforeEach(() => {
    provider = new FakePaymentProvider();
  });

  it('should create a charge successfully with valid input', async () => {
    const charge = await provider.createCharge({
      amount: 15000,
      currency: 'PEN',
      tokenId: 'tkn_test_valid',
      email: 'client@example.com',
      description: 'Pago por Cotización #123',
    });

    expect(charge.id).toBeDefined();
    expect(charge.amount).toBe(15000);
    expect(charge.currency).toBe('PEN');
    expect(charge.status).toBe('SUCCEEDED');
    expect(charge.customerEmail).toBe('client@example.com');
    expect(charge.referenceCode).toBeDefined();
    expect(charge.paidAt).toBeInstanceOf(Date);

    // Verify it is retrievable
    const retrieved = await provider.getCharge(charge.id);
    expect(retrieved).toEqual(charge);
  });

  it('should reject non-positive amounts', async () => {
    await expect(
      provider.createCharge({
        amount: 0,
        currency: 'PEN',
        tokenId: 'tkn_test_valid',
        email: 'client@example.com',
        description: 'Test',
      }),
    ).rejects.toThrow(PaymentProviderError);
  });

  it('should reject missing token', async () => {
    await expect(
      provider.createCharge({
        amount: 5000,
        currency: 'PEN',
        tokenId: '',
        email: 'client@example.com',
        description: 'Test',
      }),
    ).rejects.toThrow('El token de tarjeta es requerido.');
  });

  it('should simulate card decline when token indicates decline', async () => {
    await expect(
      provider.createCharge({
        amount: 5000,
        currency: 'PEN',
        tokenId: 'tkn_test_declined',
        email: 'client@example.com',
        description: 'Test',
      }),
    ).rejects.toThrow('La tarjeta fue rechazada');
  });

  it('should simulate insufficient funds', async () => {
    await expect(
      provider.createCharge({
        amount: 5000,
        currency: 'PEN',
        tokenId: 'tkn_test_insufficient_funds',
        email: 'client@example.com',
        description: 'Test',
      }),
    ).rejects.toThrow('Fondos insuficientes.');
  });

  it('should create and retrieve an asynchronous order', async () => {
    const order = await provider.createOrder({
      amount: 25000,
      currency: 'PEN',
      description: 'PagoEfectivo CIP Cotización',
      orderNumber: 'ORD-001',
      clientDetails: {
        firstName: 'Carlos',
        lastName: 'Pérez',
        email: 'carlos@example.com',
      },
      expirationDate: new Date(Date.now() + 86400000),
    });

    expect(order.id).toBeDefined();
    expect(order.paymentCode).toContain('CIP-');
    expect(order.status).toBe('PENDING');

    const retrieved = await provider.getOrder(order.id);
    expect(retrieved).toEqual(order);

    const paidOrder = provider.simulateOrderPayment(order.id);
    expect(paidOrder?.status).toBe('SUCCEEDED');
  });
});

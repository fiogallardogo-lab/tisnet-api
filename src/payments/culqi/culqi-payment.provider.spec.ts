import { vi } from 'vitest';
import { CulqiPaymentProvider } from './culqi-payment.provider';
import { PaymentProviderError } from '../payment-provider.interface';

describe('CulqiPaymentProvider', () => {
  let provider: CulqiPaymentProvider;
  const mockFetch = vi.fn();

  beforeAll(() => {
    (global as any).fetch = mockFetch;
  });

  beforeEach(() => {
    mockFetch.mockReset();
    provider = new CulqiPaymentProvider({
      secretKey: 'sk_test_fake_key_123',
      baseUrl: 'https://api.culqi.test',
      timeoutMs: 3000,
    });
  });

  it('should create charge successfully via Culqi API', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 201,
      text: async () =>
        JSON.stringify({
          id: 'chr_test_999',
          amount: 10000,
          currency_code: 'PEN',
          email: 'test@example.com',
          description: 'Cotización Web',
          reference_code: 'ABC1234',
          capture: true,
          capture_date: 1700000000,
          outcome: { type: 'venta_exitosa' },
        }),
    });

    const result = await provider.createCharge({
      amount: 10000,
      currency: 'PEN',
      tokenId: 'tkn_test_abc123',
      email: 'test@example.com',
      description: 'Cotización Web',
    });

    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.culqi.test/charges',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer sk_test_fake_key_123',
          'Content-Type': 'application/json',
        }),
      }),
    );

    expect(result.id).toBe('chr_test_999');
    expect(result.status).toBe('SUCCEEDED');
    expect(result.amount).toBe(10000);
    expect(result.currency).toBe('PEN');
    expect(result.referenceCode).toBe('ABC1234');
  });

  it('should map Culqi API errors to PaymentProviderError', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 402,
      text: async () =>
        JSON.stringify({
          object: 'error',
          type: 'card_error',
          code: 'card_declined',
          merchant_message: 'La tarjeta fue rechazada por el banco.',
          user_message: 'Fondos insuficientes.',
        }),
    });

    await expect(
      provider.createCharge({
        amount: 10000,
        currency: 'PEN',
        tokenId: 'tkn_test_declined',
        email: 'test@example.com',
        description: 'Error test',
      }),
    ).rejects.toThrow('Fondos insuficientes.');
  });

  it('should validate that amount is positive integer in cents', async () => {
    await expect(
      provider.createCharge({
        amount: 12.5, // float is invalid in Culqi
        currency: 'PEN',
        tokenId: 'tkn_test_abc',
        email: 'test@example.com',
        description: 'Test',
      }),
    ).rejects.toThrow('El monto debe ser un entero positivo en céntimos.');
  });
});

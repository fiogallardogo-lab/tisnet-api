import { Injectable, Logger } from '@nestjs/common';
import {
  CreateChargeInput,
  CreateOrderInput,
  PaymentCharge,
  PaymentOrder,
  PaymentProvider,
  PaymentProviderError,
} from './payment-provider.interface';

@Injectable()
export class FakePaymentProvider implements PaymentProvider {
  private readonly logger = new Logger(FakePaymentProvider.name);
  private readonly charges = new Map<string, PaymentCharge>();
  private readonly orders = new Map<string, PaymentOrder>();

  async createCharge(input: CreateChargeInput): Promise<PaymentCharge> {
    this.logger.log(`[FakePayment] Creating charge: amount=${input.amount} ${input.currency}, email=${input.email}`);

    if (!input.amount || input.amount <= 0) {
      throw new PaymentProviderError(
        'El monto debe ser mayor a cero.',
        'INVALID_AMOUNT',
        400,
      );
    }

    if (!input.tokenId) {
      throw new PaymentProviderError(
        'El token de tarjeta es requerido.',
        'MISSING_TOKEN',
        400,
      );
    }

    // Deterministic simulation for tests
    if (input.tokenId.includes('fail') || input.tokenId === 'tkn_test_declined') {
      throw new PaymentProviderError(
        'La tarjeta fue rechazada por el banco emisor.',
        'CARD_DECLINED',
        402,
      );
    }

    if (input.tokenId === 'tkn_test_insufficient_funds') {
      throw new PaymentProviderError(
        'Fondos insuficientes.',
        'INSUFFICIENT_FUNDS',
        402,
      );
    }

    const chargeId = `chr_fake_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const charge: PaymentCharge = {
      id: chargeId,
      amount: input.amount,
      currency: input.currency,
      status: 'SUCCEEDED',
      description: input.description,
      customerEmail: input.email,
      referenceCode: `REF-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
      paidAt: new Date(),
      rawResponse: { provider: 'fake', simulated: true },
    };

    this.charges.set(chargeId, charge);
    return charge;
  }

  async getCharge(chargeId: string): Promise<PaymentCharge | null> {
    return this.charges.get(chargeId) ?? null;
  }

  async createOrder(input: CreateOrderInput): Promise<PaymentOrder> {
    this.logger.log(`[FakePayment] Creating order: ${input.orderNumber}, amount=${input.amount}`);

    const orderId = `ord_fake_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const cipCode = `CIP-${Math.floor(1000000 + Math.random() * 9000000)}`;

    const order: PaymentOrder = {
      id: orderId,
      orderNumber: input.orderNumber,
      paymentCode: cipCode,
      status: 'PENDING',
      amount: input.amount,
      currency: input.currency,
      expirationDate: input.expirationDate,
      rawResponse: { provider: 'fake', cip: cipCode },
    };

    this.orders.set(orderId, order);
    return order;
  }

  async getOrder(orderId: string): Promise<PaymentOrder | null> {
    return this.orders.get(orderId) ?? null;
  }

  /** Test helper to manually mark an order as paid */
  simulateOrderPayment(orderId: string): PaymentOrder | null {
    const order = this.orders.get(orderId);
    if (!order) return null;
    order.status = 'SUCCEEDED';
    return order;
  }

  /** Test helper to clear memory */
  reset(): void {
    this.charges.clear();
    this.orders.clear();
  }
}

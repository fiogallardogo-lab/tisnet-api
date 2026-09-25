export const PAYMENT_PROVIDER = Symbol('PAYMENT_PROVIDER');

export type PaymentCurrency = 'PEN' | 'USD';

export type PaymentStatus =
  | 'PENDING'
  | 'SUCCEEDED'
  | 'FAILED'
  | 'EXPIRED'
  | 'REFUNDED';

export interface CreateChargeInput {
  /** Amount in cents / minor currency unit (e.g. 15000 = S/ 150.00). Must be positive integer. */
  amount: number;
  currency: PaymentCurrency;
  /** Token ID obtained from frontend checkout (e.g. tkn_live_... or tkn_test_...). */
  tokenId: string;
  email: string;
  description: string;
  metadata?: Record<string, string | number>;
}

export interface PaymentCharge {
  id: string;
  amount: number;
  currency: PaymentCurrency;
  status: PaymentStatus;
  description: string;
  customerEmail: string;
  referenceCode?: string;
  paidAt?: Date;
  errorCode?: string;
  errorMessage?: string;
  rawResponse?: Record<string, unknown>;
}

export interface CreateOrderInput {
  /** Amount in cents / minor currency unit. Must be positive integer. */
  amount: number;
  currency: PaymentCurrency;
  description: string;
  orderNumber: string;
  clientDetails: {
    firstName: string;
    lastName: string;
    email: string;
    phone?: string;
  };
  expirationDate: Date;
  metadata?: Record<string, string | number>;
}

export interface PaymentOrder {
  id: string;
  orderNumber: string;
  paymentCode?: string;
  qrCode?: string;
  status: PaymentStatus;
  amount: number;
  currency: PaymentCurrency;
  expirationDate: Date;
  rawResponse?: Record<string, unknown>;
}

export class PaymentProviderError extends Error {
  constructor(
    message: string,
    public readonly code: string = 'PAYMENT_FAILED',
    public readonly statusCode: number = 400,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'PaymentProviderError';
  }
}

export interface PaymentProvider {
  /** Create a direct charge from a card/Yape token */
  createCharge(input: CreateChargeInput): Promise<PaymentCharge>;

  /** Retrieve an existing charge by ID */
  getCharge(chargeId: string): Promise<PaymentCharge | null>;

  /** Create an order for asynchronous payment (e.g. PagoEfectivo / CIP) */
  createOrder(input: CreateOrderInput): Promise<PaymentOrder>;

  /** Retrieve an existing order by ID */
  getOrder(orderId: string): Promise<PaymentOrder | null>;
}

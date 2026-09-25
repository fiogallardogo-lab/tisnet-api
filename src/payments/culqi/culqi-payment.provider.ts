import { Injectable, Logger } from '@nestjs/common';
import {
  CreateChargeInput,
  CreateOrderInput,
  PaymentCharge,
  PaymentOrder,
  PaymentProvider,
  PaymentProviderError,
} from '../payment-provider.interface';

export interface CulqiProviderOptions {
  secretKey: string;
  baseUrl?: string;
  timeoutMs?: number;
}

@Injectable()
export class CulqiPaymentProvider implements PaymentProvider {
  private readonly logger = new Logger(CulqiPaymentProvider.name);
  private readonly secretKey: string;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;

  constructor(options: CulqiProviderOptions) {
    if (!options.secretKey) {
      throw new Error('[CulqiPaymentProvider] secretKey is required');
    }
    this.secretKey = options.secretKey;
    this.baseUrl = options.baseUrl ?? 'https://api.culqi.com/v2';
    this.timeoutMs = options.timeoutMs ?? 15000;
  }

  async createCharge(input: CreateChargeInput): Promise<PaymentCharge> {
    if (!input.amount || input.amount <= 0 || !Number.isInteger(input.amount)) {
      throw new PaymentProviderError(
        'El monto debe ser un entero positivo en céntimos.',
        'INVALID_AMOUNT',
        400,
      );
    }

    if (!input.tokenId) {
      throw new PaymentProviderError(
        'El token de Culqi es requerido.',
        'MISSING_TOKEN',
        400,
      );
    }

    const payload = {
      amount: input.amount,
      currency_code: input.currency,
      email: input.email,
      source_id: input.tokenId,
      description: input.description,
      metadata: input.metadata ?? {},
    };

    const response = await this.request<any>('/charges', {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    const isSucceeded = response.outcome?.type === 'venta_exitosa' || response.capture === true;
    const status = isSucceeded ? 'SUCCEEDED' : 'PENDING';

    return {
      id: response.id,
      amount: response.amount,
      currency: response.currency_code,
      status,
      description: response.description ?? input.description,
      customerEmail: response.email ?? input.email,
      referenceCode: response.reference_code,
      paidAt: response.capture_date ? new Date(response.capture_date * 1000) : new Date(),
      rawResponse: response,
    };
  }

  async getCharge(chargeId: string): Promise<PaymentCharge | null> {
    try {
      const response = await this.request<any>(`/charges/${encodeURIComponent(chargeId)}`, {
        method: 'GET',
      });

      const isSucceeded = response.outcome?.type === 'venta_exitosa' || response.capture === true;
      return {
        id: response.id,
        amount: response.amount,
        currency: response.currency_code,
        status: isSucceeded ? 'SUCCEEDED' : 'FAILED',
        description: response.description,
        customerEmail: response.email,
        referenceCode: response.reference_code,
        paidAt: response.capture_date ? new Date(response.capture_date * 1000) : undefined,
        rawResponse: response,
      };
    } catch (err) {
      if (err instanceof PaymentProviderError && err.statusCode === 404) {
        return null;
      }
      throw err;
    }
  }

  async createOrder(input: CreateOrderInput): Promise<PaymentOrder> {
    const expirationTimestamp = Math.floor(input.expirationDate.getTime() / 1000);

    const payload = {
      amount: input.amount,
      currency_code: input.currency,
      description: input.description,
      order_number: input.orderNumber,
      client_details: {
        first_name: input.clientDetails.firstName,
        last_name: input.clientDetails.lastName,
        email: input.clientDetails.email,
        phone_number: input.clientDetails.phone ?? '',
      },
      expiration_date: expirationTimestamp,
      metadata: input.metadata ?? {},
    };

    const response = await this.request<any>('/orders', {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    return {
      id: response.id,
      orderNumber: response.order_number ?? input.orderNumber,
      paymentCode: response.payment_code,
      qrCode: response.qr,
      status: response.state === 'paid' ? 'SUCCEEDED' : 'PENDING',
      amount: response.amount,
      currency: response.currency_code,
      expirationDate: new Date(response.expiration_date * 1000),
      rawResponse: response,
    };
  }

  async getOrder(orderId: string): Promise<PaymentOrder | null> {
    try {
      const response = await this.request<any>(`/orders/${encodeURIComponent(orderId)}`, {
        method: 'GET',
      });

      return {
        id: response.id,
        orderNumber: response.order_number,
        paymentCode: response.payment_code,
        qrCode: response.qr,
        status: response.state === 'paid' ? 'SUCCEEDED' : response.state === 'expired' ? 'EXPIRED' : 'PENDING',
        amount: response.amount,
        currency: response.currency_code,
        expirationDate: new Date(response.expiration_date * 1000),
        rawResponse: response,
      };
    } catch (err) {
      if (err instanceof PaymentProviderError && err.statusCode === 404) {
        return null;
      }
      throw err;
    }
  }

  private async request<T>(endpoint: string, options: RequestInit): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const res = await fetch(url, {
        ...options,
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${this.secretKey}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
          ...(options.headers ?? {}),
        },
      });

      const bodyText = await res.text();
      let parsed: any;
      try {
        parsed = bodyText ? JSON.parse(bodyText) : {};
      } catch {
        parsed = { raw: bodyText };
      }

      if (!res.ok) {
        const errorMsg =
          parsed.user_message ||
          parsed.merchant_message ||
          parsed.message ||
          `Culqi API returned status ${res.status}`;
        const errorCode = parsed.code || 'CULQI_API_ERROR';

        this.logger.warn(`[CulqiPaymentProvider] Request failed ${res.status}: ${errorMsg}`);
        throw new PaymentProviderError(errorMsg, errorCode, res.status, parsed);
      }

      return parsed as T;
    } catch (err: any) {
      if (err instanceof PaymentProviderError) throw err;
      if (err.name === 'AbortError') {
        throw new PaymentProviderError(
          'Tiempo de espera agotado al conectar con Culqi.',
          'TIMEOUT',
          504,
        );
      }
      throw new PaymentProviderError(
        `Error al comunicar con pasarela Culqi: ${err.message}`,
        'NETWORK_ERROR',
        502,
        err,
      );
    } finally {
      clearTimeout(timeout);
    }
  }
}

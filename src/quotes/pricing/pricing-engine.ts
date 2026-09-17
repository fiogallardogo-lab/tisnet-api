import { QuoteDeliveryMode } from '../domain/quote.enums';

export interface PricingSelection {
  solutionType: string;
  optionCodes: string[];
  deliveryMode?: QuoteDeliveryMode | string;
}

export interface PricingItem {
  code: string;
  label: string;
  amountMinor: number;
  displayOrder: number;
}

export interface PricingResult {
  amountMinor: number;
  currency: string;
  pricingVersion: string;
  items: PricingItem[];
}

/**
 * Contrato del cálculo determinista de precios.
 * Si una selección no tiene regla aprobada en la versión activa,
 * calculate retorna undefined para indicar estado PENDING_RULES.
 */
export interface PricingEngine {
  calculate(selection: PricingSelection): PricingResult | undefined;
}

export const PRICING_ENGINE = Symbol('PRICING_ENGINE');

export interface PricingSelection {
  solutionType: string;
  optionCodes: string[];
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
 * Contrato del cálculo. No debe existir una implementación productiva hasta
 * que SP-01 apruebe fórmula, tabla de precios, moneda y redondeo.
 */
export interface PricingEngine {
  calculate(selection: PricingSelection): PricingResult;
}

export const PRICING_ENGINE = Symbol('PRICING_ENGINE');

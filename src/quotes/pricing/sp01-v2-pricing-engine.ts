import { Injectable } from '@nestjs/common';
import { QuoteDeliveryMode } from '../domain/quote.enums';
import {
  PricingEngine,
  PricingItem,
  PricingResult,
  PricingSelection,
} from './pricing-engine';
import { roundHalfAwayFromZero } from './rounding';

export const SP01_V2_VERSION = 'SP-01-v2';
export const SP01_V2_CURRENCY = 'PEN';

export const SP01_V2_SOLUTION_PRICES: Readonly<Record<string, number>> = {
  LANDING_PAGE: 85000,
  CORPORATE_SITE: 180000,
  ECOMMERCE: 320000,
  PERSONAL_PORTFOLIO: 140000,
  WEB_APP: 580000,
  SAAS_PLATFORM: 760000,
};

export const SP01_V2_SOLUTION_LABELS: Readonly<Record<string, string>> = {
  LANDING_PAGE: 'Landing page',
  CORPORATE_SITE: 'Sitio web corporativo',
  ECOMMERCE: 'Tienda virtual (E-commerce)',
  PERSONAL_PORTFOLIO: 'Portafolio profesional',
  WEB_APP: 'Aplicación web',
  SAAS_PLATFORM: 'Plataforma SaaS',
};

export const SP01_V2_EXTRA_PRICES: Readonly<Record<string, number>> = {
  SEO_ADVANCED: 45000,
  CUSTOM_CMS: 70000,
  ADVANCED_ANALYTICS: 35000,
  HOSTING_1Y: 28000,
  MULTILINGUAL: 95000,
  MAINTENANCE_6M: 65000,
  LEAD_AUTOMATION: 78000,
  COMMERCIAL_CRM: 92000,
};

export const SP01_V2_DELIVERY_RATES: Readonly<Record<QuoteDeliveryMode, number>> = {
  [QuoteDeliveryMode.NORMAL]: 0,
  [QuoteDeliveryMode.URGENT]: 30,
  [QuoteDeliveryMode.FLEXIBLE]: -10,
};

export const SP01_V2_DELIVERY_LABELS: Readonly<Record<QuoteDeliveryMode, string>> = {
  [QuoteDeliveryMode.NORMAL]: 'Entrega estándar (0%)',
  [QuoteDeliveryMode.URGENT]: 'Entrega urgente (+30%)',
  [QuoteDeliveryMode.FLEXIBLE]: 'Entrega flexible (-10%)',
};

@Injectable()
export class Sp01V2PricingEngine implements PricingEngine {
  calculate(selection: PricingSelection): PricingResult | undefined {
    const baseMinor = SP01_V2_SOLUTION_PRICES[selection.solutionType];
    if (baseMinor === undefined) {
      // Categoría reconocida pero sin regla tarifaria en SP-01-v2 (ej. MOBILE_APP, CUSTOM_SOFTWARE)
      return undefined;
    }

    // Validar que todas las opciones seleccionadas tengan regla en SP-01-v2
    let extrasMinor = 0;
    for (const code of selection.optionCodes) {
      const extraPrice = SP01_V2_EXTRA_PRICES[code];
      if (extraPrice === undefined) {
        // Opción sin regla tarifaria aprobada en SP-01-v2
        return undefined;
      }
      extrasMinor += extraPrice;
    }

    const deliveryModeKey = (selection.deliveryMode ?? QuoteDeliveryMode.NORMAL) as QuoteDeliveryMode;
    const ratePercentage = SP01_V2_DELIVERY_RATES[deliveryModeKey];
    if (ratePercentage === undefined) {
      // Modalidad desconocida o sin regla
      return undefined;
    }

    const subtotalMinor = baseMinor + extrasMinor;
    const adjustmentMinor = roundHalfAwayFromZero((subtotalMinor * ratePercentage) / 100);
    const totalMinor = subtotalMinor + adjustmentMinor;

    const solutionLabel = SP01_V2_SOLUTION_LABELS[selection.solutionType] ?? selection.solutionType;
    const deliveryLabel = SP01_V2_DELIVERY_LABELS[deliveryModeKey] ?? deliveryModeKey;

    const items: PricingItem[] = [
      {
        code: 'BASE',
        label: `Base: ${solutionLabel}`,
        amountMinor: baseMinor,
        displayOrder: 1,
      },
      {
        code: 'EXTRA',
        label: 'Servicios adicionales',
        amountMinor: extrasMinor,
        displayOrder: 2,
      },
      {
        code: 'DELIVERY_ADJUSTMENT',
        label: `Ajuste por modalidad: ${deliveryLabel}`,
        amountMinor: adjustmentMinor,
        displayOrder: 3,
      },
    ];

    return {
      amountMinor: totalMinor,
      currency: SP01_V2_CURRENCY,
      pricingVersion: SP01_V2_VERSION,
      items,
    };
  }
}

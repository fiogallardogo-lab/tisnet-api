import { describe, expect, it } from 'vitest';
import { QuoteDeliveryMode } from '../domain/quote.enums';
import { Sp01V2PricingEngine } from './sp01-v2-pricing-engine';

describe('Sp01V2PricingEngine', () => {
  const engine = new Sp01V2PricingEngine();

  describe('Casos obligatorios', () => {
    it('Caso 1: ECOMMERCE + SEO_ADVANCED + ADVANCED_ANALYTICS + NORMAL => S/ 4,000.00', () => {
      const result = engine.calculate({
        solutionType: 'ECOMMERCE',
        optionCodes: ['SEO_ADVANCED', 'ADVANCED_ANALYTICS'],
        deliveryMode: QuoteDeliveryMode.NORMAL,
      });

      expect(result).toBeDefined();
      expect(result?.amountMinor).toBe(400000);
      expect(result?.currency).toBe('PEN');
      expect(result?.pricingVersion).toBe('SP-01-v2');
      expect(result?.items).toEqual([
        {
          code: 'BASE',
          label: 'Base: Tienda virtual (E-commerce)',
          amountMinor: 320000,
          displayOrder: 1,
        },
        {
          code: 'EXTRA',
          label: 'Servicios adicionales',
          amountMinor: 80000,
          displayOrder: 2,
        },
        {
          code: 'DELIVERY_ADJUSTMENT',
          label: 'Ajuste por modalidad: Entrega estándar (0%)',
          amountMinor: 0,
          displayOrder: 3,
        },
      ]);
      const sum = result!.items.reduce((acc, it) => acc + it.amountMinor, 0);
      expect(sum).toBe(result?.amountMinor);
    });

    it('Caso 2: ECOMMERCE + SEO_ADVANCED + ADVANCED_ANALYTICS + URGENT => S/ 5,200.00', () => {
      const result = engine.calculate({
        solutionType: 'ECOMMERCE',
        optionCodes: ['SEO_ADVANCED', 'ADVANCED_ANALYTICS'],
        deliveryMode: QuoteDeliveryMode.URGENT,
      });

      expect(result).toBeDefined();
      expect(result?.amountMinor).toBe(520000);
      expect(result?.items).toEqual([
        {
          code: 'BASE',
          label: 'Base: Tienda virtual (E-commerce)',
          amountMinor: 320000,
          displayOrder: 1,
        },
        {
          code: 'EXTRA',
          label: 'Servicios adicionales',
          amountMinor: 80000,
          displayOrder: 2,
        },
        {
          code: 'DELIVERY_ADJUSTMENT',
          label: 'Ajuste por modalidad: Entrega urgente (+30%)',
          amountMinor: 120000,
          displayOrder: 3,
        },
      ]);
      const sum = result!.items.reduce((acc, it) => acc + it.amountMinor, 0);
      expect(sum).toBe(result?.amountMinor);
    });

    it('Caso 3: ECOMMERCE + SEO_ADVANCED + ADVANCED_ANALYTICS + FLEXIBLE => S/ 3,600.00', () => {
      const result = engine.calculate({
        solutionType: 'ECOMMERCE',
        optionCodes: ['SEO_ADVANCED', 'ADVANCED_ANALYTICS'],
        deliveryMode: QuoteDeliveryMode.FLEXIBLE,
      });

      expect(result).toBeDefined();
      expect(result?.amountMinor).toBe(360000);
      expect(result?.items).toEqual([
        {
          code: 'BASE',
          label: 'Base: Tienda virtual (E-commerce)',
          amountMinor: 320000,
          displayOrder: 1,
        },
        {
          code: 'EXTRA',
          label: 'Servicios adicionales',
          amountMinor: 80000,
          displayOrder: 2,
        },
        {
          code: 'DELIVERY_ADJUSTMENT',
          label: 'Ajuste por modalidad: Entrega flexible (-10%)',
          amountMinor: -40000,
          displayOrder: 3,
        },
      ]);
      const sum = result!.items.reduce((acc, it) => acc + it.amountMinor, 0);
      expect(sum).toBe(result?.amountMinor);
    });

    it('Caso 4: LANDING_PAGE + SEO_ADVANCED + ADVANCED_ANALYTICS + NORMAL => S/ 1,650.00', () => {
      const result = engine.calculate({
        solutionType: 'LANDING_PAGE',
        optionCodes: ['SEO_ADVANCED', 'ADVANCED_ANALYTICS'],
        deliveryMode: QuoteDeliveryMode.NORMAL,
      });

      expect(result).toBeDefined();
      expect(result?.amountMinor).toBe(165000);
      expect(result?.items).toEqual([
        {
          code: 'BASE',
          label: 'Base: Landing page',
          amountMinor: 85000,
          displayOrder: 1,
        },
        {
          code: 'EXTRA',
          label: 'Servicios adicionales',
          amountMinor: 80000,
          displayOrder: 2,
        },
        {
          code: 'DELIVERY_ADJUSTMENT',
          label: 'Ajuste por modalidad: Entrega estándar (0%)',
          amountMinor: 0,
          displayOrder: 3,
        },
      ]);
      const sum = result!.items.reduce((acc, it) => acc + it.amountMinor, 0);
      expect(sum).toBe(result?.amountMinor);
    });
  });

  describe('Categorías reconocidas sin precio (PENDING_RULES)', () => {
    it('debe retornar undefined para MOBILE_APP', () => {
      const result = engine.calculate({
        solutionType: 'MOBILE_APP',
        optionCodes: ['SEO_ADVANCED'],
      });
      expect(result).toBeUndefined();
    });

    it('debe retornar undefined para CUSTOM_SOFTWARE', () => {
      const result = engine.calculate({
        solutionType: 'CUSTOM_SOFTWARE',
        optionCodes: ['SEO_ADVANCED'],
      });
      expect(result).toBeUndefined();
    });

    it('debe retornar undefined si una opción carece de regla SP-01-v2', () => {
      const result = engine.calculate({
        solutionType: 'WEB_APP',
        optionCodes: ['AUTHENTICATION'], // Opción de v1 sin regla de precio en v2
      });
      expect(result).toBeUndefined();
    });
  });

  describe('Valores por defecto y modalidades', () => {
    it('debe asumir NORMAL cuando deliveryMode no es especificado', () => {
      const result = engine.calculate({
        solutionType: 'LANDING_PAGE',
        optionCodes: ['SEO_ADVANCED'],
      });

      expect(result).toBeDefined();
      // 85000 + 45000 = 130000; ajuste 0 => 130000
      expect(result?.amountMinor).toBe(130000);
    });

    it('debe aplicar redondeo simétrico roundHalfAwayFromZero en ajustes', () => {
      // Usar combinación que produzca fracción decimal en el porcentaje
      // CORPORATE_SITE = 180000 + HOSTING_1Y (28000) = 208000
      // 208000 * 0.3 = 62400
      const result = engine.calculate({
        solutionType: 'CORPORATE_SITE',
        optionCodes: ['HOSTING_1Y'],
        deliveryMode: QuoteDeliveryMode.URGENT,
      });
      expect(result?.amountMinor).toBe(208000 + 62400);
    });
  });
});

import { describe, expect, it } from 'vitest';
import { QuotePricingStatus, QuoteStatus } from '../domain/quote.enums';
import { toPublicQuoteResponse } from './public-quote.mapper';

describe('toPublicQuoteResponse', () => {
  it('debe exponer únicamente los campos públicos aprobados', () => {
    const result = toPublicQuoteResponse({
      publicCode: 'Q-AAAAAAAA',
      status: QuoteStatus.RECEIVED,
      pricingStatus: QuotePricingStatus.PENDING_RULES,
      amountMinor: null,
      currency: null,
      pricingVersion: null,
      createdAt: new Date('2026-09-16T18:30:00.000Z'),
    });

    expect(result).toEqual({
      code: 'Q-AAAAAAAA',
      status: QuoteStatus.RECEIVED,
      pricingStatus: QuotePricingStatus.PENDING_RULES,
      amountMinor: null,
      currency: null,
      pricingVersion: null,
      createdAt: '2026-09-16T18:30:00.000Z',
    });
    expect(Object.keys(result).sort()).toEqual(
      [
        'amountMinor',
        'code',
        'createdAt',
        'currency',
        'pricingStatus',
        'pricingVersion',
        'status',
      ].sort(),
    );
    expect(result).not.toHaveProperty('id');
    expect(result).not.toHaveProperty('contactName');
    expect(result).not.toHaveProperty('contactEmail');
    expect(result).not.toHaveProperty('contactPhone');
    expect(result).not.toHaveProperty('contactCompany');
    expect(result).not.toHaveProperty('options');
    expect(result).not.toHaveProperty('items');
  });

  it('debe conservar los datos monetarios de un cálculo aprobado', () => {
    const result = toPublicQuoteResponse({
      publicCode: 'Q-BBBBBBBB',
      status: QuoteStatus.RECEIVED,
      pricingStatus: QuotePricingStatus.CALCULATED,
      amountMinor: 125000,
      currency: 'PEN',
      pricingVersion: 'SP-01-v1',
      createdAt: new Date('2026-09-16T18:30:00.000Z'),
    });

    expect(result).toMatchObject({
      pricingStatus: QuotePricingStatus.CALCULATED,
      amountMinor: 125000,
      currency: 'PEN',
      pricingVersion: 'SP-01-v1',
    });
  });
});

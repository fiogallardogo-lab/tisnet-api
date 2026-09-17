import { describe, expect, it } from 'vitest';
import { normalizePublicQuote } from './quote-normalizer';
import { QuoteDeliveryMode } from './quote.enums';

describe('normalizePublicQuote', () => {
  it('debe normalizar códigos, contacto, modalidad y textos opcionales', () => {
    const result = normalizePublicQuote({
      solutionType: '  web_app ',
      options: [{ code: ' auth ' }, { code: ' reports ' }],
      deliveryMode: QuoteDeliveryMode.URGENT,
      contact: {
        fullName: '  Ana    Torres ',
        email: ' ANA.TORRES@EXAMPLE.COM ',
        phone: ' +51   987 654 321 ',
        company: ' Empresa   Ejemplo SAC ',
      },
      notes: ' Primera   versión trimestral ',
    });

    expect(result).toEqual({
      solutionType: 'WEB_APP',
      options: [{ code: 'AUTH' }, { code: 'REPORTS' }],
      deliveryMode: QuoteDeliveryMode.URGENT,
      contact: {
        fullName: 'Ana Torres',
        email: 'ana.torres@example.com',
        phone: '+51 987 654 321',
        company: 'Empresa Ejemplo SAC',
      },
      notes: 'Primera versión trimestral',
    });
  });

  it('debe asignar NORMAL por defecto cuando deliveryMode está ausente', () => {
    const result = normalizePublicQuote({
      solutionType: 'WEB_APP',
      options: [{ code: 'AUTH' }],
      contact: {
        fullName: 'Ana Torres',
        email: 'ana@example.com',
        phone: '987654321',
      },
    });

    expect(result.deliveryMode).toBe(QuoteDeliveryMode.NORMAL);
  });

  it('debe convertir textos opcionales vacíos en ausencia', () => {
    const result = normalizePublicQuote({
      solutionType: 'WEB_APP',
      options: [{ code: 'AUTH' }],
      contact: {
        fullName: 'Ana Torres',
        email: 'ana@example.com',
        phone: '987654321',
        company: '   ',
      },
      notes: '   ',
    });

    expect(result.contact.company).toBeUndefined();
    expect(result.notes).toBeUndefined();
  });
});

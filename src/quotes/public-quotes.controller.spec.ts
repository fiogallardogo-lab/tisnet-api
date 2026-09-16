import { describe, expect, it, vi } from 'vitest';
import { QuotePricingStatus, QuoteStatus } from './domain/quote.enums';
import { PublicQuotesController } from './public-quotes.controller';
import { QuotesService } from './quotes.service';

describe('PublicQuotesController', () => {
  it('debe envolver la respuesta con el mensaje público acordado', async () => {
    const data = {
      code: 'Q-AAAAAAAA',
      status: QuoteStatus.RECEIVED,
      pricingStatus: QuotePricingStatus.PENDING_RULES,
      amountMinor: null,
      currency: null,
      pricingVersion: null,
      createdAt: '2026-09-16T18:30:00.000Z',
    };
    const service = {
      createPublic: vi.fn().mockResolvedValue(data),
    } as unknown as QuotesService;
    const controller = new PublicQuotesController(service);
    const dto = {
      solutionType: 'WEB_APP',
      options: [{ code: 'AUTH' }],
      contact: {
        fullName: 'Ana Torres',
        email: 'ana@example.com',
        phone: '987654321',
      },
    };

    await expect(controller.create(dto)).resolves.toEqual({
      success: true,
      message: 'Cotización registrada correctamente',
      data,
    });
    expect(service.createPublic).toHaveBeenCalledWith(dto);
  });
});

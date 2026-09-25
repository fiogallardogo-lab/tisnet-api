import {
  ServiceUnavailableException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { QuoteCatalog } from './catalog/quote-catalog';
import { CreatePublicQuoteDto } from './dto/create-public-quote.dto';
import {
  QuoteDeliveryMode,
  QuotePricingStatus,
  QuoteStatus,
} from './domain/quote.enums';
import { PricingEngine } from './pricing/pricing-engine';
import {
  QuoteCodeCollisionError,
  QuoteRepository,
} from './repositories/quote.repository';
import { QuotesService } from './quotes.service';

const dto: CreatePublicQuoteDto = {
  solutionType: 'WEB_APP',
  options: [{ code: 'AUTH' }, { code: 'REPORTS' }],
  contact: {
    fullName: ' Ana   Torres ',
    email: 'ANA@EXAMPLE.COM',
    phone: '+51 987 654 321',
    company: ' Empresa SAC ',
  },
  notes: ' Primera versión ',
};

describe('QuotesService', () => {
  const repository: QuoteRepository = {
    create: vi.fn(),
  };

  const catalog: QuoteCatalog = {
    findSolution: vi.fn(),
    findOption: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(catalog.findSolution).mockReturnValue({
      code: 'WEB_APP',
      name: 'Aplicación web',
      isActive: true,
    });
    vi.mocked(catalog.findOption).mockImplementation((code) => ({
      code,
      name: code === 'AUTH' ? 'Autenticación' : 'Reportes',
      solutionTypes: ['WEB_APP'],
      isActive: true,
      displayOrder: code === 'AUTH' ? 1 : 2,
    }));
    vi.mocked(repository.create).mockResolvedValue({
      publicCode: 'Q-AAAAAAAA',
      status: QuoteStatus.RECEIVED,
      pricingStatus: QuotePricingStatus.PENDING_RULES,
      amountMinor: null,
      currency: null,
      pricingVersion: null,
      createdAt: new Date('2026-09-16T18:30:00.000Z'),
    });
  });

  it('debe registrar una cotización pendiente sin inventar precios', async () => {
    const service = new QuotesService(
      repository,
      catalog,
      undefined,
      () => 'Q-AAAAAAAA',
    );

    const result = await service.createPublic(dto);

    expect(repository.create).toHaveBeenCalledWith({
      deliveryMode: 'NORMAL',
      publicCode: 'Q-AAAAAAAA',
      status: QuoteStatus.RECEIVED,
      solutionType: 'WEB_APP',
      contactName: 'Ana Torres',
      contactEmail: 'ana@example.com',
      contactPhone: '+51 987 654 321',
      contactCompany: 'Empresa SAC',
      notes: 'Primera versión',
      pricingStatus: QuotePricingStatus.PENDING_RULES,
      amountMinor: null,
      currency: null,
      pricingVersion: null,
      options: [
        { code: 'AUTH', name: 'Autenticación', displayOrder: 1 },
        { code: 'REPORTS', name: 'Reportes', displayOrder: 2 },
      ],
      items: [],
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
  });

  it('debe registrar PENDING_RULES cuando el PricingEngine no tiene regla aprobada', async () => {
    const pricingEngine: PricingEngine = {
      calculate: vi.fn().mockReturnValue(undefined),
    };
    const service = new QuotesService(
      repository,
      catalog,
      pricingEngine,
      () => 'Q-AAAAAAAA',
    );

    const result = await service.createPublic(dto);

    expect(pricingEngine.calculate).toHaveBeenCalledWith({
      solutionType: 'WEB_APP',
      optionCodes: ['AUTH', 'REPORTS'],
      deliveryMode: QuoteDeliveryMode.NORMAL,
    });
    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        pricingStatus: QuotePricingStatus.PENDING_RULES,
        amountMinor: null,
        currency: null,
        pricingVersion: null,
        items: [],
      }),
    );
    expect(result.pricingStatus).toBe(QuotePricingStatus.PENDING_RULES);
  });

  it('debe rechazar una solución inexistente o inactiva', async () => {
    vi.mocked(catalog.findSolution).mockReturnValue(undefined);
    const service = new QuotesService(repository, catalog);

    await expect(service.createPublic(dto)).rejects.toThrow(
      new UnprocessableEntityException(
        'El tipo de solución no existe o no está disponible',
      ),
    );
    expect(repository.create).not.toHaveBeenCalled();
  });

  it('debe rechazar una opción inexistente o inactiva', async () => {
    vi.mocked(catalog.findOption).mockReturnValue(undefined);
    const service = new QuotesService(repository, catalog);

    await expect(service.createPublic(dto)).rejects.toThrow(
      new UnprocessableEntityException(
        'La característica AUTH no existe o no está disponible',
      ),
    );
    expect(repository.create).not.toHaveBeenCalled();
  });

  it('debe rechazar una opción incompatible con la solución', async () => {
    vi.mocked(catalog.findOption).mockReturnValue({
      code: 'AUTH',
      name: 'Autenticación',
      solutionTypes: ['MOBILE_APP'],
      isActive: true,
      displayOrder: 1,
    });
    const service = new QuotesService(repository, catalog);

    await expect(service.createPublic(dto)).rejects.toThrow(
      new UnprocessableEntityException(
        'La característica AUTH no es compatible con WEB_APP',
      ),
    );
    expect(repository.create).not.toHaveBeenCalled();
  });

  it('debe reintentar solamente las colisiones de código', async () => {
    vi.mocked(repository.create)
      .mockRejectedValueOnce(new QuoteCodeCollisionError())
      .mockRejectedValueOnce(new QuoteCodeCollisionError())
      .mockResolvedValueOnce({
        publicCode: 'Q-CCCCCCCC',
        status: QuoteStatus.RECEIVED,
        pricingStatus: QuotePricingStatus.PENDING_RULES,
        amountMinor: null,
        currency: null,
        pricingVersion: null,
        createdAt: new Date('2026-09-16T18:30:00.000Z'),
      });
    const codes = ['Q-AAAAAAAA', 'Q-BBBBBBBB', 'Q-CCCCCCCC'];
    const service = new QuotesService(repository, catalog, undefined, () =>
      codes.shift()!,
    );

    const result = await service.createPublic(dto);

    expect(repository.create).toHaveBeenCalledTimes(3);
    expect(result.code).toBe('Q-CCCCCCCC');
  });

  it('debe responder 503 después de tres colisiones', async () => {
    vi.mocked(repository.create).mockRejectedValue(
      new QuoteCodeCollisionError(),
    );
    const service = new QuotesService(
      repository,
      catalog,
      undefined,
      () => 'Q-AAAAAAAA',
    );

    await expect(service.createPublic(dto)).rejects.toThrow(
      new ServiceUnavailableException(
        'No se pudo generar un código único para la cotización',
      ),
    );
    expect(repository.create).toHaveBeenCalledTimes(3);
  });

  it('no debe reintentar errores que no sean colisiones', async () => {
    vi.mocked(repository.create).mockRejectedValue(new Error('DB unavailable'));
    const service = new QuotesService(repository, catalog);

    await expect(service.createPublic(dto)).rejects.toThrow('DB unavailable');
    expect(repository.create).toHaveBeenCalledTimes(1);
  });

  it('debe persistir un cálculo válido cuando existe PricingEngine', async () => {
    const pricingEngine: PricingEngine = {
      calculate: vi.fn().mockReturnValue({
        amountMinor: 125000,
        currency: 'PEN',
        pricingVersion: 'SP-01-v1',
        items: [
          {
            code: 'BASE',
            label: 'Base',
            amountMinor: 100000,
            displayOrder: 1,
          },
          {
            code: 'AUTH',
            label: 'Autenticación',
            amountMinor: 25000,
            displayOrder: 2,
          },
        ],
      }),
    };
    vi.mocked(repository.create).mockImplementation(async (input) => ({
      publicCode: input.publicCode,
      status: input.status,
      pricingStatus: input.pricingStatus,
      amountMinor: input.amountMinor,
      currency: input.currency,
      pricingVersion: input.pricingVersion,
      createdAt: new Date('2026-09-16T18:30:00.000Z'),
    }));
    const service = new QuotesService(
      repository,
      catalog,
      pricingEngine,
      () => 'Q-AAAAAAAA',
    );

    const result = await service.createPublic({
      ...dto,
      deliveryMode: QuoteDeliveryMode.URGENT,
    });

    expect(pricingEngine.calculate).toHaveBeenCalledWith({
      solutionType: 'WEB_APP',
      optionCodes: ['AUTH', 'REPORTS'],
      deliveryMode: QuoteDeliveryMode.URGENT,
    });
    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        pricingStatus: QuotePricingStatus.CALCULATED,
        amountMinor: 125000,
        currency: 'PEN',
        pricingVersion: 'SP-01-v1',
      }),
    );
    expect(result.pricingStatus).toBe(QuotePricingStatus.CALCULATED);
  });

  it('debe rechazar un desglose cuyo total no coincida', async () => {
    const pricingEngine: PricingEngine = {
      calculate: () => ({
        amountMinor: 100,
        currency: 'PEN',
        pricingVersion: 'SP-01-v1',
        items: [
          { code: 'BASE', label: 'Base', amountMinor: 99, displayOrder: 1 },
        ],
      }),
    };
    const service = new QuotesService(repository, catalog, pricingEngine);

    await expect(service.createPublic(dto)).rejects.toThrow(
      'El desglose del precio no coincide con el total',
    );
    expect(repository.create).not.toHaveBeenCalled();
  });
});

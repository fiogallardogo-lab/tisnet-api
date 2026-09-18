import { Prisma } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { QuotePricingStatus, QuoteStatus } from '../domain/quote.enums.js';
import { PrismaQuoteRepository } from './prisma-quote.repository.js';
import { CreateQuoteRecord, QuoteCodeCollisionError } from './quote.repository.js';

const input: CreateQuoteRecord = {
  publicCode: 'Q-AAAAAAAA',
  status: QuoteStatus.RECEIVED,
  solutionType: 'WEB_APP',
  contactName: 'Ana Torres',
  contactEmail: 'ana@example.com',
  contactPhone: '987654321',
  contactCompany: undefined,
  notes: undefined,
  pricingStatus: QuotePricingStatus.PENDING_RULES,
  amountMinor: null,
  currency: null,
  pricingVersion: null,
  options: [{ code: 'AUTH', name: 'Autenticación', displayOrder: 1 }],
  items: [],
};

describe('PrismaQuoteRepository', () => {
  const tx = {
    quote: {
      create: vi.fn(),
    },
  };
  const prisma = {
    $transaction: vi.fn(),
    quote: {
      findUnique: vi.fn(),
    },
  };
  let repository: PrismaQuoteRepository;

  beforeEach(() => {
    vi.clearAllMocks();
    prisma.$transaction.mockImplementation(async (callback) => callback(tx));
    tx.quote.create.mockResolvedValue({
      publicCode: 'Q-AAAAAAAA',
      status: QuoteStatus.RECEIVED,
      pricingStatus: QuotePricingStatus.PENDING_RULES,
      amountMinor: null,
      currency: null,
      pricingVersion: null,
      createdAt: new Date('2026-09-16T18:30:00.000Z'),
    });
    repository = new PrismaQuoteRepository(prisma as never);
  });

  it('debe crear Quote y opciones dentro de una transacción', async () => {
    const result = await repository.create(input);

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.quote.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        publicCode: 'Q-AAAAAAAA',
        status: QuoteStatus.RECEIVED,
        pricingStatus: QuotePricingStatus.PENDING_RULES,
        options: {
          create: [
            {
              optionCode: 'AUTH',
              optionName: 'Autenticación',
              displayOrder: 1,
            },
          ],
        },
      }),
    });
    expect(result.amountMinor).toBeNull();
  });

  it('debe incluir QuoteItem solo cuando existe un desglose calculado', async () => {
    const calculated = {
      ...input,
      pricingStatus: QuotePricingStatus.CALCULATED,
      amountMinor: 100,
      currency: 'PEN',
      pricingVersion: 'SP-01-v1',
      items: [
        { code: 'BASE', label: 'Base', amountMinor: 100, displayOrder: 1 },
      ],
    };
    tx.quote.create.mockResolvedValue({
      publicCode: 'Q-AAAAAAAA',
      status: QuoteStatus.RECEIVED,
      pricingStatus: QuotePricingStatus.CALCULATED,
      amountMinor: new Prisma.Decimal(100),
      currency: 'PEN',
      pricingVersion: 'SP-01-v1',
      createdAt: new Date('2026-09-16T18:30:00.000Z'),
    });

    await repository.create(calculated);

    expect(tx.quote.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        items: {
          create: [
            {
              itemCode: 'BASE',
              label: 'Base',
              amountMinor: 100,
              displayOrder: 1,
            },
          ],
        },
      }),
    });
  });

  it('debe mapear solo la colisión única de publicCode', async () => {
    tx.quote.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: '6.19.3',
        meta: { target: ['publicCode'] },
      }),
    );

    await expect(repository.create(input)).rejects.toBeInstanceOf(
      QuoteCodeCollisionError,
    );
  });

  it('no debe convertir otras restricciones únicas en colisiones de código', async () => {
    tx.quote.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: '6.19.3',
        meta: { target: ['quoteId', 'optionCode'] },
      }),
    );

    await expect(repository.create(input)).rejects.toThrow(
      'Unique constraint failed',
    );
  });

  describe('findByPublicCode', () => {
    it('devuelve la cotización completa con opciones e ítems ordenados', async () => {
      const now = new Date('2026-09-18T10:00:00Z');
      prisma.quote.findUnique.mockResolvedValue({
        publicCode: 'Q-ABCDEFGH',
        status: QuoteStatus.RECEIVED,
        solutionType: 'WEB_APP',
        contactName: 'Carlos Ruiz',
        contactEmail: 'carlos@example.com',
        contactPhone: '+51999999999',
        contactCompany: 'Empresa SAC',
        notes: 'Notas de requerimiento',
        pricingStatus: QuotePricingStatus.CALCULATED,
        amountMinor: new Prisma.Decimal(250000),
        currency: 'PEN',
        pricingVersion: 'SP-01-v2',
        createdAt: now,
        options: [
          { optionCode: 'OPT1', optionName: 'Diseño UI', displayOrder: 1 },
        ],
        items: [
          { itemCode: 'ITEM1', label: 'Desarrollo Base', amountMinor: new Prisma.Decimal(250000), displayOrder: 1 },
        ],
      });

      const result = await repository.findByPublicCode('q-abcdefgh');

      expect(prisma.quote.findUnique).toHaveBeenCalledWith({
        where: { publicCode: 'Q-ABCDEFGH' },
        include: {
          options: { orderBy: { displayOrder: 'asc' } },
          items: { orderBy: { displayOrder: 'asc' } },
        },
      });

      expect(result).toEqual({
        publicCode: 'Q-ABCDEFGH',
        status: QuoteStatus.RECEIVED,
        solutionType: 'WEB_APP',
        contactName: 'Carlos Ruiz',
        contactEmail: 'carlos@example.com',
        contactPhone: '+51999999999',
        contactCompany: 'Empresa SAC',
        notes: 'Notas de requerimiento',
        pricingStatus: QuotePricingStatus.CALCULATED,
        amountMinor: 250000,
        currency: 'PEN',
        pricingVersion: 'SP-01-v2',
        options: [{ code: 'OPT1', name: 'Diseño UI', displayOrder: 1 }],
        items: [{ code: 'ITEM1', label: 'Desarrollo Base', amountMinor: 250000, displayOrder: 1 }],
        createdAt: now,
      });
    });

    it('devuelve null si no existe la cotización', async () => {
      prisma.quote.findUnique.mockResolvedValue(null);

      const result = await repository.findByPublicCode('Q-INEXISTENTE');
      expect(result).toBeNull();
    });
  });
});

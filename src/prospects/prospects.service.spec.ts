import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import {
  Prisma,
  ProspectSource,
  ProspectStatus,
  QuotePricingStatus,
  QuoteStatus,
} from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { ProspectsService } from './prospects.service.js';

const now = new Date('2026-09-18T12:00:00.000Z');

function makeProspect(overrides: Record<string, unknown> = {}) {
  return {
    id: 7,
    userId: 5,
    name: 'Cliente TISNET',
    email: 'cliente@example.com',
    phone: '+51999999999',
    company: 'Empresa SAC',
    status: ProspectStatus.NEW,
    source: ProspectSource.QUOTE,
    createdAt: now,
    updatedAt: now,
    quotes: [
      {
        publicCode: 'Q-ABCDEFGH',
        solutionType: 'WEB_CORPORATIVA',
        status: QuoteStatus.RECEIVED,
        pricingStatus: QuotePricingStatus.CALCULATED,
        amountMinor: { toNumber: () => 150000 },
        currency: 'PEN',
        createdAt: now,
      },
    ],
    ...overrides,
  };
}

function createService() {
  const tx = {
    quote: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    prospect: {
      findFirst: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  };
  const prisma = {
    $transaction: vi.fn(async (input: unknown) => {
      if (typeof input === 'function') return input(tx);
      if (Array.isArray(input)) return Promise.all(input);
      return input;
    }),
    prospect: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      update: vi.fn(),
    },
    adminProfile: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
  };

  return {
    service: new ProspectsService(prisma as never),
    prisma,
    tx,
  };
}

describe('ProspectsService', () => {
  describe('linkQuote', () => {
    it('vincula una cotización y crea el prospecto con datos confiables de Quote', async () => {
      const { service, tx } = createService();
      const prospect = makeProspect();
      tx.quote.findUnique.mockResolvedValue({
        id: 10,
        publicCode: 'Q-ABCDEFGH',
        contactName: prospect.name,
        contactEmail: 'CLIENTE@EXAMPLE.COM',
        contactPhone: prospect.phone,
        contactCompany: prospect.company,
        prospectId: null,
        prospect: null,
      });
      tx.prospect.findFirst.mockResolvedValue(null);
      tx.prospect.create.mockResolvedValue(prospect);
      tx.prospect.findUniqueOrThrow.mockResolvedValue(prospect);

      const result = await service.linkQuote(
        5,
        'cliente@example.com',
        'q-abcdefgh',
      );

      expect(tx.quote.findUnique).toHaveBeenCalledWith({
        where: { publicCode: 'Q-ABCDEFGH' },
        include: { prospect: true },
      });
      expect(tx.prospect.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 5,
          email: 'cliente@example.com',
          source: ProspectSource.QUOTE,
        }),
      });
      expect(tx.quote.update).toHaveBeenCalledWith({
        where: { id: 10 },
        data: { prospectId: 7 },
      });
      expect(result).toMatchObject({ id: 7, email: 'cliente@example.com' });
    });

    it('reutiliza un prospecto existente perteneciente al mismo usuario', async () => {
      const { service, tx } = createService();
      const existingProspect = makeProspect({ id: 8, userId: 5 });
      tx.quote.findUnique.mockResolvedValue({
        id: 12,
        publicCode: 'Q-ABCDEFGH',
        contactName: 'Nuevo Nombre',
        contactEmail: 'cliente@example.com',
        contactPhone: '+51999999999',
        contactCompany: 'Nueva Empresa',
        prospectId: null,
        prospect: null,
      });
      tx.prospect.findFirst.mockResolvedValue(existingProspect);
      tx.prospect.update.mockResolvedValue(existingProspect);
      tx.prospect.findUniqueOrThrow.mockResolvedValue(existingProspect);

      const result = await service.linkQuote(
        5,
        'cliente@example.com',
        'Q-ABCDEFGH',
      );

      expect(tx.prospect.update).toHaveBeenCalledWith({
        where: { id: 8 },
        data: expect.objectContaining({
          userId: 5,
          name: 'Nuevo Nombre',
        }),
      });
      expect(result.id).toBe(8);
    });

    it('impide vincular una cotización de otro correo', async () => {
      const { service, tx } = createService();
      tx.quote.findUnique.mockResolvedValue({
        contactEmail: 'otra-persona@example.com',
        prospect: null,
      });

      await expect(
        service.linkQuote(5, 'cliente@example.com', 'Q-ABCDEFGH'),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('responde 404 cuando el código no existe', async () => {
      const { service, tx } = createService();
      tx.quote.findUnique.mockResolvedValue(null);

      await expect(
        service.linkQuote(5, 'cliente@example.com', 'Q-ABCDEFGH'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('impide apropiarse de una cotización ya vinculada a otro usuario', async () => {
      const { service, tx } = createService();
      tx.quote.findUnique.mockResolvedValue({
        contactEmail: 'cliente@example.com',
        prospect: { userId: 99 },
      });

      await expect(
        service.linkQuote(5, 'cliente@example.com', 'Q-ABCDEFGH'),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('lanza ConflictException ante colisiones de clave única Prisma P2002', async () => {
      const { service, prisma } = createService();
      prisma.$transaction.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
          code: 'P2002',
          clientVersion: '5.0.0',
        }),
      );

      await expect(
        service.linkQuote(5, 'cliente@example.com', 'Q-ABCDEFGH'),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('findOwn', () => {
    it('devuelve el prospecto propio cuando existe', async () => {
      const { service, prisma } = createService();
      const prospect = makeProspect();
      prisma.prospect.findUnique.mockResolvedValue(prospect);

      const result = await service.findOwn(5);
      expect(result.id).toBe(7);
      expect(result.email).toBe('cliente@example.com');
      expect(result.quotes[0].amountMinor).toBe(150000);
    });

    it('lanza NotFoundException cuando el cliente no tiene prospecto', async () => {
      const { service, prisma } = createService();
      prisma.prospect.findUnique.mockResolvedValue(null);

      await expect(service.findOwn(5)).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('findAll', () => {
    it('devuelve listado paginado y con filtros', async () => {
      const { service, prisma } = createService();
      const prospect = makeProspect();
      prisma.prospect.findMany.mockResolvedValue([prospect]);
      prisma.prospect.count.mockResolvedValue(1);

      const result = await service.findAll({
        page: 1,
        limit: 10,
        search: 'Empresa',
        status: ProspectStatus.NEW,
      });

      expect(result.items).toHaveLength(1);
      expect(result.meta).toEqual({
        page: 1,
        limit: 10,
        totalItems: 1,
        totalPages: 1,
      });
    });
  });

  describe('findOne', () => {
    it('devuelve el detalle de un prospecto por id', async () => {
      const { service, prisma } = createService();
      const prospect = makeProspect();
      prisma.prospect.findUnique.mockResolvedValue(prospect);

      const result = await service.findOne(7);
      expect(result.id).toBe(7);
    });

    it('lanza NotFoundException si el prospecto no existe', async () => {
      const { service, prisma } = createService();
      prisma.prospect.findUnique.mockResolvedValue(null);

      await expect(service.findOne(999)).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('updateStatus', () => {
    it('actualiza el estado comercial de un prospecto existente', async () => {
      const { service, prisma } = createService();
      const updated = makeProspect({ status: ProspectStatus.QUALIFIED });
      prisma.prospect.findUnique.mockResolvedValue({ id: 7 });
      prisma.prospect.update.mockResolvedValue(updated);

      const result = await service.updateStatus(7, ProspectStatus.QUALIFIED);
      expect(result.status).toBe(ProspectStatus.QUALIFIED);
      expect(prisma.prospect.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 7 },
          data: { status: ProspectStatus.QUALIFIED },
        }),
      );
    });

    it('lanza NotFoundException si se intenta actualizar un prospecto inexistente', async () => {
      const { service, prisma } = createService();
      prisma.prospect.findUnique.mockResolvedValue(null);

      await expect(
        service.updateStatus(999, ProspectStatus.QUALIFIED),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('findPublicAdvisors', () => {
    it('publica únicamente asesores marcados y usuarios activos', async () => {
      const { service, prisma } = createService();
      prisma.adminProfile.findMany.mockResolvedValue([
        {
          id: 3,
          executiveTitle: 'Asesor comercial',
          specialty: 'Productos digitales',
          photoUrl: null,
          calendlyUrl: null,
          user: { name: 'Asesora TISNET' },
        },
      ]);

      const result = await service.findPublicAdvisors();

      expect(prisma.adminProfile.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { isPublicAdvisor: true, user: { isActive: true } },
        }),
      );
      expect(result).toEqual([
        expect.objectContaining({ id: 3, name: 'Asesora TISNET' }),
      ]);
    });
  });

  describe('setAdvisorVisibility', () => {
    it('actualiza la visibilidad de un asesor activo', async () => {
      const { service, prisma } = createService();
      prisma.adminProfile.findUnique.mockResolvedValue({
        id: 4,
        user: { isActive: true },
      });
      prisma.adminProfile.update.mockResolvedValue({
        id: 4,
        executiveTitle: 'Gerente Comercial',
        specialty: 'Fintech',
        photoUrl: null,
        calendlyUrl: null,
        isPublicAdvisor: true,
        user: { name: 'Asesor Carlos', isActive: true },
      });

      const result = await service.setAdvisorVisibility(4, true);
      expect(result).toMatchObject({
        id: 4,
        name: 'Asesor Carlos',
        isPublicAdvisor: true,
        isActive: true,
      });
    });

    it('lanza NotFoundException si el perfil no existe', async () => {
      const { service, prisma } = createService();
      prisma.adminProfile.findUnique.mockResolvedValue(null);

      await expect(service.setAdvisorVisibility(999, true)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('lanza ConflictException si el usuario está inactivo y se intenta publicar', async () => {
      const { service, prisma } = createService();
      prisma.adminProfile.findUnique.mockResolvedValue({
        id: 4,
        user: { isActive: false },
      });

      await expect(service.setAdvisorVisibility(4, true)).rejects.toBeInstanceOf(
        ConflictException,
      );
    });
  });
});

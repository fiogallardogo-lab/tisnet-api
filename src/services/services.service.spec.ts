import { ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Test, TestingModule } from '@nestjs/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaService } from '../prisma/prisma.service';
import { ServicesService } from './services.service';

const mockService = {
  id: 1,
  name: 'Desarrollo de software a medida',
  slug: 'desarrollo-de-software-a-medida',
  shortDescription:
    'Creamos soluciones digitales adaptadas a las necesidades de cada organización.',
  description:
    'Servicio orientado al análisis, diseño, desarrollo e implementación de sistemas personalizados.',
  icon: 'Code',
  imageUrl: 'https://example.com/services/software.jpg',
  isActive: true,
  displayOrder: 1,
  isFeatured: true,
  createdAt: new Date('2026-09-10T12:00:00.000Z'),
  updatedAt: new Date('2026-09-10T12:00:00.000Z'),
};

const mockPublicItem = {
  id: 1,
  name: 'Desarrollo de software a medida',
  slug: 'desarrollo-de-software-a-medida',
  shortDescription:
    'Creamos soluciones digitales adaptadas a las necesidades de cada organización.',
  icon: 'Code',
  imageUrl: 'https://example.com/services/software.jpg',
  displayOrder: 1,
  isFeatured: true,
};

const mockPublicDetail = {
  id: 1,
  name: 'Desarrollo de software a medida',
  slug: 'desarrollo-de-software-a-medida',
  shortDescription:
    'Creamos soluciones digitales adaptadas a las necesidades de cada organización.',
  description:
    'Servicio orientado al análisis, diseño, desarrollo e implementación de sistemas personalizados.',
  icon: 'Code',
  imageUrl: 'https://example.com/services/software.jpg',
  displayOrder: 1,
  isFeatured: true,
};

describe('ServicesService', () => {
  let service: ServicesService;

  const prismaMock = {
    service: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
    $transaction: vi.fn(),
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    prismaMock.$transaction.mockImplementation(
      async (operations: Promise<unknown>[]) => Promise.all(operations),
    );

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ServicesService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    service = module.get<ServicesService>(ServicesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ------------------------------------------------------------------ create
  describe('create', () => {
    it('debe crear un servicio correctamente cuando el slug está disponible', async () => {
      prismaMock.service.findFirst.mockResolvedValue(null);
      prismaMock.service.create.mockResolvedValue(mockService);

      const dto = {
        name: mockService.name,
        slug: mockService.slug,
        shortDescription: mockService.shortDescription,
        description: mockService.description,
        icon: mockService.icon,
        imageUrl: mockService.imageUrl,
        displayOrder: mockService.displayOrder,
        isFeatured: mockService.isFeatured,
      };

      const result = await service.create(dto);

      expect(prismaMock.service.findFirst).toHaveBeenCalledWith({
        where: { slug: dto.slug },
        select: { id: true },
      });
      expect(prismaMock.service.create).toHaveBeenCalledWith({
        data: dto,
      });
      expect(result).toEqual(mockService);
    });

    it('debe lanzar ConflictException si el slug ya existe en la verificación previa', async () => {
      prismaMock.service.findFirst.mockResolvedValue({ id: 2 });

      await expect(
        service.create({
          name: mockService.name,
          slug: mockService.slug,
          shortDescription: mockService.shortDescription,
          description: mockService.description,
        }),
      ).rejects.toThrow(new ConflictException('El slug ya está registrado'));

      expect(prismaMock.service.create).not.toHaveBeenCalled();
    });

    it('debe capturar error P2002 de Prisma y lanzar ConflictException', async () => {
      prismaMock.service.findFirst.mockResolvedValue(null);
      prismaMock.service.create.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError(
          'Unique constraint failed on the fields: (`slug`)',
          { code: 'P2002', clientVersion: '6.19.3' },
        ),
      );

      await expect(
        service.create({
          name: mockService.name,
          slug: mockService.slug,
          shortDescription: mockService.shortDescription,
          description: mockService.description,
        }),
      ).rejects.toThrow(new ConflictException('El slug ya está registrado'));
    });
  });

  // ----------------------------------------------------------------- findAll
  describe('findAll', () => {
    it('debe devolver el listado administrativo con paginación y orden por defecto', async () => {
      prismaMock.service.findMany.mockResolvedValue([mockService]);
      prismaMock.service.count.mockResolvedValue(1);

      const result = await service.findAll({ page: 1, limit: 10 });

      expect(prismaMock.service.findMany).toHaveBeenCalledWith({
        where: {},
        orderBy: [{ displayOrder: 'asc' }, { createdAt: 'desc' }],
        skip: 0,
        take: 10,
      });
      expect(prismaMock.service.count).toHaveBeenCalledWith({ where: {} });
      expect(result).toEqual({
        items: [mockService],
        meta: {
          page: 1,
          limit: 10,
          totalItems: 1,
          totalPages: 1,
        },
      });
    });

    it('debe aplicar paginación personalizada (page: 2, limit: 5)', async () => {
      prismaMock.service.findMany.mockResolvedValue([mockService]);
      prismaMock.service.count.mockResolvedValue(12);

      const result = await service.findAll({ page: 2, limit: 5 });

      expect(prismaMock.service.findMany).toHaveBeenCalledWith({
        where: {},
        orderBy: [{ displayOrder: 'asc' }, { createdAt: 'desc' }],
        skip: 5,
        take: 5,
      });
      expect(result.meta).toEqual({
        page: 2,
        limit: 5,
        totalItems: 12,
        totalPages: 3,
      });
    });

    it('debe aplicar filtro search en name, slug y shortDescription', async () => {
      prismaMock.service.findMany.mockResolvedValue([mockService]);
      prismaMock.service.count.mockResolvedValue(1);

      await service.findAll({ page: 1, limit: 10, search: 'software' });

      expect(prismaMock.service.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            OR: [
              { name: { contains: 'software' } },
              { slug: { contains: 'software' } },
              { shortDescription: { contains: 'software' } },
            ],
          },
        }),
      );
    });

    it('debe filtrar correctamente por isActive = true', async () => {
      prismaMock.service.findMany.mockResolvedValue([mockService]);
      prismaMock.service.count.mockResolvedValue(1);

      await service.findAll({ page: 1, limit: 10, isActive: true });

      expect(prismaMock.service.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { isActive: true },
        }),
      );
    });

    it('debe filtrar correctamente por isActive = false', async () => {
      prismaMock.service.findMany.mockResolvedValue([
        { ...mockService, isActive: false },
      ]);
      prismaMock.service.count.mockResolvedValue(1);

      await service.findAll({ page: 1, limit: 10, isActive: false });

      expect(prismaMock.service.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { isActive: false },
        }),
      );
    });

    it('debe filtrar correctamente por isFeatured = true', async () => {
      prismaMock.service.findMany.mockResolvedValue([mockService]);
      prismaMock.service.count.mockResolvedValue(1);

      await service.findAll({ page: 1, limit: 10, isFeatured: true });

      expect(prismaMock.service.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { isFeatured: true },
        }),
      );
    });

    it('debe filtrar correctamente por isFeatured = false', async () => {
      prismaMock.service.findMany.mockResolvedValue([
        { ...mockService, isFeatured: false },
      ]);
      prismaMock.service.count.mockResolvedValue(1);

      await service.findAll({ page: 1, limit: 10, isFeatured: false });

      expect(prismaMock.service.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { isFeatured: false },
        }),
      );
    });
  });

  // ----------------------------------------------------------------- findOne
  describe('findOne', () => {
    it('debe retornar el servicio cuando existe', async () => {
      prismaMock.service.findUnique.mockResolvedValue(mockService);

      const result = await service.findOne(1);

      expect(prismaMock.service.findUnique).toHaveBeenCalledWith({
        where: { id: 1 },
      });
      expect(result).toEqual(mockService);
    });

    it('debe lanzar NotFoundException cuando el servicio no existe', async () => {
      prismaMock.service.findUnique.mockResolvedValue(null);

      await expect(service.findOne(999)).rejects.toThrow(
        new NotFoundException('Servicio no encontrado'),
      );
    });
  });

  // ------------------------------------------------------------------ update
  describe('update', () => {
    it('debe actualizar correctamente los datos sin cambiar el slug', async () => {
      prismaMock.service.findUnique.mockResolvedValue({ id: 1 });
      prismaMock.service.update.mockResolvedValue({
        ...mockService,
        name: 'Nuevo Nombre de Servicio',
      });

      const result = await service.update(1, {
        name: 'Nuevo Nombre de Servicio',
      });

      expect(prismaMock.service.findUnique).toHaveBeenCalledWith({
        where: { id: 1 },
        select: { id: true },
      });
      expect(prismaMock.service.findFirst).not.toHaveBeenCalled();
      expect(prismaMock.service.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { name: 'Nuevo Nombre de Servicio' },
      });
      expect(result.name).toBe('Nuevo Nombre de Servicio');
    });

    it('debe verificar disponibilidad de slug y actualizar cuando el nuevo slug está disponible', async () => {
      prismaMock.service.findUnique.mockResolvedValue({ id: 1 });
      prismaMock.service.findFirst.mockResolvedValue(null);
      prismaMock.service.update.mockResolvedValue({
        ...mockService,
        slug: 'nuevo-slug-disponible',
      });

      const result = await service.update(1, {
        slug: 'nuevo-slug-disponible',
      });

      expect(prismaMock.service.findFirst).toHaveBeenCalledWith({
        where: {
          slug: 'nuevo-slug-disponible',
          id: { not: 1 },
        },
        select: { id: true },
      });
      expect(prismaMock.service.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { slug: 'nuevo-slug-disponible' },
      });
      expect(result.slug).toBe('nuevo-slug-disponible');
    });

    it('debe lanzar ConflictException si el nuevo slug ya está registrado por otro servicio', async () => {
      prismaMock.service.findUnique.mockResolvedValue({ id: 1 });
      prismaMock.service.findFirst.mockResolvedValue({ id: 2 });

      await expect(
        service.update(1, { slug: 'slug-en-uso' }),
      ).rejects.toThrow(new ConflictException('El slug ya está registrado'));

      expect(prismaMock.service.update).not.toHaveBeenCalled();
    });

    it('debe lanzar NotFoundException si el servicio a actualizar no existe', async () => {
      prismaMock.service.findUnique.mockResolvedValue(null);

      await expect(
        service.update(999, { name: 'Servicio Inexistente' }),
      ).rejects.toThrow(new NotFoundException('Servicio no encontrado'));

      expect(prismaMock.service.update).not.toHaveBeenCalled();
    });

    it('debe capturar error P2002 de Prisma y lanzar ConflictException durante update', async () => {
      prismaMock.service.findUnique.mockResolvedValue({ id: 1 });
      prismaMock.service.findFirst.mockResolvedValue(null);
      prismaMock.service.update.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError(
          'Unique constraint failed on the fields: (`slug`)',
          { code: 'P2002', clientVersion: '6.19.3' },
        ),
      );

      await expect(
        service.update(1, { slug: 'slug-en-conflicto' }),
      ).rejects.toThrow(new ConflictException('El slug ya está registrado'));
    });
  });

  // ---------------------------------------------------------------- activate
  describe('activate', () => {
    it('debe activar un servicio existente', async () => {
      prismaMock.service.findUnique.mockResolvedValue({ id: 1 });
      prismaMock.service.update.mockResolvedValue({
        ...mockService,
        isActive: true,
      });

      const result = await service.activate(1);

      expect(prismaMock.service.findUnique).toHaveBeenCalledWith({
        where: { id: 1 },
        select: { id: true },
      });
      expect(prismaMock.service.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { isActive: true },
      });
      expect(result.isActive).toBe(true);
    });

    it('debe responder correctamente de forma idempotente si ya está activo', async () => {
      prismaMock.service.findUnique.mockResolvedValue({ id: 1 });
      prismaMock.service.update.mockResolvedValue({
        ...mockService,
        isActive: true,
      });

      const result = await service.activate(1);

      expect(result.isActive).toBe(true);
    });

    it('debe lanzar NotFoundException si el servicio no existe', async () => {
      prismaMock.service.findUnique.mockResolvedValue(null);

      await expect(service.activate(999)).rejects.toThrow(
        new NotFoundException('Servicio no encontrado'),
      );

      expect(prismaMock.service.update).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------- deactivate
  describe('deactivate', () => {
    it('debe desactivar un servicio existente', async () => {
      prismaMock.service.findUnique.mockResolvedValue({ id: 1 });
      prismaMock.service.update.mockResolvedValue({
        ...mockService,
        isActive: false,
      });

      const result = await service.deactivate(1);

      expect(prismaMock.service.findUnique).toHaveBeenCalledWith({
        where: { id: 1 },
        select: { id: true },
      });
      expect(prismaMock.service.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { isActive: false },
      });
      expect(result.isActive).toBe(false);
    });

    it('debe responder correctamente de forma idempotente si ya está inactivo', async () => {
      prismaMock.service.findUnique.mockResolvedValue({ id: 1 });
      prismaMock.service.update.mockResolvedValue({
        ...mockService,
        isActive: false,
      });

      const result = await service.deactivate(1);

      expect(result.isActive).toBe(false);
    });

    it('debe lanzar NotFoundException si el servicio no existe', async () => {
      prismaMock.service.findUnique.mockResolvedValue(null);

      await expect(service.deactivate(999)).rejects.toThrow(
        new NotFoundException('Servicio no encontrado'),
      );

      expect(prismaMock.service.update).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------- findPublic
  describe('findPublic', () => {
    it('debe forzar siempre el filtro isActive = true y aplicar defaults y orden', async () => {
      prismaMock.service.findMany.mockResolvedValue([mockPublicItem]);
      prismaMock.service.count.mockResolvedValue(1);

      const result = await service.findPublic({ page: 1, limit: 12 });

      expect(prismaMock.service.findMany).toHaveBeenCalledWith({
        where: { isActive: true },
        select: {
          id: true,
          name: true,
          slug: true,
          shortDescription: true,
          icon: true,
          imageUrl: true,
          displayOrder: true,
          isFeatured: true,
        },
        orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }],
        skip: 0,
        take: 12,
      });
      expect(prismaMock.service.count).toHaveBeenCalledWith({
        where: { isActive: true },
      });
      expect(result).toEqual({
        items: [mockPublicItem],
        meta: {
          page: 1,
          limit: 12,
          totalItems: 1,
          totalPages: 1,
        },
      });
    });

    it('debe aplicar filtro search en name y shortDescription manteniendo isActive = true', async () => {
      prismaMock.service.findMany.mockResolvedValue([mockPublicItem]);
      prismaMock.service.count.mockResolvedValue(1);

      await service.findPublic({
        page: 1,
        limit: 12,
        search: 'software',
      });

      expect(prismaMock.service.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            isActive: true,
            OR: [
              { name: { contains: 'software' } },
              { shortDescription: { contains: 'software' } },
            ],
          },
        }),
      );
    });

    it('debe filtrar por isFeatured = true manteniendo isActive = true', async () => {
      prismaMock.service.findMany.mockResolvedValue([mockPublicItem]);
      prismaMock.service.count.mockResolvedValue(1);

      await service.findPublic({
        page: 1,
        limit: 12,
        isFeatured: true,
      });

      expect(prismaMock.service.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            isActive: true,
            isFeatured: true,
          },
        }),
      );
    });

    it('debe filtrar por isFeatured = false manteniendo isActive = true', async () => {
      prismaMock.service.findMany.mockResolvedValue([
        { ...mockPublicItem, isFeatured: false },
      ]);
      prismaMock.service.count.mockResolvedValue(1);

      await service.findPublic({
        page: 1,
        limit: 12,
        isFeatured: false,
      });

      expect(prismaMock.service.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            isActive: true,
            isFeatured: false,
          },
        }),
      );
    });

    it('debe aplicar paginación personalizada en el listado público', async () => {
      prismaMock.service.findMany.mockResolvedValue([mockPublicItem]);
      prismaMock.service.count.mockResolvedValue(25);

      const result = await service.findPublic({ page: 3, limit: 6 });

      expect(prismaMock.service.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 12,
          take: 6,
        }),
      );
      expect(result.meta).toEqual({
        page: 3,
        limit: 6,
        totalItems: 25,
        totalPages: 5,
      });
    });

    it('debe asegurar que el select público excluye campos internos y de auditoría', async () => {
      prismaMock.service.findMany.mockResolvedValue([mockPublicItem]);
      prismaMock.service.count.mockResolvedValue(1);

      await service.findPublic({ page: 1, limit: 12 });

      const callArgs = prismaMock.service.findMany.mock.calls[0][0];
      expect(callArgs.select).toBeDefined();
      expect(callArgs.select.description).toBeUndefined();
      expect(callArgs.select.isActive).toBeUndefined();
      expect(callArgs.select.createdAt).toBeUndefined();
      expect(callArgs.select.updatedAt).toBeUndefined();
    });
  });

  // -------------------------------------------------------- findPublicBySlug
  describe('findPublicBySlug', () => {
    it('debe retornar el detalle público de un servicio activo por su slug', async () => {
      prismaMock.service.findFirst.mockResolvedValue(mockPublicDetail);

      const result = await service.findPublicBySlug(
        'desarrollo-de-software-a-medida',
      );

      expect(prismaMock.service.findFirst).toHaveBeenCalledWith({
        where: {
          slug: 'desarrollo-de-software-a-medida',
          isActive: true,
        },
        select: {
          id: true,
          name: true,
          slug: true,
          shortDescription: true,
          description: true,
          icon: true,
          imageUrl: true,
          displayOrder: true,
          isFeatured: true,
        },
      });
      expect(result).toEqual(mockPublicDetail);
    });

    it('debe lanzar NotFoundException si el slug no existe', async () => {
      prismaMock.service.findFirst.mockResolvedValue(null);

      await expect(
        service.findPublicBySlug('servicio-inexistente'),
      ).rejects.toThrow(new NotFoundException('Servicio no encontrado'));
    });

    it('debe lanzar NotFoundException si el servicio existe pero está inactivo (Prisma devuelve null por isActive: true)', async () => {
      prismaMock.service.findFirst.mockResolvedValue(null);

      await expect(
        service.findPublicBySlug('servicio-inactivo'),
      ).rejects.toThrow(new NotFoundException('Servicio no encontrado'));
    });
  });
});

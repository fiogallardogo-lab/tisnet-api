import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { ProjectStatus } from '@prisma/client';
import { Test, TestingModule } from '@nestjs/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectsService } from './projects.service';

const project = {
  id: 1,
  name: 'Sistema de inventario',
  slug: 'sistema-de-inventario',
  shortDescription: 'Control centralizado de productos.',
  description: 'Descripción pública completa del proyecto.',
  problem: null,
  solution: null,
  objective: null,
  features: ['Control de productos'],
  categoryId: 1,
  status: ProjectStatus.DRAFT,
  developmentDate: new Date('2026-09-04T00:00:00.000Z'),
  clientName: null,
  demoUrl: null,
  externalUrl: null,
  coverImageUrl: null,
  isFeatured: false,
  isPublished: false,
  displayOrder: 0,
  createdAt: new Date('2026-09-04T17:00:00.000Z'),
  updatedAt: new Date('2026-09-04T17:00:00.000Z'),
  category: { id: 1, name: 'Logística', isActive: true },
  technologies: [
    { technology: { id: 1, name: 'React', icon: 'react.svg' } },
  ],
};

describe('ProjectsService', () => {
  let service: ProjectsService;

  const prismaMock = {
    project: {
      create: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      update: vi.fn(),
    },
    category: {
      findFirst: vi.fn(),
    },
    technology: {
      findMany: vi.fn(),
    },
    $transaction: vi.fn(),
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    prismaMock.$transaction.mockImplementation(async (operations: Promise<unknown>[]) =>
      Promise.all(operations),
    );

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProjectsService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    service = module.get(ProjectsService);
  });

  describe('create', () => {
    it('debe crear un proyecto con categoría y tecnologías activas', async () => {
      prismaMock.project.findFirst.mockResolvedValue(null);
      prismaMock.category.findFirst.mockResolvedValue({ id: 1 });
      prismaMock.technology.findMany.mockResolvedValue([{ id: 1 }]);
      prismaMock.project.create.mockResolvedValue(project);

      const result = await service.create({
        name: project.name,
        slug: project.slug,
        shortDescription: project.shortDescription,
        description: project.description,
        categoryId: 1,
        technologyIds: [1],
      });

      expect(result.technologies).toEqual([
        { id: 1, name: 'React', icon: 'react.svg' },
      ]);
      expect(prismaMock.project.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.not.objectContaining({ isPublished: expect.anything() }),
        }),
      );
    });

    it('debe rechazar un slug duplicado', async () => {
      prismaMock.project.findFirst.mockResolvedValue({ id: 2 });

      await expect(
        service.create({
          name: project.name,
          slug: project.slug,
          shortDescription: project.shortDescription,
          description: project.description,
          categoryId: 1,
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('debe rechazar una categoría inexistente o inactiva', async () => {
      prismaMock.project.findFirst.mockResolvedValue(null);
      prismaMock.category.findFirst.mockResolvedValue(null);

      await expect(
        service.create({
          name: project.name,
          slug: project.slug,
          shortDescription: project.shortDescription,
          description: project.description,
          categoryId: 99,
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('findAll', () => {
    it('debe devolver el listado administrativo paginado', async () => {
      prismaMock.project.findMany.mockResolvedValue([project]);
      prismaMock.project.count.mockResolvedValue(1);

      const result = await service.findAll({ page: 1, limit: 10 });

      expect(result.meta).toEqual({
        page: 1,
        limit: 10,
        totalItems: 1,
        totalPages: 1,
      });
      expect(result.items).toHaveLength(1);
    });
  });

  describe('findOne', () => {
    it('debe responder 404 cuando el proyecto administrativo no existe', async () => {
      prismaMock.project.findUnique.mockResolvedValue(null);

      await expect(service.findOne(999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('debe reemplazar las tecnologías durante una edición', async () => {
      prismaMock.project.findUnique.mockResolvedValue({ id: 1 });
      prismaMock.technology.findMany.mockResolvedValue([{ id: 2 }]);
      prismaMock.project.update.mockResolvedValue({
        ...project,
        technologies: [{ technology: { id: 2, name: 'NestJS', icon: null } }],
      });

      await service.update(1, { technologyIds: [2] });

      expect(prismaMock.project.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            technologies: {
              deleteMany: {},
              create: [{ technologyId: 2 }],
            },
          }),
        }),
      );
    });

    it('debe rechazar actualización si technologyIds contiene IDs inexistentes', async () => {
      prismaMock.project.findUnique.mockResolvedValue({ id: 1 });
      prismaMock.technology.findMany.mockResolvedValue([]);

      await expect(
        service.update(1, { technologyIds: [99] }),
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.update(1, { technologyIds: [99] }),
      ).rejects.toThrow('Una o más tecnologías no existen o están inactivas');
    });

    it('debe rechazar actualización si technologyIds contiene tecnologías inactivas', async () => {
      prismaMock.project.findUnique.mockResolvedValue({ id: 1 });
      // Solo 1 activa encontrada para [1, 2]
      prismaMock.technology.findMany.mockResolvedValue([{ id: 1 }]);

      await expect(
        service.update(1, { technologyIds: [1, 2] }),
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.update(1, { technologyIds: [1, 2] }),
      ).rejects.toThrow('Una o más tecnologías no existen o están inactivas');
    });

    it('debe rechazar actualización si el nuevo slug pertenece a otro proyecto', async () => {
      prismaMock.project.findUnique.mockResolvedValue({ id: 1 });
      prismaMock.project.findFirst.mockResolvedValue({ id: 2 });

      await expect(
        service.update(1, { slug: 'slug-perteneciente-a-otro' }),
      ).rejects.toThrow(ConflictException);

      await expect(
        service.update(1, { slug: 'slug-perteneciente-a-otro' }),
      ).rejects.toThrow('El slug ya está registrado');
    });
  });

  describe('publish', () => {
    it('debe impedir publicar un proyecto archivado', async () => {
      prismaMock.project.findUnique.mockResolvedValue({
        ...project,
        status: ProjectStatus.ARCHIVED,
        category: { ...project.category, isActive: true },
      });

      await expect(service.publish(1)).rejects.toThrow(BadRequestException);
      await expect(service.publish(1)).rejects.toThrow('Un proyecto archivado no puede publicarse');
      expect(prismaMock.project.update).not.toHaveBeenCalled();
    });

    it('debe rechazar publicación si name contiene solo espacios en blanco', async () => {
      prismaMock.project.findUnique.mockResolvedValue({
        ...project,
        name: '   ',
        category: { ...project.category, isActive: true },
      });

      await expect(service.publish(1)).rejects.toThrow(BadRequestException);
      await expect(service.publish(1)).rejects.toThrow(
        'El proyecto no contiene la información mínima para publicarse',
      );
      expect(prismaMock.project.update).not.toHaveBeenCalled();
    });

    it('debe rechazar publicación si slug contiene solo espacios en blanco', async () => {
      prismaMock.project.findUnique.mockResolvedValue({
        ...project,
        slug: '   ',
        category: { ...project.category, isActive: true },
      });

      await expect(service.publish(1)).rejects.toThrow(BadRequestException);
      await expect(service.publish(1)).rejects.toThrow(
        'El proyecto no contiene la información mínima para publicarse',
      );
      expect(prismaMock.project.update).not.toHaveBeenCalled();
    });

    it('debe rechazar publicación si shortDescription contiene solo espacios en blanco', async () => {
      prismaMock.project.findUnique.mockResolvedValue({
        ...project,
        shortDescription: '   ',
        category: { ...project.category, isActive: true },
      });

      await expect(service.publish(1)).rejects.toThrow(BadRequestException);
      await expect(service.publish(1)).rejects.toThrow(
        'El proyecto no contiene la información mínima para publicarse',
      );
      expect(prismaMock.project.update).not.toHaveBeenCalled();
    });

    it('debe rechazar publicación si description contiene solo espacios en blanco', async () => {
      prismaMock.project.findUnique.mockResolvedValue({
        ...project,
        description: '   ',
        category: { ...project.category, isActive: true },
      });

      await expect(service.publish(1)).rejects.toThrow(BadRequestException);
      await expect(service.publish(1)).rejects.toThrow(
        'El proyecto no contiene la información mínima para publicarse',
      );
      expect(prismaMock.project.update).not.toHaveBeenCalled();
    });

    it('debe rechazar publicación si la categoría asociada está inactiva', async () => {
      prismaMock.project.findUnique.mockResolvedValue({
        ...project,
        category: { ...project.category, isActive: false },
      });

      await expect(service.publish(1)).rejects.toThrow(BadRequestException);
      await expect(service.publish(1)).rejects.toThrow('La categoría del proyecto está inactiva');
      expect(prismaMock.project.update).not.toHaveBeenCalled();
    });

    it('debe permitir publicar de manera idempotente un proyecto ya publicado sin error', async () => {
      prismaMock.project.findUnique.mockResolvedValue({
        ...project,
        isPublished: true,
        category: { ...project.category, isActive: true },
      });
      prismaMock.project.update.mockResolvedValue({
        ...project,
        isPublished: true,
      });

      const result = await service.publish(1);

      expect(result.isPublished).toBe(true);
      expect(prismaMock.project.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 1 },
          data: { isPublished: true },
        }),
      );
    });
  });

  describe('unpublish', () => {
    it('debe permitir despublicar de manera idempotente un proyecto ya despublicado sin error', async () => {
      prismaMock.project.findUnique.mockResolvedValue({ id: 1 });
      prismaMock.project.update.mockResolvedValue({
        ...project,
        isPublished: false,
      });

      const result = await service.unpublish(1);

      expect(result.isPublished).toBe(false);
      expect(prismaMock.project.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 1 },
          data: { isPublished: false },
        }),
      );
    });
  });

  describe('archive', () => {
    it('debe archivar sin eliminar físicamente el proyecto', async () => {
      prismaMock.project.findUnique.mockResolvedValue({ id: 1 });
      prismaMock.project.update.mockResolvedValue({
        ...project,
        status: ProjectStatus.ARCHIVED,
        isPublished: false,
      });

      const result = await service.archive(1);

      expect(result.status).toBe(ProjectStatus.ARCHIVED);
      expect(result.isPublished).toBe(false);
      expect(prismaMock.project.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { status: ProjectStatus.ARCHIVED, isPublished: false },
        }),
      );
    });
  });

  describe('findPublic', () => {
    it('debe forzar el filtro de publicados y no archivados en el listado público', async () => {
      prismaMock.project.findMany.mockResolvedValue([{ ...project, isPublished: true }]);
      prismaMock.project.count.mockResolvedValue(1);

      const result = await service.findPublic({ page: 1, limit: 12 });

      expect(result.items[0]).not.toHaveProperty('clientName');
      expect(result.items[0]).not.toHaveProperty('isPublished');
      expect(prismaMock.project.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            isPublished: true,
            status: { not: ProjectStatus.ARCHIVED },
          }),
        }),
      );
    });

    it('debe aplicar filtro por technologyId en el listado público manteniendo publicados y no archivados', async () => {
      prismaMock.project.findMany.mockResolvedValue([{ ...project, isPublished: true }]);
      prismaMock.project.count.mockResolvedValue(1);

      await service.findPublic({ page: 1, limit: 12, technologyId: 5 });

      expect(prismaMock.project.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            isPublished: true,
            status: { not: ProjectStatus.ARCHIVED },
            technologies: { some: { technologyId: 5 } },
          }),
        }),
      );
    });

    it('debe aplicar filtro por isFeatured en el listado público manteniendo publicados y no archivados', async () => {
      prismaMock.project.findMany.mockResolvedValue([{ ...project, isPublished: true, isFeatured: true }]);
      prismaMock.project.count.mockResolvedValue(1);

      await service.findPublic({ page: 1, limit: 12, isFeatured: true });

      expect(prismaMock.project.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            isPublished: true,
            status: { not: ProjectStatus.ARCHIVED },
            isFeatured: true,
          }),
        }),
      );
    });
  });

  describe('findPublicBySlug', () => {
    it('debe responder 404 si el slug no corresponde a un proyecto público', async () => {
      prismaMock.project.findFirst.mockResolvedValue(null);

      await expect(service.findPublicBySlug('no-publicado')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});

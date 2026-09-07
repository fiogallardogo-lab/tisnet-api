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
  category: { id: 1, name: 'Logística' },
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

  it('debe responder 404 cuando el proyecto administrativo no existe', async () => {
    prismaMock.project.findUnique.mockResolvedValue(null);

    await expect(service.findOne(999)).rejects.toThrow(NotFoundException);
  });

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

  it('debe impedir publicar un proyecto archivado', async () => {
    prismaMock.project.findUnique.mockResolvedValue({
      ...project,
      status: ProjectStatus.ARCHIVED,
      category: { ...project.category, isActive: true },
    });

    await expect(service.publish(1)).rejects.toThrow(BadRequestException);
    expect(prismaMock.project.update).not.toHaveBeenCalled();
  });

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

  it('debe responder 404 si el slug no corresponde a un proyecto público', async () => {
    prismaMock.project.findFirst.mockResolvedValue(null);

    await expect(service.findPublicBySlug('no-publicado')).rejects.toThrow(
      NotFoundException,
    );
  });
});

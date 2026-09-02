import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';

import { TechnologiesService } from './technologies.service';
import { PrismaService } from '../prisma/prisma.service';

describe('TechnologiesService', () => {
    let service: TechnologiesService;

    const mockTechnology = {
        id: 1,
        name: 'TypeScript',
        description: 'Typed superset of JavaScript',
        icon: 'typescript.svg',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
    };

    const prismaServiceMock = {
        technology: {
            findUnique: vi.fn(),
            findMany: vi.fn(),
            create: vi.fn(),
            update: vi.fn(),
        },
    };

    beforeEach(async () => {
        vi.clearAllMocks();

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                TechnologiesService,
                {
                    provide: PrismaService,
                    useValue: prismaServiceMock,
                },
            ],
        }).compile();

        service = module.get<TechnologiesService>(TechnologiesService);
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    // ------------------------------------------------------------------ create
    describe('create()', () => {
        it('debe crear una tecnología cuando el nombre no existe', async () => {
            prismaServiceMock.technology.findUnique.mockResolvedValue(null);
            prismaServiceMock.technology.create.mockResolvedValue(mockTechnology);

            const result = await service.create({
                name: 'TypeScript',
                description: 'Typed superset of JavaScript',
                icon: 'typescript.svg',
            });

            expect(result).toEqual(mockTechnology);
            expect(prismaServiceMock.technology.create).toHaveBeenCalledOnce();
        });

        it('debe lanzar ConflictException si el nombre ya existe', async () => {
            prismaServiceMock.technology.findUnique.mockResolvedValue(mockTechnology);

            await expect(
                service.create({ name: 'TypeScript' }),
            ).rejects.toThrow(ConflictException);

            expect(prismaServiceMock.technology.create).not.toHaveBeenCalled();
        });
    });

    // ---------------------------------------------------------------- findAll
    describe('findAll()', () => {
        it('debe retornar un array de tecnologías', async () => {
            prismaServiceMock.technology.findMany.mockResolvedValue([mockTechnology]);

            const result = await service.findAll();

            expect(result).toEqual([mockTechnology]);
            expect(prismaServiceMock.technology.findMany).toHaveBeenCalledOnce();
        });

        it('debe retornar un array vacío si no hay tecnologías', async () => {
            prismaServiceMock.technology.findMany.mockResolvedValue([]);

            const result = await service.findAll();

            expect(result).toEqual([]);
        });
    });

    // --------------------------------------------------------------- findOne
    describe('findOne()', () => {
        it('debe retornar una tecnología por id', async () => {
            prismaServiceMock.technology.findUnique.mockResolvedValue(mockTechnology);

            const result = await service.findOne(1);

            expect(result).toEqual(mockTechnology);
        });

        it('debe lanzar NotFoundException si la tecnología no existe', async () => {
            prismaServiceMock.technology.findUnique.mockResolvedValue(null);

            await expect(service.findOne(999)).rejects.toThrow(NotFoundException);
        });
    });

    // ----------------------------------------------------------------- update
    describe('update()', () => {
        it('debe actualizar una tecnología existente', async () => {
            const updated = { ...mockTechnology, description: 'Updated' };

            prismaServiceMock.technology.findUnique.mockResolvedValueOnce(mockTechnology); // findOne
            prismaServiceMock.technology.update.mockResolvedValue(updated);

            const result = await service.update(1, { description: 'Updated' });

            expect(result).toEqual(updated);
            expect(prismaServiceMock.technology.update).toHaveBeenCalledOnce();
        });

        it('debe lanzar NotFoundException si la tecnología no existe', async () => {
            prismaServiceMock.technology.findUnique.mockResolvedValue(null);

            await expect(
                service.update(999, { description: 'X' }),
            ).rejects.toThrow(NotFoundException);

            expect(prismaServiceMock.technology.update).not.toHaveBeenCalled();
        });

        it('debe lanzar ConflictException si el nuevo nombre ya pertenece a otra tecnología', async () => {
            const other = { ...mockTechnology, id: 2, name: 'JavaScript' };

            prismaServiceMock.technology.findUnique
                .mockResolvedValueOnce(mockTechnology) // findOne(id=1) → exists
                .mockResolvedValueOnce(other);          // findUnique(name) → belongs to id=2

            await expect(
                service.update(1, { name: 'JavaScript' }),
            ).rejects.toThrow(ConflictException);

            expect(prismaServiceMock.technology.update).not.toHaveBeenCalled();
        });

        it('debe permitir actualizar el nombre por el mismo registro', async () => {
            const sameRecord = { ...mockTechnology }; // mismo id

            prismaServiceMock.technology.findUnique
                .mockResolvedValueOnce(mockTechnology) // findOne(id=1)
                .mockResolvedValueOnce(sameRecord);    // findUnique(name) → same id

            prismaServiceMock.technology.update.mockResolvedValue(mockTechnology);

            const result = await service.update(1, { name: 'TypeScript' });

            expect(result).toEqual(mockTechnology);
            expect(prismaServiceMock.technology.update).toHaveBeenCalledOnce();
        });
    });
});

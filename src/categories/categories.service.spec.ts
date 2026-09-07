import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';

import { CategoriesService } from './categories.service';
import { PrismaService } from '../prisma/prisma.service';

describe('CategoriesService', () => {
    let service: CategoriesService;

    const prismaServiceMock = {
        category: {
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
                CategoriesService,
                {
                    provide: PrismaService,
                    useValue: prismaServiceMock,
                },
            ],
        }).compile();

        service = module.get<CategoriesService>(CategoriesService);
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    describe('findAll()', () => {
        it('debe listar todas las categorías cuando no recibe filtro', async () => {
            prismaServiceMock.category.findMany.mockResolvedValue([]);

            await service.findAll();

            expect(prismaServiceMock.category.findMany).toHaveBeenCalledWith({
                orderBy: { name: 'asc' },
            });
        });

        it('debe listar únicamente categorías activas cuando isActive es true', async () => {
            prismaServiceMock.category.findMany.mockResolvedValue([]);

            await service.findAll(true);

            expect(prismaServiceMock.category.findMany).toHaveBeenCalledWith({
                where: { isActive: true },
                orderBy: { name: 'asc' },
            });
        });
    });
});

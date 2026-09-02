import {
    ConflictException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

@Injectable()
export class CategoriesService {
    constructor(private readonly prisma: PrismaService) { }

    async create(createCategoryDto: CreateCategoryDto) {
        const existingCategory = await this.prisma.category.findUnique({
            where: {
                name: createCategoryDto.name,
            },
        });

        if (existingCategory) {
            throw new ConflictException('La categoría ya existe');
        }

        return this.prisma.category.create({
            data: createCategoryDto,
        });
    }

    async findAll() {
        return this.prisma.category.findMany({
            orderBy: {
                name: 'asc',
            },
        });
    }

    async findOne(id: number) {
        const category = await this.prisma.category.findUnique({
            where: { id },
        });

        if (!category) {
            throw new NotFoundException('Categoría no encontrada');
        }

        return category;
    }

    async update(id: number, updateCategoryDto: UpdateCategoryDto) {
        await this.findOne(id);

        if (updateCategoryDto.name) {
            const categoryWithSameName = await this.prisma.category.findUnique({
                where: {
                    name: updateCategoryDto.name,
                },
            });

            if (categoryWithSameName && categoryWithSameName.id !== id) {
                throw new ConflictException('La categoría ya existe');
            }
        }

        return this.prisma.category.update({
            where: { id },
            data: updateCategoryDto,
        });
    }
}
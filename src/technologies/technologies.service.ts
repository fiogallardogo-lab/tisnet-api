import {
    ConflictException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import { CreateTechnologyDto } from './dto/create-technology.dto';
import { UpdateTechnologyDto } from './dto/update-technology.dto';

@Injectable()
export class TechnologiesService {
    constructor(private readonly prisma: PrismaService) { }

    async create(createTechnologyDto: CreateTechnologyDto) {
        const existingTechnology = await this.prisma.technology.findUnique({
            where: {
                name: createTechnologyDto.name,
            },
        });

        if (existingTechnology) {
            throw new ConflictException('La tecnología ya existe');
        }

        return this.prisma.technology.create({
            data: createTechnologyDto,
        });
    }

    async findAll() {
        return this.prisma.technology.findMany({
            orderBy: {
                name: 'asc',
            },
        });
    }

    async findOne(id: number) {
        const technology = await this.prisma.technology.findUnique({
            where: { id },
        });

        if (!technology) {
            throw new NotFoundException('Tecnología no encontrada');
        }

        return technology;
    }

    async update(id: number, updateTechnologyDto: UpdateTechnologyDto) {
        await this.findOne(id);

        if (updateTechnologyDto.name) {
            const technologyWithSameName = await this.prisma.technology.findUnique({
                where: {
                    name: updateTechnologyDto.name,
                },
            });

            if (technologyWithSameName && technologyWithSameName.id !== id) {
                throw new ConflictException('La tecnología ya existe');
            }
        }

        return this.prisma.technology.update({
            where: { id },
            data: updateTechnologyDto,
        });
    }
}

import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateServiceDto } from './dto/create-service.dto';
import { ListServicesQueryDto } from './dto/list-services-query.dto';
import { UpdateServiceDto } from './dto/update-service.dto';

@Injectable()
export class ServicesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateServiceDto) {
    await this.ensureSlugAvailable(dto.slug);

    try {
      return await this.prisma.service.create({
        data: dto,
      });
    } catch (error) {
      this.handleUniqueSlugError(error);
      throw error;
    }
  }

  async findAll(query: ListServicesQueryDto) {
    const { page = 1, limit = 10, search, isActive, isFeatured } = query;
    const where: Prisma.ServiceWhereInput = {
      ...(search
        ? {
            OR: [
              { name: { contains: search } },
              { slug: { contains: search } },
              { shortDescription: { contains: search } },
            ],
          }
        : {}),
      ...(isActive === undefined ? {} : { isActive }),
      ...(isFeatured === undefined ? {} : { isFeatured }),
    };

    const [services, totalItems] = await this.prisma.$transaction([
      this.prisma.service.findMany({
        where,
        orderBy: [{ displayOrder: 'asc' }, { createdAt: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.service.count({ where }),
    ]);

    return {
      items: services,
      meta: {
        page,
        limit,
        totalItems,
        totalPages: Math.ceil(totalItems / limit),
      },
    };
  }

  async findOne(id: number) {
    const service = await this.prisma.service.findUnique({
      where: { id },
    });

    if (!service) {
      throw new NotFoundException('Servicio no encontrado');
    }

    return service;
  }

  async update(id: number, dto: UpdateServiceDto) {
    await this.ensureServiceExists(id);

    if (dto.slug !== undefined) {
      await this.ensureSlugAvailable(dto.slug, id);
    }

    try {
      return await this.prisma.service.update({
        where: { id },
        data: dto,
      });
    } catch (error) {
      this.handleUniqueSlugError(error);
      throw error;
    }
  }

  async activate(id: number) {
    await this.ensureServiceExists(id);

    return this.prisma.service.update({
      where: { id },
      data: { isActive: true },
    });
  }

  async deactivate(id: number) {
    await this.ensureServiceExists(id);

    return this.prisma.service.update({
      where: { id },
      data: { isActive: false },
    });
  }

  private async ensureServiceExists(id: number): Promise<void> {
    const service = await this.prisma.service.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!service) {
      throw new NotFoundException('Servicio no encontrado');
    }
  }

  private async ensureSlugAvailable(
    slug: string,
    excludedId?: number,
  ): Promise<void> {
    const service = await this.prisma.service.findFirst({
      where: {
        slug,
        ...(excludedId === undefined ? {} : { id: { not: excludedId } }),
      },
      select: { id: true },
    });

    if (service) {
      throw new ConflictException('El slug ya está registrado');
    }
  }

  private handleUniqueSlugError(error: unknown): void {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new ConflictException('El slug ya está registrado');
    }
  }
}

import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, QuotePricingStatus, type Quote } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class AdminQuotesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: {
    page?: number;
    limit?: number;
    search?: string;
    status?: string;
  }) {
    if (
      [query.page, query.limit].some(
        (v) =>
          v !== undefined &&
          (!Number.isSafeInteger(Number(v)) || Number(v) < 1),
      )
    )
      throw new BadRequestException('Paginación inválida');
    const page = Math.max(1, Math.floor(Number(query.page) || 1));
    const limit = Math.min(
      100,
      Math.max(1, Math.floor(Number(query.limit) || 20)),
    );
    const search = query.search?.trim();
    if (
      query.status &&
      !Object.values(QuotePricingStatus).includes(
        query.status as QuotePricingStatus,
      )
    )
      throw new BadRequestException('Estado inválido');
    const where: Prisma.QuoteWhereInput = {
      ...(query.status
        ? { pricingStatus: query.status as QuotePricingStatus }
        : {}),
      ...(search
        ? {
            OR: [
              { publicCode: { contains: search } },
              { contactName: { contains: search } },
              { contactEmail: { contains: search } },
              { contactCompany: { contains: search } },
            ],
          }
        : {}),
    };
    const [items, totalItems] = await this.prisma.$transaction([
      this.prisma.quote.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.quote.count({ where }),
    ]);
    return {
      items: items.map((item) => this.map(item)),
      meta: {
        page,
        limit,
        totalItems,
        totalPages: Math.ceil(totalItems / limit),
      },
    };
  }

  async findOne(id: number) {
    const item = await this.prisma.quote.findUnique({ where: { id } });
    if (!item) throw new NotFoundException('Cotización no encontrada');
    return this.map(item);
  }

  private map(item: Quote) {
    return {
      id: item.id,
      publicCode: item.publicCode,
      fullName: item.contactName ?? null,
      email: item.contactEmail ?? null,
      phone: item.contactPhone ?? null,
      company: item.contactCompany ?? null,
      service: item.solutionType,
      deliveryMode: item.deliveryMode,
      estimatedAmount:
        item.amountMinor == null ? null : Number(item.amountMinor),
      currency: item.currency,
      status: item.pricingStatus,
      pricingStatus: item.pricingStatus,
      createdAt: item.createdAt,
      notes: item.notes,
      selections: item.snapshot,
    };
  }
}

import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
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
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
    const search = query.search?.trim();
    const where: Prisma.PublicQuoteWhereInput = {
      ...(query.status ? { pricingStatus: query.status } : {}),
      ...(search
        ? {
            OR: [
              { code: { contains: search } },
              { contact: { path: '$.fullName', string_contains: search } },
              { contact: { path: '$.email', string_contains: search } },
              { contact: { path: '$.company', string_contains: search } },
            ],
          }
        : {}),
    };
    const [items, totalItems] = await this.prisma.$transaction([
      this.prisma.publicQuote.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.publicQuote.count({ where }),
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
    const item = await this.prisma.publicQuote.findUnique({ where: { id } });
    if (!item) throw new NotFoundException('Cotización no encontrada');
    return this.map(item);
  }

  private map(item: any) {
    const contact =
      typeof item.contact === 'object' && item.contact ? item.contact : {};
    return {
      id: item.id,
      publicCode: item.code,
      fullName: contact.fullName ?? null,
      email: contact.email ?? null,
      phone: contact.phone ?? null,
      company: contact.company ?? null,
      service: item.solutionType,
      deliveryMode: item.deliveryMode,
      estimatedAmount: item.amountMinor,
      currency: item.currency,
      status: item.pricingStatus,
      pricingStatus: item.pricingStatus,
      createdAt: item.createdAt,
      notes: item.notes,
      selections: item.snapshot,
    };
  }
}

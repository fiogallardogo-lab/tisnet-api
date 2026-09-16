import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { QuotePricingStatus, QuoteStatus } from '../domain/quote.enums';
import {
  CreateQuoteRecord,
  CreatedQuoteRecord,
  QuoteCodeCollisionError,
  QuoteRepository,
} from './quote.repository';

function isPublicCodeCollision(error: unknown): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) return false;
  if (error.code !== 'P2002') return false;

  const target = error.meta?.target;
  if (Array.isArray(target)) return target.includes('publicCode');
  return typeof target === 'string' && target.includes('publicCode');
}

function decimalToSafeInteger(value: Prisma.Decimal | null): number | null {
  if (value === null) return null;
  const numberValue = value.toNumber();
  if (!Number.isSafeInteger(numberValue)) {
    throw new Error('El importe persistido está fuera del rango seguro');
  }
  return numberValue;
}

function toDomainStatus(value: string): QuoteStatus {
  if (value === QuoteStatus.RECEIVED) return QuoteStatus.RECEIVED;
  throw new Error(`Estado de Quote no soportado: ${value}`);
}

function toDomainPricingStatus(value: string): QuotePricingStatus {
  if (value === QuotePricingStatus.PENDING_RULES)
    return QuotePricingStatus.PENDING_RULES;
  if (value === QuotePricingStatus.CALCULATED)
    return QuotePricingStatus.CALCULATED;
  throw new Error(`Estado de pricing no soportado: ${value}`);
}

@Injectable()
export class PrismaQuoteRepository implements QuoteRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: CreateQuoteRecord): Promise<CreatedQuoteRecord> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const quote = await tx.quote.create({
          data: {
            publicCode: input.publicCode,
            status: input.status,
            solutionType: input.solutionType,
            contactName: input.contactName,
            contactEmail: input.contactEmail,
            contactPhone: input.contactPhone,
            contactCompany: input.contactCompany,
            notes: input.notes,
            pricingStatus: input.pricingStatus,
            amountMinor: input.amountMinor,
            currency: input.currency,
            pricingVersion: input.pricingVersion,
            options: {
              create: input.options.map((option) => ({
                optionCode: option.code,
                optionName: option.name,
                displayOrder: option.displayOrder,
              })),
            },
            ...(input.items.length > 0
              ? {
                  items: {
                    create: input.items.map((item) => ({
                      itemCode: item.code,
                      label: item.label,
                      amountMinor: item.amountMinor,
                      displayOrder: item.displayOrder,
                    })),
                  },
                }
              : {}),
          },
        });

        return {
          publicCode: quote.publicCode,
          status: toDomainStatus(quote.status),
          pricingStatus: toDomainPricingStatus(quote.pricingStatus),
          amountMinor: decimalToSafeInteger(quote.amountMinor),
          currency: quote.currency,
          pricingVersion: quote.pricingVersion,
          createdAt: quote.createdAt,
        };
      });
    } catch (error) {
      if (isPublicCodeCollision(error)) {
        throw new QuoteCodeCollisionError();
      }
      throw error;
    }
  }
}

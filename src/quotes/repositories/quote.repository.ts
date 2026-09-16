import { QuotePricingStatus, QuoteStatus } from '../domain/quote.enums';

export const QUOTE_REPOSITORY = Symbol('QUOTE_REPOSITORY');

export interface CreateQuoteOptionRecord {
  code: string;
  name: string;
  displayOrder: number;
}

export interface CreateQuoteItemRecord {
  code: string;
  label: string;
  amountMinor: number;
  displayOrder: number;
}

export interface CreateQuoteRecord {
  publicCode: string;
  status: QuoteStatus;
  solutionType: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  contactCompany?: string;
  notes?: string;
  pricingStatus: QuotePricingStatus;
  amountMinor: number | null;
  currency: string | null;
  pricingVersion: string | null;
  options: CreateQuoteOptionRecord[];
  items: CreateQuoteItemRecord[];
}

export interface CreatedQuoteRecord {
  publicCode: string;
  status: QuoteStatus;
  pricingStatus: QuotePricingStatus;
  amountMinor: number | null;
  currency: string | null;
  pricingVersion: string | null;
  createdAt: Date;
}

export interface QuoteRepository {
  /** Crea Quote, QuoteOption[] y QuoteItem[] en una única transacción. */
  create(input: CreateQuoteRecord): Promise<CreatedQuoteRecord>;
}

export class QuoteCodeCollisionError extends Error {
  constructor() {
    super('El código público de cotización ya existe');
    this.name = 'QuoteCodeCollisionError';
  }
}

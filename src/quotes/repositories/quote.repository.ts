import { QuotePricingStatus, QuoteStatus } from '../domain/quote.enums.js';

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

export interface QuoteDetailRecord {
  publicCode: string;
  status: QuoteStatus;
  solutionType: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  contactCompany: string | null;
  notes: string | null;
  pricingStatus: QuotePricingStatus;
  amountMinor: number | null;
  currency: string | null;
  pricingVersion: string | null;
  options: {
    code: string;
    name: string;
    displayOrder: number;
  }[];
  items: {
    code: string;
    label: string;
    amountMinor: number;
    displayOrder: number;
  }[];
  createdAt: Date;
}

export interface QuoteRepository {
  /** Crea Quote, QuoteOption[] y QuoteItem[] en una única transacción. */
  create(input: CreateQuoteRecord): Promise<CreatedQuoteRecord>;
  /** Busca una Quote completa por su publicCode */
  findByPublicCode(publicCode: string): Promise<QuoteDetailRecord | null>;
}

export class QuoteCodeCollisionError extends Error {
  constructor() {
    super('El código público de cotización ya existe');
    this.name = 'QuoteCodeCollisionError';
  }
}

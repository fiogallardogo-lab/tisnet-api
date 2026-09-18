export interface QuoteFeature {
  id: string;
  name: string;
  priceMinor?: number;
}
export interface QuoteSolution {
  id: string;
  name: string;
  features: QuoteFeature[];
  baseMinor?: number;
  businessDays?: number;
  included?: string[];
}
export interface QuoteCatalog {
  solutions: QuoteSolution[];
  pricingStatus: 'PENDING' | 'AVAILABLE';
}
export interface CreateQuoteInput {
  fullName: string;
  company?: string;
  solutionType: string;
  featureIds: string[];
  email: string;
  phone: string;
  description: string;
  deliveryMode?: 'NORMAL' | 'URGENT' | 'FLEXIBLE';
}
export interface QuoteReceipt {
  code: string;
  status: 'RECEIVED';
  createdAt: string;
  pricing:
    | { status: 'PENDING' }
    | {
        status: 'CALCULATED';
        amount: string;
        currency: string;
        version: string;
      };
}
export interface PublicQuoteDto {
  code: string;
  status: 'RECEIVED';
  createdAt: string;
  pricingStatus: 'PENDING_RULES' | 'CALCULATED';
  amountMinor: number | null;
  currency: string | null;
  pricingVersion: string | null;
}

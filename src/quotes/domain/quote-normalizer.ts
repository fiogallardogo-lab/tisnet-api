import { CreatePublicQuoteDto } from '../dto/create-public-quote.dto';
import { QuoteDeliveryMode } from './quote.enums';

const collapseWhitespace = (value: string) => value.trim().replace(/\s+/g, ' ');

const optionalText = (value?: string) => {
  if (value === undefined) return undefined;
  const normalized = collapseWhitespace(value);
  return normalized === '' ? undefined : normalized;
};

export interface NormalizedPublicQuote {
  solutionType: string;
  options: Array<{ code: string }>;
  deliveryMode: QuoteDeliveryMode;
  contact: {
    fullName: string;
    email: string;
    phone: string;
    company?: string;
  };
  notes?: string;
}

export function normalizePublicQuote(
  dto: CreatePublicQuoteDto,
): NormalizedPublicQuote {
  return {
    solutionType: dto.solutionType.trim().toUpperCase(),
    options: dto.options.map(({ code }) => ({
      code: code.trim().toUpperCase(),
    })),
    deliveryMode:
      (dto.deliveryMode as QuoteDeliveryMode) ?? QuoteDeliveryMode.NORMAL,
    contact: {
      fullName: collapseWhitespace(dto.contact.fullName),
      email: dto.contact.email.trim().toLowerCase(),
      phone: collapseWhitespace(dto.contact.phone),
      company: optionalText(dto.contact.company),
    },
    notes: optionalText(dto.notes),
  };
}

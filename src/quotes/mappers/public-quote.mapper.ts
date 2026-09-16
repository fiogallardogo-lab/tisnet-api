import { PublicQuoteResponseDto } from '../dto/public-quote-response.dto';
import { CreatedQuoteRecord } from '../repositories/quote.repository';

/**
 * Único punto autorizado para convertir una entidad persistida en la
 * confirmación pública. La entrada deliberadamente no expone IDs ni contacto.
 */
export function toPublicQuoteResponse(
  quote: CreatedQuoteRecord,
): PublicQuoteResponseDto {
  return {
    code: quote.publicCode,
    status: quote.status,
    pricingStatus: quote.pricingStatus,
    amountMinor: quote.amountMinor,
    currency: quote.currency,
    pricingVersion: quote.pricingVersion,
    createdAt: quote.createdAt.toISOString(),
  };
}

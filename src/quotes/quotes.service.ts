import {
  Inject,
  Injectable,
  Optional,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { QuoteCatalog, QUOTE_CATALOG } from './catalog/quote-catalog';
import { CreatePublicQuoteDto } from './dto/create-public-quote.dto';
import { PublicQuoteResponseDto } from './dto/public-quote-response.dto';
import { QuotePricingStatus, QuoteStatus } from './domain/quote.enums';
import { generateQuoteCode } from './domain/quote-code.generator';
import { normalizePublicQuote } from './domain/quote-normalizer';
import { toPublicQuoteResponse } from './mappers/public-quote.mapper';
import {
  PRICING_ENGINE,
  PricingEngine,
  PricingResult,
} from './pricing/pricing-engine';
import {
  QUOTE_REPOSITORY,
  QuoteCodeCollisionError,
  QuoteRepository,
} from './repositories/quote.repository';
import { QUOTE_CODE_GENERATOR, QuoteCodeGenerator } from './quotes.tokens';

const MAX_CODE_ATTEMPTS = 3;

@Injectable()
export class QuotesService {
  constructor(
    @Inject(QUOTE_REPOSITORY)
    private readonly repository: QuoteRepository,
    @Inject(QUOTE_CATALOG)
    private readonly catalog: QuoteCatalog,
    @Optional()
    @Inject(PRICING_ENGINE)
    private readonly pricingEngine?: PricingEngine,
    @Optional()
    @Inject(QUOTE_CODE_GENERATOR)
    private readonly codeGenerator: QuoteCodeGenerator = generateQuoteCode,
  ) {}

  async createPublic(
    dto: CreatePublicQuoteDto,
  ): Promise<PublicQuoteResponseDto> {
    const normalized = normalizePublicQuote(dto);
    const solution = this.catalog.findSolution(normalized.solutionType);

    if (!solution?.isActive) {
      throw new UnprocessableEntityException(
        'El tipo de solución no existe o no está disponible',
      );
    }

    const options = normalized.options.map(({ code }) => {
      const option = this.catalog.findOption(code);

      if (!option?.isActive) {
        throw new UnprocessableEntityException(
          `La característica ${code} no existe o no está disponible`,
        );
      }

      if (!option.solutionTypes.includes(solution.code)) {
        throw new UnprocessableEntityException(
          `La característica ${code} no es compatible con ${solution.code}`,
        );
      }

      return {
        code: option.code,
        name: option.name,
        displayOrder: option.displayOrder,
      };
    });

    const pricing = this.calculatePricing(
      solution.code,
      options.map(({ code }) => code),
    );

    for (let attempt = 1; attempt <= MAX_CODE_ATTEMPTS; attempt += 1) {
      try {
        const created = await this.repository.create({
          publicCode: this.codeGenerator(),
          status: QuoteStatus.RECEIVED,
          solutionType: solution.code,
          contactName: normalized.contact.fullName,
          contactEmail: normalized.contact.email,
          contactPhone: normalized.contact.phone,
          contactCompany: normalized.contact.company,
          notes: normalized.notes,
          pricingStatus: pricing
            ? QuotePricingStatus.CALCULATED
            : QuotePricingStatus.PENDING_RULES,
          amountMinor: pricing?.amountMinor ?? null,
          currency: pricing?.currency ?? null,
          pricingVersion: pricing?.pricingVersion ?? null,
          options,
          items: pricing?.items ?? [],
        });

        return toPublicQuoteResponse(created);
      } catch (error) {
        if (!(error instanceof QuoteCodeCollisionError)) throw error;
        if (attempt === MAX_CODE_ATTEMPTS) {
          throw new ServiceUnavailableException(
            'No se pudo generar un código único para la cotización',
          );
        }
      }
    }

    throw new ServiceUnavailableException(
      'No se pudo generar un código único para la cotización',
    );
  }

  private calculatePricing(
    solutionType: string,
    optionCodes: string[],
  ): PricingResult | undefined {
    if (!this.pricingEngine) return undefined;

    const result = this.pricingEngine.calculate({ solutionType, optionCodes });
    this.assertValidPricing(result);
    return result;
  }

  private assertValidPricing(result: PricingResult) {
    if (!Number.isSafeInteger(result.amountMinor)) {
      throw new Error('PricingEngine devolvió un monto total inválido');
    }
    if (!/^[A-Z]{3}$/.test(result.currency)) {
      throw new Error('PricingEngine devolvió una moneda inválida');
    }
    if (result.pricingVersion.trim() === '') {
      throw new Error('PricingEngine devolvió una versión vacía');
    }
    if (result.items.length === 0) {
      throw new Error('PricingEngine debe devolver al menos una línea');
    }
    if (
      result.items.some(({ amountMinor }) => !Number.isSafeInteger(amountMinor))
    ) {
      throw new Error('PricingEngine devolvió una línea con monto inválido');
    }
    const itemTotal = result.items.reduce(
      (total, item) => total + item.amountMinor,
      0,
    );
    if (itemTotal !== result.amountMinor) {
      throw new Error('El desglose del precio no coincide con el total');
    }
  }
}

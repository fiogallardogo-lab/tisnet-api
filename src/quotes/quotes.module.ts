import { DynamicModule, Module, Provider } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { QuoteCatalog, QUOTE_CATALOG } from './catalog/quote-catalog';
import { RejectUnknownQuoteFieldsInterceptor } from './interceptors/reject-unknown-quote-fields.interceptor';
import { PublicQuotesController } from './public-quotes.controller';
import { PrismaQuoteRepository } from './repositories/prisma-quote.repository';
import { QUOTE_REPOSITORY } from './repositories/quote.repository';
import { QuotesService } from './quotes.service';
import { QUOTE_CODE_GENERATOR } from './quotes.tokens';
import { generateQuoteCode } from './domain/quote-code.generator';
import { PRICING_ENGINE, PricingEngine } from './pricing/pricing-engine';
import { Sp01V2PricingEngine } from './pricing/sp01-v2-pricing-engine';

export interface QuotesModuleOptions {
  catalog: QuoteCatalog;
  pricingEngine?: PricingEngine;
}

@Module({
  imports: [PrismaModule],
  controllers: [PublicQuotesController],
  providers: [
    QuotesService,
    PrismaQuoteRepository,
    RejectUnknownQuoteFieldsInterceptor,
    Sp01V2PricingEngine,
    { provide: QUOTE_REPOSITORY, useExisting: PrismaQuoteRepository },
    { provide: QUOTE_CODE_GENERATOR, useValue: generateQuoteCode },
    { provide: PRICING_ENGINE, useExisting: Sp01V2PricingEngine },
  ],
  exports: [QuotesService],
})
export class QuotesModule {
  static register(options: QuotesModuleOptions): DynamicModule {
    const providers: Provider[] = [
      {
        provide: QUOTE_CATALOG,
        useValue: options.catalog,
      },
    ];

    if (options.pricingEngine) {
      providers.push({
        provide: PRICING_ENGINE,
        useValue: options.pricingEngine,
      });
    }

    return {
      module: QuotesModule,
      providers,
      exports: [QUOTE_CATALOG],
    };
  }
}

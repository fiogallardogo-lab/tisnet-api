import { DynamicModule, Module, Provider } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { PrismaModule } from '../prisma/prisma.module.js';

import { QuoteCatalog, QUOTE_CATALOG } from './catalog/quote-catalog.js';
import { generateQuoteCode } from './domain/quote-code.generator.js';
import { RejectUnknownQuoteFieldsInterceptor } from './interceptors/reject-unknown-quote-fields.interceptor.js';
import { PRICING_ENGINE, PricingEngine } from './pricing/pricing-engine.js';
import { Sp01V2PricingEngine } from './pricing/sp01-v2-pricing-engine.js';
import { PublicQuotesController } from './public-quotes.controller.js';
import { PrismaQuoteRepository } from './repositories/prisma-quote.repository.js';
import { QUOTE_REPOSITORY } from './repositories/quote.repository.js';
import { QuotesService } from './quotes.service.js';
import { QUOTE_CODE_GENERATOR } from './quotes.tokens.js';

import { AdminQuotesController } from './admin-quotes.controller.js';
import { AdminQuotesService } from './admin-quotes.service.js';

export interface QuotesModuleOptions {
  catalog: QuoteCatalog;
  pricingEngine?: PricingEngine;
}

@Module({
  imports: [
    PrismaModule,
    PassportModule.register({
      defaultStrategy: 'jwt',
    }),
  ],
  controllers: [PublicQuotesController, AdminQuotesController],
  providers: [
    QuotesService,
    PrismaQuoteRepository,
    RejectUnknownQuoteFieldsInterceptor,
    Sp01V2PricingEngine,
    AdminQuotesService,
    JwtAuthGuard,
    RolesGuard,
    {
      provide: QUOTE_REPOSITORY,
      useExisting: PrismaQuoteRepository,
    },
    {
      provide: QUOTE_CODE_GENERATOR,
      useValue: generateQuoteCode,
    },
    {
      provide: PRICING_ENGINE,
      useExisting: Sp01V2PricingEngine,
    },
  ],
  exports: [QuotesService, QUOTE_REPOSITORY, PrismaQuoteRepository],
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
      exports: [
        QUOTE_CATALOG,
        QUOTE_REPOSITORY,
        PrismaQuoteRepository,
        QuotesService,
      ],
    };
  }
}

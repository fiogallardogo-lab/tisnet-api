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

export interface QuotesModuleOptions {
  catalog: QuoteCatalog;
}

@Module({
  imports: [PrismaModule],
  controllers: [PublicQuotesController],
  providers: [
    QuotesService,
    PrismaQuoteRepository,
    RejectUnknownQuoteFieldsInterceptor,
    { provide: QUOTE_REPOSITORY, useExisting: PrismaQuoteRepository },
    { provide: QUOTE_CODE_GENERATOR, useValue: generateQuoteCode },
  ],
  exports: [QuotesService],
})
export class QuotesModule {
  static register(options: QuotesModuleOptions): DynamicModule {
    const catalogProvider: Provider = {
      provide: QUOTE_CATALOG,
      useValue: options.catalog,
    };

    return {
      module: QuotesModule,
      providers: [catalogProvider],
      exports: [QUOTE_CATALOG],
    };
  }
}

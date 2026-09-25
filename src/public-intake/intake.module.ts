import { QuotesModule } from '../quotes/quotes.module';
import { quotesCatalogV1 } from '../quotes/catalog/quotes-catalog-v1';
import { Module } from '@nestjs/common';
import { IntakeController } from './intake.controller';
import { IntakeService } from './intake.service';
@Module({
  imports: [QuotesModule.register({ catalog: quotesCatalogV1 })],
  controllers: [IntakeController],
  providers: [IntakeService],
})
export class IntakeModule {}

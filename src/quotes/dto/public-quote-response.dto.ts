import { ApiProperty } from '@nestjs/swagger';
import { QuotePricingStatus, QuoteStatus } from '../domain/quote.enums';

export class PublicQuoteResponseDto {
  @ApiProperty({ example: 'Q-7K4M9X2P' })
  code: string;

  @ApiProperty({ enum: QuoteStatus, example: QuoteStatus.RECEIVED })
  status: QuoteStatus;

  @ApiProperty({
    enum: QuotePricingStatus,
    example: QuotePricingStatus.PENDING_RULES,
  })
  pricingStatus: QuotePricingStatus;

  @ApiProperty({ example: 400000, nullable: true, type: Number })
  amountMinor: number | null;

  @ApiProperty({ example: 'PEN', nullable: true, type: String })
  currency: string | null;

  @ApiProperty({ example: 'SP-01-v2', nullable: true, type: String })
  pricingVersion: string | null;

  @ApiProperty({ example: '2026-09-16T18:30:00.000Z' })
  createdAt: string;
}

export class CreatePublicQuoteResponseDto {
  @ApiProperty({ example: true })
  success: true;

  @ApiProperty({ example: 'Cotización registrada correctamente' })
  message: string;

  @ApiProperty({ type: PublicQuoteResponseDto })
  data: PublicQuoteResponseDto;
}

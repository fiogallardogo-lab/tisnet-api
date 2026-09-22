import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsNotEmpty,
  IsString,
  MaxLength,
  ValidateIf,
} from 'class-validator';

export enum DeliverableReviewDecision {
  APPROVE = 'APPROVE',
  OBSERVE = 'OBSERVE',
}

export class ReviewDeliverableDto {
  @ApiProperty({
    enum: DeliverableReviewDecision,
    example: DeliverableReviewDecision.APPROVE,
  })
  @IsEnum(DeliverableReviewDecision)
  decision: DeliverableReviewDecision;

  @ApiPropertyOptional({
    example: 'Corrige el enlace de evidencia y agrega la versión para móviles.',
    description: 'Obligatorio cuando decision es OBSERVE.',
  })
  @ValidateIf(
    (dto: ReviewDeliverableDto) =>
      dto.decision === DeliverableReviewDecision.OBSERVE,
  )
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  feedbackNotes?: string;
}

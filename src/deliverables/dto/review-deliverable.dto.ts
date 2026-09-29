import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export enum DeliverableReviewDecision {
  APPROVE = 'APPROVE',
  OBSERVE = 'OBSERVE',
}

export class ReviewDeliverableDto {
  @ApiPropertyOptional({
    enum: DeliverableReviewDecision,
    example: DeliverableReviewDecision.APPROVE,
  })
  @IsOptional()
  @IsEnum(DeliverableReviewDecision)
  decision?: DeliverableReviewDecision;

  @ApiPropertyOptional({
    example: 'APPROVED',
    description: 'Valores admitidos: APPROVED | OBSERVED (alias de decision)',
  })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({
    example: 'Corrige el enlace de evidencia y agrega la versión para móviles.',
    description: 'Obligatorio cuando decision es OBSERVE.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  feedbackNotes?: string;

  @ApiPropertyOptional({
    example: 'La funcionalidad cumple con los criterios de aceptación.',
    description: 'Alias de feedbackNotes.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  comments?: string;
}


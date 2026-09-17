import { Transform, Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { QuoteContactDto } from './quote-contact.dto';
import { QuoteOptionDto } from './quote-option.dto';
import { QuoteDeliveryMode } from '../domain/quote.enums';

const normalizeCode = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toUpperCase() : value;

const emptyToUndefined = ({ value }: { value: unknown }) => {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
};

export class CreatePublicQuoteDto {
  @ApiProperty({
    description: 'Código estable del tipo de solución',
    example: 'ECOMMERCE',
    minLength: 2,
    maxLength: 64,
  })
  @Transform(normalizeCode)
  @IsString()
  @MinLength(2)
  @MaxLength(64)
  @Matches(/^[A-Z][A-Z0-9_]*$/, {
    message:
      'El tipo de solución debe usar mayúsculas, números y guiones bajos',
  })
  solutionType: string;

  @ApiProperty({ type: [QuoteOptionDto], minItems: 1, maxItems: 20 })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @ArrayUnique((option: QuoteOptionDto) => option.code, {
    message: 'Las características seleccionadas no pueden repetirse',
  })
  @ValidateNested({ each: true })
  @Type(() => QuoteOptionDto)
  options: QuoteOptionDto[];

  @ApiPropertyOptional({
    description: 'Modalidad de entrega del proyecto',
    enum: QuoteDeliveryMode,
    example: QuoteDeliveryMode.NORMAL,
    default: QuoteDeliveryMode.NORMAL,
  })
  @Transform(normalizeCode)
  @IsOptional()
  @IsEnum(QuoteDeliveryMode, {
    message: 'La modalidad de entrega debe ser NORMAL, URGENT o FLEXIBLE',
  })
  deliveryMode?: QuoteDeliveryMode;

  @ApiProperty({ type: QuoteContactDto })
  @ValidateNested()
  @Type(() => QuoteContactDto)
  contact: QuoteContactDto;

  @ApiPropertyOptional({ maxLength: 1000 })
  @Transform(emptyToUndefined)
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}

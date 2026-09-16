import { Transform, Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { QuoteContactDto } from './quote-contact.dto';
import { QuoteOptionDto } from './quote-option.dto';

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
    example: 'CODIGO_DE_SOLUCION',
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

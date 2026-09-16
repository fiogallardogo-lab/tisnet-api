import { Transform } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches, MaxLength, MinLength } from 'class-validator';

const normalizeCode = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toUpperCase() : value;

export class QuoteOptionDto {
  @ApiProperty({
    description: 'Código estable de una característica del catálogo',
    example: 'CODIGO_DE_CARACTERISTICA',
    minLength: 2,
    maxLength: 64,
  })
  @Transform(normalizeCode)
  @IsString()
  @MinLength(2)
  @MaxLength(64)
  @Matches(/^[A-Z][A-Z0-9_]*$/, {
    message:
      'El código de característica debe usar mayúsculas, números y guiones bajos',
  })
  code: string;
}

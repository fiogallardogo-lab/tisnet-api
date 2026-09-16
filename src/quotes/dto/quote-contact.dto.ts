import { Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { HasPhoneDigitCount } from '../validators/phone-digit-count.validator';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

const normalizeEmail = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;

const emptyToUndefined = ({ value }: { value: unknown }) => {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
};

export class QuoteContactDto {
  @ApiProperty({ example: 'Ana Torres', minLength: 2, maxLength: 100 })
  @Transform(trim)
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  fullName: string;

  @ApiProperty({ example: 'ana.torres@example.com', maxLength: 150 })
  @Transform(normalizeEmail)
  @IsEmail()
  @MaxLength(150)
  email: string;

  @ApiProperty({ example: '+51 987 654 321', minLength: 7, maxLength: 30 })
  @Transform(trim)
  @IsString()
  @MinLength(7)
  @MaxLength(30)
  @Matches(/^[\d\s+()-]+$/, {
    message: 'El teléfono contiene caracteres no permitidos',
  })
  @HasPhoneDigitCount(7, 15)
  phone: string;

  @ApiPropertyOptional({ example: 'Empresa Ejemplo SAC', maxLength: 150 })
  @Transform(emptyToUndefined)
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(150)
  company?: string;
}

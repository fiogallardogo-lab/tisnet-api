import { Transform } from 'class-transformer';
import {
  Equals,
  IsBoolean,
  IsOptional,
  IsString,
  Length,
  ValidateIf,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export const hasLegalUpdate = (dto: UpdateOwnUserDto) =>
  dto.acceptedTerms !== undefined ||
  dto.termsVersion !== undefined ||
  dto.privacyVersion !== undefined;

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class UpdateOwnUserDto {
  @ApiPropertyOptional({ minLength: 2, maxLength: 100 })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsOptional()
  @IsString()
  @Length(2, 100)
  name?: string;

  @ApiPropertyOptional({
    enum: [true],
    description:
      'Obligatorio junto con ambas versiones para renovar la aceptación legal',
  })
  @ValidateIf(hasLegalUpdate)
  @IsBoolean()
  @Equals(true)
  acceptedTerms?: true;

  @ApiPropertyOptional({ minLength: 1, maxLength: 50 })
  @Transform(trim)
  @ValidateIf(hasLegalUpdate)
  @IsString()
  @Length(1, 50)
  termsVersion?: string;

  @ApiPropertyOptional({ minLength: 1, maxLength: 50 })
  @Transform(trim)
  @ValidateIf(hasLegalUpdate)
  @IsString()
  @Length(1, 50)
  privacyVersion?: string;
}

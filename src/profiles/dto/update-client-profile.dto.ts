import { Transform } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class UpdateClientProfileDto {
  @ApiPropertyOptional({ pattern: '^\\d{8}$' })
  @Transform(trim)
  @IsOptional()
  @Matches(/^\d{8}$/)
  dni?: string;

  @ApiPropertyOptional({ minimum: 0, maximum: 130 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(130)
  age?: number;

  @ApiPropertyOptional({ minLength: 6, maxLength: 20 })
  @Transform(trim)
  @IsOptional()
  @IsString()
  @Length(6, 20)
  @Matches(/^[0-9+()\- ]+$/)
  phone?: string;

  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(100)
  district?: string;

  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(150)
  businessName?: string;

  @ApiPropertyOptional({ pattern: '^\\d{11}$' })
  @Transform(trim)
  @IsOptional()
  @Matches(/^\d{11}$/)
  ruc?: string;

  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(150)
  commercialName?: string;

  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(100)
  businessDistrict?: string;
}

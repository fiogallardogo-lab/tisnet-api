import { Transform } from 'class-transformer';
import {
  ArrayUnique,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class UpdateDeveloperProfileDto {
  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(150)
  career?: string;

  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(180)
  university?: string;

  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(100)
  academicStatus?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(80)
  experienceYears?: number;

  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(120)
  specialty?: string;

  @ApiPropertyOptional({ type: [Number] })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsInt({ each: true })
  technologyIds?: number[];

  @Transform(trim)
  @IsOptional()
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  @MaxLength(500)
  cvUrl?: string;

  @Transform(trim)
  @IsOptional()
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  @MaxLength(500)
  photoUrl?: string;

  @Transform(trim)
  @IsOptional()
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  @MaxLength(500)
  linkedinUrl?: string;

  @Transform(trim)
  @IsOptional()
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  @MaxLength(500)
  githubUrl?: string;
}

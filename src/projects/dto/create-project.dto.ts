import { ProjectStatus } from '@prisma/client';
import {
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreateProjectDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(150)
  name: string;

  @IsString()
  @MinLength(3)
  @MaxLength(180)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message: 'slug must contain only lowercase letters, numbers, and hyphens',
  })
  slug: string;

  @IsString()
  @MinLength(10)
  @MaxLength(300)
  shortDescription: string;

  @IsString()
  @MinLength(20)
  description: string;

  @IsOptional()
  @IsString()
  problem?: string | null;

  @IsOptional()
  @IsString()
  solution?: string | null;

  @IsOptional()
  @IsString()
  objective?: string | null;

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  features?: string[];

  @IsInt()
  @Min(1)
  categoryId: number;

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsInt({ each: true })
  @Min(1, { each: true })
  technologyIds?: number[];

  @IsOptional()
  @IsEnum(ProjectStatus)
  status?: ProjectStatus;

  @IsOptional()
  @IsDateString()
  developmentDate?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  clientName?: string | null;

  @IsOptional()
  @IsUrl()
  @MaxLength(500)
  demoUrl?: string | null;

  @IsOptional()
  @IsUrl()
  @MaxLength(500)
  externalUrl?: string | null;

  @IsOptional()
  @IsUrl()
  @MaxLength(500)
  coverImageUrl?: string | null;

  @IsOptional()
  @IsBoolean()
  isFeatured?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  displayOrder?: number;
}

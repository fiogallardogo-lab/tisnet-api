import { ProjectStatus } from '@prisma/client';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
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
  @ApiProperty({ example: 'Sistema de inventario' })
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(150)
  name: string;

  @ApiProperty({ example: 'sistema-de-inventario' })
  @IsString()
  @MinLength(3)
  @MaxLength(180)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message: 'El slug solo puede contener minúsculas, números y guiones',
  })
  slug: string;

  @ApiProperty({ example: 'Control centralizado de productos y existencias.' })
  @IsString()
  @MinLength(10)
  @MaxLength(300)
  shortDescription: string;

  @ApiProperty({ example: 'Descripción pública completa del proyecto.' })
  @IsString()
  @MinLength(20)
  description: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  problem?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  solution?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  objective?: string | null;

  @ApiPropertyOptional({ type: [String], default: [] })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  features?: string[];

  @ApiProperty({ example: 1, minimum: 1 })
  @IsInt()
  @Min(1)
  categoryId: number;

  @ApiPropertyOptional({ type: [Number], default: [] })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsInt({ each: true })
  @Min(1, { each: true })
  technologyIds?: number[];

  @ApiPropertyOptional({ enum: ProjectStatus, default: ProjectStatus.DRAFT })
  @IsOptional()
  @IsEnum(ProjectStatus)
  status?: ProjectStatus;

  @ApiPropertyOptional({ example: '2026-09-04', nullable: true })
  @IsOptional()
  @IsDateString()
  developmentDate?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  clientName?: string | null;

  @ApiPropertyOptional({ example: 'https://demo.example.com', nullable: true })
  @IsOptional()
  @IsUrl()
  @MaxLength(500)
  demoUrl?: string | null;

  @ApiPropertyOptional({ example: 'https://example.com', nullable: true })
  @IsOptional()
  @IsUrl()
  @MaxLength(500)
  externalUrl?: string | null;

  @ApiPropertyOptional({ example: 'https://cdn.example.com/cover.webp', nullable: true })
  @IsOptional()
  @IsUrl()
  @MaxLength(500)
  coverImageUrl?: string | null;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isFeatured?: boolean;

  @ApiPropertyOptional({ default: 0, minimum: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  displayOrder?: number;
}

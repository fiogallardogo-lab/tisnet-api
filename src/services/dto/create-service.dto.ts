import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
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

export class CreateServiceDto {
  @ApiProperty({ example: 'Desarrollo de software a medida' })
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(150)
  name: string;

  @ApiProperty({ example: 'desarrollo-de-software-a-medida' })
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(180)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message: 'El slug solo puede contener minúsculas, números y guiones',
  })
  slug: string;

  @ApiProperty({
    example:
      'Creamos soluciones digitales adaptadas a las necesidades de cada organización.',
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(10)
  @MaxLength(300)
  shortDescription: string;

  @ApiProperty({
    example:
      'Servicio orientado al análisis, diseño, desarrollo e implementación de sistemas empresariales personalizados, escalables y seguros.',
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(20)
  description: string;

  @ApiPropertyOptional({ example: 'Code', nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  icon?: string | null;

  @ApiPropertyOptional({
    example:
      'https://images.unsplash.com/photo-1555066931-4365d14bab8c?auto=format&fit=crop&w=800&q=80',
    nullable: true,
  })
  @IsOptional()
  @IsUrl()
  @MaxLength(500)
  imageUrl?: string | null;

  @ApiPropertyOptional({ example: 1, minimum: 0, default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  displayOrder?: number;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isFeatured?: boolean;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

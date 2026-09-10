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
  @ApiProperty({
    description: 'Nombre comercial del servicio',
    example: 'Desarrollo de software a medida',
    minLength: 3,
    maxLength: 150,
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(150)
  name: string;

  @ApiProperty({
    description: 'Identificador único legible para URLs en formato kebab-case',
    example: 'desarrollo-de-software-a-medida',
    minLength: 3,
    maxLength: 180,
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(180)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message: 'El slug solo puede contener minúsculas, números y guiones',
  })
  slug: string;

  @ApiProperty({
    description: 'Resumen informativo breve para tarjetas del catálogo',
    example:
      'Creamos soluciones digitales adaptadas a las necesidades de cada organización.',
    minLength: 10,
    maxLength: 300,
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(10)
  @MaxLength(300)
  shortDescription: string;

  @ApiProperty({
    description:
      'Descripción detallada, alcance y especificaciones del servicio',
    example:
      'Servicio orientado al análisis, diseño, desarrollo e implementación de sistemas personalizados.',
    minLength: 20,
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(20)
  description: string;

  @ApiPropertyOptional({
    description: 'Identificador de icono (ej. Code, Cloud, Shield)',
    example: 'Code',
    maxLength: 100,
    nullable: true,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  icon?: string | null;

  @ApiPropertyOptional({
    description: 'URL de la imagen ilustrativa o cover del servicio',
    example: 'https://example.com/services/software.jpg',
    maxLength: 500,
    nullable: true,
  })
  @IsOptional()
  @IsUrl()
  @MaxLength(500)
  imageUrl?: string | null;

  @ApiPropertyOptional({
    description: 'Orden de prioridad para presentación en el portal público',
    example: 1,
    minimum: 0,
    default: 0,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  displayOrder?: number;

  @ApiPropertyOptional({
    description: 'Indica si el servicio se destaca en la página de inicio',
    example: true,
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  isFeatured?: boolean;

  @ApiPropertyOptional({
    description:
      'Estado de activación del servicio. Si es false, no aparece en catálogo público',
    example: true,
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

import { Transform, Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class CatalogQueryDto {
  @ApiPropertyOptional({
    description:
      'Busca tecnologías activas por nombre. Los espacios al inicio y final se eliminan.',
    maxLength: 100,
    example: 'react',
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @ApiPropertyOptional({
    description: 'Filtra tecnologías activas por categoría tecnológica.',
    type: Number,
    minimum: 1,
    example: 1,
  })
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(1)
  categoryId?: number;
}

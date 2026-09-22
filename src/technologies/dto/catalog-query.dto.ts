import { Transform } from 'class-transformer';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

/** categoryId is unsupported until Technology has an agreed category relation. */
export class CatalogQueryDto {
  @ApiPropertyOptional({
    description: 'Busca por nombre; trim. Vacío equivale a no filtrar.',
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
}

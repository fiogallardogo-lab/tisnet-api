import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsNotEmpty,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class MemberContributionItemDto {
  @ApiProperty({ example: 10, description: 'ID del usuario integrante del equipo' })
  @IsInt()
  @IsNotEmpty()
  userId: number;

  @ApiProperty({ example: 70, description: 'Porcentaje de contribución (1-100)' })
  @IsInt()
  @Min(0, { message: 'El porcentaje debe ser al menos 0%' })
  @Max(100, { message: 'El porcentaje no puede exceder 100%' })
  percentage: number;

  @ApiProperty({ example: 'Desarrollo de backend comercial y contratos', description: 'Descripción de las tareas realizadas' })
  @IsString()
  @IsNotEmpty({ message: 'La descripción de la contribución es obligatoria.' })
  @MaxLength(500)
  description: string;
}

export class SaveContributionsDto {
  @ApiProperty({ type: [MemberContributionItemDto], description: 'Lista de contribuciones por integrante' })
  @IsArray()
  @ArrayMinSize(1, { message: 'Debe incluir al menos una contribución' })
  @ValidateNested({ each: true })
  @Type(() => MemberContributionItemDto)
  contributions: MemberContributionItemDto[];
}

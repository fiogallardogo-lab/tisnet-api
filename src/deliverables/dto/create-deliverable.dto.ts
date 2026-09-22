import { ApiProperty } from '@nestjs/swagger';
import {
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateDeliverableDto {
  @ApiProperty({ example: 'Prototipo navegable' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  title: string;

  @ApiProperty({
    example: 'Primera versión navegable para validación del cliente.',
  })
  @IsString()
  @IsNotEmpty()
  description: string;

  @ApiProperty({ example: 1, minimum: 1 })
  @IsInt()
  @Min(1)
  milestoneOrder: number;

  @ApiProperty({ example: '2026-10-15' })
  @IsDateString({ strict: true })
  dueDate: string;
}

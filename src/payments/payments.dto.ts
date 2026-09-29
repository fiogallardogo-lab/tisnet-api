import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
export class InstallmentDto {
  @ApiProperty({
    minimum: 1,
    maximum: 10000,
    description: '100 puntos base = 1%; suma exacta 10000',
  })
  @IsInt()
  @Min(1)
  @Max(10000)
  percentageBasisPoints: number;
  @ApiProperty({
    example: '2026-10-01',
    description: 'Fecha civil YYYY-MM-DD; orden no decreciente',
  })
  @IsDateString({ strict: true })
  dueDate: string;
  @ApiProperty({
    maxLength: 150,
    description: 'Descripción obligatoria de la cuota',
  })
  @IsString()
  @MaxLength(150)
  @Matches(/\S/)
  milestone: string;
}
export class OfficialQuoteDto {
  @ApiProperty()
  @IsInt()
  @Min(1)
  clientUserId: number;
  @ApiProperty({
    minimum: 1,
    maximum: 1000000000000,
    description: 'Importe entero en unidades menores',
  })
  @IsInt()
  @Min(1)
  @Max(1000000000000)
  amountMinor: number;
  @ApiProperty({ example: 'PEN' })
  @Matches(/^[A-Z]{3}$/)
  currency: string;
  @ApiProperty({ maxLength: 5000 })
  @IsString()
  @MaxLength(5000)
  @Matches(/\S/)
  scope: string;
  @ApiPropertyOptional({ maxLength: 2000 })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  observations?: string;
  @ApiProperty({ type: [InstallmentDto], minItems: 1, maxItems: 5 })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(5)
  @ValidateNested({ each: true })
  @Type(() => InstallmentDto)
  installments: InstallmentDto[];
}
export class PaymentEventDto {
  @IsInt() @Min(1) scheduleId: number;
  @IsString() @Matches(/\S/) @MaxLength(150) externalEventId: string;
  @ApiProperty({
    minimum: 1,
    maximum: 1000000000000,
    description: 'Importe entero en unidades menores',
  })
  @IsInt()
  @Min(1)
  @Max(1000000000000)
  amountMinor: number;
  @ApiProperty({ example: 'PEN' })
  @Matches(/^[A-Z]{3}$/)
  currency: string;
  @Matches(/^(CONFIRMED|FAILED)$/) status: 'CONFIRMED' | 'FAILED';
}

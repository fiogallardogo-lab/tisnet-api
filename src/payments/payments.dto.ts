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
  @IsInt() @Min(1) @Max(10000) percentageBasisPoints: number;
  @IsDateString({ strict: true }) dueDate: string;
  @IsString() @MaxLength(150) @Matches(/\S/) milestone: string;
}
export class OfficialQuoteDto {
  @IsInt() @Min(1) clientUserId: number;
  @IsInt() @Min(1) @Max(1000000000000) amountMinor: number;
  @Matches(/^[A-Z]{3}$/) currency: string;
  @IsString() @MaxLength(5000) @Matches(/\S/) scope: string;
  @IsOptional() @IsString() @MaxLength(2000) observations?: string;
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
  @IsInt() @Min(1) @Max(1000000000000) amountMinor: number;
  @Matches(/^[A-Z]{3}$/) currency: string;
  @Matches(/^(CONFIRMED|FAILED)$/) status: 'CONFIRMED' | 'FAILED';
}

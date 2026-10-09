import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsBoolean,
  IsDateString,
  IsIn,
  IsEmail,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class BookMeetingDto {
  @IsInt() @Min(1) advisorId: number;
  @IsString() @MaxLength(100) @Matches(/\S/) name: string;
  @IsEmail() @MaxLength(150) email: string;
  @IsOptional() @IsString() @MaxLength(30) phone?: string;
  @IsOptional() @IsBoolean() notifyWhatsapp?: boolean;
  @IsOptional() @IsString() @MaxLength(100) quoteId?: string;
  @IsDateString({ strict: true }) start: string;
  @IsDateString({ strict: true }) end: string;
}

export class AvailabilityQuery {
  @IsOptional()
  @IsDateString({ strict: true })
  from?: string;

  @IsOptional()
  @IsDateString({ strict: true })
  to?: string;

  @IsOptional()
  @IsString()
  date?: string;

  @IsOptional()
  @IsString()
  timezone?: string;
}

export class MeetingListQuery {
  @Type(() => Number) @IsInt() @Min(1) page = 1;
  @Type(() => Number) @IsInt() @Min(1) @Max(100) limit = 20;
}

export class UpdateMeetingStatusDto {
  @IsIn(['SCHEDULED', 'COMPLETED', 'CANCELLED']) status:
    'SCHEDULED' | 'COMPLETED' | 'CANCELLED';
}

export class RescheduleMeetingDto {
  @IsDateString({ strict: true }) start: string;
  @IsDateString({ strict: true }) end: string;
}

export class AdvisorAvailabilitySlotDto {
  @IsDateString({ strict: true }) start: string;
  @IsDateString({ strict: true }) end: string;
}

export class ReplaceAdvisorAvailabilityDto {
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => AdvisorAvailabilitySlotDto)
  slots: AdvisorAvailabilitySlotDto[];
}

export class NotifyMeetingLinkDto {
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  message?: string;
}
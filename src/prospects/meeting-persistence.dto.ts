import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEmail,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
export class BookMeetingDto {
  @IsInt() @Min(1) advisorId: number;
  @IsString() @MaxLength(100) @Matches(/\S/) name: string;
  @IsEmail() @MaxLength(150) email: string;
  @IsOptional() @IsString() @MaxLength(30) phone?: string;
  @IsString() @MaxLength(100) quoteId: string;
  @IsDateString({ strict: true }) start: string;
  @IsDateString({ strict: true }) end: string;
}
export class AvailabilityQuery {
  @IsDateString({ strict: true }) from: string;
  @IsDateString({ strict: true }) to: string;
}
export class MeetingListQuery {
  @Type(() => Number) @IsInt() @Min(1) page = 1;
  @Type(() => Number) @IsInt() @Min(1) @Max(100) limit = 20;
}

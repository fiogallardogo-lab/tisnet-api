import { Type } from 'class-transformer';
import {
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  Max,
  Min,
} from 'class-validator';
export class AuditQuery {
  @IsOptional()
  @IsIn([
    'USER',
    'PROJECT',
    'PAYMENT',
    'DELIVERABLE',
    'TEAM_APPLICATION',
    'QUOTE',
  ])
  entityType?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) actorId?: number;
  @IsOptional() @IsDateString({ strict: true }) from?: string;
  @IsOptional() @IsDateString({ strict: true }) to?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) cursor?: number;
  @Type(() => Number) @IsInt() @Min(1) @Max(1000) limit = 50;
}

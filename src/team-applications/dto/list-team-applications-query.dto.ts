import { Transform, Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  TEAM_APPLICATION_ROLES,
  TEAM_APPLICATION_STATUSES,
  TeamApplicationRole,
  TeamApplicationStatus,
} from '../team-application.constants.js';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class ListTeamApplicationsQueryDto {
  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @ApiPropertyOptional({ default: 10, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 10;

  @ApiPropertyOptional({ enum: TEAM_APPLICATION_STATUSES })
  @IsOptional()
  @IsIn(TEAM_APPLICATION_STATUSES)
  status?: TeamApplicationStatus;

  @ApiPropertyOptional({ enum: TEAM_APPLICATION_ROLES })
  @IsOptional()
  @IsIn(TEAM_APPLICATION_ROLES)
  role?: TeamApplicationRole;

  @ApiPropertyOptional({ maxLength: 100 })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(100)
  search?: string;
}

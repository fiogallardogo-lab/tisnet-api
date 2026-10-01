import { ApiPropertyOptional, PickType } from '@nestjs/swagger';
import { IsDateString, IsOptional } from 'class-validator';
import { WorkPageQuery } from '../work/work.dto';
export class WorkspaceMeetingsQuery extends PickType(WorkPageQuery, [
  'page',
  'limit',
] as const) {
  @ApiPropertyOptional({ example: '2026-10-01T00:00:00-05:00' })
  @IsOptional()
  @IsDateString({ strict: true })
  from?: string;
  @ApiPropertyOptional({ example: '2026-10-31T23:59:59-05:00' })
  @IsOptional()
  @IsDateString({ strict: true })
  to?: string;
}

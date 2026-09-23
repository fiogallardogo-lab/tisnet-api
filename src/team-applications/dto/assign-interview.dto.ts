import { Type } from 'class-transformer';
import { IsInt, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AssignInterviewDto {
  @ApiProperty({ example: 4, minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  adminProfileId!: number;
}

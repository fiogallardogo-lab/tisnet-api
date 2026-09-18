import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

export class SetAdvisorVisibilityDto {
  @ApiProperty({ example: true })
  @IsBoolean()
  isPublicAdvisor!: boolean;
}

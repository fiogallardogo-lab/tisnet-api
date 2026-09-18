import { ApiProperty } from '@nestjs/swagger';
import { ProspectStatus } from '@prisma/client';
import { IsEnum } from 'class-validator';

export class UpdateProspectStatusDto {
  @ApiProperty({ enum: ProspectStatus, example: ProspectStatus.CONTACTED })
  @IsEnum(ProspectStatus)
  status!: ProspectStatus;
}

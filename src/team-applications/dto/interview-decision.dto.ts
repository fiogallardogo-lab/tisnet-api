import { Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsString, Length, ValidateIf } from 'class-validator';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class InterviewDecisionDto {
  @ApiProperty({ enum: ['ACCEPTED', 'REJECTED'] })
  @IsIn(['ACCEPTED', 'REJECTED'])
  decision!: 'ACCEPTED' | 'REJECTED';

  @ApiPropertyOptional({
    minLength: 20,
    maxLength: 1000,
    description: 'Obligatorio cuando decision es REJECTED',
  })
  @ValidateIf(
    (dto: InterviewDecisionDto) =>
      dto.decision === 'REJECTED' || dto.reason !== undefined,
  )
  @Transform(trim)
  @IsString()
  @Length(20, 1000)
  reason?: string;
}

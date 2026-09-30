import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
} from 'class-validator';
const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;
export class PublicTeamDto {
  @ApiProperty()
  @Transform(trim)
  @IsString()
  @Length(2, 100)
  displayName!: string;
  @ApiProperty()
  @Transform(trim)
  @IsString()
  @Length(1, 1000)
  biography!: string;
  @ApiProperty()
  @Transform(trim)
  @IsString()
  @Length(1, 150)
  specialty!: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(1, 500)
  photoUrl?: string;
  @ApiProperty() @IsBoolean() approved!: boolean;
  @ApiProperty() @IsBoolean() consentRecorded!: boolean;
}
export class PublicTeamQuery {
  @ApiPropertyOptional({ default: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100000)
  page = 1;
  @ApiPropertyOptional({ default: 20 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;
}

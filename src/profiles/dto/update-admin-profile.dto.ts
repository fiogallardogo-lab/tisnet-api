import { Transform } from 'class-transformer';
import { IsOptional, IsString, IsUrl, MaxLength } from 'class-validator';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class UpdateAdminProfileDto {
  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(120)
  executiveTitle?: string;

  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(120)
  specialty?: string;

  @Transform(trim)
  @IsOptional()
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  @MaxLength(500)
  photoUrl?: string;

  @Transform(trim)
  @IsOptional()
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  @MaxLength(500)
  calendlyUrl?: string;
}

import { Transform } from 'class-transformer';
import { IsOptional, IsString, IsUrl, MaxLength } from 'class-validator';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class UpdateProductOwnerProfileDto {
  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  bio?: string;

  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(120)
  specialty?: string;

  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(500)
  availabilityNotes?: string;

  @Transform(trim)
  @IsOptional()
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  @MaxLength(500)
  photoUrl?: string;
}

import { Transform } from 'class-transformer';
import {
  Equals,
  IsBoolean,
  IsEmail,
  IsString,
  Length,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class RegisterDto {
  @ApiProperty({ example: 'Cliente TISNET', minLength: 2, maxLength: 100 })
  @Transform(trim)
  @IsString()
  @Length(2, 100)
  name!: string;

  @ApiProperty({ example: 'cliente@example.com' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail()
  @MaxLength(150)
  email!: string;

  @ApiProperty({ minLength: 8, maxLength: 72, writeOnly: true })
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  password!: string;

  @ApiProperty({ example: true })
  @IsBoolean()
  @Equals(true)
  acceptedTerms!: true;

  @ApiProperty({ example: 'v1.0', maxLength: 50 })
  @Transform(trim)
  @IsString()
  @Length(1, 50)
  termsVersion!: string;

  @ApiProperty({ example: 'v1.0', maxLength: 50 })
  @Transform(trim)
  @IsString()
  @Length(1, 50)
  privacyVersion!: string;
}

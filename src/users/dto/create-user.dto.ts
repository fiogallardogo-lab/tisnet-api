import { Transform } from 'class-transformer';
import {
  Equals,
  IsBoolean,
  IsEmail,
  IsIn,
  IsString,
  Length,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

import { PLATFORM_ROLES } from '../../common/constants/platform-roles';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

const ADMIN_CREATABLE_ROLES = [
  PLATFORM_ROLES.CLIENT,
  PLATFORM_ROLES.DEVELOPER,
  PLATFORM_ROLES.PRODUCT_OWNER,
  PLATFORM_ROLES.ADMIN,
] as const;

export class CreateUserDto {
  @ApiProperty({
    example: 'Usuario TISNET',
    minLength: 2,
    maxLength: 100,
  })
  @Transform(trim)
  @IsString()
  @Length(2, 100)
  name!: string;

  @ApiProperty({
    example: 'usuario@tisnet.com',
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail()
  @MaxLength(150)
  email!: string;

  @ApiProperty({
    minLength: 8,
    maxLength: 72,
    writeOnly: true,
  })
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  password!: string;

  @ApiProperty({
    enum: ADMIN_CREATABLE_ROLES,
    example: PLATFORM_ROLES.DEVELOPER,
  })
  @IsIn(ADMIN_CREATABLE_ROLES)
  role!: (typeof ADMIN_CREATABLE_ROLES)[number];

  @ApiProperty({
    example: true,
  })
  @IsBoolean()
  @Equals(true)
  acceptedTerms!: true;

  @ApiProperty({
    example: 'v1.0',
    maxLength: 50,
  })
  @Transform(trim)
  @IsString()
  @Length(1, 50)
  termsVersion!: string;

  @ApiProperty({
    example: 'v1.0',
    maxLength: 50,
  })
  @Transform(trim)
  @IsString()
  @Length(1, 50)
  privacyVersion!: string;
}

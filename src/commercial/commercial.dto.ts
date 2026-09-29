import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  Equals,
  IsBoolean,
  IsDateString,
  IsEmail,
  IsInt,
  IsOptional,
  IsString,
  Length,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;
export class EditQuoteDto {
  @ApiProperty({
    description: 'Valor updatedAt recibido al consultar la cotización',
  })
  @IsDateString()
  expectedUpdatedAt!: string;
  @ApiPropertyOptional()
  @ValidateIf((_object, value) => value !== undefined)
  @Transform(trim)
  @IsString()
  @Length(2, 100)
  fullName?: string;
  @ApiPropertyOptional()
  @ValidateIf((_object, value) => value !== undefined)
  @Transform(trim)
  @IsString()
  @Length(7, 30)
  phone?: string;
  @ApiPropertyOptional()
  @ValidateIf((_object, value) => value !== undefined)
  @Transform(trim)
  @IsString()
  @MaxLength(150)
  company?: string;
  @ApiPropertyOptional()
  @ValidateIf((_object, value) => value !== undefined)
  @Transform(trim)
  @IsString()
  @MaxLength(5000)
  notes?: string;
}
export class ObservationDto {
  @ApiProperty() @IsInt() @Min(1) versionId!: number;
  @ApiProperty({ maxLength: 2000 })
  @Transform(trim)
  @IsString()
  @Length(1, 2000)
  text!: string;
}
export class AcceptQuoteDto {
  @ApiProperty({
    description: 'ID persistido de QuoteVersion, no su número secuencial',
  })
  @IsInt()
  @Min(1)
  versionId!: number;
  @ApiProperty({ enum: [true] }) @IsBoolean() @Equals(true) accepted!: true;
}
export class ContactDto {
  @ApiProperty() @Transform(trim) @IsString() @Length(2, 100) name!: string;
  @ApiProperty()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail()
  @MaxLength(150)
  email!: string;
  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(30)
  phone?: string;
  @ApiProperty() @Transform(trim) @IsString() @Length(3, 150) subject!: string;
  @ApiProperty()
  @Transform(trim)
  @IsString()
  @Length(10, 5000)
  message!: string;
}
export class ActivationDto {
  @ApiProperty({ writeOnly: true })
  @IsString()
  @Length(20, 3000)
  token!: string;
  @ApiProperty({ writeOnly: true, minLength: 8, maxLength: 72 })
  @IsString()
  @Length(8, 72)
  password!: string;
  @ApiProperty({ enum: [true] })
  @IsBoolean()
  @Equals(true)
  acceptedTerms!: true;
  @ApiProperty()
  @Transform(trim)
  @IsString()
  @Length(1, 50)
  termsVersion!: string;
  @ApiProperty()
  @Transform(trim)
  @IsString()
  @Length(1, 50)
  privacyVersion!: string;
}
export class InviteClientDto {
  @ApiProperty() @Transform(trim) @IsString() @Length(2, 100) name!: string;
  @ApiProperty()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail()
  @MaxLength(150)
  email!: string;
}
export class RequestActivationDto {
  @ApiProperty()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail()
  @MaxLength(150)
  email!: string;
}

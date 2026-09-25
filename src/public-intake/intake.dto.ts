import { Type, Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayUnique,
  Equals,
  IsArray,
  IsEmail,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;
export class QuoteOptionDto {
  @IsString() @MaxLength(40) code: string;
}
export class QuoteContactDto {
  @Transform(trim) @IsString() @MinLength(2) @MaxLength(100) fullName: string;
  @Transform(trim) @IsEmail() @MaxLength(150) email: string;
  @Transform(trim) @Matches(/^[+\d ()-]{7,30}$/) phone: string;
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MinLength(2)
  @MaxLength(150)
  company?: string;
}
export class CreateQuoteDto {
  @IsIn([
    'LANDING_PAGE',
    'CORPORATE_SITE',
    'ECOMMERCE',
    'PERSONAL_PORTFOLIO',
    'WEB_APP',
    'SAAS_PLATFORM',
    'MOBILE_APP',
    'CUSTOM_SOFTWARE',
  ])
  solutionType: string;
  @IsOptional() @IsIn(['NORMAL', 'URGENT', 'FLEXIBLE']) deliveryMode: string =
    'NORMAL';
  @IsOptional() @Equals('SP-01-v2') catalogVersion?: string;
  @IsArray()
  @ArrayMaxSize(8)
  @ArrayUnique((item: QuoteOptionDto) => item.code)
  @ValidateNested({ each: true })
  @Type(() => QuoteOptionDto)
  options: QuoteOptionDto[];
  @IsNotEmpty()
  @ValidateNested()
  @Type(() => QuoteContactDto)
  contact: QuoteContactDto;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(1000) notes?: string;
}
export class TeamApplicationDto {
  @IsIn(['DEVELOPER', 'PRODUCT_OWNER']) requestedRole:
    'DEVELOPER' | 'PRODUCT_OWNER';
  @Transform(trim) @IsString() @MinLength(2) @MaxLength(100) fullName: string;
  @Type(() => Number) @IsInt() @Min(1) @Max(130) age: number;
  @Transform(trim) @IsString() @IsNotEmpty() @MaxLength(100) district: string;
  @Transform(trim) @IsEmail() @MaxLength(150) email: string;
  @Transform(trim) @Matches(/^[+\d ()-]{7,30}$/) phone: string;
  @Matches(/^\d{8}$/) dni: string;
  @Transform(trim) @IsString() @IsNotEmpty() @MaxLength(150) career: string;
  @Transform(trim) @IsString() @IsNotEmpty() @MaxLength(180) university: string;
  @Type(() => Number) @IsInt() @Min(0) @Max(80) experienceYears: number;
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  programmingLanguages: string;
  @IsIn(['BACKEND', 'FRONTEND', 'FULL_STACK']) specialty: string;
  @Equals('true') consent: string;
}

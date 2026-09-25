import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
export class ProjectParticipantDto {
  @IsInt() @Min(1) userId: number;
  @IsIn(['DEVELOPER', 'PRODUCT_OWNER']) role: 'DEVELOPER' | 'PRODUCT_OWNER';
  @IsInt() @Min(1) @Max(10000) participationBasisPoints: number;
}
export class ProjectTeamDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ArrayUnique((x: ProjectParticipantDto) => x.userId)
  @ValidateNested({ each: true })
  @Type(() => ProjectParticipantDto)
  members: ProjectParticipantDto[];
}
export class KickoffDto extends ProjectTeamDto {
  @IsInt() @Min(1) quoteId: number;
  @IsString() @Matches(/\S/) @MaxLength(150) name: string;
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/) @MaxLength(180) slug: string;
  @IsInt() @Min(1) categoryId: number;
  @IsDateString({ strict: true }) heldAt: string;
  @IsOptional() @IsString() @MaxLength(2000) notes?: string;
}

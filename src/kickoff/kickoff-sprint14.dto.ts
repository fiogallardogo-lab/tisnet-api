import { Type } from 'class-transformer';
import {
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
} from 'class-validator';

/** S14-B07: Validated DTO for scheduling or updating a kickoff from a project */
export class ScheduleKickoffDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  advisorId?: number;

  @IsDateString({ strict: true })
  scheduledAt: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}

export class ReviewKickoffDto {
  @IsIn(['CONFIRM', 'RESCHEDULE'])
  action: 'CONFIRM' | 'RESCHEDULE';

  @IsOptional()
  @IsDateString({ strict: true })
  scheduledAt?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}

/** S14-B07: Validated DTO for adding a single member to a project */
export class AddMemberDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  technicalRole?: string;

  @IsInt()
  @Min(1)
  userId: number;

  @IsIn(['DEVELOPER'])
  memberRole: 'DEVELOPER';

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10000)
  participationBasisPoints?: number;
}

/** DTO item for a single team member in the bulk replace operation */
export class TeamMemberDto {
  @IsInt()
  @Min(1)
  userId: number;

  @IsIn(['DEVELOPER', 'PRODUCT_OWNER'])
  role: 'DEVELOPER' | 'PRODUCT_OWNER';

  @IsInt()
  @Min(1)
  @Max(10000)
  participationBasisPoints: number;
}

/** DTO for bulk-replacing a project team */
export class SetProjectTeamDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ArrayUnique((x: TeamMemberDto) => x.userId)
  @ValidateNested({ each: true })
  @Type(() => TeamMemberDto)
  members: TeamMemberDto[];
}

/** S14-B05: Validated DTO for assigning a Product Owner */
export class AssignProductOwnerDto {
  @IsInt()
  @Min(1)
  userId: number;
}

import { IsBoolean, IsIn, IsOptional } from 'class-validator';

const MANAGEABLE_ROLES = ['CLIENT', 'DEVELOPER', 'PRODUCT_OWNER', 'ADMIN'] as const;

export class UpdateUserDto {
  @IsOptional()
  @IsIn(MANAGEABLE_ROLES)
  role?: (typeof MANAGEABLE_ROLES)[number];

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

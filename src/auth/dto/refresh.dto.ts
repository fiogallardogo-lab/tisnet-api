import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RefreshDto {
  @ApiProperty({ description: 'Refresh token returned by the login endpoint' })
  @IsString()
  @IsNotEmpty({ message: 'El token de refresco es obligatorio' })
  refreshToken!: string;
}

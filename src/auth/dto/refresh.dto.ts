import { IsNotEmpty, IsString } from 'class-validator';

export class RefreshDto {
  @IsString()
  @IsNotEmpty({ message: 'El token de refresco es obligatorio' })
  refreshToken!: string;
}
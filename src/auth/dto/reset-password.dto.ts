import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength, MinLength, ValidateIf } from 'class-validator';

export class ResetPasswordDto {
  @ApiProperty({
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    description: 'Token temporal recibido en el correo de recuperación',
  })
  @IsString({ message: 'El token debe ser una cadena de texto' })
  @IsNotEmpty({ message: 'El token de restablecimiento es obligatorio' })
  token!: string;

  @ApiPropertyOptional({
    example: 'MiNuevaClaveSegura2026!',
    minLength: 8,
    maxLength: 72,
    writeOnly: true,
    description: 'Nueva contraseña para la cuenta (campo canónico newPassword)',
  })
  @ValidateIf((o) => !o.password || o.newPassword)
  @IsString({ message: 'La nueva contraseña debe ser una cadena de texto' })
  @MinLength(8, { message: 'La contraseña debe tener al menos 8 caracteres' })
  @MaxLength(72, { message: 'La contraseña no puede exceder 72 caracteres' })
  newPassword?: string;

  @ApiPropertyOptional({
    example: 'MiNuevaClaveSegura2026!',
    minLength: 8,
    maxLength: 72,
    writeOnly: true,
    description: 'Contraseña para la cuenta (alias password enviado por frontend)',
  })
  @ValidateIf((o) => !o.newPassword)
  @IsString({ message: 'La nueva contraseña debe ser una cadena de texto' })
  @MinLength(8, { message: 'La contraseña debe tener al menos 8 caracteres' })
  @MaxLength(72, { message: 'La contraseña no puede exceder 72 caracteres' })
  password?: string;
}

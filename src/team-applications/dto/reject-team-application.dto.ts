import { Transform } from 'class-transformer';
import { IsString, Length } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class RejectTeamApplicationDto {
  @ApiProperty({
    minLength: 20,
    maxLength: 1000,
    example:
      'Actualmente buscamos un perfil con mayor experiencia en proyectos productivos.',
  })
  @Transform(trim)
  @IsString()
  @Length(20, 1000)
  reason!: string;
}

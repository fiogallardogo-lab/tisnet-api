import { ApiProperty } from '@nestjs/swagger';
import { ValidateBy } from 'class-validator';

function IsPositiveIntegerOrNull() {
  return ValidateBy({
    name: 'isPositiveIntegerOrNull',
    validator: {
      validate: (value: unknown) =>
        value === null ||
        (typeof value === 'number' && Number.isSafeInteger(value) && value > 0),
      defaultMessage: () =>
        'advisorProfileId debe ser un entero positivo o null',
    },
  });
}

export class AssignProspectAdvisorDto {
  @ApiProperty({
    type: Number,
    nullable: true,
    example: 4,
    description: 'ID de AdminProfile; null elimina la asignación actual.',
  })
  @IsPositiveIntegerOrNull()
  advisorProfileId!: number | null;
}

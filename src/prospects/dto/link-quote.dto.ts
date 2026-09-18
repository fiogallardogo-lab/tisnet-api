import { Transform } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches } from 'class-validator';

const normalizeQuoteCode = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toUpperCase() : value;

export class LinkQuoteDto {
  @ApiProperty({ example: 'Q-ABCDEFGH' })
  @Transform(normalizeQuoteCode)
  @IsString()
  @Matches(/^Q-[A-HJ-NP-Z2-9]{8}$/, {
    message: 'publicCode debe tener el formato Q-XXXXXXXX',
  })
  publicCode!: string;
}

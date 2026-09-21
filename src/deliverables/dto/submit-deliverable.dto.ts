import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUrl, MaxLength } from 'class-validator';

const HTTP_URL_OPTIONS = {
  protocols: ['http', 'https'],
  require_protocol: true,
};

export class SubmitDeliverableDto {
  @ApiPropertyOptional({
    example: 'https://files.example.com/prototype-v1.pdf',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  @IsUrl(HTTP_URL_OPTIONS)
  fileUrl?: string;

  @ApiPropertyOptional({ example: 'https://www.figma.com/proto/example' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  @IsUrl(HTTP_URL_OPTIONS)
  externalLink?: string;
}

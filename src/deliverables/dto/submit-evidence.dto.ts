import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, IsUrl, MaxLength } from 'class-validator';

const HTTP_URL_OPTIONS = {
  protocols: ['http', 'https'],
  require_protocol: true,
};

export class SubmitEvidenceDto {
  @ApiPropertyOptional({
    example: 'https://storage.tisnet.pe/deliverables/informe-hito-1.pdf',
    description: 'URL del archivo PDF técnico cargado.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  @IsUrl(HTTP_URL_OPTIONS, { message: 'El enlace del documento debe ser una URL válida (http/https)' })
  pdfUrl?: string;

  @ApiPropertyOptional({
    example: 'https://storage.tisnet.pe/deliverables/informe-hito-1.pdf',
    description: 'Alias de pdfUrl para compatibilidad con submit.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  @IsUrl(HTTP_URL_OPTIONS, { message: 'fileUrl debe ser una URL válida (http/https)' })
  fileUrl?: string;

  @ApiProperty({
    example: 'https://www.loom.com/share/demo-hito-1',
    description: 'URL del video o enlace de demostración.',
  })
  @IsNotEmpty({ message: 'El enlace de video o demostración es obligatorio.' })
  @IsString()
  @MaxLength(500)
  @IsUrl(HTTP_URL_OPTIONS, { message: 'El videoUrl debe ser una URL válida (http/https)' })
  videoUrl: string;

  @ApiPropertyOptional({
    example: 'Entrega técnica del hito 1 con cobertura de pruebas.',
    description: 'Notas o comentarios sobre la evidencia enviada.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}

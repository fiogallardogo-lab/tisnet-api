import { ApiProperty } from '@nestjs/swagger';
class HealthDatabaseDto {
  @ApiProperty({ enum: ['CONNECTED', 'DISCONNECTED'] }) status!:
    'CONNECTED' | 'DISCONNECTED';
  @ApiProperty() latencyMs!: number;
}
class HealthMemoryDto {
  @ApiProperty() rssMb!: number;
  @ApiProperty() heapUsedMb!: number;
}
export class HealthDto {
  @ApiProperty({ enum: ['UP', 'DEGRADED'] }) status!: 'UP' | 'DEGRADED';
  @ApiProperty({ enum: ['v1'] }) apiVersion!: 'v1';
  @ApiProperty({
    description: 'SHA incorporado en APP_COMMIT, unknown si no se configuró',
  })
  commit!: string;
  @ApiProperty({ format: 'date-time' }) timestamp!: string;
  @ApiProperty() uptimeSeconds!: number;
  @ApiProperty({ type: HealthDatabaseDto }) database!: HealthDatabaseDto;
  @ApiProperty({ type: HealthMemoryDto }) memory!: HealthMemoryDto;
  @ApiProperty() environment!: string;
}

import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AppService } from './app.service.js';
import { PrismaService } from './prisma/prisma.service.js';

@ApiTags('System & Health')
@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('health')
  @ApiOperation({ summary: 'Verificar estado de salud y conectividad de la plataforma (S15-B11)' })
  @ApiResponse({ status: 200, description: 'Servicio y dependencias operativas' })
  async getHealth() {
    let databaseStatus = 'CONNECTED';
    let dbLatencyMs = 0;
    try {
      const start = Date.now();
      await this.prisma.$queryRaw`SELECT 1`;
      dbLatencyMs = Date.now() - start;
    } catch {
      databaseStatus = 'DISCONNECTED';
    }

    const memoryUsage = process.memoryUsage();
    return {
      status: databaseStatus === 'CONNECTED' ? 'UP' : 'DEGRADED',
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor(process.uptime()),
      database: {
        status: databaseStatus,
        latencyMs: dbLatencyMs,
      },
      memory: {
        rssMb: Math.round((memoryUsage.rss / 1024 / 1024) * 100) / 100,
        heapUsedMb: Math.round((memoryUsage.heapUsed / 1024 / 1024) * 100) / 100,
      },
      environment: process.env.NODE_ENV || 'development',
    };
  }
}

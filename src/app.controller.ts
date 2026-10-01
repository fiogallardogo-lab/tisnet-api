import { HealthDto } from './dashboard/health.dto';
import { ApiWorkResponse } from './work/work-swagger';
import type { Response } from 'express';
import { Controller, Get, Res } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
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
  @ApiOperation({
    summary:
      'Verificar estado de salud y conectividad de la plataforma (S15-B11)',
  })
  @ApiWorkResponse(HealthDto)
  @ApiWorkResponse(HealthDto, 503)
  async getHealth(@Res({ passthrough: true }) response?: Response) {
    let databaseStatus = 'CONNECTED';
    let dbLatencyMs = 0;
    try {
      const start = Date.now();
      await this.prisma.$queryRaw`SELECT 1`;
      dbLatencyMs = Date.now() - start;
    } catch {
      databaseStatus = 'DISCONNECTED';
      response?.status(503);
    }

    const memoryUsage = process.memoryUsage();
    return {
      status: databaseStatus === 'CONNECTED' ? 'UP' : 'DEGRADED',
      apiVersion: 'v1',
      commit: process.env.APP_COMMIT || 'unknown',
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor(process.uptime()),
      database: {
        status: databaseStatus,
        latencyMs: dbLatencyMs,
      },
      memory: {
        rssMb: Math.round((memoryUsage.rss / 1024 / 1024) * 100) / 100,
        heapUsedMb:
          Math.round((memoryUsage.heapUsed / 1024 / 1024) * 100) / 100,
      },
      environment: process.env.NODE_ENV || 'development',
    };
  }
}

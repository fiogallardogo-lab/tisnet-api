import { Test, TestingModule } from '@nestjs/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { PrismaService } from './prisma/prisma.service.js';

describe('AppController', () => {
  let appController: AppController;
  let prisma: { $queryRaw: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    prisma = {
      $queryRaw: vi.fn().mockResolvedValue([{ 1: 1 }]),
    };

    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        AppService,
        {
          provide: PrismaService,
          useValue: prisma,
        },
      ],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('root', () => {
    it('should return "Hello World!"', () => {
      expect(appController.getHello()).toBe('Hello World!');
    });
  });

  describe('health (S15-B11)', () => {
    it('should return UP and database status when database is reachable', async () => {
      const health = await appController.getHealth();
      expect(health.status).toBe('UP');
      expect(health.apiVersion).toBe('v1');
      expect(health.commit).toBe(process.env.APP_COMMIT || 'unknown');
      expect(health.database.status).toBe('CONNECTED');
      expect(health.uptimeSeconds).toBeGreaterThanOrEqual(0);
    });

    it('should return DEGRADED when database fails', async () => {
      prisma.$queryRaw.mockRejectedValueOnce(new Error('Connection lost'));
      const response = { status: vi.fn() };
      const health = await appController.getHealth(response as any);
      expect(response.status).toHaveBeenCalledWith(503);
      expect(health.status).toBe('DEGRADED');
      expect(health.database.status).toBe('DISCONNECTED');
    });
  });
});

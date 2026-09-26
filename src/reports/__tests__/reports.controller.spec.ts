import { vi, describe, beforeEach, it, expect } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { ReportsController } from '../reports.controller';
import { ReportsService } from '../reports.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';

describe('ReportsController', () => {
  let controller: ReportsController;
  let service: ReportsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ReportsController],
      providers: [
        {
          provide: ReportsService,
          useValue: {
            getProjectsReport: vi.fn().mockResolvedValue({ canViewFinance: true, projects: [] }),
          },
        },
      ],
    })
    .overrideGuard(JwtAuthGuard).useValue({ canActivate: vi.fn(() => true) })
    .overrideGuard(RolesGuard).useValue({ canActivate: vi.fn(() => true) })
    .compile();

    controller = module.get<ReportsController>(ReportsController);
    service = module.get<ReportsService>(ReportsService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should pass projectId and user to service', async () => {
    const req = { user: { id: 1, role: 'ADMIN' } };
    const res = await controller.getProjectsReport('123', req);
    
    expect(service.getProjectsReport).toHaveBeenCalledWith(req.user, 123);
    expect(res.canViewFinance).toBe(true);
  });

  it('should pass undefined projectId if query is empty or invalid', async () => {
    const req = { user: { id: 1, role: 'ADMIN' } };
    await controller.getProjectsReport(undefined, req);
    expect(service.getProjectsReport).toHaveBeenCalledWith(req.user, undefined);
    
    await controller.getProjectsReport('invalid', req);
    expect(service.getProjectsReport).toHaveBeenCalledWith(req.user, undefined);
  });
});

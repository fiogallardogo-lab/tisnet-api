import { vi, describe, beforeEach, it, expect } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { ReportsService } from '../reports.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('ReportsService', () => {
  let service: ReportsService;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReportsService,
        {
          provide: PrismaService,
          useValue: {
            project: {
              findMany: vi.fn(),
            },
          },
        },
      ],
    }).compile();

    service = module.get<ReportsService>(ReportsService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getProjectsReport', () => {
    it('should calculate progress and financials correctly for ADMIN', async () => {
      const mockUser = { id: 1, role: 'ADMIN' };
      const mockProjects = [
        {
          id: 101,
          name: 'Test Project',
          quote: {
            amountMinor: 50000,
            currency: 'PEN',
            versions: [
              {
                schedules: [
                  {
                    payments: [
                      { amountMinor: 25000, status: 'CONFIRMED' },
                    ]
                  }
                ]
              }
            ]
          },
          deliverables: [
            { status: 'APPROVED' },
            { status: 'PENDING' },
          ]
        }
      ];

      (prisma.project.findMany as any).mockResolvedValue(mockProjects);

      const result = await service.getProjectsReport(mockUser);

      expect(result.canViewFinance).toBe(true);
      expect(result.projects.length).toBe(1);
      
      const p = result.projects[0];
      expect(p.projectId).toBe(101);
      expect(p.name).toBe('Test Project');
      expect(p.progress).toBe(50); // 1 out of 2 approved
      expect(p.approvedDeliverables).toBe(1);
      expect(p.pendingDeliverables).toBe(1);
      expect(p.totalMinor).toBe(50000);
      expect(p.paidMinor).toBe(25000);
      expect(p.currency).toBe('PEN');
      // Ensure no sensitive data exposed
      expect(p).not.toHaveProperty('passwordHash');
    });

    it('should restrict finance view for non-admins (e.g. USER) and filter by members', async () => {
      const mockUser = { id: 2, role: 'DEVELOPER' };
      const mockProjects = [
        {
          id: 102,
          name: 'Dev Project',
          quote: {
            amountMinor: 10000,
            currency: 'USD',
            versions: []
          },
          deliverables: []
        }
      ];

      (prisma.project.findMany as any).mockResolvedValue(mockProjects);

      const result = await service.getProjectsReport(mockUser);

      expect(prisma.project.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            members: { some: { userId: 2, isActive: true } }
          })
        })
      );

      expect(result.canViewFinance).toBe(false);
      expect(result.projects[0].progress).toBe(0);
      expect(result.projects[0].totalMinor).toBeUndefined();
      expect(result.projects[0].paidMinor).toBeUndefined();
    });

    it('should return empty projects array if project does not exist', async () => {
      const mockUser = { id: 1, role: 'ADMIN' };
      (prisma.project.findMany as any).mockResolvedValue([]);

      const result = await service.getProjectsReport(mockUser, 999);

      expect(prisma.project.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ id: 999 })
        })
      );
      expect(result.projects.length).toBe(0);
    });
  });
});

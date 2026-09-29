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

  describe('getProjectTraceabilityReport and renderProjectReportPdf', () => {
    it('generates traceability data and renders valid PDF buffer', async () => {
      const mockProject = {
        id: 10,
        name: 'Plataforma E-commerce',
        slug: 'plataforma-ecommerce',
        status: 'IN_DEVELOPMENT',
        createdAt: new Date(),
        clientUserId: 4,
        productOwnerId: 3,
        client: { id: 4, name: 'Lucía López', email: 'lucia@example.com' },
        productOwner: { id: 3, name: 'Pedro PO', email: 'pedro@example.com' },
        members: [
          {
            userId: 2,
            memberRole: 'DEVELOPER',
            technicalRole: 'Backend Lead',
            participationBasisPoints: 5000,
            isActive: true,
            user: { id: 2, name: 'Carlos Dev', email: 'carlos@example.com' },
          },
        ],
        quote: {
          publicCode: 'COT-2026-001',
          versions: [
            {
              version: 1,
              amountMinor: 150000,
              currency: 'PEN',
              schedules: [
                { id: 1, sequence: 1, payments: [{ id: 1, status: 'CONFIRMED' }] },
              ],
            },
          ],
        },
        deliverables: [
          {
            id: 101,
            milestoneOrder: 1,
            title: 'Hito 1: Arquitectura y API',
            description: 'Modelos y pruebas base',
            status: 'APPROVED',
            dueDate: new Date('2026-10-15'),
            fileUrl: 'https://files.example.com/arch.pdf',
            externalLink: 'https://loom.com/share/demo',
            feedbackNotes: 'Aprobado sin observaciones',
            submittedAt: new Date(),
            reviewedAt: new Date(),
            reviewedBy: { id: 4, name: 'Lucía López' },
            contributions: [
              {
                userId: 2,
                percentage: 100,
                description: 'Implementación completa',
                user: { id: 2, name: 'Carlos Dev', email: 'carlos@example.com' },
              },
            ],
            history: [
              {
                action: 'SUBMITTED',
                actor: { id: 2, name: 'Carlos Dev', role: { name: 'DEVELOPER' } },
                fileUrl: 'https://files.example.com/arch.pdf',
                externalLink: 'https://loom.com/share/demo',
                feedbackNotes: null,
                createdAt: new Date(),
              },
            ],
          },
        ],
      };

      prisma.project.findUnique = vi.fn().mockResolvedValue(mockProject);

      const report = await service.getProjectTraceabilityReport({ id: 1, role: 'ADMIN' }, 10);
      expect(report.project.name).toBe('Plataforma E-commerce');
      expect(report.milestones.length).toBe(1);
      expect(report.milestones[0].contributions[0].percentage).toBe(100);

      const pdf = await service.renderProjectReportPdf(report);
      expect(Buffer.isBuffer(pdf)).toBe(true);
      expect(pdf.length).toBeGreaterThan(100);
      expect(pdf.subarray(0, 4).toString()).toBe('%PDF');
    });
  });
});


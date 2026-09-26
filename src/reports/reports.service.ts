import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma, ProjectStatus, PaymentStatus } from '@prisma/client';

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async getProjectsReport(user: { id: number; role: string }, projectId?: number) {
    const canViewFinance = ['ADMIN', 'SUPER_ADMIN', 'CLIENT'].includes(user.role);
    
    const where: Prisma.ProjectWhereInput = { status: { notIn: [ProjectStatus.DRAFT, ProjectStatus.ARCHIVED] } };
    if (projectId) {
      where.id = projectId;
    }
    
    if (['CLIENT', 'DEVELOPER', 'PRODUCT_OWNER'].includes(user.role)) {
       where.members = { some: { userId: user.id, isActive: true } };
    }

    const projects = await this.prisma.project.findMany({
      where,
      include: {
        quote: {
          include: {
            versions: {
              include: {
                schedules: {
                  include: {
                    payments: {
                      where: { status: PaymentStatus.CONFIRMED }
                    }
                  }
                }
              }
            }
          }
        },
        deliverables: true
      }
    });

    const reportProjects = projects.map(p => {
      const approvedDeliverables = p.deliverables.filter((d: any) => d.status === 'APPROVED').length;
      const totalDeliverables = p.deliverables.length;
      const progress = totalDeliverables > 0 ? Math.round((approvedDeliverables / totalDeliverables) * 100) : 0;
      
      let paidMinor = 0;
      if (p.quote?.versions) {
        for (const version of p.quote.versions) {
          for (const schedule of version.schedules) {
            for (const pay of schedule.payments) {
              paidMinor += Number(pay.amountMinor);
            }
          }
        }
      }

      return {
        projectId: p.id,
        name: p.name,
        progress,
        approvedDeliverables,
        pendingDeliverables: totalDeliverables - approvedDeliverables,
        ...(canViewFinance ? {
          totalMinor: p.quote?.amountMinor ? Number(p.quote.amountMinor) : undefined,
          paidMinor,
          currency: p.quote?.currency ?? undefined
        } : {})
      };
    });

    return {
      canViewFinance,
      projects: reportProjects,
      generatedAt: new Date().toISOString()
    };
  }
}

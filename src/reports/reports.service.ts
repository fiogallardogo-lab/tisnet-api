import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma, ProjectStatus, PaymentStatus } from '@prisma/client';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async getProjectsReport(
    user: { id: number; role: string },
    projectId?: number,
  ) {
    const canViewFinance = ['ADMIN', 'SUPER_ADMIN', 'CLIENT'].includes(
      user.role,
    );

    const where: Prisma.ProjectWhereInput = {
      status: { notIn: [ProjectStatus.DRAFT, ProjectStatus.ARCHIVED] },
    };
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
                      where: { status: PaymentStatus.CONFIRMED },
                    },
                  },
                },
              },
            },
          },
        },
        deliverables: true,
      },
    });

    const reportProjects = projects.map((p) => {
      const approvedDeliverables = p.deliverables.filter(
        (d: any) => d.status === 'APPROVED',
      ).length;
      const totalDeliverables = p.deliverables.length;
      const progress =
        totalDeliverables > 0
          ? Math.round((approvedDeliverables / totalDeliverables) * 100)
          : 0;

      const officialVersion = p.quote?.versions.find(
        (v) => v.version === p.quote?.activeVersion,
      );
      let paidMinor = 0;
      if (p.quote?.versions) {
        for (const version of p.quote.versions.filter(
          (v) => v.version === p.quote?.activeVersion,
        )) {
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
        ...(canViewFinance &&
        (user.role !== 'CLIENT' || p.clientUserId === user.id)
          ? {
              totalMinor: officialVersion
                ? Number(officialVersion.amountMinor)
                : undefined,
              paidMinor,
              currency: officialVersion?.currency,
            }
          : {}),
      };
    });

    return {
      canViewFinance,
      projects: reportProjects,
      generatedAt: new Date().toISOString(),
    };
  }

  async getProjectTraceabilityReport(
    user: { id: number; role: string },
    projectId: number,
  ) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: {
        client: { select: { id: true, name: true } },
        productOwner: { select: { id: true, name: true } },
        members: {
          where: { isActive: true },
          include: {
            user: { select: { id: true, name: true } },
          },
        },
        quote: {
          include: {
            versions: {
              orderBy: { version: 'desc' },

              include: {
                schedules: {
                  orderBy: { sequence: 'asc' },
                  include: {
                    payments: { where: { status: PaymentStatus.CONFIRMED } },
                  },
                },
              },
            },
          },
        },
        deliverables: {
          orderBy: { milestoneOrder: 'asc' },
          include: {
            reviewedBy: { select: { id: true, name: true } },
            history: {
              include: {
                actor: {
                  select: {
                    id: true,
                    name: true,
                    role: { select: { name: true } },
                  },
                },
              },
              orderBy: { createdAt: 'asc' },
            },
            contributions: {
              include: {
                user: { select: { id: true, name: true } },
              },
            },
          },
        },
      },
    });

    if (!project) {
      throw new NotFoundException('Proyecto no encontrado.');
    }

    const isAdmin = ['ADMIN', 'SUPER_ADMIN'].includes(user.role);
    const isMember = project.members.some((m) => m.userId === user.id);
    const isClient = project.clientUserId === user.id;
    const isPo = project.productOwnerId === user.id;

    if (!isAdmin && !isMember && !isClient && !isPo) {
      throw new ForbiddenException(
        'No tienes permisos para ver el informe de este proyecto.',
      );
    }

    const activeVersion =
      isAdmin || (user.role === 'CLIENT' && isClient)
        ? project.quote?.versions?.find(
            (v) => v.version === project.quote?.activeVersion,
          )
        : undefined;
    const totalDeliverables = project.deliverables.length;
    const approvedDeliverables = project.deliverables.filter(
      (d) => d.status === 'APPROVED',
    ).length;
    const progress =
      totalDeliverables > 0
        ? Math.round((approvedDeliverables / totalDeliverables) * 100)
        : 0;

    // Aggregate team contributions
    const contributionMap = new Map<
      number,
      {
        user: { id: number; name: string };
        percentageSum: number;
        count: number;
        tasks: string[];
      }
    >();
    for (const d of project.deliverables) {
      for (const c of d.contributions) {
        const item = contributionMap.get(c.userId) ?? {
          user: { id: c.user.id, name: c.user.name },
          percentageSum: 0,
          count: 0,
          tasks: [],
        };
        item.percentageSum += c.percentage;
        item.count += 1;
        item.tasks.push(c.description);
        contributionMap.set(c.userId, item);
      }
    }

    const teamContributions = Array.from(contributionMap.values()).map((c) => ({
      userId: c.user.id,
      name: c.user.name,
      averagePercentage:
        Math.round((c.percentageSum / (totalDeliverables || 1)) * 100) / 100,
      milestonesContributed: c.count,
      tasks: c.tasks,
    }));

    return {
      project: {
        id: project.id,
        name: project.name,
        slug: project.slug,
        status: project.status,
        progress,
        createdAt: project.createdAt,
        client: project.client ? { name: project.client.name } : null,
        productOwner: project.productOwner
          ? { name: project.productOwner.name }
          : null,
      },
      commercial: activeVersion
        ? {
            quoteCode: project.quote?.publicCode,
            version: activeVersion.version,
            amountMinor: Number(activeVersion.amountMinor),
            currency: activeVersion.currency,
            schedulesCount: activeVersion.schedules.length,
          }
        : null,
      team: project.members.map((m) => ({
        id: m.userId,
        name: m.user.name,
        memberRole: m.memberRole,
        technicalRole: m.technicalRole,
        participationBasisPoints: m.participationBasisPoints,
      })),
      milestones: project.deliverables.map((d) => ({
        id: d.id,
        milestoneOrder: d.milestoneOrder,
        title: d.title,
        description: d.description,
        status: d.status,
        dueDate: d.dueDate,
        pdfUrl: d.fileUrl,
        videoUrl: d.externalLink,
        feedbackNotes: d.feedbackNotes,
        submittedAt: d.submittedAt,
        reviewedAt: d.reviewedAt,
        reviewedBy: d.reviewedBy ? d.reviewedBy.name : null,
        contributions: d.contributions.map((c) => ({
          userId: c.userId,
          name: c.user.name,
          percentage: c.percentage,
          description: c.description,
        })),
        history: d.history.map((h) => ({
          action: h.action,
          actorName: h.actor.name,
          actorRole: h.actor.role.name,
          fileUrl: h.fileUrl,
          videoUrl: h.externalLink,
          comments: h.feedbackNotes,
          timestamp: h.createdAt,
        })),
      })),
      teamContributions,
      generatedAt: new Date().toISOString(),
    };
  }

  async renderProjectReportPdf(reportData: any): Promise<Buffer> {
    const pdfDoc = await PDFDocument.create();
    let page = pdfDoc.addPage([595.28, 841.89]);
    const regularFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    let y = 790;
    const writeLine = (
      text: string,
      options?: {
        bold?: boolean;
        size?: number;
        spacing?: number;
        indent?: number;
        color?: any;
      },
    ) => {
      const size = options?.size ?? 10;
      const spacing = options?.spacing ?? 14;
      const indent = options?.indent ?? 50;
      const color = options?.color ?? rgb(0.1, 0.1, 0.1);

      if (y < 50) {
        page = pdfDoc.addPage([595.28, 841.89]);
        y = 790;
      }

      const sanitized = text.replace(/[^\x20-\x7E\xA0-\xFF]/g, ' ');
      page.drawText(sanitized, {
        x: indent,
        y,
        size,
        font: options?.bold ? boldFont : regularFont,
        color,
      });

      y -= spacing;
    };

    // Header
    writeLine('TISNET SOLUCIONES TECNOLÓGICAS', {
      bold: true,
      size: 16,
      spacing: 20,
    });
    writeLine('Informe Oficial de Trazabilidad y Cierre de Proyecto', {
      bold: true,
      size: 12,
      spacing: 25,
    });

    // Project Info
    writeLine('1. DATOS DEL PROYECTO', { bold: true, size: 11, spacing: 16 });
    writeLine(
      `Proyecto: ${reportData.project.name} (ID: ${reportData.project.id})`,
      { indent: 60 },
    );
    writeLine(
      `Estado: ${reportData.project.status} | Avance: ${reportData.project.progress}%`,
      { indent: 60 },
    );
    writeLine(
      `Cliente: ${reportData.project.client?.name ?? 'No asignado'} (${reportData.project.client?.email ?? '-'})`,
      { indent: 60 },
    );
    writeLine(
      `Product Owner: ${reportData.project.productOwner?.name ?? 'No asignado'} (${reportData.project.productOwner?.email ?? '-'})`,
      { indent: 60, spacing: 20 },
    );

    // Commercial Info
    if (reportData.commercial) {
      writeLine('2. ACUERDO COMERCIAL Y FINANCIERO', {
        bold: true,
        size: 11,
        spacing: 16,
      });
      writeLine(
        `Cotización: ${reportData.commercial.quoteCode ?? 'N/A'} (Versión ${reportData.commercial.version})`,
        { indent: 60 },
      );
      writeLine(
        `Monto Total: ${reportData.commercial.currency} ${(reportData.commercial.amountMinor / 100).toFixed(2)}`,
        { indent: 60 },
      );
      writeLine(`Cuotas Acordadas: ${reportData.commercial.schedulesCount}`, {
        indent: 60,
        spacing: 20,
      });
    }

    // Team Members
    writeLine('3. EQUIPO DEL PROYECTO', { bold: true, size: 11, spacing: 16 });
    for (const member of reportData.team) {
      const roleStr = member.technicalRole
        ? `${member.memberRole} · ${member.technicalRole}`
        : member.memberRole;
      writeLine(`• ${member.name} (${member.email}) - Rol: ${roleStr}`, {
        indent: 60,
      });
    }
    y -= 10;

    // Milestones & Deliverables
    writeLine('4. EJECUCIÓN POR HITOS Y EVIDENCIAS', {
      bold: true,
      size: 11,
      spacing: 16,
    });
    for (const m of reportData.milestones) {
      writeLine(`Hito #${m.milestoneOrder}: ${m.title} [${m.status}]`, {
        bold: true,
        indent: 60,
        spacing: 14,
      });
      if (m.dueDate)
        writeLine(
          `Fecha límite: ${new Date(m.dueDate).toISOString().slice(0, 10)}`,
          { indent: 70, size: 9 },
        );
      if (m.pdfUrl)
        writeLine(`PDF Técnico: ${m.pdfUrl}`, { indent: 70, size: 9 });
      if (m.videoUrl)
        writeLine(`Video Demo: ${m.videoUrl}`, { indent: 70, size: 9 });
      if (m.reviewedBy)
        writeLine(
          `Revisado por: ${m.reviewedBy} (${m.reviewedAt ? new Date(m.reviewedAt).toISOString().slice(0, 10) : ''})`,
          { indent: 70, size: 9 },
        );
      if (m.feedbackNotes)
        writeLine(`Observaciones: ${m.feedbackNotes}`, { indent: 70, size: 9 });

      // Milestone Contributions
      if (m.contributions?.length) {
        writeLine('Distribución del Hito:', {
          bold: true,
          indent: 70,
          size: 9,
        });
        for (const c of m.contributions) {
          writeLine(`- ${c.name}: ${c.percentage}% (${c.description})`, {
            indent: 80,
            size: 8,
          });
        }
      }
      y -= 8;
    }

    // Team Summary
    if (reportData.teamContributions?.length) {
      writeLine('5. RESUMEN DE CONTRIBUCIONES DEL EQUIPO', {
        bold: true,
        size: 11,
        spacing: 16,
      });
      for (const tc of reportData.teamContributions) {
        writeLine(
          `• ${tc.name}: ${tc.averagePercentage}% de contribución promedio en ${tc.milestonesContributed} hitos`,
          { indent: 60 },
        );
      }
      y -= 10;
    }

    // Footer
    writeLine(
      `Generado el: ${new Date(reportData.generatedAt).toLocaleString('es-PE')} · TISNET Plataforma`,
      {
        size: 8,
        indent: 50,
        color: rgb(0.4, 0.4, 0.4),
        spacing: 10,
      },
    );

    const pdfBytes = await pdfDoc.save();
    return Buffer.from(pdfBytes);
  }
}

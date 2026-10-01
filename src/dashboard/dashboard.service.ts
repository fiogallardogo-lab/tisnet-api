import { ForbiddenException, Injectable } from '@nestjs/common';
import { Prisma, ProjectMemberRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { DashboardDto } from './dashboard.dto';
import { WorkActor } from '../work/work.service';
@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}
  async get(actor: WorkActor, requiredRole: string): Promise<DashboardDto> {
    if (actor.role !== requiredRole)
      throw new ForbiddenException('Dashboard de otro rol');
    const global = ['ADMIN', 'SUPER_ADMIN'].includes(actor.role),
      superadmin = actor.role === 'SUPER_ADMIN';
    const projectWhere: Prisma.ProjectWhereInput = {
      status: { not: 'ARCHIVED' },
      ...(!global
        ? {
            members: {
              some: {
                userId: actor.id,
                memberRole: actor.role as ProjectMemberRole,
                isActive: true,
              },
            },
          }
        : {}),
    };
    const taskWhere: Prisma.WorkTaskWhereInput = {
      project: projectWhere,
      ...(actor.role === 'DEVELOPER' ? { assigneeId: actor.id } : {}),
    };
    const meetingWhere: Prisma.MeetingWhereInput = {
      status: { in: ['PENDING', 'SCHEDULED'] },
      scheduledAt: { gte: new Date() },
      ...(!global
        ? actor.role === 'CLIENT'
          ? { prospect: { userId: actor.id } }
          : { kickoff: { project: projectWhere } }
        : {}),
    };
    const quoteWhere: Prisma.QuoteWhereInput = global
      ? {}
      : { prospect: { userId: actor.id } };
    const showTasks = actor.role !== 'CLIENT',
      commercial = global || actor.role === 'CLIENT';
    const [
      user,
      projects,
      projectCount,
      tasks,
      openTasks,
      overdueTasks,
      pendingDeliverables,
      meetings,
      meetingCount,
      quotes,
      prospects,
      workload,
      usersByRole,
      projectsByStatus,
      deliverables,
      revenue,
    ] = await Promise.all([
      this.prisma.user.findUniqueOrThrow({
        where: { id: actor.id },
        select: { id: true, name: true },
      }),
      this.prisma.project.findMany({
        where: projectWhere,
        take: 50,
        orderBy: { id: 'desc' },
        select: { id: true, name: true, status: true },
      }),
      this.prisma.project.count({ where: projectWhere }),
      showTasks
        ? this.prisma.workTask.findMany({
            where: { ...taskWhere, status: { not: 'DONE' } },
            take: 50,
            orderBy: [{ dueDate: 'asc' }, { id: 'asc' }],
            select: {
              id: true,
              projectId: true,
              title: true,
              status: true,
              assigneeId: true,
              dueDate: true,
            },
          })
        : Promise.resolve([]),
      showTasks
        ? this.prisma.workTask.count({
            where: { ...taskWhere, status: { not: 'DONE' } },
          })
        : Promise.resolve(0),
      showTasks
        ? this.prisma.workTask.count({
            where: {
              ...taskWhere,
              status: { not: 'DONE' },
              dueDate: {
                lt: new Date(
                  new Date().toLocaleDateString('en-CA', {
                    timeZone: 'America/Lima',
                  }) + 'T00:00:00.000Z',
                ),
              },
            },
          })
        : Promise.resolve(0),
      this.prisma.projectDeliverable.count({
        where: { project: projectWhere, status: 'IN_REVIEW' },
      }),
      this.prisma.meeting.findMany({
        where: meetingWhere,
        take: 50,
        orderBy: [{ scheduledAt: 'asc' }, { id: 'asc' }],
        select: { id: true, status: true, scheduledAt: true, timezone: true },
      }),
      this.prisma.meeting.count({ where: meetingWhere }),
      commercial
        ? this.prisma.quote.count({ where: quoteWhere })
        : Promise.resolve(0),
      global ? this.prisma.prospect.count() : Promise.resolve(0),
      global || actor.role === 'PRODUCT_OWNER'
        ? this.prisma.workTask.groupBy({
            by: ['assigneeId'],
            where: {
              ...taskWhere,
              status: { not: 'DONE' },
              assigneeId: { not: null },
            },
            _count: { _all: true },
          })
        : Promise.resolve([]),
      superadmin
        ? this.prisma.role.findMany({
            select: { name: true, _count: { select: { users: true } } },
          })
        : Promise.resolve([]),
      superadmin
        ? this.prisma.project.groupBy({
            by: ['status'],
            _count: { _all: true },
          })
        : Promise.resolve([]),
      this.prisma.projectDeliverable.findMany({
        where: { project: projectWhere, status: { not: 'APPROVED' } },
        select: {
          id: true,
          projectId: true,
          title: true,
          status: true,
          dueDate: true,
        },
        orderBy: [{ dueDate: 'asc' }, { id: 'asc' }],
        take: 50,
      }),
      global
        ? this.prisma.payment.groupBy({
            by: ['currency'],
            where: { status: 'CONFIRMED' },
            _sum: { amountMinor: true },
          })
        : Promise.resolve([]),
    ]);
    const counts = projects.length
      ? await this.prisma.projectDeliverable.groupBy({
          by: ['projectId', 'status'],
          where: { projectId: { in: projects.map((p) => p.id) } },
          _count: { _all: true },
        })
      : [];
    return {
      deliverables: deliverables.map((d) => ({
        ...d,
        dueDate: d.dueDate.toISOString().slice(0, 10),
      })),
      revenue: revenue.map((r) => ({
        currency: r.currency,
        confirmedAmountMinor: r._sum.amountMinor?.toFixed(0) ?? '0',
      })),
      generatedAt: new Date().toISOString(),
      user: { ...user, role: actor.role },
      stats: {
        projects: projectCount,
        openTasks,
        pendingDeliverables,
        overdueTasks,
        meetings: meetingCount,
        quotes,
        prospects,
      },
      projects: projects.map((p) => {
        const own = counts.filter((c) => c.projectId === p.id),
          total = own.reduce((n, c) => n + c._count._all, 0),
          approved = own.find((c) => c.status === 'APPROVED')?._count._all ?? 0;
        return {
          ...p,
          totalDeliverables: total,
          approvedDeliverables: approved,
          progress: total ? Math.round((approved / total) * 100) : 0,
        };
      }),
      tasks: tasks.map((t) => ({
        ...t,
        dueDate: t.dueDate?.toISOString().slice(0, 10) ?? null,
      })),
      meetings: meetings.map((m) => ({
        ...m,
        scheduledAt: m.scheduledAt?.toISOString() ?? null,
      })),
      workload: workload.map((w) => ({
        userId: w.assigneeId!,
        openTasks: w._count._all,
      })),
      usersByRole: usersByRole.map((r) => ({
        label: r.name,
        count: r._count.users,
      })),
      projectsByStatus: projectsByStatus.map((p) => ({
        label: p.status,
        count: p._count._all,
      })),
      integrations: superadmin
        ? [
            {
              name: 'Calendly',
              status: process.env.CALENDLY_WEBHOOK_SECRET
                ? 'CONFIGURED'
                : 'NOT_CONFIGURED',
              connectivity: 'NOT_PROBED',
            },
            {
              name: 'Email',
              status:
                process.env.SMTP_HOST || process.env.RESEND_API_KEY
                  ? 'CONFIGURED'
                  : 'NOT_CONFIGURED',
              connectivity: 'NOT_PROBED',
            },
          ]
        : [],
      database: 'READ_OK',
      previewLimit: 50,
    };
  }
}

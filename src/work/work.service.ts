import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateTaskDto,
  UpdateTaskDto,
  TaskQuery,
  WorkPageQuery,
  CreateResourceDto,
  UpdateResourceDto,
  CreateWorkLogDto,
  LogQuery,
  CreateMilestoneDto,
  UpdateMilestoneDto,
} from './work.dto';
export interface WorkActor {
  id: number;
  role: string;
}
const managers = ['ADMIN', 'SUPER_ADMIN', 'PRODUCT_OWNER'];
@Injectable()
export class WorkService {
  constructor(private readonly prisma: PrismaService) {}
  async access(
    projectId: number,
    actor: WorkActor,
    write = false,
    db: Prisma.TransactionClient = this.prisma,
  ) {
    const p = await db.project.findUnique({
      where: { id: projectId },
      select: { id: true, status: true },
    });
    if (!p) throw new NotFoundException('Proyecto no encontrado');
    if (!['ADMIN', 'SUPER_ADMIN'].includes(actor.role)) {
      const member = await db.projectMember.findUnique({
        where: { projectId_userId: { projectId, userId: actor.id } },
      });
      if (!member?.isActive || member.memberRole !== actor.role)
        throw new ForbiddenException('Se requiere membresía activa del rol');
    }
    if (write && ['COMPLETED', 'ARCHIVED'].includes(p.status))
      throw new ConflictException('Proyecto cerrado');
    return p;
  }
  private manage(actor: WorkActor) {
    if (!managers.includes(actor.role))
      throw new ForbiddenException('Solo PO o administrador');
  }
  private async assignee(
    db: Prisma.TransactionClient,
    projectId: number,
    id?: number | null,
  ) {
    if (id == null) return;
    const m = await db.projectMember.findFirst({
      where: {
        projectId,
        userId: id,
        isActive: true,
        user: { isActive: true },
        memberRole: 'DEVELOPER',
      },
    });
    if (!m)
      throw new BadRequestException(
        'Asignado debe ser Developer activo del proyecto',
      );
  }
  private async audit(
    db: Prisma.TransactionClient,
    actor: WorkActor,
    action: string,
    entity: string,
    id: number,
    projectId: number,
  ) {
    await db.auditEvent.create({
      data: {
        actorId: actor.id,
        action,
        entityType: entity,
        entityId: String(id),
        metadata: { projectId },
      },
    });
  }
  private page<T>(items: T[], totalItems: number, q: WorkPageQuery) {
    return {
      items,
      page: q.page,
      limit: q.limit,
      totalItems,
      totalPages: Math.ceil(totalItems / q.limit),
    };
  }
  async tasks(projectId: number, actor: WorkActor, q: TaskQuery) {
    await this.access(projectId, actor);
    if (actor.role === 'CLIENT')
      throw new ForbiddenException('Las tareas internas solo son visibles para el equipo del proyecto');
    const where: Prisma.WorkTaskWhereInput = {
      projectId,
      ...(q.status ? { status: q.status } : {}),
      ...(actor.role === 'DEVELOPER'
        ? { assigneeId: actor.id }
        : q.assigneeId ? { assigneeId: q.assigneeId } : {}),
      ...(q.search ? { title: { contains: q.search.trim() } } : {}),
    };
    const [items, count] = await this.prisma.$transaction([
      this.prisma.workTask.findMany({
        where,
        include: { milestone: { select: { id: true, title: true, sequence: true } } },
        orderBy: { id: 'desc' },
        skip: (q.page - 1) * q.limit,
        take: q.limit,
      }),
      this.prisma.workTask.count({ where }),
    ]);
    return this.page(items, count, q);
  }
  async createTask(projectId: number, actor: WorkActor, dto: CreateTaskDto) {
    this.manage(actor);
    return this.prisma.$transaction(async (db) => {
      await this.access(projectId, actor, true, db);
      await this.assignee(db, projectId, dto.assigneeId);
      if (dto.milestoneId != null && !(await db.projectMilestone.findFirst({ where: { id: dto.milestoneId, projectId } })))
        throw new BadRequestException('El hito debe pertenecer al proyecto');
      const task = await db.workTask.create({
        data: {
          projectId,
          createdById: actor.id,
          title: dto.title.trim(),
          description: dto.description?.trim() ?? '',
          assigneeId: dto.assigneeId,
          dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
          milestoneId: dto.milestoneId,
          priority: dto.priority,
        },
      });
      await this.audit(
        db,
        actor,
        'TASK_CREATED',
        'WORK_TASK',
        task.id,
        projectId,
      );
      return task;
    });
  }
  async updateTask(
    projectId: number,
    id: number,
    actor: WorkActor,
    dto: UpdateTaskDto,
  ) {
    return this.prisma.$transaction(async (db) => {
      await this.access(projectId, actor, true, db);
      await db.$queryRaw`SELECT id FROM WorkTask WHERE id=${id} AND projectId=${projectId} FOR UPDATE`;
      const task = await db.workTask.findFirst({ where: { id, projectId } });
      if (!task) throw new NotFoundException('Tarea no encontrada');
      if (!managers.includes(actor.role)) {
        if (
          actor.role !== 'DEVELOPER' ||
          task.assigneeId !== actor.id ||
          Object.keys(dto).some((k) => !['status', 'blockedReason'].includes(k))
        )
          throw new ForbiddenException('Solo el asignado cambia el estado');
        const allowed = {
          TODO: ['IN_PROGRESS', 'BLOCKED'],
          IN_PROGRESS: ['TODO', 'BLOCKED', 'IN_REVIEW'],
          BLOCKED: ['TODO', 'IN_PROGRESS'],
          IN_REVIEW: ['IN_PROGRESS', 'DONE'],
          DONE: ['IN_PROGRESS'],
        };
        if (
          dto.status &&
          dto.status !== task.status &&
          !allowed[task.status].includes(dto.status)
        )
          throw new ConflictException('Transición de tarea inválida');
      }
      for (const key of ['title', 'description', 'status'] as const)
        if (dto[key] === null)
          throw new BadRequestException(`${key} no admite null`);
      await this.assignee(db, projectId, dto.assigneeId);
      if (dto.milestoneId != null && !(await db.projectMilestone.findFirst({ where: { id: dto.milestoneId, projectId } })))
        throw new BadRequestException('El hito debe pertenecer al proyecto');
      if (dto.status === 'BLOCKED' && !(dto.blockedReason || task.blockedReason)?.trim())
        throw new BadRequestException('Describe el bloqueo de la tarea');
      const result = await db.workTask.update({
        where: { id },
        data: {
          ...(dto.title !== undefined ? { title: dto.title.trim() } : {}),
          ...(dto.description !== undefined
            ? { description: dto.description.trim() }
            : {}),
          ...(dto.status ? { status: dto.status } : {}),
          ...(dto.assigneeId !== undefined
            ? { assigneeId: dto.assigneeId }
            : {}),
          ...(dto.dueDate !== undefined
            ? { dueDate: dto.dueDate ? new Date(dto.dueDate) : null }
            : {}),
          ...(dto.milestoneId !== undefined ? { milestoneId: dto.milestoneId } : {}),
          ...(dto.priority !== undefined ? { priority: dto.priority } : {}),
          ...(dto.blockedReason !== undefined ? { blockedReason: dto.blockedReason?.trim() || null } : {}),
          ...(dto.status && dto.status !== 'BLOCKED' ? { blockedReason: null } : {}),
        },
      });
      await this.audit(db, actor, 'TASK_UPDATED', 'WORK_TASK', id, projectId);
      return result;
    });
  }
  async deleteTask(projectId: number, id: number, actor: WorkActor) {
    this.manage(actor);
    return this.prisma.$transaction(async (db) => {
      await this.access(projectId, actor, true, db);
      const task = await db.workTask.findFirst({ where: { id, projectId } });
      if (!task) throw new NotFoundException('Tarea no encontrada');
      if (await db.workLog.count({ where: { taskId: id } }))
        throw new ConflictException('La tarea tiene horas registradas');
      try {
        await db.workTask.delete({ where: { id } });
      } catch (e) {
        if (
          e instanceof Prisma.PrismaClientKnownRequestError &&
          e.code === 'P2003'
        )
          throw new ConflictException('La tarea tiene horas registradas');
        throw e;
      }
      await this.audit(db, actor, 'TASK_DELETED', 'WORK_TASK', id, projectId);
      return null;
    });
  }
  async createMilestone(projectId: number, actor: WorkActor, dto: CreateMilestoneDto) {
    this.manage(actor);
    return this.prisma.$transaction(async (db) => {
      await this.access(projectId, actor, true, db);
      await db.$queryRaw`SELECT id FROM Project WHERE id=${projectId} FOR UPDATE`;
      const sequence = (await db.projectMilestone.aggregate({ where: { projectId }, _max: { sequence: true } }))._max.sequence ?? 0;
      const milestone = await db.projectMilestone.create({ data: { projectId, title: dto.title.trim(), dueDate: new Date(dto.dueDate), sequence: sequence + 1 } });
      await this.audit(db, actor, 'MILESTONE_CREATED', 'PROJECT_MILESTONE', milestone.id, projectId);
      return milestone;
    });
  }
  async updateMilestone(projectId: number, id: number, actor: WorkActor, dto: UpdateMilestoneDto) {
    this.manage(actor);
    return this.prisma.$transaction(async (db) => {
      await this.access(projectId, actor, true, db);
      const milestone = await db.projectMilestone.findFirst({ where: { id, projectId } });
      if (!milestone) throw new NotFoundException('Hito no encontrado');
      const result = await db.projectMilestone.update({ where: { id }, data: { ...(dto.title ? { title: dto.title.trim() } : {}), ...(dto.dueDate ? { dueDate: new Date(dto.dueDate) } : {}) } });
      await this.audit(db, actor, 'MILESTONE_UPDATED', 'PROJECT_MILESTONE', id, projectId);
      return result;
    });
  }
  async resources(projectId: number, actor: WorkActor, q: WorkPageQuery) {
    await this.access(projectId, actor);
    const where = {
      projectId,
      ...(q.search ? { name: { contains: q.search.trim() } } : {}),
    };
    const [items, n] = await this.prisma.$transaction([
      this.prisma.workResource.findMany({
        where,
        orderBy: { id: 'desc' },
        skip: (q.page - 1) * q.limit,
        take: q.limit,
      }),
      this.prisma.workResource.count({ where }),
    ]);
    return this.page(items, n, q);
  }
  async saveResource(
    projectId: number,
    actor: WorkActor,
    dto: CreateResourceDto | UpdateResourceDto,
    id?: number,
  ) {
    if (![...managers, 'DEVELOPER'].includes(actor.role))
      throw new ForbiddenException();
    return this.prisma.$transaction(async (db) => {
      await this.access(projectId, actor, true, db);
      if (id) {
        const r = await db.workResource.findFirst({ where: { id, projectId } });
        if (!r) throw new NotFoundException();
        if (!managers.includes(actor.role) && r.createdById !== actor.id)
          throw new ForbiddenException();
      }
      if (dto.name === null || dto.url === null)
        throw new BadRequestException('name/url no admiten null');
      const data = {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.url !== undefined ? { url: dto.url } : {}),
      };
      const r = id
        ? await db.workResource.update({ where: { id }, data })
        : await db.workResource.create({
            data: {
              projectId,
              createdById: actor.id,
              name: dto.name!.trim(),
              url: dto.url!,
            },
          });
      await this.audit(
        db,
        actor,
        id ? 'RESOURCE_UPDATED' : 'RESOURCE_CREATED',
        'WORK_RESOURCE',
        r.id,
        projectId,
      );
      return r;
    });
  }
  async deleteResource(projectId: number, id: number, actor: WorkActor) {
    return this.prisma.$transaction(async (db) => {
      await this.access(projectId, actor, true, db);
      const r = await db.workResource.findFirst({ where: { id, projectId } });
      if (!r) throw new NotFoundException();
      if (
        !managers.includes(actor.role) &&
        (actor.role !== 'DEVELOPER' || r.createdById !== actor.id)
      )
        throw new ForbiddenException();
      await db.workResource.delete({ where: { id } });
      await this.audit(
        db,
        actor,
        'RESOURCE_DELETED',
        'WORK_RESOURCE',
        id,
        projectId,
      );
      return null;
    });
  }
  async logs(projectId: number, actor: WorkActor, q: LogQuery) {
    await this.access(projectId, actor);
    if (actor.role === 'CLIENT')
      throw new ForbiddenException('Horas internas del equipo');
    if (q.from && q.to && q.from > q.to)
      throw new BadRequestException('Rango inválido');
    const where: Prisma.WorkLogWhereInput = {
      ...(q.search ? { summary: { contains: q.search.trim() } } : {}),
      projectId,
      userId: actor.role === 'DEVELOPER' ? actor.id : q.userId,
      ...(q.from || q.to
        ? {
            date: {
              gte: q.from ? new Date(q.from) : undefined,
              lte: q.to ? new Date(q.to) : undefined,
            },
          }
        : {}),
    };
    const [items, n] = await this.prisma.$transaction([
      this.prisma.workLog.findMany({
        where,
        orderBy: { id: 'desc' },
        skip: (q.page - 1) * q.limit,
        take: q.limit,
      }),
      this.prisma.workLog.count({ where }),
    ]);
    return this.page(items, n, q);
  }
  async createLog(projectId: number, actor: WorkActor, dto: CreateWorkLogDto) {
    if (!['DEVELOPER', 'PRODUCT_OWNER'].includes(actor.role))
      throw new ForbiddenException('Solo Developer/PO registra trabajo propio');
    const today = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Lima',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
    if (dto.date > today)
      throw new BadRequestException('No se registran horas futuras');
    return this.prisma.$transaction(
      async (db) => {
        await this.access(projectId, actor, true, db);
        await db.$queryRaw`SELECT id FROM User WHERE id=${actor.id} FOR UPDATE`;
        if (dto.taskId) {
          const task = await db.workTask.findFirst({
            where: { id: dto.taskId, projectId },
          });
          if (!task) throw new BadRequestException('Tarea fuera del proyecto');
          if (actor.role === 'DEVELOPER' && task.assigneeId !== actor.id)
            throw new ForbiddenException('Tarea no asignada');
        }
        const sum = await db.workLog.aggregate({
          where: { userId: actor.id, date: new Date(dto.date) },
          _sum: { minutes: true },
        });
        if ((sum._sum.minutes ?? 0) + dto.minutes > 1440)
          throw new ConflictException(
            'Máximo 1440 minutos por día entre todos los proyectos',
          );
        const log = await db.workLog.create({
          data: {
            projectId,
            userId: actor.id,
            taskId: dto.taskId,
            date: new Date(dto.date),
            minutes: dto.minutes,
            summary: dto.summary.trim(),
          },
        });
        await this.audit(
          db,
          actor,
          'WORK_LOG_CREATED',
          'WORK_LOG',
          log.id,
          projectId,
        );
        return log;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted },
    );
  }
}

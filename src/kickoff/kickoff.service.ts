import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PaymentsService } from '../payments/payments.service';
import { KickoffDto, ProjectTeamDto } from './kickoff.dto';
export function validateParticipation(members: ProjectTeamDto['members']) {
  if (
    !members.length ||
    new Set(members.map((m) => m.userId)).size !== members.length ||
    members.some(
      (m) =>
        !Number.isInteger(m.participationBasisPoints) ||
        m.participationBasisPoints < 1 ||
        m.participationBasisPoints > 10000,
    ) ||
    members.reduce((sum, m) => sum + m.participationBasisPoints, 0) !== 10000 ||
    members.filter((m) => m.role === 'PRODUCT_OWNER').length !== 1
  )
    throw new BadRequestException(
      'El equipo requiere un PO único y participaciones que sumen exactamente 100%.',
    );
}
@Injectable()
export class KickoffService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly payments: PaymentsService,
  ) {}
  private async validateTeam(
    tx: Prisma.TransactionClient,
    members: ProjectTeamDto['members'],
  ) {
    validateParticipation(members);
    const users = await tx.user.findMany({
      where: { id: { in: members.map((m) => m.userId) }, isActive: true },
      select: { id: true, role: { select: { name: true } } },
    });
    if (
      members.some(
        (m) => !users.some((u) => u.id === m.userId && u.role.name === m.role),
      )
    )
      throw new BadRequestException(
        'Cada miembro debe estar activo y tener el rol indicado.',
      );
  }
  async create(actorId: number, dto: KickoffDto) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM Quote WHERE id = ${dto.quoteId} FOR UPDATE`;
        const version = await this.payments.assertInitialPayment(
          dto.quoteId,
          tx,
        );
        const quote = await tx.quote.findUniqueOrThrow({
          where: { id: dto.quoteId },
        });
        if (await tx.project.findUnique({ where: { quoteId: dto.quoteId } }))
          throw new ConflictException(
            'Ya existe un proyecto para esta cotización.',
          );
        if (!quote.prospectId)
          throw new ConflictException('La cotización no tiene prospecto.');
        if (
          !(await tx.category.findFirst({
            where: { id: dto.categoryId, isActive: true },
          }))
        )
          throw new BadRequestException('Categoría no disponible');
        await this.validateTeam(tx, dto.members);
        const client = await tx.user.findFirst({
          where: {
            id: version.clientUserId,
            isActive: true,
            role: { name: 'CLIENT' },
          },
        });
        if (!client) throw new ConflictException('Cliente no disponible');
        const schedules = await tx.paymentSchedule.findMany({
          where: { quoteVersionId: version.id },
          orderBy: { sequence: 'asc' },
        });
        const scope = version.scope as { description?: string };
        const project = await tx.project.create({
          data: {
            name: dto.name,
            slug: dto.slug,
            shortDescription: (scope.description || dto.name).slice(0, 300),
            description: scope.description || dto.name,
            categoryId: dto.categoryId,
            status: 'IN_DEVELOPMENT',
            quoteId: dto.quoteId,
            clientUserId: client.id,
            prospectId: quote.prospectId,
            productOwnerId: dto.members.find((m) => m.role === 'PRODUCT_OWNER')!
              .userId,
            developmentDate: new Date(dto.heldAt),
            kickoff: {
              create: {
                actorId,
                heldAt: new Date(dto.heldAt),
                notes: dto.notes,
              },
            },
            members: {
              create: [
                {
                  userId: client.id,
                  memberRole: 'CLIENT',
                  participationBasisPoints: 0,
                },
                ...dto.members.map((m) => ({
                  userId: m.userId,
                  memberRole: m.role,
                  participationBasisPoints: m.participationBasisPoints,
                })),
              ],
            },
          },
        });
        for (const part of schedules) {
          await tx.projectMilestone.create({
            data: {
              projectId: project.id,
              paymentScheduleId: part.id,
              title: part.milestone,
              dueDate: part.dueDate,
              sequence: part.sequence,
              deliverables: {
                create: {
                  projectId: project.id,
                  title: part.milestone,
                  description: scope.description || part.milestone,
                  milestoneOrder: part.sequence,
                  dueDate: part.dueDate,
                },
              },
            },
          });
        }
        await tx.auditEvent.create({
          data: {
            actorId,
            action: 'PROJECT_KICKOFF',
            entityType: 'PROJECT',
            entityId: String(project.id),
            metadata: { quoteId: dto.quoteId, version: version.version },
          },
        });
        return tx.project.findUniqueOrThrow({
          where: { id: project.id },
          include: {
            kickoff: true,
            members: true,
            milestones: { include: { deliverables: true } },
          },
        });
      });
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      )
        throw new ConflictException('Slug o cotización ya vinculado.');
      throw e;
    }
  }
  async access(projectId: number, actor: { id: number; role: string }) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
    });
    if (!project) throw new NotFoundException('Proyecto no encontrado');
    if (!['ADMIN', 'SUPER_ADMIN'].includes(actor.role)) {
      const membership = await this.prisma.projectMember.findUnique({
        where: { projectId_userId: { projectId, userId: actor.id } },
      });
      if (!membership?.isActive || membership.memberRole !== actor.role)
        throw new ForbiddenException('No perteneces a este proyecto.');
    }
    return project;
  }
  async detail(projectId: number, actor: { id: number; role: string }) {
    await this.access(projectId, actor);
    return this.prisma.project.findUniqueOrThrow({
      where: { id: projectId },
      include: {
        kickoff: true,
        members: true,
        milestones: { include: { deliverables: true, paymentSchedule: true } },
      },
    });
  }
  async setTeam(
    projectId: number,
    actor: { id: number; role: string },
    dto: ProjectTeamDto,
  ) {
    await this.access(projectId, actor);
    if (!['ADMIN', 'SUPER_ADMIN'].includes(actor.role))
      throw new ForbiddenException(
        'Solo administración puede reasignar equipo y participaciones.',
      );
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM Project WHERE id = ${projectId} FOR UPDATE`;
      await this.validateTeam(tx, dto.members);
      await tx.projectMember.updateMany({
        where: { projectId, memberRole: { not: 'CLIENT' } },
        data: { isActive: false, participationBasisPoints: 0 },
      });
      for (const m of dto.members) {
        await tx.projectMember.upsert({
          where: { projectId_userId: { projectId, userId: m.userId } },
          create: {
            projectId,
            userId: m.userId,
            memberRole: m.role,
            participationBasisPoints: m.participationBasisPoints,
          },
          update: {
            memberRole: m.role,
            participationBasisPoints: m.participationBasisPoints,
            isActive: true,
          },
        });
      }
      await tx.project.update({
        where: { id: projectId },
        data: {
          productOwnerId: dto.members.find((m) => m.role === 'PRODUCT_OWNER')!
            .userId,
        },
      });
      await tx.auditEvent.create({
        data: {
          actorId: actor.id,
          action: 'PROJECT_TEAM_UPDATED',
          entityType: 'PROJECT',
          entityId: String(projectId),
          metadata: { memberCount: dto.members.length },
        },
      });
      return tx.projectMember.findMany({
        where: { projectId, isActive: true },
      });
    });
  }
}

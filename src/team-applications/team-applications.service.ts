import * as crypto from 'crypto';
import * as bcrypt from 'bcrypt';
import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PLATFORM_ROLES } from '../common/constants/platform-roles.js';
import {
  NOTIFICATION_PROVIDER,
  NotificationProvider,
} from '../notifications/notification-provider.interface.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { ListTeamApplicationsQueryDto } from './dto/list-team-applications-query.dto.js';
import { TEAM_APPLICATION_STATUS } from './team-application.constants.js';

const summarySelect = {
  id: true,
  code: true,
  email: true,
  dni: true,
  requestedRole: true,
  profile: true,
  status: true,
  resultingUserId: true,
  decidedAt: true,
  createdAt: true,
  updatedAt: true,
  assignedAdminProfile: {
    select: {
      id: true,
      user: { select: { id: true, name: true, email: true } },
    },
  },
} satisfies Prisma.TeamApplicationSelect;

const detailSelect = {
  ...summarySelect,
  cvName: true,
  photoMime: true,
  consent: true,
  interviewAssignedAt: true,
  interviewCompletedAt: true,
  rejectionReason: true,
  rejectedAt: true,
  decidedAt: true,
  decidedByUserId: true,
  decisionReason: true,
  resultingUserId: true,
  reviewedByUser: {
    select: { id: true, name: true, email: true },
  },
  decidedBy: {
    select: { id: true, name: true, email: true },
  },
  resultingUser: {
    select: {
      id: true,
      name: true,
      email: true,
      role: { select: { id: true, name: true } },
    },
  },
  assignedAdminProfile: {
    select: {
      id: true,
      executiveTitle: true,
      specialty: true,
      calendlyUrl: true,
      user: { select: { id: true, name: true, email: true } },
    },
  },
} satisfies Prisma.TeamApplicationSelect;

type SummaryRecord = Prisma.TeamApplicationGetPayload<{
  select: typeof summarySelect;
}>;

type DetailRecord = Prisma.TeamApplicationGetPayload<{
  select: typeof detailSelect;
}>;

@Injectable()
export class TeamApplicationsService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(NOTIFICATION_PROVIDER)
    private readonly notifications: NotificationProvider,
  ) {}

  async findAll(query: ListTeamApplicationsQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const search = query.search?.trim();
    const where: Prisma.TeamApplicationWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.role ? { requestedRole: query.role } : {}),
      ...(search
        ? {
            OR: [
              { code: { contains: search } },
              { email: { contains: search } },
              { dni: { contains: search } },
              {
                profile: {
                  path: '$.fullName',
                  string_contains: search,
                },
              },
            ],
          }
        : {}),
    };

    const [items, totalItems] = await this.prisma.$transaction([
      this.prisma.teamApplication.findMany({
        where,
        select: summarySelect,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.teamApplication.count({ where }),
    ]);

    return {
      items: items.map((item) => this.toSummary(item)),
      meta: {
        page,
        limit,
        totalItems,
        totalPages: Math.ceil(totalItems / limit),
      },
    };
  }

  async findMyInterviews(userId: number) {
    return this.findAssignedInterviews(userId);
  }

  async findMyInterviewDetail(id: number, userId: number) {
    return this.findAssignedInterview(userId, id);
  }

  async findInterviewers() {
    const profiles = await this.prisma.adminProfile.findMany({
      where: {
        user: {
          isActive: true,
          role: { name: 'ADMIN' },
        },
      },
      select: {
        id: true,
        executiveTitle: true,
        specialty: true,
        calendlyUrl: true,
        user: { select: { id: true, name: true, email: true } },
      },
      orderBy: { user: { name: 'asc' } },
    });

    return profiles.map(({ user, ...profile }) => ({
      adminProfileId: profile.id,
      userId: user.id,
      name: user.name,
      email: user.email,
      executiveTitle: profile.executiveTitle,
      specialty: profile.specialty,
      calendlyUrl: profile.calendlyUrl,
    }));
  }

  async findAssignedInterviews(userId: number) {
    const adminProfileId = await this.assignedAdminProfileId(userId);
    const items = await this.prisma.teamApplication.findMany({
      where: { assignedAdminProfileId: adminProfileId },
      select: summarySelect,
      orderBy: [{ interviewAssignedAt: 'desc' }, { id: 'desc' }],
    });
    return items.map((item) => this.toSummary(item));
  }

  async findAssignedInterview(userId: number, id: number) {
    const adminProfileId = await this.assignedAdminProfileId(userId);
    const application = await this.prisma.teamApplication.findUnique({
      where: { id },
      select: {
        ...detailSelect,
        assignedAdminProfileId: true,
      },
    });
    if (!application) {
      throw new NotFoundException('Entrevista asignada no encontrada');
    }
    if (application.assignedAdminProfileId !== adminProfileId) {
      throw new ForbiddenException('No tienes permisos sobre esta entrevista');
    }
    return this.toDetail(application);
  }

  async getAssignedPhoto(userId: number, id: number) {
    await this.findAssignedInterview(userId, id);
    return this.getPhoto(id);
  }

  async getAssignedCv(userId: number, id: number) {
    await this.findAssignedInterview(userId, id);
    return this.getCv(id);
  }

  async completeAssignedInterview(
    userId: number,
    userRole: string,
    id: number,
    decision: 'ACCEPTED' | 'REJECTED',
    reason?: string,
  ) {
    if (decision === 'REJECTED' && (!reason || reason.trim().length < 20)) {
      throw new ConflictException(
        'El rechazo requiere un motivo de al menos 20 caracteres',
      );
    }

    const application = await this.prisma.teamApplication.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        requestedRole: true,
        profile: true,
        status: true,
        assignedAdminProfileId: true,
      },
    });

    if (!application) {
      throw new NotFoundException('Postulación no encontrada');
    }

    if (userRole === PLATFORM_ROLES.ADMIN) {
      const adminProfileId = await this.assignedAdminProfileId(userId);
      if (application.assignedAdminProfileId !== adminProfileId) {
        throw new ForbiddenException(
          'No tienes permisos sobre esta entrevista',
        );
      }
    } else if (userRole !== PLATFORM_ROLES.SUPER_ADMIN) {
      throw new ForbiddenException('No tienes permisos suficientes');
    }

    if (application.status !== TEAM_APPLICATION_STATUS.INTERVIEW_ASSIGNED) {
      throw new ConflictException(
        'La postulación ya tiene una decisión registrada',
      );
    }

    const trimmedReason = reason?.trim() || null;
    const now = new Date();

    let precomputedHash = '';
    if (decision === 'ACCEPTED') {
      const randomSecret = crypto.randomBytes(32).toString('hex');
      precomputedHash = await bcrypt.hash(randomSecret, 10);
    }

    await this.prisma.$transaction(async (tx) => {
      const updated = await tx.teamApplication.updateMany({
        where: {
          id,
          status: TEAM_APPLICATION_STATUS.INTERVIEW_ASSIGNED,
        },
        data: {
          status: decision,
          decidedByUserId: userId,
          decidedAt: now,
          interviewCompletedAt: now,
          decisionReason: trimmedReason,
          rejectionReason: decision === 'REJECTED' ? trimmedReason : null,
          rejectedAt: decision === 'REJECTED' ? now : null,
        },
      });

      if (updated.count !== 1) {
        throw new ConflictException('La postulación ya fue procesada');
      }

      if (decision === 'ACCEPTED') {
        let resultingUserId: number;

        const existingUser = await tx.user.findUnique({
          where: { email: application.email },
          include: {
            role: true,
            developerProfile: true,
            productOwnerProfile: true,
          },
        });

        if (existingUser) {
          if (existingUser.role.name !== application.requestedRole) {
            throw new ConflictException(
              `El correo ya está registrado con un rol incompatible (${existingUser.role.name})`,
            );
          }

          resultingUserId = existingUser.id;

          if (
            application.requestedRole === 'DEVELOPER' &&
            !existingUser.developerProfile
          ) {
            await tx.developerProfile.create({
              data: { userId: existingUser.id },
            });
          } else if (
            application.requestedRole === 'PRODUCT_OWNER' &&
            !existingUser.productOwnerProfile
          ) {
            await tx.productOwnerProfile.create({
              data: { userId: existingUser.id },
            });
          }
        } else {
          const role = await tx.role.findUnique({
            where: { name: application.requestedRole },
          });

          if (!role) {
            throw new InternalServerErrorException(
              `El rol ${application.requestedRole} no está configurado`,
            );
          }

          const profileObj = this.profileObject(application.profile);
          const fullName =
            this.profileString(profileObj, 'fullName') || 'Colaborador';

          try {
            const newUser = await tx.user.create({
              data: {
                name: fullName,
                email: application.email,
                passwordHash: precomputedHash,
                roleId: role.id,
                isActive: true,
                acceptedTermsAt: now,
                ...(application.requestedRole === 'DEVELOPER'
                  ? { developerProfile: { create: {} } }
                  : {}),
                ...(application.requestedRole === 'PRODUCT_OWNER'
                  ? { productOwnerProfile: { create: {} } }
                  : {}),
              },
            });
            resultingUserId = newUser.id;
          } catch (error) {
            if (
              error instanceof Prisma.PrismaClientKnownRequestError &&
              error.code === 'P2002'
            ) {
              throw new ConflictException('El correo ya está registrado');
            }
            throw error;
          }
        }

        await tx.teamApplication.update({
          where: { id },
          data: { resultingUserId },
        });

        await tx.auditEvent.create({
          data: {
            actorId: userId,
            action: 'TEAM_APPLICATION_ACCEPTED',
            entityType: 'TEAM_APPLICATION',
            entityId: String(id),
            metadata: {
              status: 'ACCEPTED',
              role: application.requestedRole,
              resultingUserId,
            },
          },
        });

        await tx.auditEvent.create({
          data: {
            actorId: userId,
            action: 'TEAM_APPLICATION_USER_LINKED',
            entityType: 'TEAM_APPLICATION',
            entityId: String(id),
            metadata: {
              status: 'ACCEPTED',
              role: application.requestedRole,
              resultingUserId,
            },
          },
        });
      } else {
        await tx.auditEvent.create({
          data: {
            actorId: userId,
            action: 'TEAM_APPLICATION_REJECTED',
            entityType: 'TEAM_APPLICATION',
            entityId: String(id),
            metadata: {
              status: 'REJECTED',
              role: application.requestedRole,
            },
          },
        });
      }
    });

    const fullName = this.profileString(
      this.profileObject(application.profile),
      'fullName',
    );
    const notificationStatus = await this.notifySafely({
      recipient: application.email,
      subject:
        decision === 'ACCEPTED'
          ? 'TISNET: entrevista aprobada'
          : 'TISNET: resultado de entrevista',
      text:
        decision === 'ACCEPTED'
          ? `Hola ${fullName}. Tu entrevista fue aprobada. TISNET se comunicará contigo para los siguientes pasos.`
          : `Hola ${fullName}. Gracias por participar en la entrevista. En esta oportunidad no continuaremos con el proceso.`,
      metadata: {
        applicationId: String(id),
        event: `TEAM_APPLICATION_${decision}`,
      },
    });

    return {
      ...(await this.findOne(id)),
      notificationStatus,
    };
  }

  async findOne(id: number) {
    const application = await this.prisma.teamApplication.findUnique({
      where: { id },
      select: detailSelect,
    });
    if (!application) {
      throw new NotFoundException('Postulación no encontrada');
    }
    return this.toDetail(application);
  }

  async getPhoto(id: number) {
    const application = await this.prisma.teamApplication.findUnique({
      where: { id },
      select: { photo: true, photoMime: true },
    });
    if (!application) {
      throw new NotFoundException('Postulación no encontrada');
    }
    return {
      content: Buffer.from(application.photo),
      mimeType: application.photoMime,
    };
  }

  async getCv(id: number) {
    const application = await this.prisma.teamApplication.findUnique({
      where: { id },
      select: { cv: true, cvName: true },
    });
    if (!application) {
      throw new NotFoundException('Postulación no encontrada');
    }
    return {
      content: Buffer.from(application.cv),
      filename: application.cvName,
    };
  }

  async assignInterview(
    id: number,
    adminProfileId: number,
    reviewerUserId: number,
  ) {
    const [application, admin] = await Promise.all([
      this.prisma.teamApplication.findUnique({
        where: { id },
        select: {
          id: true,
          email: true,
          requestedRole: true,
          profile: true,
          status: true,
        },
      }),
      this.prisma.adminProfile.findUnique({
        where: { id: adminProfileId },
        select: {
          id: true,
          calendlyUrl: true,
          user: {
            select: {
              name: true,
              email: true,
              isActive: true,
              role: { select: { name: true } },
            },
          },
        },
      }),
    ]);

    if (!application) {
      throw new NotFoundException('Postulación no encontrada');
    }
    this.ensurePending(application.status);
    if (!admin) {
      throw new NotFoundException('Administrador entrevistador no encontrado');
    }
    if (!admin.user.isActive || admin.user.role.name !== 'ADMIN') {
      throw new ConflictException(
        'El entrevistador debe ser un administrador activo',
      );
    }

    const updated = await this.prisma.teamApplication.updateMany({
      where: { id, status: TEAM_APPLICATION_STATUS.PENDING_REVIEW },
      data: {
        status: TEAM_APPLICATION_STATUS.INTERVIEW_ASSIGNED,
        assignedAdminProfileId: adminProfileId,
        reviewedByUserId: reviewerUserId,
        interviewAssignedAt: new Date(),
        rejectionReason: null,
        rejectedAt: null,
      },
    });
    if (updated.count !== 1) {
      throw new ConflictException('La postulación ya fue procesada');
    }

    const notificationStatus = await this.notifySafely({
      recipient: application.email,
      subject: 'TISNET: entrevista asignada',
      text: this.interviewMessage(application, admin),
      metadata: {
        applicationId: String(id),
        event: 'TEAM_APPLICATION_INTERVIEW_ASSIGNED',
      },
    });

    return {
      ...(await this.findOne(id)),
      notificationStatus,
    };
  }

  async reject(id: number, reason: string, reviewerUserId: number) {
    const application = await this.prisma.teamApplication.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        requestedRole: true,
        profile: true,
        status: true,
      },
    });
    if (!application) {
      throw new NotFoundException('Postulación no encontrada');
    }
    this.ensurePending(application.status);

    const now = new Date();
    await this.prisma.$transaction(async (tx) => {
      const updated = await tx.teamApplication.updateMany({
        where: { id, status: TEAM_APPLICATION_STATUS.PENDING_REVIEW },
        data: {
          status: TEAM_APPLICATION_STATUS.REJECTED,
          reviewedByUserId: reviewerUserId,
          rejectionReason: reason,
          rejectedAt: now,
          decidedByUserId: reviewerUserId,
          decidedAt: now,
          decisionReason: reason,
          assignedAdminProfileId: null,
          interviewAssignedAt: null,
        },
      });
      if (updated.count !== 1) {
        throw new ConflictException('La postulación ya fue procesada');
      }

      await tx.auditEvent.create({
        data: {
          actorId: reviewerUserId,
          action: 'TEAM_APPLICATION_REJECTED',
          entityType: 'TEAM_APPLICATION',
          entityId: String(id),
          metadata: {
            status: 'REJECTED',
            role: application.requestedRole,
          },
        },
      });
    });

    const notificationStatus = await this.notifySafely({
      recipient: application.email,
      subject: 'TISNET: resultado de tu postulación',
      text: this.rejectionMessage(application, reason),
      metadata: {
        applicationId: String(id),
        event: 'TEAM_APPLICATION_REJECTED',
      },
    });

    return {
      ...(await this.findOne(id)),
      notificationStatus,
    };
  }

  private toSummary(application: SummaryRecord) {
    const profile = this.profileObject(application.profile);
    return {
      id: application.id,
      code: application.code,
      fullName: this.profileString(profile, 'fullName'),
      email: application.email,
      dni: application.dni,
      requestedRole: application.requestedRole,
      specialty: this.profileString(profile, 'specialty'),
      status: application.status,
      resultingUserId: application.resultingUserId,
      decidedAt: application.decidedAt,
      createdAt: application.createdAt,
      updatedAt: application.updatedAt,
      assignedAdmin: application.assignedAdminProfile
        ? {
            adminProfileId: application.assignedAdminProfile.id,
            userId: application.assignedAdminProfile.user.id,
            name: application.assignedAdminProfile.user.name,
            email: application.assignedAdminProfile.user.email,
          }
        : null,
    };
  }

  private toDetail(application: DetailRecord) {
    const summary = this.toSummary(application);
    return {
      ...summary,
      profile: this.profileObject(application.profile),
      consent: application.consent,
      files: {
        cvName: application.cvName,
        cvUrl: `/api/v1/team-applications/${application.id}/cv`,
        photoUrl: `/api/v1/team-applications/${application.id}/photo`,
        photoMime: application.photoMime,
      },
      assignedAdmin: application.assignedAdminProfile
        ? {
            adminProfileId: application.assignedAdminProfile.id,
            userId: application.assignedAdminProfile.user.id,
            name: application.assignedAdminProfile.user.name,
            email: application.assignedAdminProfile.user.email,
            executiveTitle: application.assignedAdminProfile.executiveTitle,
            specialty: application.assignedAdminProfile.specialty,
            calendlyUrl: application.assignedAdminProfile.calendlyUrl,
          }
        : null,
      reviewedBy: application.reviewedByUser,
      decidedBy: application.decidedBy,
      decidedAt: application.decidedAt,
      decisionReason: application.decisionReason,
      resultingUserId: application.resultingUserId,
      resultingUser: application.resultingUser
        ? {
            id: application.resultingUser.id,
            name: application.resultingUser.name,
            email: application.resultingUser.email,
            role: application.resultingUser.role.name,
          }
        : null,
      interviewAssignedAt: application.interviewAssignedAt,
      interviewCompletedAt: application.interviewCompletedAt,
      rejectionReason: application.rejectionReason,
      rejectedAt: application.rejectedAt,
    };
  }

  private ensurePending(status: string) {
    if (status !== TEAM_APPLICATION_STATUS.PENDING_REVIEW) {
      throw new ConflictException('La postulación ya fue procesada');
    }
  }

  private async assignedAdminProfileId(userId: number) {
    const profile = await this.prisma.adminProfile.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (!profile)
      throw new NotFoundException('Perfil administrativo no encontrado');
    return profile.id;
  }

  private profileObject(value: Prisma.JsonValue): Record<string, unknown> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
    return value as Record<string, unknown>;
  }

  private profileString(profile: Record<string, unknown>, key: string) {
    const value = profile[key];
    return typeof value === 'string' ? value : '';
  }

  private async notifySafely(
    input: Parameters<NotificationProvider['send']>[0],
  ): Promise<'SENT' | 'FAILED'> {
    try {
      await this.notifications.send(input);
      return 'SENT';
    } catch {
      return 'FAILED';
    }
  }

  private interviewMessage(
    application: { requestedRole: string; profile: Prisma.JsonValue },
    admin: { user: { name: string }; calendlyUrl: string | null },
  ) {
    const name = this.profileString(
      this.profileObject(application.profile),
      'fullName',
    );
    const calendly = admin.calendlyUrl
      ? ` Puedes coordinar el horario en ${admin.calendlyUrl}.`
      : ' El entrevistador se comunicará contigo para coordinar el horario.';
    return `Hola ${name}. Tu postulación como ${application.requestedRole} avanzó a entrevista. ${admin.user.name} fue asignado como entrevistador.${calendly}`;
  }

  private rejectionMessage(
    application: { requestedRole: string; profile: Prisma.JsonValue },
    reason: string,
  ) {
    const name = this.profileString(
      this.profileObject(application.profile),
      'fullName',
    );
    return `Hola ${name}. Gracias por postular como ${application.requestedRole} en TISNET. En esta oportunidad no continuaremos con el proceso. Motivo: ${reason}`;
  }
}

import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { describeNotificationFailure } from '../notifications/notification-errors.js';
import {
  NOTIFICATION_PROVIDER,
  NotificationProvider,
} from '../notifications/notification-provider.interface.js';
import {
  renderInterviewAssigned,
  renderRejectedApplication,
  renderApplicationAccepted,
} from '../notifications/templates/application-notifications.js';
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
  rejectionReason: true,
  rejectedAt: true,
  reviewedByUser: {
    select: { id: true, name: true, email: true },
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
  private readonly logger = new Logger(TeamApplicationsService.name);

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
    const application = await this.prisma.teamApplication.findFirst({
      where: { id, assignedAdminProfileId: adminProfileId },
      select: detailSelect,
    });
    if (!application)
      throw new NotFoundException('Entrevista asignada no encontrada');
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
    id: number,
    decision: 'ACCEPTED' | 'REJECTED',
    reason?: string,
  ) {
    const rejectionReason = reason?.trim();
    if (
      decision === 'REJECTED' &&
      (!rejectionReason ||
        rejectionReason.length < 20 ||
        rejectionReason.length > 1000)
    ) {
      throw new BadRequestException(
        'El motivo de rechazo debe tener entre 20 y 1000 caracteres',
      );
    }
    const adminProfileId = await this.assignedAdminProfileId(userId);
    const application = await this.prisma.teamApplication.findFirst({
      where: { id, assignedAdminProfileId: adminProfileId },
      select: {
        code: true,
        email: true,
        requestedRole: true,
        profile: true,
        status: true,
      },
    });
    if (!application)
      throw new NotFoundException('Entrevista asignada no encontrada');
    if (application.status !== TEAM_APPLICATION_STATUS.INTERVIEW_ASSIGNED) {
      throw new ConflictException(
        'La entrevista ya tiene una decisión registrada',
      );
    }
    const updated = await this.prisma.teamApplication.updateMany({
      where: {
        id,
        assignedAdminProfileId: adminProfileId,
        status: TEAM_APPLICATION_STATUS.INTERVIEW_ASSIGNED,
      },
      data: {
        status: decision,
        rejectionReason: decision === 'REJECTED' ? rejectionReason : null,
        rejectedAt: decision === 'REJECTED' ? new Date() : null,
      },
    });
    if (updated.count !== 1)
      throw new ConflictException('La entrevista ya fue procesada');
    const fullName = this.profileString(
      this.profileObject(application.profile),
      'fullName',
    );
    const notification =
      decision === 'REJECTED'
        ? renderRejectedApplication({
            recipient: application.email,
            candidateName: fullName,
            applicationCode: application.code,
            requestedRole: application.requestedRole,
            rejectionReason: rejectionReason!,
          })
        : renderApplicationAccepted({
            recipient: application.email,
            candidateName: fullName,
            applicationCode: application.code,
            requestedRole: application.requestedRole,
          });
    const notificationStatus = await this.notifySafely(notification);
    return {
      ...(await this.findAssignedInterview(userId, id)),
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
          code: true,
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

    const notificationStatus = await this.notifySafely(
      renderInterviewAssigned({
        recipient: application.email,
        candidateName: this.profileString(
          this.profileObject(application.profile),
          'fullName',
        ),
        applicationCode: application.code,
        requestedRole: application.requestedRole,
        interviewerName: admin.user.name,
        calendlyUrl: admin.calendlyUrl,
      }),
    );

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
        code: true,
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

    const updated = await this.prisma.teamApplication.updateMany({
      where: { id, status: TEAM_APPLICATION_STATUS.PENDING_REVIEW },
      data: {
        status: TEAM_APPLICATION_STATUS.REJECTED,
        reviewedByUserId: reviewerUserId,
        rejectionReason: reason,
        rejectedAt: new Date(),
        assignedAdminProfileId: null,
        interviewAssignedAt: null,
      },
    });
    if (updated.count !== 1) {
      throw new ConflictException('La postulación ya fue procesada');
    }

    const notificationStatus = await this.notifySafely(
      renderRejectedApplication({
        recipient: application.email,
        candidateName: this.profileString(
          this.profileObject(application.profile),
          'fullName',
        ),
        applicationCode: application.code,
        requestedRole: application.requestedRole,
        rejectionReason: reason,
      }),
    );

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
      interviewAssignedAt: application.interviewAssignedAt,
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
    } catch (error) {
      const failure = describeNotificationFailure(error);
      const event = input.metadata?.type ?? input.metadata?.event ?? 'UNKNOWN';
      const applicationReference =
        input.metadata?.applicationCode ??
        input.metadata?.applicationId ??
        'UNKNOWN';
      this.logger.warn(
        `Notification delivery failed event=${event} application=${applicationReference} code=${failure.code} retryable=${failure.retryable}`,
      );
      return 'FAILED';
    }
  }
}

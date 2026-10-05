import {
  ConflictException,
  BadRequestException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import * as bcrypt from 'bcrypt';

import { PLATFORM_ROLES } from '../common/constants/platform-roles';
import { validateLegalVersions } from '../common/legal/legal-versions';
import { auditRecord } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';

import { CreateUserDto } from './dto/create-user.dto';
import { ListUsersQueryDto } from './dto/list-users-query.dto';
import { UpdateUserDto } from './dto/update-user.dto';

interface CreateClientInput {
  name: string;
  email: string;
  passwordHash: string;
  termsVersion: string;
  privacyVersion: string;
}

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  async listUsers(query: ListUsersQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const search = query.search?.trim();

    const where: Prisma.UserWhereInput = {
      ...(typeof query.isActive === 'boolean'
        ? {
            isActive: query.isActive,
          }
        : {}),

      ...(search
        ? {
            OR: [
              {
                name: {
                  contains: search,
                },
              },
              {
                email: {
                  contains: search,
                },
              },
            ],
          }
        : {}),
    };

    const [users, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: {
          id: 'desc',
        },
        select: {
          id: true,
          name: true,
          email: true,
          isActive: true,
          acceptedTermsAt: true,
          termsVersion: true,
          privacyVersion: true,
          role: {
            select: {
              name: true,
            },
          },
        },
      }),

      this.prisma.user.count({
        where,
      }),
    ]);

    return {
      data: users.map((user) => ({
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role.name,
        isActive: user.isActive,
        acceptedTermsAt: user.acceptedTermsAt,
        termsVersion: user.termsVersion,
        privacyVersion: user.privacyVersion,
      })),

      meta: {
        page,
        limit,
        total,
        totalPages: total === 0 ? 0 : Math.ceil(total / limit),
      },
    };
  }

  async updateManagedUser(id: number, actorId: number, dto: UpdateUserDto) {
    if (id === actorId) {
      throw new ForbiddenException('No puedes modificar tu propia cuenta');
    }

    const current = await this.prisma.user.findUnique({
      where: { id },
      include: { role: true },
    });
    if (!current) throw new NotFoundException('Usuario no encontrado');
    if (current.role.name === PLATFORM_ROLES.SUPER_ADMIN) {
      throw new ForbiddenException(
        'No se puede modificar una cuenta SUPER_ADMIN',
      );
    }

    const role = dto.role
      ? await this.prisma.role.findUnique({ where: { name: dto.role } })
      : null;
    if (dto.role && !role) {
      throw new InternalServerErrorException(
        `El rol ${dto.role} no está configurado`,
      );
    }

    const changedRole = role && role.id !== current.roleId;
    const changedActive =
      typeof dto.isActive === 'boolean' && dto.isActive !== current.isActive;

    const user = await this.prisma.user.update({
      where: { id },
      data: {
        ...(role ? { roleId: role.id } : {}),
        ...(typeof dto.isActive === 'boolean'
          ? { isActive: dto.isActive }
          : {}),
        ...(changedRole || changedActive
          ? { tokenVersion: { increment: 1 } }
          : {}),
        ...(dto.role === PLATFORM_ROLES.CLIENT
          ? { clientProfile: { upsert: { create: {}, update: {} } } }
          : {}),
        ...(dto.role === PLATFORM_ROLES.DEVELOPER
          ? { developerProfile: { upsert: { create: {}, update: {} } } }
          : {}),
        ...(dto.role === PLATFORM_ROLES.PRODUCT_OWNER
          ? { productOwnerProfile: { upsert: { create: {}, update: {} } } }
          : {}),
        ...(dto.role === PLATFORM_ROLES.ADMIN
          ? { adminProfile: { upsert: { create: {}, update: {} } } }
          : {}),
      },
      include: { role: true },
    });

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role.name,
      isActive: user.isActive,
      acceptedTermsAt: user.acceptedTermsAt,
      termsVersion: user.termsVersion,
      privacyVersion: user.privacyVersion,
    };
  }

  async findByEmail(email: string) {
    return this.prisma.user.findUnique({
      where: { email },
      include: {
        role: true,
      },
    });
  }

  async findById(id: number) {
    return this.prisma.user.findUnique({
      where: { id },
      include: {
        role: true,
      },
    });
  }

  async incrementTokenVersion(id: number) {
    return this.prisma.user.update({
      where: { id },
      data: {
        tokenVersion: {
          increment: 1,
        },
      },
    });
  }

  async createClient(input: CreateClientInput) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const role = await tx.role.findUnique({
          where: {
            name: PLATFORM_ROLES.CLIENT,
          },
        });

        if (!role) {
          throw new InternalServerErrorException(
            'El rol CLIENT no está configurado',
          );
        }

        return tx.user.create({
          data: {
            name: input.name,
            email: input.email,
            passwordHash: input.passwordHash,
            roleId: role.id,
            acceptedTermsAt: new Date(),
            termsVersion: input.termsVersion,
            privacyVersion: input.privacyVersion,
            clientProfile: {
              create: {},
            },
          },
          include: {
            role: true,
          },
        });
      });
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

  async createAdministrativeUser(dto: CreateUserDto, actorId?: number) {
    const { termsVersion, privacyVersion } = validateLegalVersions(
      this.configService,
      dto,
    );

    const passwordHash = await bcrypt.hash(dto.password, 12);

    try {
      return await this.prisma.$transaction(async (tx) => {
        let activationRequest: {
          id: number;
          prospectId: number;
          status: string;
          prospect: {
            email: string;
            userId: number | null;
            name: string;
            company: string | null;
            quotes: Array<{
              id: number;
              publicCode: string;
              solutionType: string;
              notes: string | null;
            }>;
          };
        } | null = null;
        if (dto.activationRequestId !== undefined) {
          if (dto.role !== PLATFORM_ROLES.CLIENT) {
            throw new BadRequestException(
              'Una solicitud de activación solo puede completarse con una cuenta CLIENT.',
            );
          }
          activationRequest = await tx.clientActivationRequest.findUnique({
            where: { id: dto.activationRequestId },
            select: {
              id: true,
              prospectId: true,
              status: true,
              prospect: {
                select: {
                  email: true,
                  userId: true,
                  name: true,
                  company: true,
                  quotes: {
                    orderBy: { createdAt: 'desc' },
                    take: 1,
                    select: {
                      id: true,
                      publicCode: true,
                      solutionType: true,
                      notes: true,
                    },
                  },
                },
              },
            },
          });
          if (!activationRequest) {
            throw new NotFoundException(
              'Solicitud de activación no encontrada.',
            );
          }
          if (activationRequest.status !== 'PENDING') {
            throw new ConflictException(
              'La solicitud de activación ya fue atendida.',
            );
          }
          if (
            activationRequest.prospect.email.toLowerCase() !==
            dto.email.toLowerCase()
          ) {
            throw new BadRequestException(
              'El correo debe coincidir con el registrado en la solicitud del visitante.',
            );
          }
          if (activationRequest.prospect.userId !== null) {
            throw new ConflictException(
              'El visitante ya tiene una cuenta vinculada.',
            );
          }
        }

        const role = await tx.role.findUnique({
          where: {
            name: dto.role,
          },
        });

        if (!role) {
          throw new InternalServerErrorException(
            `El rol ${dto.role} no está configurado`,
          );
        }

        const user = await tx.user.create({
          data: {
            name: dto.name,
            email: dto.email,
            passwordHash,
            roleId: role.id,
            acceptedTermsAt: new Date(),
            termsVersion,
            privacyVersion,

            ...(dto.role === PLATFORM_ROLES.CLIENT
              ? {
                  clientProfile: {
                    create: {},
                  },
                }
              : {}),

            ...(dto.role === PLATFORM_ROLES.DEVELOPER
              ? {
                  developerProfile: {
                    create: {},
                  },
                }
              : {}),

            ...(dto.role === PLATFORM_ROLES.PRODUCT_OWNER
              ? {
                  productOwnerProfile: {
                    create: {},
                  },
                }
              : {}),

            ...(dto.role === PLATFORM_ROLES.ADMIN
              ? {
                  adminProfile: {
                    create: {},
                  },
                }
              : {}),
          },
          include: {
            role: true,
          },
        });

        let linkedProjectId: number | null = null;
        if (activationRequest) {
          const claimed = await tx.clientActivationRequest.updateMany({
            where: {
              id: activationRequest.id,
              status: 'PENDING',
            },
            data: {
              status: 'APPROVED',
              reviewerId: actorId ?? null,
              clientUserId: user.id,
              reviewedAt: new Date(),
            },
          });
          if (claimed.count !== 1) {
            throw new ConflictException(
              'La solicitud fue atendida por otra persona.',
            );
          }
          await tx.prospect.update({
            where: { id: activationRequest.prospectId },
            data: { userId: user.id, status: 'CONVERTED' },
          });
          const quote = activationRequest.prospect.quotes?.[0];
          if (quote) {
            const existingProject = await tx.project.findUnique({
              where: { quoteId: quote.id },
              select: { id: true },
            });
            if (existingProject) {
              linkedProjectId = existingProject.id;
              await tx.project.update({
                where: { id: existingProject.id },
                data: {
                  clientUserId: user.id,
                  prospectId: activationRequest.prospectId,
                  clientName: activationRequest.prospect.name,
                },
              });
            } else {
              const category = await tx.category.findFirst({
                where: { isActive: true },
                orderBy: { id: 'asc' },
                select: { id: true },
              });
              if (!category) {
                throw new InternalServerErrorException(
                  'No se puede crear el proyecto: no hay una categoría activa configurada.',
                );
              }
              const projectName = quote.solutionType
                .replaceAll('_', ' ')
                .toLowerCase()
                .replace(/\b\w/g, (letter) => letter.toUpperCase());
              const description =
                quote.notes?.trim() ||
                `Proyecto generado desde la cotización ${quote.publicCode}. Pendiente de validar alcance, hitos y fecha de inicio con el cliente.`;
              const project = await tx.project.create({
                data: {
                  name: projectName,
                  slug: `cotizacion-${quote.id}-${quote.publicCode
                    .toLowerCase()
                    .replace(/[^a-z0-9]+/g, '-')}`,
                  shortDescription: `Proyecto asociado a la cotización ${quote.publicCode}.`,
                  description,
                  categoryId: category.id,
                  status: 'DRAFT',
                  clientName: activationRequest.prospect.name,
                  clientUserId: user.id,
                  prospectId: activationRequest.prospectId,
                  quoteId: quote.id,
                },
                select: { id: true },
              });
              linkedProjectId = project.id;
            }
          }
          if (actorId !== undefined) {
            await auditRecord(tx, {
              actorId,
              action: 'CLIENT_ACTIVATION_REQUEST_APPROVED',
              entityType: 'CLIENT_ACTIVATION_REQUEST',
              entityId: String(activationRequest.id),
            });
          }
        }

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role.name,
          isActive: user.isActive,
          acceptedTermsAt: user.acceptedTermsAt,
          termsVersion: user.termsVersion,
          privacyVersion: user.privacyVersion,
          projectId: linkedProjectId,
          projectCreated: linkedProjectId !== null,
        };
      });
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

  async updatePassword(id: number, passwordHash: string) {
    try {
      return await this.prisma.user.update({
        where: {
          id,
        },
        data: {
          passwordHash,
          tokenVersion: {
            increment: 1,
          },
        },
        include: {
          role: true,
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw new NotFoundException('Usuario no encontrado');
      }

      throw error;
    }
  }

  async updateOwnUser(
    id: number,
    data: {
      name?: string;
      termsVersion?: string;
      privacyVersion?: string;
      acceptedTermsAt?: Date;
    },
  ) {
    try {
      return await this.prisma.user.update({
        where: {
          id,
        },
        data,
        include: {
          role: true,
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw new NotFoundException('Usuario no encontrado');
      }

      throw error;
    }
  }
}

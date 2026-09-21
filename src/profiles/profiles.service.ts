import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import { validateLegalVersions } from '../common/legal/legal-versions';
import { PLATFORM_ROLES } from '../common/constants/platform-roles';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { UpdateAdminProfileDto } from './dto/update-admin-profile.dto';
import { UpdateClientProfileDto } from './dto/update-client-profile.dto';
import { UpdateDeveloperProfileDto } from './dto/update-developer-profile.dto';
import { hasLegalUpdate, UpdateOwnUserDto } from './dto/update-own-user.dto';
import { UpdateProductOwnerProfileDto } from './dto/update-product-owner-profile.dto';

type UserWithProfiles = Prisma.UserGetPayload<{
  include: {
    role: true;
    clientProfile: true;
    developerProfile: {
      include: {
        technologies: { include: { technology: true } };
      };
    };
    productOwnerProfile: true;
    adminProfile: true;
  };
}>;

@Injectable()
export class ProfilesService {
  constructor(
    private readonly usersService: UsersService,
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  async getOwnProfile(userId: number) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        role: true,
        clientProfile: true,
        developerProfile: {
          include: {
            technologies: {
              include: { technology: true },
              orderBy: { technology: { name: 'asc' } },
            },
          },
        },
        productOwnerProfile: true,
        adminProfile: true,
      },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Usuario inactivo o no existe');
    }

    return this.toOwnProfile(user);
  }

  async updateOwnUser(userId: number, dto: UpdateOwnUserDto) {
    const legalUpdate = hasLegalUpdate(dto);
    if (!dto.name && !legalUpdate) {
      throw new BadRequestException('Debe enviar al menos un campo válido');
    }

    if (legalUpdate && dto.acceptedTerms !== true) {
      throw new BadRequestException(
        'Debe aceptar los términos y privacidad vigentes',
      );
    }
    const legalData = legalUpdate
      ? {
          ...validateLegalVersions(this.configService, dto),
          acceptedTermsAt: new Date(),
        }
      : {};
    const user = await this.usersService.updateOwnUser(userId, {
      ...(dto.name ? { name: dto.name } : {}),
      ...legalData,
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

  async updateClientProfile(userId: number, dto: UpdateClientProfileDto) {
    try {
      const profile = await this.prisma.clientProfile.upsert({
        where: { userId },
        create: { userId, ...dto },
        update: dto,
      });
      return this.withoutUserId(PLATFORM_ROLES.CLIENT, profile);
    } catch (error) {
      this.rethrowProfileConflict(error);
    }
  }

  async updateDeveloperProfile(userId: number, dto: UpdateDeveloperProfileDto) {
    const { technologyIds, ...profileData } = dto;
    const uniqueTechnologyIds = [...new Set(technologyIds ?? [])];

    return this.prisma
      .$transaction(async (tx) => {
        if (technologyIds !== undefined && uniqueTechnologyIds.length > 0) {
          const activeTechnologies = await tx.technology.count({
            where: { id: { in: uniqueTechnologyIds }, isActive: true },
          });
          if (activeTechnologies !== uniqueTechnologyIds.length) {
            throw new BadRequestException(
              'Una o más tecnologías no existen o están inactivas',
            );
          }
        }

        const profile = await tx.developerProfile.upsert({
          where: { userId },
          create: { userId, ...profileData },
          update: profileData,
        });

        if (technologyIds !== undefined) {
          await tx.developerTechnology.deleteMany({
            where: { developerProfileId: profile.id },
          });
          if (uniqueTechnologyIds.length > 0) {
            await tx.developerTechnology.createMany({
              data: uniqueTechnologyIds.map((technologyId) => ({
                developerProfileId: profile.id,
                technologyId,
              })),
            });
          }
        }

        const updated = await tx.developerProfile.findUniqueOrThrow({
          where: { id: profile.id },
          include: {
            technologies: {
              include: { technology: true },
              orderBy: { technology: { name: 'asc' } },
            },
          },
        });

        const { userId: _userId, technologies, ...safeProfile } = updated;
        return {
          type: PLATFORM_ROLES.DEVELOPER,
          ...safeProfile,
          technologies: technologies.map(({ technology }) => ({
            id: technology.id,
            name: technology.name,
            icon: technology.icon,
          })),
        };
      })
      .catch((error: unknown) => this.rethrowProfileConflict(error));
  }

  async updateProductOwnerProfile(
    userId: number,
    dto: UpdateProductOwnerProfileDto,
  ) {
    const profile = await this.prisma.productOwnerProfile
      .upsert({
        where: { userId },
        create: { userId, ...dto },
        update: dto,
      })
      .catch((error: unknown) => this.rethrowProfileConflict(error));
    return this.withoutUserId(PLATFORM_ROLES.PRODUCT_OWNER, profile);
  }

  async updateAdminProfile(userId: number, dto: UpdateAdminProfileDto) {
    const profile = await this.prisma.adminProfile
      .upsert({
        where: { userId },
        create: { userId, ...dto },
        update: dto,
      })
      .catch((error: unknown) => this.rethrowProfileConflict(error));
    return this.withoutUserId(PLATFORM_ROLES.ADMIN, profile);
  }

  private toOwnProfile(user: UserWithProfiles) {
    const safeUser = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role.name,
      isActive: user.isActive,
    };

    if (user.role.name === PLATFORM_ROLES.CLIENT && user.clientProfile) {
      return {
        user: safeUser,
        profile: this.withoutUserId(PLATFORM_ROLES.CLIENT, user.clientProfile),
      };
    }

    if (user.role.name === PLATFORM_ROLES.DEVELOPER && user.developerProfile) {
      const {
        userId: _userId,
        technologies,
        ...profile
      } = user.developerProfile;
      return {
        user: safeUser,
        profile: {
          type: PLATFORM_ROLES.DEVELOPER,
          ...profile,
          technologies: technologies.map(({ technology }) => ({
            id: technology.id,
            name: technology.name,
            icon: technology.icon,
          })),
        },
      };
    }

    if (
      user.role.name === PLATFORM_ROLES.PRODUCT_OWNER &&
      user.productOwnerProfile
    ) {
      return {
        user: safeUser,
        profile: this.withoutUserId(
          PLATFORM_ROLES.PRODUCT_OWNER,
          user.productOwnerProfile,
        ),
      };
    }

    if (user.role.name === PLATFORM_ROLES.ADMIN && user.adminProfile) {
      return {
        user: safeUser,
        profile: this.withoutUserId(PLATFORM_ROLES.ADMIN, user.adminProfile),
      };
    }

    return { user: safeUser, profile: null };
  }

  private withoutUserId<T extends { userId: number }>(type: string, value: T) {
    const { userId: _userId, ...profile } = value;
    return { type, ...profile };
  }

  private rethrowProfileConflict(error: unknown): never {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      const target = String(error.meta?.target ?? '');
      const message = /dni|ruc/i.test(target)
        ? 'El DNI o RUC ya está registrado'
        : 'Ya existe un perfil con los datos únicos indicados';
      throw new ConflictException(message);
    }
    throw error;
  }
}

import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import * as bcrypt from 'bcrypt';

import { PLATFORM_ROLES } from '../common/constants/platform-roles';
import { validateLegalVersions } from '../common/legal/legal-versions';
import { PrismaService } from '../prisma/prisma.service';

import { CreateUserDto } from './dto/create-user.dto';

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
          where: { name: PLATFORM_ROLES.CLIENT },
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

  async createAdministrativeUser(dto: CreateUserDto) {
    const { termsVersion, privacyVersion } = validateLegalVersions(
      this.configService,
      dto,
    );

    const passwordHash = await bcrypt.hash(dto.password, 12);

    try {
      return await this.prisma.$transaction(async (tx) => {
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
        where: { id },
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
        where: { id },
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

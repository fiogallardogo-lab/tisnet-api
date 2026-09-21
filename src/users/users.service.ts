import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PLATFORM_ROLES } from '../common/constants/platform-roles';

interface CreateClientInput {
  name: string;
  email: string;
  passwordHash: string;
  termsVersion: string;
  privacyVersion: string;
}

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

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
            clientProfile: { create: {} },
          },
          include: { role: true },
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
        include: { role: true },
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

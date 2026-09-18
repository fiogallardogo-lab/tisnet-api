import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, ProspectSource, ProspectStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { ListProspectsQueryDto } from './dto/list-prospects-query.dto.js';

const prospectRelations = {
  quotes: {
    select: {
      publicCode: true,
      solutionType: true,
      status: true,
      pricingStatus: true,
      amountMinor: true,
      currency: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' as const },
  },
} satisfies Prisma.ProspectInclude;

@Injectable()
export class ProspectsService {
  constructor(private readonly prisma: PrismaService) {}

  async linkQuote(
    userId: number,
    authenticatedEmail: string,
    publicCode: string,
  ) {
    const email = authenticatedEmail.trim().toLowerCase();
    const code = publicCode.trim().toUpperCase();

    try {
      return await this.prisma.$transaction(async (tx) => {
        const quote = await tx.quote.findUnique({
          where: { publicCode: code },
          include: { prospect: true },
        });

        if (!quote) {
          throw new NotFoundException('Cotización no encontrada');
        }
        if (quote.contactEmail.trim().toLowerCase() !== email) {
          throw new ForbiddenException(
            'La cotización no pertenece al usuario autenticado',
          );
        }
        if (
          quote.prospect?.userId !== null &&
          quote.prospect?.userId !== undefined &&
          quote.prospect.userId !== userId
        ) {
          throw new ConflictException(
            'La cotización ya está vinculada a otro prospecto',
          );
        }

        let prospect = await tx.prospect.findFirst({
          where: { OR: [{ email }, { userId }] },
        });
        if (
          prospect &&
          prospect.userId !== null &&
          prospect.userId !== userId
        ) {
          throw new ConflictException(
            'El correo ya está vinculado a otro prospecto',
          );
        }
        if (prospect && prospect.email !== email) {
          throw new ConflictException(
            'El usuario ya está vinculado a otro prospecto',
          );
        }

        prospect = prospect
          ? await tx.prospect.update({
              where: { id: prospect.id },
              data: {
                userId,
                name: quote.contactName,
                phone: quote.contactPhone,
                company: quote.contactCompany,
              },
            })
          : await tx.prospect.create({
              data: {
                userId,
                name: quote.contactName,
                email,
                phone: quote.contactPhone,
                company: quote.contactCompany,
                source: ProspectSource.QUOTE,
              },
            });

        if (quote.prospectId !== prospect.id) {
          await tx.quote.update({
            where: { id: quote.id },
            data: { prospectId: prospect.id },
          });
        }

        return this.findProspectById(tx, prospect.id);
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          'El usuario, correo o cotización ya tiene otro vínculo',
        );
      }
      throw error;
    }
  }

  async findOwn(userId: number) {
    const prospect = await this.prisma.prospect.findUnique({
      where: { userId },
      include: prospectRelations,
    });

    if (!prospect) {
      throw new NotFoundException('Prospecto no encontrado');
    }

    return this.toProspectResponse(prospect);
  }

  async findAll(query: ListProspectsQueryDto) {
    const { page, limit, search, status } = query;
    const where: Prisma.ProspectWhereInput = {
      ...(status ? { status } : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search } },
              { email: { contains: search } },
              { company: { contains: search } },
            ],
          }
        : {}),
    };

    const [prospects, totalItems] = await this.prisma.$transaction([
      this.prisma.prospect.findMany({
        where,
        include: prospectRelations,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.prospect.count({ where }),
    ]);

    return {
      items: prospects.map((prospect) => this.toProspectResponse(prospect)),
      meta: {
        page,
        limit,
        totalItems,
        totalPages: Math.ceil(totalItems / limit),
      },
    };
  }

  async findOne(id: number) {
    const prospect = await this.prisma.prospect.findUnique({
      where: { id },
      include: prospectRelations,
    });

    if (!prospect) {
      throw new NotFoundException('Prospecto no encontrado');
    }

    return this.toProspectResponse(prospect);
  }

  async updateStatus(id: number, status: ProspectStatus) {
    await this.ensureProspectExists(id);

    const prospect = await this.prisma.prospect.update({
      where: { id },
      data: { status },
      include: prospectRelations,
    });

    return this.toProspectResponse(prospect);
  }

  async findPublicAdvisors() {
    const advisors = await this.prisma.adminProfile.findMany({
      where: {
        isPublicAdvisor: true,
        user: { isActive: true },
      },
      select: {
        id: true,
        executiveTitle: true,
        specialty: true,
        photoUrl: true,
        calendlyUrl: true,
        user: { select: { name: true } },
      },
      orderBy: { user: { name: 'asc' } },
    });

    return advisors.map(({ user, ...advisor }) => ({
      ...advisor,
      name: user.name,
    }));
  }

  async setAdvisorVisibility(profileId: number, isPublicAdvisor: boolean) {
    const advisor = await this.prisma.adminProfile.findUnique({
      where: { id: profileId },
      include: { user: true },
    });

    if (!advisor) {
      throw new NotFoundException('Perfil de asesor no encontrado');
    }
    if (isPublicAdvisor && !advisor.user.isActive) {
      throw new ConflictException(
        'Un usuario inactivo no puede publicarse como asesor',
      );
    }

    const updated = await this.prisma.adminProfile.update({
      where: { id: profileId },
      data: { isPublicAdvisor },
      select: {
        id: true,
        executiveTitle: true,
        specialty: true,
        photoUrl: true,
        calendlyUrl: true,
        isPublicAdvisor: true,
        user: { select: { name: true, isActive: true } },
      },
    });

    const { user, ...profile } = updated;
    return { ...profile, name: user.name, isActive: user.isActive };
  }

  private async ensureProspectExists(id: number) {
    const prospect = await this.prisma.prospect.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!prospect) {
      throw new NotFoundException('Prospecto no encontrado');
    }
  }

  private async findProspectById(tx: Prisma.TransactionClient, id: number) {
    const prospect = await tx.prospect.findUniqueOrThrow({
      where: { id },
      include: prospectRelations,
    });
    return this.toProspectResponse(prospect);
  }

  private toProspectResponse(
    prospect: Prisma.ProspectGetPayload<{ include: typeof prospectRelations }>,
  ) {
    return {
      id: prospect.id,
      name: prospect.name,
      email: prospect.email,
      phone: prospect.phone,
      company: prospect.company,
      status: prospect.status,
      source: prospect.source,
      quotes: prospect.quotes.map((quote) => ({
        ...quote,
        amountMinor: quote.amountMinor?.toNumber() ?? null,
      })),
      createdAt: prospect.createdAt,
      updatedAt: prospect.updatedAt,
    };
  }
}

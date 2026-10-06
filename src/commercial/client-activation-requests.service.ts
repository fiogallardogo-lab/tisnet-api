import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ClientActivationRequestStatus } from '@prisma/client';
import { Prisma } from '@prisma/client';
import { auditRecord } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ClientActivationRequestsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(prospectId: number, requesterId: number) {
    const prospect = await this.prisma.prospect.findUnique({
      where: { id: prospectId },
      select: { id: true, userId: true, status: true, email: true },
    });
    if (!prospect) throw new NotFoundException('Visitante no encontrado.');
    if (prospect.userId || prospect.status === 'CONVERTED')
      throw new ConflictException('El visitante ya fue convertido en cliente.');
    const pending = await this.prisma.clientActivationRequest.findFirst({
      where: { prospectId, status: ClientActivationRequestStatus.PENDING },
      select: { id: true, status: true, createdAt: true },
    });
    if (pending) return { ...pending, prospectId, alreadyPending: true };

    try {
      const request = await this.prisma.$transaction(async (tx) => {
        const created = await tx.clientActivationRequest.create({
          data: { prospectId, requesterId },
          select: { id: true, status: true, createdAt: true },
        });
        await auditRecord(tx, {
          actorId: requesterId,
          action: 'CLIENT_ACTIVATION_REQUESTED',
          entityType: 'CLIENT_ACTIVATION_REQUEST',
          entityId: String(created.id),
        });
        return created;
      });
      return { ...request, prospectId, alreadyPending: false };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const concurrentRequest =
          await this.prisma.clientActivationRequest.findFirst({
            where: {
              prospectId,
              status: ClientActivationRequestStatus.PENDING,
            },
            select: { id: true, status: true, createdAt: true },
          });
        if (concurrentRequest)
          return { ...concurrentRequest, prospectId, alreadyPending: true };
      }
      throw error;
    }
  }

  async list(actorId: number, role: string) {
    const requests = await this.prisma.clientActivationRequest.findMany({
      where:
        role === 'SUPER_ADMIN'
          ? { status: ClientActivationRequestStatus.PENDING }
          : { requesterId: actorId },
      include: {
        prospect: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            company: true,
            status: true,
            source: true,
            quotes: {
              select: {
                publicCode: true,
                solutionType: true,
                pricingStatus: true,
                amountMinor: true,
                currency: true,
                createdAt: true,
              },
              orderBy: { createdAt: 'desc' },
              take: 1,
            },
          },
        },
        requester: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    return {
      items: requests.map((request) => ({
        id: request.id,
        prospectId: request.prospectId,
        status: request.status,
        createdAt: request.createdAt,
        reviewedAt: request.reviewedAt,
        prospect: {
          ...request.prospect,
          quotes: request.prospect.quotes.map((quote) => ({
            ...quote,
            amountMinor: quote.amountMinor?.toNumber() ?? null,
          })),
        },
        requestedBy: request.requester,
      })),
      totalItems: requests.length,
    };
  }
}

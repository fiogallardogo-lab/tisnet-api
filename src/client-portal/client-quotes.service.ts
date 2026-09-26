import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class ClientQuotesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async getAgreement(quoteId: number, clientId: number) {
    const quote = await this.prisma.quote.findFirst({
      where: {
        id: quoteId,
        prospect: { userId: clientId },
      },
      include: {
        versions: {
          orderBy: { version: 'desc' },
          take: 1,
          include: {
            schedules: {
              orderBy: { sequence: 'asc' },
              include: { payments: { where: { status: 'CONFIRMED' } } },
            },
          },
        },
      },
    });

    if (!quote || quote.versions.length === 0) {
      throw new NotFoundException('Cotización oficial no encontrada o no pertenece a tu cuenta.');
    }

    const official = quote.versions[0];

    return {
      quoteId: quote.id,
      code: quote.publicCode,
      activeVersion: quote.activeVersion,
      amountMinor: Number(official.amountMinor),
      currency: official.currency,
      officialAt: official.officialAt,
      acceptedAt: official.acceptedAt,
      acceptedVersionId: official.acceptedAt ? official.version : null,
      installments: official.schedules.map((s) => {
        const totalPaid = s.payments.reduce((sum, p) => sum + Number(p.amountMinor), 0);
        return {
          id: s.id,
          sequence: s.sequence,
          milestone: s.milestone,
          dueDate: s.dueDate,
          amountMinor: Number(s.amountMinor),
          paidMinor: totalPaid,
          status: totalPaid >= Number(s.amountMinor) ? 'PAID' : 'PENDING',
        };
      }),
    };
  }

  async acceptAgreement(quoteId: number, clientId: number, version: number) {
    return this.prisma.$transaction(async (tx) => {
      const quote = await tx.quote.findFirst({
        where: { id: quoteId, prospect: { userId: clientId } },
      });
      if (!quote) throw new NotFoundException('Cotización no encontrada.');
      
      if (quote.activeVersion !== version) {
        throw new ConflictException('Solo puedes aceptar la versión activa/oficial actual.');
      }

      const qv = await tx.quoteVersion.findUnique({
        where: { quoteId_version: { quoteId, version } },
      });

      if (!qv) throw new NotFoundException('Versión no encontrada.');

      if (qv.acceptedAt) {
        // Idempotent return
        return { accepted: true, acceptedAt: qv.acceptedAt };
      }

      const updated = await tx.quoteVersion.update({
        where: { id: qv.id },
        data: {
          acceptedAt: new Date(),
          acceptedByUserId: clientId,
        },
      });

      await this.audit.record({
        actorId: clientId,
        action: 'CLIENT_ACCEPTED_QUOTE_VERSION',
        entityType: 'QUOTE',
        entityId: quoteId,
        metadata: { version },
      });

      return { accepted: true, acceptedAt: updated.acceptedAt };
    });
  }
}

import { auditRecord } from '../audit/audit.service';
import {
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
      throw new NotFoundException(
        'Cotización oficial no encontrada o no pertenece a tu cuenta.',
      );
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
      acceptedVersionId: official.acceptedAt ? official.id : null,
      versions: quote.versions.map((v) => ({
        id: v.id,
        version: v.version,
        code: quote.publicCode,
        kind: 'OFFICIAL',
        status: v.acceptedAt
          ? 'ACCEPTED'
          : v.version === quote.activeVersion
            ? 'SENT'
            : 'SUPERSEDED',
        amountMinor: Number(v.amountMinor),
        currency: v.currency,
        createdAt: v.createdAt,
        notes:
          typeof v.scope === 'object' && v.scope && 'description' in v.scope
            ? v.scope.description
            : '',
        canAccept: v.version === quote.activeVersion && !v.acceptedAt,
        installments: v.schedules.map((s) => ({
          id: s.id,
          label: s.milestone,
          percentage: s.percentageBasisPoints / 100,
          amountMinor: Number(s.amountMinor),
          currency: v.currency,
          dueDate: s.dueDate.toISOString().slice(0, 10),
          status: s.payments.length ? 'PAID' : 'PENDING',
        })),
      })),
      installments: official.schedules.map((s) => {
        const totalPaid = s.payments.reduce(
          (sum, p) => sum + Number(p.amountMinor),
          0,
        );
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

  async acceptAgreement(quoteId: number, clientId: number, versionId: number) {
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM Quote WHERE id = ${quoteId} FOR UPDATE`;
      const quote = await tx.quote.findFirst({
        where: { id: quoteId, prospect: { userId: clientId } },
      });
      if (!quote) throw new NotFoundException('Cotización no encontrada.');

      const qv = await tx.quoteVersion.findFirst({
        where: { id: versionId, quoteId, clientUserId: clientId },
      });
      if (!qv) throw new NotFoundException('Versión no encontrada.');
      if (quote.activeVersion !== qv.version)
        throw new ConflictException(
          'Solo puedes aceptar la versión activa/oficial actual.',
        );
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

      await auditRecord(tx, {
        actorId: clientId,
        action: 'CLIENT_ACCEPTED_QUOTE_VERSION',
        entityType: 'QUOTE',
        entityId: String(quoteId),
        metadata: { version: qv.version },
      });

      return { accepted: true, acceptedAt: updated.acceptedAt };
    });
  }
}

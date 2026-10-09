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

  async getAgreement(quoteId: number, clientId: number, clientEmail?: string) {
    const quote = await this.prisma.quote.findFirst({
      where: {
        id: quoteId,
        OR: [
          { prospect: { userId: clientId } },
          ...(clientEmail
            ? [{ contactEmail: clientEmail.trim().toLowerCase() }]
            : []),
        ],
      },
      include: {
        options: {
          orderBy: { displayOrder: 'asc' },
        },
        versions: {
          orderBy: { version: 'desc' },
          include: {
            schedules: {
              orderBy: { sequence: 'asc' },
              include: {
                payments: { where: { status: 'CONFIRMED' } },
                manualPaymentSubmissions: {
                  orderBy: { createdAt: 'desc' },
                  take: 1,
                  select: { status: true },
                },
              },
            },
          },
        },
      },
    });

    if (!quote) {
      throw new NotFoundException(
        'Cotización no encontrada o no pertenece a tu cuenta.',
      );
    }

    const versions =
      quote.versions.length > 0
        ? quote.versions.map((v) => ({
            id: v.id,
            version: v.version,
            code: quote.publicCode,
            kind: 'OFFICIAL' as const,
            status: v.acceptedAt
              ? 'ACCEPTED'
              : v.version === quote.activeVersion
                ? 'SENT'
                : 'SUPERSEDED',
            amountMinor: Number(v.amountMinor),
            currency: v.currency,
            createdAt:
              typeof v.createdAt === 'object' && v.createdAt?.toISOString
                ? v.createdAt.toISOString()
                : String(v.createdAt),
            notes:
              typeof v.scope === 'object' && v.scope && 'description' in v.scope
                ? (v.scope as { description: string }).description
                : typeof v.scope === 'string'
                  ? v.scope
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
              manualSubmissionStatus:
                s.manualPaymentSubmissions[0]?.status ?? null,
            })),
          }))
        : [
            {
              id: 0,
              version: 0,
              code: quote.publicCode,
              kind: 'PRELIMINARY' as const,
              status: quote.status,
              amountMinor: Number(quote.amountMinor ?? 0),
              currency: quote.currency ?? 'PEN',
              createdAt:
                typeof quote.createdAt === 'object' &&
                quote.createdAt?.toISOString
                  ? quote.createdAt.toISOString()
                  : String(quote.createdAt),
              notes:
                quote.notes ||
                `Cotización preliminar estimada para ${quote.solutionType.replaceAll('_', ' ')}.`,
              canAccept: false,
              installments: [],
            },
          ];

    const official = quote.versions[0] ?? null;

    return {
      quoteId: quote.id,
      code: quote.publicCode,
      solutionType: quote.solutionType,
      deliveryMode: quote.deliveryMode,
      contactName: quote.contactName,
      contactEmail: quote.contactEmail,
      contactPhone: quote.contactPhone,
      contactCompany: quote.contactCompany,
      notes: quote.notes,
      status: quote.status,
      pricingStatus: quote.pricingStatus,
      options: quote.options.map((o) => ({
        id: o.id,
        code: o.optionCode,
        name: o.optionName,
      })),
      activeVersion: quote.activeVersion,
      amountMinor: official
        ? Number(official.amountMinor)
        : Number(quote.amountMinor ?? 0),
      currency: official ? official.currency : (quote.currency ?? 'PEN'),
      officialAt: official ? official.officialAt : null,
      acceptedAt: official ? official.acceptedAt : null,
      acceptedVersionId: official?.acceptedAt ? official.id : null,
      versions,
      installments: official
        ? official.schedules.map((s) => {
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
          })
        : [],
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

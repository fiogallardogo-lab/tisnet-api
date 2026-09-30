import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

type Amount = Prisma.Decimal | number;
type EconomicVersion = {
  id: number;
  version: number;
  currency: string;
  amountMinor: Amount;
  acceptedAt: Date | null;
  schedules: Array<{
    id: number;
    sequence: number;
    amountMinor: Amount;
    payments: Array<{ status: string; currency: string; amountMinor: Amount }>;
  }>;
};
export function economicState(version: EconomicVersion | null) {
  if (!version)
    return {
      state: 'NO_OFFICIAL_VERSION',
      complete: false,
      totalMinor: 0,
      paidMinor: 0,
      outstandingMinor: 0,
      installments: [],
    };
  const installments = version.schedules.map((s) => {
    const expected = Number(s.amountMinor);
    const confirmed = s.payments.filter((p) => p.status === 'CONFIRMED');
    const paid = confirmed.reduce((sum, p) => sum + Number(p.amountMinor), 0);
    const valid =
      Number.isSafeInteger(expected) &&
      expected > 0 &&
      confirmed.every(
        (p) =>
          p.currency === version.currency &&
          Number.isSafeInteger(Number(p.amountMinor)) &&
          Number(p.amountMinor) > 0,
      ) &&
      paid <= expected;
    return {
      id: s.id,
      sequence: s.sequence,
      amountMinor: expected,
      paidMinor: paid,
      outstandingMinor: Math.max(0, expected - paid),
      valid,
      complete: valid && paid === expected,
    };
  });
  const totalMinor = Number(version.amountMinor),
    paidMinor = installments.reduce((sum, x) => sum + x.paidMinor, 0);
  const valid =
    Number.isSafeInteger(totalMinor) &&
    totalMinor > 0 &&
    installments.length > 0 &&
    installments.length <= 5 &&
    installments.every((x) => x.valid) &&
    installments.reduce((sum, x) => sum + x.amountMinor, 0) === totalMinor;
  const complete =
    !!version.acceptedAt && valid && installments.every((x) => x.complete);
  return {
    versionId: version.id,
    version: version.version,
    currency: version.currency,
    state: !valid
      ? 'INCONSISTENT'
      : !version.acceptedAt
        ? 'UNACCEPTED'
        : complete
          ? 'PAID'
          : 'OPEN',
    complete,
    totalMinor,
    paidMinor,
    outstandingMinor: Math.max(0, totalMinor - paidMinor),
    installments,
  };
}
@Injectable()
export class FinancialService {
  constructor(private readonly db: PrismaService) {}
  async forQuote(
    quoteId: number,
    actor?: { id: number; role: string },
    tx: Prisma.TransactionClient = this.db,
  ) {
    const q = await tx.quote.findUnique({
      where: { id: quoteId },
      include: { prospect: true },
    });
    if (!q) throw new NotFoundException('Cotización no encontrada.');
    if (
      actor &&
      !['ADMIN', 'SUPER_ADMIN'].includes(actor.role) &&
      !(actor.role === 'CLIENT' && q.prospect?.userId === actor.id)
    )
      throw new ForbiddenException('No tienes acceso al estado económico.');
    const v = await tx.quoteVersion.findUnique({
      where: { quoteId_version: { quoteId, version: q.activeVersion } },
      include: {
        schedules: {
          orderBy: { sequence: 'asc' },
          include: { payments: { where: { status: 'CONFIRMED' } } },
        },
      },
    });
    return { quoteId, ...economicState(v) };
  }
  async assertComplete(quoteId: number, tx: Prisma.TransactionClient) {
    const result = await this.forQuote(quoteId, undefined, tx);
    if (!result.complete)
      throw new ConflictException(
        'La versión oficial vigente debe estar aceptada y todas sus cuotas completadas.',
      );
    return result;
  }
}

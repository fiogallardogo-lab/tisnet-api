import {
  Injectable,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { auditRecord } from '../audit/audit.service';
import { ContactDto, EditQuoteDto, ObservationDto } from './commercial.dto';
@Injectable()
export class CommercialService {
  constructor(private readonly db: PrismaService) {}
  async edit(id: number, actorId: number, dto: EditQuoteDto) {
    const data = {
      ...(dto.fullName !== undefined ? { contactName: dto.fullName } : {}),
      ...(dto.phone !== undefined ? { contactPhone: dto.phone } : {}),
      ...(dto.company !== undefined ? { contactCompany: dto.company } : {}),
      ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
    };
    if (!Object.keys(data).length)
      throw new BadRequestException('No hay campos para modificar.');
    return this.db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM Quote WHERE id = ${id} FOR UPDATE`;
      const before = await tx.quote.findUnique({ where: { id } });
      if (!before) throw new NotFoundException('Cotización no encontrada.');
      // Official snapshots cannot be silently changed through a mutable quote header.
      if (before.activeVersion > 0)
        throw new ConflictException(
          'La cotización oficial requiere una nueva versión.',
        );
      const update = await tx.quote.updateMany({
        where: { id, updatedAt: new Date(dto.expectedUpdatedAt) },
        data,
      });
      if (update.count !== 1)
        throw new ConflictException(
          'La cotización cambió; vuelve a consultarla.',
        );
      await auditRecord(tx, {
        actorId,
        action: 'QUOTE_EDITED',
        entityType: 'QUOTE',
        entityId: String(id),
      });
      return tx.quote.findUniqueOrThrow({ where: { id } });
    });
  }
  async observe(quoteId: number, actorId: number, dto: ObservationDto) {
    return this.db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM Quote WHERE id = ${quoteId} FOR UPDATE`;
      const quote = await tx.quote.findUnique({
        where: { id: quoteId },
        include: { prospect: true },
      });
      if (!quote) throw new NotFoundException('Cotización no encontrada.');
      if (quote.prospect?.userId !== actorId)
        throw new ForbiddenException('Cotización ajena.');
      const version = await tx.quoteVersion.findFirst({
        where: { id: dto.versionId, quoteId, clientUserId: actorId },
      });
      if (!version) throw new NotFoundException('Versión no encontrada.');
      if (version.version !== quote.activeVersion || version.acceptedAt)
        throw new ConflictException('Esta versión ya no admite observaciones.');
      const observation = await tx.quoteObservation.create({
        data: {
          quoteId,
          versionId: version.id,
          authorId: actorId,
          text: dto.text,
        },
      });
      await auditRecord(tx, {
        actorId,
        action: 'QUOTE_OBSERVATION_CREATED',
        entityType: 'QUOTE',
        entityId: String(quoteId),
        metadata: { version: version.version },
      });
      return observation;
    });
  }
  async observations(quoteId: number, clientId?: number) {
    const quote = await this.db.quote.findUnique({
      where: { id: quoteId },
      include: { prospect: true },
    });
    if (!quote) throw new NotFoundException('Cotización no encontrada.');
    if (clientId !== undefined && quote.prospect?.userId !== clientId)
      throw new ForbiddenException('Cotización ajena.');
    return {
      items: await this.db.quoteObservation.findMany({
        where: { quoteId },
        orderBy: { id: 'asc' },
      }),
    };
  }
  async contact(dto: ContactDto) {
    const record = await this.db.contactInquiry.create({
      data: { ...dto, code: 'C-' + randomUUID() },
    });
    return {
      code: record.code,
      status: 'RECEIVED',
      createdAt: record.createdAt,
    };
  }
}

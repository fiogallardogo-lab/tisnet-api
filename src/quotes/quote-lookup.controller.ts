import { PrismaService } from '../prisma/prisma.service';
import {
  Controller,
  Get,
  Inject,
  NotFoundException,
  ForbiddenException,
  Param,
  Request,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import {
  DOCUMENT_RENDERER,
  type DocumentRenderer,
} from '../documents/document-renderer.interface';
import {
  QUOTE_REPOSITORY,
  type QuoteRepository,
} from './repositories/quote.repository';
import { toPublicQuoteResponse } from './mappers/public-quote.mapper';

@Controller('public/quotes')
export class QuoteLookupController {
  constructor(
    @Inject(QUOTE_REPOSITORY) private readonly repository: QuoteRepository,
  ) {}
  @Get(':code')
  async find(@Param('code') code: string) {
    const quote = await this.repository.findByPublicCode(code);
    if (!quote) throw new NotFoundException('Cotización no encontrada');
    // Public code is not authentication: never disclose contact details or documents here.
    return toPublicQuoteResponse(quote);
  }
}
@Controller('quotes')
@UseGuards(JwtAuthGuard)
export class QuotePdfController {
  constructor(
    @Inject(QUOTE_REPOSITORY) private readonly repository: QuoteRepository,
    @Inject(DOCUMENT_RENDERER) private readonly renderer: DocumentRenderer,
    private readonly prisma: PrismaService,
  ) {}
  @Get(':code/pdf')
  async pdf(
    @Param('code') code: string,
    @Request() req: { user: { email: string; role: string } },
  ) {
    const quote = await this.repository.findByPublicCode(code);
    if (!quote) throw new NotFoundException('Cotización no encontrada');
    if (
      !['ADMIN', 'SUPER_ADMIN'].includes(req.user.role) &&
      quote.contactEmail.toLowerCase() !== req.user.email.toLowerCase()
    )
      throw new ForbiddenException();
    const persisted = await this.prisma.quote.findUniqueOrThrow({
      where: { publicCode: quote.publicCode },
      include: {
        versions: {
          orderBy: { version: 'desc' },
          take: 1,
          include: { schedules: { orderBy: { sequence: 'asc' } } },
        },
      },
    });
    const official = persisted.versions[0];
    const doc = await this.renderer.renderQuote({
      publicCode: quote.publicCode,
      contactName: quote.contactName,
      contactEmail: quote.contactEmail,
      solutionType: quote.solutionType,
      createdAt: quote.createdAt,
      options: quote.options.map((x) => ({ code: x.code, label: x.name })),
      items: official
        ? official.schedules.map((part) => ({
            code: `INSTALLMENT_${part.sequence}`,
            label: part.milestone,
            amountMinor: Number(part.amountMinor),
          }))
        : quote.items,
      pricing: {
        currency: official?.currency || quote.currency || 'PEN',
        pricingVersion: official
          ? `OFFICIAL-v${official.version}`
          : quote.pricingVersion,
        totalMinor: official ? Number(official.amountMinor) : quote.amountMinor,
      },
    });
    return new StreamableFile(doc.content, {
      type: 'application/pdf',
      disposition: `attachment; filename="${quote.publicCode}.pdf"`,
    });
  }
}

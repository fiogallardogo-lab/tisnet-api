import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { basename } from 'node:path';
import { PrismaService } from '../prisma/prisma.service';
import { approvedQuoteCatalog, QUOTE_CATALOG_VERSION } from './catalog';
import { CreateQuoteDto, TeamApplicationDto } from './intake.dto';
export interface IntakeFile {
  buffer: Buffer;
  size: number;
  mimetype: string;
  originalname: string;
}
export function validateFiles(cv?: IntakeFile, photo?: IntakeFile) {
  const validSize = (file?: IntakeFile) =>
    file &&
    file.size > 0 &&
    file.size <= 5 * 1024 * 1024 &&
    file.size === file.buffer.length;
  if (
    !validSize(cv) ||
    cv!.mimetype !== 'application/pdf' ||
    cv!.buffer.subarray(0, 5).toString() !== '%PDF-' ||
    !cv!.buffer.subarray(-1024).includes(Buffer.from('%%EOF'))
  )
    throw new BadRequestException('Adjunta un CV PDF válido de hasta 5 MB.');
  const b = photo?.buffer;
  const jpeg =
    b &&
    b.length >= 4 &&
    b[0] === 255 &&
    b[1] === 216 &&
    b[2] === 255 &&
    b[b.length - 2] === 255 &&
    b[b.length - 1] === 217;
  const png =
    b &&
    b.length >= 24 &&
    b.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) &&
    b.subarray(12, 16).toString() === 'IHDR';
  const webp =
    b &&
    b.length >= 16 &&
    b.subarray(0, 4).toString() === 'RIFF' &&
    b.subarray(8, 12).toString() === 'WEBP' &&
    b.readUInt32LE(4) + 8 === b.length;
  if (
    !validSize(photo) ||
    !(
      (jpeg && photo!.mimetype === 'image/jpeg') ||
      (png && photo!.mimetype === 'image/png') ||
      (webp && photo!.mimetype === 'image/webp')
    )
  )
    throw new BadRequestException(
      'Adjunta una foto JPG, PNG o WebP válida de hasta 5 MB.',
    );
}
export function calculateQuote(input: CreateQuoteDto) {
  const solution = approvedQuoteCatalog.solutions.find(
    (item) => item.id === input.solutionType,
  );
  if (!solution) throw new BadRequestException('Tipo de proyecto inválido.');
  const codes = input.options.map((item) => item.code);
  if (
    codes.length > 8 ||
    new Set(codes).size !== codes.length ||
    codes.some((code) => !solution.features.some((item) => item.id === code))
  )
    throw new BadRequestException('Extras inválidos o duplicados.');
  if (!['NORMAL', 'URGENT', 'FLEXIBLE'].includes(input.deliveryMode))
    throw new BadRequestException('Entrega inválida.');
  if (solution.baseMinor === undefined)
    return {
      amountMinor: null,
      currency: null,
      pricingVersion: null,
      pricingStatus: 'PENDING_RULES',
      snapshot: {
        solution: solution.name,
        options: [],
        deliveryMode: input.deliveryMode,
      },
    };
  const extras = solution.features.filter((item) => codes.includes(item.id));
  const subtotal =
    solution.baseMinor +
    extras.reduce((sum, item) => sum + item.priceMinor!, 0);
  const rate =
    input.deliveryMode === 'URGENT'
      ? 30
      : input.deliveryMode === 'FLEXIBLE'
        ? -10
        : 0;
  const adjustment =
    Math.sign(rate) * Math.round((subtotal * Math.abs(rate)) / 100);
  return {
    amountMinor: subtotal + adjustment,
    currency: 'PEN',
    pricingVersion: QUOTE_CATALOG_VERSION,
    pricingStatus: 'CALCULATED',
    snapshot: {
      included: solution.included!,
      businessDays: solution.businessDays!,
      taxTreatment: 'TO_CONFIRM',
      lines: [
        { type: 'BASE', code: solution.id, amountMinor: solution.baseMinor },
        ...extras.map((item) => ({
          type: 'EXTRA',
          code: item.id,
          amountMinor: item.priceMinor!,
        })),
        {
          type: 'DELIVERY_ADJUSTMENT',
          code: input.deliveryMode,
          amountMinor: adjustment,
        },
      ],
    },
  };
}
@Injectable()
export class IntakeService {
  constructor(private readonly prisma: PrismaService) {}
  async createQuote(input: CreateQuoteDto) {
    if (!/^\d{7,15}$/.test(input.contact.phone.replace(/\D/g, '')))
      throw new BadRequestException('Teléfono inválido.');
    const pricing = calculateQuote(input);
    const quote = await this.prisma.publicQuote.create({
      data: {
        code: `QUOTE-${randomUUID()}`,
        solutionType: input.solutionType,
        deliveryMode: input.deliveryMode,
        contact: { ...input.contact, email: input.contact.email.toLowerCase() },
        notes: input.notes,
        ...pricing,
      },
    });
    return {
      code: quote.code,
      status: 'RECEIVED',
      createdAt: quote.createdAt,
      pricingStatus: quote.pricingStatus,
      amountMinor: quote.amountMinor,
      currency: quote.currency,
      pricingVersion: quote.pricingVersion,
    };
  }
  async apply(
    input: TeamApplicationDto,
    files: { cv?: IntakeFile[]; photo?: IntakeFile[] },
  ) {
    validateFiles(files.cv?.[0], files.photo?.[0]);
    if (!/^\d{7,15}$/.test(input.phone.replace(/\D/g, '')))
      throw new BadRequestException('Teléfono inválido.');
    const { requestedRole, email, dni, consent, ...profile } = input;
    try {
      const result = await this.prisma.teamApplication.create({
        data: {
          code: `TEAM-${randomUUID()}`,
          email: email.toLowerCase(),
          dni,
          requestedRole,
          profile,
          consent: consent === 'true',
          cv: new Uint8Array(files.cv![0].buffer),
          cvName: basename(files.cv![0].originalname).slice(0, 255),
          photo: new Uint8Array(files.photo![0].buffer),
          photoMime: files.photo![0].mimetype,
        },
      });
      return {
        code: result.code,
        status: result.status,
        createdAt: result.createdAt,
      };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      )
        throw new ConflictException(
          'Ya existe una postulación con este correo o DNI.',
        );
      throw error;
    }
  }
}

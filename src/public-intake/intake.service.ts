import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { QuotesService } from '../quotes/quotes.service';
import { QuoteDeliveryMode } from '../quotes/domain/quote.enums';
import { Optional } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { basename } from 'node:path';
import { PrismaService } from '../prisma/prisma.service';
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
@Injectable()
export class IntakeService {
  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly quotes?: QuotesService,
  ) {}
  async createQuote(input: CreateQuoteDto) {
    if (!this.quotes) throw new Error('QuotesService no disponible');
    return this.quotes.createPublic({
      ...input,
      deliveryMode: input.deliveryMode as QuoteDeliveryMode,
    });
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

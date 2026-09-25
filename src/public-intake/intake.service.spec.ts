import { BadRequestException, ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { IntakeService, validateFiles } from './intake.service';
import { CreateQuoteDto, TeamApplicationDto } from './intake.dto';
import type { PrismaService } from '../prisma/prisma.service';
const quote = {
  solutionType: 'ECOMMERCE',
  deliveryMode: 'NORMAL',
  options: [{ code: 'SEO_ADVANCED' }, { code: 'ADVANCED_ANALYTICS' }],
  contact: {
    fullName: 'Persona Prueba',
    email: 'PRUEBA@example.test',
    phone: '999999999',
  },
};
describe('Public intake', () => {
  it('delegates portal submissions to the canonical QuotesService', async () => {
    const createPublic = vi
      .fn()
      .mockResolvedValue({ code: 'Q-ABCDEFGH', amountMinor: 520000 });
    const service = new IntakeService(
      {} as PrismaService,
      { createPublic } as never,
    );
    const result = await service.createQuote(quote);
    expect(createPublic).toHaveBeenCalledWith(quote);
    expect(result.code).toBe('Q-ABCDEFGH');
  });
  it('validates multipart numbers, identity, role and consent', async () => {
    const valid = {
      requestedRole: 'PRODUCT_OWNER',
      fullName: 'Persona Prueba',
      age: '25',
      district: 'Lima',
      email: 'test@example.test',
      phone: '999999999',
      dni: '12345678',
      career: 'Ingeniería',
      university: 'Universidad',
      experienceYears: '3',
      programmingLanguages: 'Node.js',
      specialty: 'FULL_STACK',
      consent: 'true',
    };
    expect(
      await validate(plainToInstance(TeamApplicationDto, valid)),
    ).toHaveLength(0);
    for (const change of [
      { requestedRole: 'ADMIN' },
      { consent: 'false' },
      { dni: '123' },
      { age: 'abc' },
      { experienceYears: '-1' },
    ])
      expect(
        (
          await validate(
            plainToInstance(TeamApplicationDto, { ...valid, ...change }),
          )
        ).length,
      ).toBeGreaterThan(0);
    expect(
      (
        await validate(
          plainToInstance(CreateQuoteDto, { ...quote, contact: null }),
        )
      ).length,
    ).toBeGreaterThan(0);
  });
  it('rejects forged, empty and oversized uploads', () => {
    expect(() => validateFiles()).toThrow(BadRequestException);
    expect(() =>
      validateFiles({
        buffer: Buffer.from('fake'),
        size: 4,
        mimetype: 'application/pdf',
        originalname: 'cv.pdf',
      }),
    ).toThrow(BadRequestException);
    expect(() =>
      validateFiles({
        buffer: Buffer.from('%PDF-1.4\n%%EOF'),
        size: 6 * 1024 * 1024,
        mimetype: 'application/pdf',
        originalname: 'cv.pdf',
      }),
    ).toThrow(BadRequestException);
  });
  it('maps database duplicate constraints to 409', async () => {
    const cv = Buffer.from('%PDF-1.4\n%%EOF');
    const photo = Buffer.from([255, 216, 255, 0, 255, 217]);
    const create = vi.fn().mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('duplicate', {
        code: 'P2002',
        clientVersion: '6.19.3',
      }),
    );
    const service = new IntakeService({
      teamApplication: { create },
    } as unknown as PrismaService);
    await expect(
      service.apply(
        {
          email: 'test@example.test',
          dni: '12345678',
          phone: '999999999',
          requestedRole: 'DEVELOPER',
          consent: 'true',
        } as TeamApplicationDto,
        {
          cv: [
            {
              buffer: cv,
              size: cv.length,
              mimetype: 'application/pdf',
              originalname: 'cv.pdf',
            },
          ],
          photo: [
            {
              buffer: photo,
              size: photo.length,
              mimetype: 'image/jpeg',
              originalname: 'photo.jpg',
            },
          ],
        },
      ),
    ).rejects.toThrow(ConflictException);
  });
});

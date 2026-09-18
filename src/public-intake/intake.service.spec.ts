import { BadRequestException, ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { calculateQuote, IntakeService, validateFiles } from './intake.service';
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
  it.each([
    ['NORMAL', 400000],
    ['URGENT', 520000],
    ['FLEXIBLE', 360000],
  ])('calculates %s on the server', (mode, total) => {
    expect(calculateQuote({ ...quote, deliveryMode: mode }).amountMinor).toBe(
      total,
    );
  });
  it('supports base-only packages and commercial evaluation', () => {
    expect(
      calculateQuote({ ...quote, solutionType: 'LANDING_PAGE', options: [] })
        .amountMinor,
    ).toBe(85000);
    expect(
      calculateQuote({ ...quote, solutionType: 'LANDING_PAGE' }).amountMinor,
    ).toBe(165000);
    expect(
      calculateQuote({ ...quote, solutionType: 'MOBILE_APP', options: [] })
        .pricingStatus,
    ).toBe('PENDING_RULES');
  });
  it('rejects duplicate, incompatible extras and unknown types', () => {
    expect(() =>
      calculateQuote({
        ...quote,
        options: [{ code: 'SEO_ADVANCED' }, { code: 'SEO_ADVANCED' }],
      }),
    ).toThrow(BadRequestException);
    expect(() =>
      calculateQuote({ ...quote, solutionType: 'MOBILE_APP' }),
    ).toThrow(BadRequestException);
    expect(() => calculateQuote({ ...quote, solutionType: 'UNKNOWN' })).toThrow(
      BadRequestException,
    );
  });
  it('persists the server total and complete immutable scope and price snapshot', async () => {
    const create = vi.fn(async ({ data }) => ({
      ...data,
      createdAt: new Date(),
    }));
    const service = new IntakeService({
      publicQuote: { create },
    } as unknown as PrismaService);
    const receipt = await service.createQuote({
      ...quote,
      deliveryMode: 'URGENT',
    });
    expect(receipt.amountMinor).toBe(520000);
    expect(receipt).not.toHaveProperty('contact');
    const data = create.mock.calls[0][0].data;
    expect(data.contact.email).toBe('prueba@example.test');
    expect(data.snapshot.lines).toHaveLength(4);
    expect(data.snapshot.included).toContain('Inventario');
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
    const create = vi
      .fn()
      .mockRejectedValue(
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

import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import { AdminQuotesController } from './admin-quotes.controller';
import { AdminQuotesService } from './admin-quotes.service';
import { PrismaService } from '../prisma/prisma.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';

describe('PublicQuote administrative API', () => {
  let app: INestApplication;
  const quote = {
    id: 1,
    publicCode: 'Q-ABCDEFGH',
    contactName: 'Cliente',
    contactEmail: 'client@example.test',
    solutionType: 'CORPORATE_SITE',
    deliveryMode: 'NORMAL',
    pricingStatus: 'CALCULATED',
    amountMinor: 292500,
    currency: 'PEN',
    createdAt: new Date('2026-09-24'),
    notes: null,
    snapshot: {},
  };
  const db = {
    quote: { findMany: vi.fn(), count: vi.fn(), findUnique: vi.fn() },
    $transaction: vi.fn((queries) => Promise.all(queries)),
  };
  beforeEach(async () => {
    vi.clearAllMocks();
    db.quote.findMany.mockResolvedValue([quote]);
    db.quote.count.mockResolvedValue(1);
    db.quote.findUnique.mockResolvedValue(quote);
    const module = await Test.createTestingModule({
      controllers: [AdminQuotesController],
      providers: [
        AdminQuotesService,
        RolesGuard,
        { provide: PrismaService, useValue: db },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (context) => {
          const req = context.switchToHttp().getRequest();
          req.user = { role: req.headers['x-test-role'] };
          return true;
        },
      })
      .compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api/v1');
    await app.init();
  });
  afterEach(async () => {
    await app?.close();
  });
  it.each(['ADMIN', 'SUPER_ADMIN'])(
    '%s can list and view quotes',
    async (role) => {
      const result = await request(app.getHttpServer())
        .get('/api/v1/admin/quotes')
        .set('x-test-role', role)
        .expect(200);
      expect(result.body.items[0]).toMatchObject({
        publicCode: quote.publicCode,
        email: quote.contactEmail,
        estimatedAmount: 292500,
      });
      expect(result.body.meta).toEqual({
        page: 1,
        limit: 20,
        totalItems: 1,
        totalPages: 1,
      });
      await request(app.getHttpServer())
        .get('/api/v1/admin/quotes/1')
        .set('x-test-role', role)
        .expect(200);
    },
  );
  it.each(['CLIENT', 'DEVELOPER', 'PRODUCT_OWNER'])(
    '%s is forbidden on list and detail',
    async (role) => {
      await request(app.getHttpServer())
        .get('/api/v1/admin/quotes')
        .set('x-test-role', role)
        .expect(403);
      await request(app.getHttpServer())
        .get('/api/v1/admin/quotes/1')
        .set('x-test-role', role)
        .expect(403);
      expect(db.quote.findMany).not.toHaveBeenCalled();
    },
  );
  it('uses MySQL JSON paths for contact searches, a real pricing filter and pagination', async () => {
    await request(app.getHttpServer())
      .get(
        '/api/v1/admin/quotes?search=Cliente&status=CALCULATED&page=2&limit=5',
      )
      .set('x-test-role', 'ADMIN')
      .expect(200);
    expect(db.quote.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 5,
        take: 5,
        where: {
          pricingStatus: 'CALCULATED',
          OR: [
            { publicCode: { contains: 'Cliente' } },
            { contactName: { contains: 'Cliente' } },
            { contactEmail: { contains: 'Cliente' } },
            { contactCompany: { contains: 'Cliente' } },
          ],
        },
      }),
    );
  });
  it('returns 404 for a missing quote', async () => {
    db.quote.findUnique.mockResolvedValue(null);
    await request(app.getHttpServer())
      .get('/api/v1/admin/quotes/999')
      .set('x-test-role', 'ADMIN')
      .expect(404);
  });
});

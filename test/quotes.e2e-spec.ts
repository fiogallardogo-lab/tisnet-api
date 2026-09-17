import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { TransformInterceptor } from '../src/common/interceptors/transform/transform.interceptor.js';
import { HttpExceptionFilter } from '../src/common/filters/http-exception/http-exception.filter.js';
import {
  QuoteCatalog,
  QuoteOptionDefinition,
  QuoteSolutionDefinition,
} from '../src/quotes/catalog/quote-catalog.js';
import { QuotesModule } from '../src/quotes/quotes.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

const databaseUrl = process.env.DATABASE_URL;
const databaseName = databaseUrl
  ? new URL(databaseUrl).pathname.replace(/^\//, '')
  : '';
const isolatedDatabase = /(^|[_-])test($|[_-])/i.test(databaseName);

const solutions: QuoteSolutionDefinition[] = [
  { code: 'WEB_APP', name: 'Aplicación web de prueba', isActive: true },
  { code: 'ECOMMERCE', name: 'Tienda virtual de prueba', isActive: true },
  { code: 'MOBILE_APP', name: 'Aplicación móvil de prueba', isActive: true },
];
const options: QuoteOptionDefinition[] = [
  {
    code: 'AUTH',
    name: 'Autenticación de prueba',
    solutionTypes: ['WEB_APP', 'MOBILE_APP'],
    isActive: true,
    displayOrder: 1,
  },
  {
    code: 'REPORTS',
    name: 'Reportes de prueba',
    solutionTypes: ['WEB_APP'],
    isActive: true,
    displayOrder: 2,
  },
  {
    code: 'SEO_ADVANCED',
    name: 'SEO avanzado de prueba',
    solutionTypes: ['ECOMMERCE', 'WEB_APP'],
    isActive: true,
    displayOrder: 3,
  },
  {
    code: 'ADVANCED_ANALYTICS',
    name: 'Analítica avanzada de prueba',
    solutionTypes: ['ECOMMERCE', 'WEB_APP'],
    isActive: true,
    displayOrder: 4,
  },
];

const testCatalog: QuoteCatalog = {
  findSolution: (code) => solutions.find((solution) => solution.code === code),
  findOption: (code) => options.find((option) => option.code === code),
};

describe.skipIf(!isolatedDatabase)('Quotes API (e2e, base aislada)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [QuotesModule.register({ catalog: testCatalog })],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({ transform: true, whitelist: true }),
    );
    app.useGlobalInterceptors(new TransformInterceptor());
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.init();
    prisma = app.get(PrismaService);
  });

  it('debe crear una cotización pública persistente en PENDING_RULES para opciones sin regla', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/public/quotes')
      .send({
        solutionType: 'WEB_APP',
        options: [{ code: 'AUTH' }, { code: 'REPORTS' }],
        contact: {
          fullName: 'Ana   E2E',
          email: 'ANA.E2E@EXAMPLE.COM',
          phone: '+51 987 654 321',
          company: 'Empresa E2E',
        },
        notes: 'Solicitud de prueba',
      })
      .expect(201);

    expect(response.body.success).toBe(true);
    expect(response.body.data.code).toMatch(/^Q-[A-HJ-NP-Z2-9]{8}$/);
    expect(response.body.data.pricingStatus).toBe('PENDING_RULES');
    expect(response.body.data.amountMinor).toBeNull();
    expect(response.body.data.currency).toBeNull();
    expect(response.body.data.pricingVersion).toBeNull();
    expect(response.body.data).not.toHaveProperty('contactEmail');
    expect(response.body.data).not.toHaveProperty('id');

    const quote = await prisma.quote.findUnique({
      where: { publicCode: response.body.data.code },
      include: { options: true, items: true },
    });
    expect(quote?.contactEmail).toBe('ana.e2e@example.com');
    expect(quote?.options).toHaveLength(2);
    expect(quote?.items).toHaveLength(0);
  });

  it('debe admitir categorías reconocidas sin regla (MOBILE_APP) persistiendo en PENDING_RULES', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/public/quotes')
      .send({
        solutionType: 'MOBILE_APP',
        options: [{ code: 'AUTH' }],
        contact: {
          fullName: 'Carlos Movil',
          email: 'carlos.movil@example.com',
          phone: '987654321',
        },
      })
      .expect(201);

    expect(response.body.success).toBe(true);
    expect(response.body.data.pricingStatus).toBe('PENDING_RULES');
    expect(response.body.data.amountMinor).toBeNull();

    const quote = await prisma.quote.findUnique({
      where: { publicCode: response.body.data.code },
      include: { items: true },
    });
    expect(quote?.items).toHaveLength(0);
  });

  it('debe calcular y persistir cotización con regla aprobada SP-01-v2 (ECOMMERCE + NORMAL => S/ 4,000.00)', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/public/quotes')
      .send({
        solutionType: 'ECOMMERCE',
        options: [{ code: 'SEO_ADVANCED' }, { code: 'ADVANCED_ANALYTICS' }],
        deliveryMode: 'NORMAL',
        contact: {
          fullName: 'Beatriz Ecommerce',
          email: 'beatriz.e2e@example.com',
          phone: '987654321',
        },
      })
      .expect(201);

    expect(response.body.success).toBe(true);
    expect(response.body.data.pricingStatus).toBe('CALCULATED');
    expect(response.body.data.amountMinor).toBe(400000);
    expect(response.body.data.currency).toBe('PEN');
    expect(response.body.data.pricingVersion).toBe('SP-01-v2');

    const quote = await prisma.quote.findUnique({
      where: { publicCode: response.body.data.code },
      include: { options: true, items: { orderBy: { displayOrder: 'asc' } } },
    });
    expect(quote?.pricingStatus).toBe('CALCULATED');
    expect(quote?.amountMinor?.toNumber()).toBe(400000);
    expect(quote?.currency).toBe('PEN');
    expect(quote?.pricingVersion).toBe('SP-01-v2');
    expect(quote?.items).toHaveLength(3);

    expect(quote?.items[0].itemCode).toBe('BASE');
    expect(quote?.items[0].amountMinor.toNumber()).toBe(320000);

    expect(quote?.items[1].itemCode).toBe('EXTRA');
    expect(quote?.items[1].amountMinor.toNumber()).toBe(80000);

    expect(quote?.items[2].itemCode).toBe('DELIVERY_ADJUSTMENT');
    expect(quote?.items[2].amountMinor.toNumber()).toBe(0);
  });

  it('debe calcular y persistir cotización con URGENT (+30%) => S/ 5,200.00', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/public/quotes')
      .send({
        solutionType: 'ECOMMERCE',
        options: [{ code: 'SEO_ADVANCED' }, { code: 'ADVANCED_ANALYTICS' }],
        deliveryMode: 'URGENT',
        contact: {
          fullName: 'David Urgente',
          email: 'david.e2e@example.com',
          phone: '987654321',
        },
      })
      .expect(201);

    expect(response.body.success).toBe(true);
    expect(response.body.data.pricingStatus).toBe('CALCULATED');
    expect(response.body.data.amountMinor).toBe(520000);

    const quote = await prisma.quote.findUnique({
      where: { publicCode: response.body.data.code },
      include: { items: { orderBy: { displayOrder: 'asc' } } },
    });
    expect(quote?.items[2].itemCode).toBe('DELIVERY_ADJUSTMENT');
    expect(quote?.items[2].amountMinor.toNumber()).toBe(120000);
  });

  it('debe rechazar campos desconocidos con 400 antes de persistir', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/public/quotes')
      .send({
        solutionType: 'WEB_APP',
        options: [{ code: 'AUTH' }],
        contact: {
          fullName: 'Ana E2E',
          email: 'ana@example.com',
          phone: '987654321',
        },
        status: 'CALCULATED',
      })
      .expect(400);

    expect(response.body.success).toBe(false);
  });

  it('debe rechazar catálogos desconocidos con 422', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/public/quotes')
      .send({
        solutionType: 'UNKNOWN_SOLUTION',
        options: [{ code: 'AUTH' }],
        contact: {
          fullName: 'Ana E2E',
          email: 'ana@example.com',
          phone: '987654321',
        },
      })
      .expect(422);

    expect(response.body.success).toBe(false);
  });

  afterAll(async () => {
    if (prisma) {
      await prisma.quote.deleteMany({
        where: { contactEmail: { endsWith: '@example.com' } },
      });
    }
    await app?.close();
  });
});

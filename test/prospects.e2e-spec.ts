import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module.js';
import { HttpExceptionFilter } from '../src/common/filters/http-exception/http-exception.filter.js';
import { TransformInterceptor } from '../src/common/interceptors/transform/transform.interceptor.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

describe('Prospects API (e2e, base aislada)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const password = 'PasswordSegura123!';
  const clientEmail = `prospect-client-${suffix}@example.test`;
  const adminEmail = `prospect-admin-${suffix}@example.test`;
  const quoteCode = 'Q-BCDEFGHJ';
  const foreignQuoteCode = 'Q-CDEFGHJK';

  let clientToken: string;
  let adminToken: string;

  beforeAll(async () => {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) throw new Error('Falta DATABASE_URL para E2E.');

    const databaseName = new URL(databaseUrl).pathname.replace(/^\//, '');
    if (!/(^|[_-])test($|[_-])/i.test(databaseName)) {
      throw new Error(
        `E2E cancelado: la base "${databaseName}" no parece aislada.`,
      );
    }

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    );
    app.useGlobalInterceptors(new TransformInterceptor());
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.init();

    prisma = app.get(PrismaService);
    const passwordHash = await bcrypt.hash(password, 4);
    const [clientRole, adminRole] = await Promise.all([
      prisma.role.findUniqueOrThrow({ where: { name: 'CLIENT' } }),
      prisma.role.findUniqueOrThrow({ where: { name: 'ADMIN' } }),
    ]);

    await prisma.user.create({
      data: {
        name: 'Cliente Prospect E2E',
        email: clientEmail,
        passwordHash,
        roleId: clientRole.id,
        clientProfile: { create: {} },
      },
    });
    await prisma.user.create({
      data: {
        name: 'Asesor Prospect E2E',
        email: adminEmail,
        passwordHash,
        roleId: adminRole.id,
        adminProfile: {
          create: {
            executiveTitle: 'Asesor comercial',
            isPublicAdvisor: true,
          },
        },
      },
    });

    await prisma.quote.createMany({
      data: [
        {
          publicCode: quoteCode,
          solutionType: 'WEB_CORPORATIVA',
          contactName: 'Cliente Prospect E2E',
          contactEmail: clientEmail,
          contactPhone: '+51999999999',
        },
        {
          publicCode: foreignQuoteCode,
          solutionType: 'WEB_CORPORATIVA',
          contactName: 'Otra persona',
          contactEmail: `foreign-${suffix}@example.test`,
          contactPhone: '+51888888888',
        },
      ],
    });

    clientToken = await login(clientEmail);
    adminToken = await login(adminEmail);
  });

  afterAll(async () => {
    if (prisma) {
      await prisma.quote.deleteMany({
        where: { publicCode: { in: [quoteCode, foreignQuoteCode] } },
      });
      await prisma.prospect.deleteMany({ where: { email: clientEmail } });
      await prisma.user.deleteMany({
        where: { email: { in: [clientEmail, adminEmail] } },
      });
    }
    await app?.close();
  });

  async function login(email: string) {
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password })
      .expect(200);
    return response.body.data.accessToken as string;
  }

  it('vincula una cotización propia y permite repetir la operación', async () => {
    const first = await request(app.getHttpServer())
      .post('/api/v1/prospects/link-quote')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({ publicCode: quoteCode.toLowerCase() })
      .expect(201);

    expect(first.body.data).toMatchObject({
      email: clientEmail,
      source: 'QUOTE',
    });
    expect(first.body.data.quotes).toEqual([
      expect.objectContaining({ publicCode: quoteCode }),
    ]);

    const repeated = await request(app.getHttpServer())
      .post('/api/v1/prospects/link-quote')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({ publicCode: quoteCode })
      .expect(201);

    expect(repeated.body.data.id).toBe(first.body.data.id);
  });

  it('rechaza una cotización perteneciente a otro correo', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/prospects/link-quote')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({ publicCode: foreignQuoteCode })
      .expect(403);
  });

  it('permite al cliente consultar su prospecto', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/prospects/me')
      .set('Authorization', `Bearer ${clientToken}`)
      .expect(200);

    expect(response.body.data.email).toBe(clientEmail);
  });

  it('limita el listado administrativo y publica solo asesores activos', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/prospects')
      .set('Authorization', `Bearer ${clientToken}`)
      .expect(403);

    const prospects = await request(app.getHttpServer())
      .get('/api/v1/prospects')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(prospects.body.data.items).toEqual(
      expect.arrayContaining([expect.objectContaining({ email: clientEmail })]),
    );

    const advisors = await request(app.getHttpServer())
      .get('/api/v1/public/advisors')
      .expect(200);
    expect(advisors.body.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'Asesor Prospect E2E' }),
      ]),
    );
    expect(advisors.body.data[0]).not.toHaveProperty('email');
  });
});

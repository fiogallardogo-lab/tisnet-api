import { generateQuoteCode } from '../src/quotes/domain/quote-code.generator';
/** Integrated API regression: real JWT, MySQL and concurrent requests. */
import { createAppTestModule } from './helpers/create-app-test-module';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { beforeAll, afterAll, describe, it, expect, vi } from 'vitest';
import { PrismaService } from '../src/prisma/prisma.service';
import { TransformInterceptor } from '../src/common/interceptors/transform/transform.interceptor';
import { HttpExceptionFilter } from '../src/common/filters/http-exception/http-exception.filter';

const databaseName = new URL(
  process.env.DATABASE_URL || 'mysql://localhost/unknown',
).pathname.slice(1);
describe.skipIf(!/(^|[_-])test($|[_-])/i.test(databaseName))(
  'S14 integrated payment concurrency and missing-project contracts',
  () => {
    let categoryId: number;
    let app: INestApplication,
      db: PrismaService,
      token: string,
      scheduleId: number,
      quoteId: number;
    const suffix = randomUUID(),
      chargeId = 'chr-s14-' + suffix;
    const webhookAuth = Buffer.from('webhook:s14-test').toString('base64');
    const req = () => request(app.getHttpServer());
    const admin = () => ({ Authorization: 'Bearer ' + token });
    beforeAll(async () => {
      vi.stubEnv('CULQI_WEBHOOK_BASIC_AUTH', webhookAuth);
      const module = await createAppTestModule().compile();
      app = module.createNestApplication();
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
      db = app.get(PrismaService);
      const ar = await db.role.upsert({
        where: { name: 'ADMIN' },
        update: {},
        create: { name: 'ADMIN' },
      });
      const cr = await db.role.upsert({
        where: { name: 'CLIENT' },
        update: {},
        create: { name: 'CLIENT' },
      });
      const a = await db.user.create({
        data: {
          name: 'S14 concurrency admin',
          email: 'admin-' + suffix + '@example.test',
          passwordHash: 'unused',
          roleId: ar.id,
        },
      });
      const c = await db.user.create({
        data: {
          name: 'S14 concurrency client',
          email: 'client-' + suffix + '@example.test',
          passwordHash: 'unused',
          roleId: cr.id,
        },
      });
      token = new JwtService().sign(
        { sub: a.id, tokenVersion: a.tokenVersion },
        { secret: process.env.JWT_SECRET!, expiresIn: 300 },
      );
      categoryId = (
        await db.category.create({
          data: { name: 'S14 concurrency ' + suffix, isActive: true },
        })
      ).id;
      const prospect = await db.prospect.create({
        data: { userId: c.id, name: c.name, email: c.email, source: 'MANUAL' },
      });
      const quote = await db.quote.create({
        data: {
          publicCode: generateQuoteCode(),
          solutionType: 'LANDING_PAGE',
          contactName: c.name,
          contactEmail: c.email,
          contactPhone: '999888777',
          prospectId: prospect.id,
          activeVersion: 1,
        },
      });
      quoteId = quote.id;
      const version = await db.quoteVersion.create({
        data: {
          quoteId,
          version: 1,
          clientUserId: c.id,
          authorId: a.id,
          amountMinor: 1000,
          currency: 'PEN',
          scope: { description: 'S14 concurrency fixture' },
          acceptedAt: new Date(),
          acceptedByUserId: c.id,
          schedules: {
            create: {
              sequence: 1,
              amountMinor: 1000,
              percentageBasisPoints: 10000,
              dueDate: new Date('2027-01-01'),
              milestone: 'Adelanto',
            },
          },
        },
        include: { schedules: true },
      });
      scheduleId = version.schedules[0].id;
    }, 30000);
    afterAll(async () => {
      if (db && categoryId)
        await db.category.update({
          where: { id: categoryId },
          data: { isActive: false },
        });
      await app?.close();
      vi.unstubAllEnvs();
    });
    it('persists one payment and enables one project for two identical requests', async () => {
      const body = {
        scheduleId,
        externalEventId: chargeId,
        amountMinor: 1000,
        currency: 'PEN',
        status: 'CONFIRMED',
      };
      const results = await Promise.all([
        req().post('/api/v1/admin/payments/events').set(admin()).send(body),
        req().post('/api/v1/admin/payments/events').set(admin()).send(body),
      ]);
      expect(results.some((r) => r.status === 201)).toBe(true);
      expect(results.every((r) => r.status === 201 || r.status === 409)).toBe(
        true,
      );
      const retry = await req()
        .post('/api/v1/admin/payments/events')
        .set(admin())
        .send(body)
        .expect(201);
      expect(retry.body.data.id).toBe(
        results.find((r) => r.status === 201)!.body.data.id,
      );
      expect(await db.payment.count({ where: { scheduleId } })).toBe(1);
      await expect
        .poll(() => db.project.count({ where: { quoteId } }), {
          timeout: 10000,
          interval: 100,
        })
        .toBe(1);
      const project = await db.project.findUniqueOrThrow({
        where: { quoteId },
      });
      expect(
        await db.auditEvent.count({
          where: { action: 'PROJECT_ENABLED', entityId: String(project.id) },
        }),
      ).toBe(1);
    }, 15000);
    it('authenticates duplicate webhook requests without duplicating payment or project', async () => {
      const payload = {
        id: 'evt-' + suffix,
        type: 'charge.creation.succeeded',
        object: 'event',
        data: JSON.stringify({
          id: chargeId,
          amount: 1000,
          currency_code: 'PEN',
          email: 'client-' + suffix + '@example.test',
          metadata: { scheduleId: String(scheduleId) },
        }),
      };
      await req()
        .post('/api/v1/payments/culqi/webhook')
        .send(payload)
        .expect(401);
      const responses = await Promise.all([
        req()
          .post('/api/v1/payments/culqi/webhook')
          .set('Authorization', 'Basic ' + webhookAuth)
          .send(payload),
        req()
          .post('/api/v1/payments/culqi/webhook')
          .set('Authorization', 'Basic ' + webhookAuth)
          .send(payload),
      ]);
      expect(responses.map((r) => r.status)).toEqual([200, 200]);
      // Controller acknowledges asynchronously; wait for both audit records before checking final state.
      await expect
        .poll(
          () =>
            db.auditEvent.count({
              where: { action: 'PAYMENT_SUCCEEDED', entityId: chargeId },
            }),
          { timeout: 5000, interval: 100 },
        )
        .toBe(2);
      expect(await db.payment.count({ where: { scheduleId } })).toBe(1);
      expect(await db.project.count({ where: { quoteId } })).toBe(1);
    });
    it('returns 404 for concurrent kickoff requests on a missing project', async () => {
      const dto = {
        scheduledAt: new Date(Date.now() + 86400000).toISOString(),
      };
      const responses = await Promise.all([
        req()
          .post('/api/v1/projects/2147483647/kickoff')
          .set(admin())
          .send(dto),
        req()
          .post('/api/v1/projects/2147483647/kickoff')
          .set(admin())
          .send(dto),
      ]);
      expect(responses.map((r) => r.status)).toEqual([404, 404]);
    });
    it('returns 404 for concurrent PO assignments on a missing project', async () => {
      const responses = await Promise.all([
        req()
          .put('/api/v1/projects/2147483647/product-owner')
          .set(admin())
          .send({ userId: 2147483647 }),
        req()
          .put('/api/v1/projects/2147483647/product-owner')
          .set(admin())
          .send({ userId: 2147483647 }),
      ]);
      expect(responses.map((r) => r.status)).toEqual([404, 404]);
    });
  },
);

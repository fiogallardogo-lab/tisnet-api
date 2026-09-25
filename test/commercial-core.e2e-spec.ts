import {
  INestApplication,
  ValidationPipe,
  UnauthorizedException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { JwtAuthGuard } from '../src/auth/guards/jwt-auth.guard';
import { TransformInterceptor } from '../src/common/interceptors/transform/transform.interceptor';
import { HttpExceptionFilter } from '../src/common/filters/http-exception/http-exception.filter';
import { MeetingPersistenceService } from '../src/prospects/meeting-persistence.service';
import { PaymentsService } from '../src/payments/payments.service';
const dbName = new URL(
  process.env.DATABASE_URL || 'mysql://localhost/unknown',
).pathname.slice(1);
describe.skipIf(!/(^|[_-])test($|[_-])/i.test(dbName))(
  'Sprints 7-10 and 12 integrated commercial flow',
  () => {
    let app: INestApplication,
      db: PrismaService,
      client: number,
      admin: number,
      advisor: number,
      quoteId: number,
      code: string;
    let po: number, developer: number, categoryId: number;
    const email = `commercial-${randomUUID()}@example.test`;
    const req = () => request(app.getHttpServer());
    const adminHeaders = () => ({
      'x-user': String(admin),
      'x-role': 'ADMIN',
      'x-email': `admin-${email}`,
    });
    const official = () => ({
      clientUserId: client,
      amountMinor: 10001,
      currency: 'PEN',
      scope: 'Sitio web acordado',
      observations: 'Contrato de prueba',
      installments: [
        {
          percentageBasisPoints: 5000,
          dueDate: '2026-12-01',
          milestone: 'Diseño aprobado',
        },
        {
          percentageBasisPoints: 5000,
          dueDate: '2026-12-20',
          milestone: 'Entrega final',
        },
      ],
    });
    beforeAll(async () => {
      const module = await Test.createTestingModule({ imports: [AppModule] })
        .overrideGuard(JwtAuthGuard)
        .useValue({
          canActivate(ctx) {
            const r = ctx.switchToHttp().getRequest();
            if (!r.headers['x-user']) throw new UnauthorizedException();
            r.user = {
              id: Number(r.headers['x-user']),
              role: r.headers['x-role'],
              email: r.headers['x-email'],
            };
            return true;
          },
        })
        .compile();
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
      const cr = await db.role.findUniqueOrThrow({ where: { name: 'CLIENT' } }),
        ar = await db.role.findUniqueOrThrow({ where: { name: 'ADMIN' } });
      client = (
        await db.user.create({
          data: {
            email,
            name: 'Cliente de prueba',
            passwordHash: 'test-only-not-a-password-hash',
            roleId: cr.id,
          },
        })
      ).id;
      admin = (
        await db.user.create({
          data: {
            email: `admin-${email}`,
            name: 'Asesor de prueba',
            passwordHash: 'test-only-not-a-password-hash',
            roleId: ar.id,
            adminProfile: { create: { isPublicAdvisor: true } },
          },
        })
      ).id;
      advisor = (
        await db.adminProfile.findUniqueOrThrow({ where: { userId: admin } })
      ).id;
    });
    afterAll(async () => {
      if (db) {
        const ids = (
          await db.quote.findMany({
            where: { contactEmail: email },
            select: { id: true },
          })
        ).map((q) => q.id);
        const projectIds = (
          await db.project.findMany({
            where: { quoteId: { in: ids } },
            select: { id: true },
          })
        ).map((p) => p.id);
        await db.projectDeliverable.deleteMany({
          where: { projectId: { in: projectIds } },
        });
        await db.projectMilestone.deleteMany({
          where: { projectId: { in: projectIds } },
        });
        await db.kickoff.deleteMany({
          where: { projectId: { in: projectIds } },
        });
        await db.project.deleteMany({ where: { id: { in: projectIds } } });
        await db.meetingEvent.deleteMany({
          where: { meeting: { quoteId: { in: ids } } },
        });
        await db.meeting.deleteMany({ where: { quoteId: { in: ids } } });
        await db.payment.deleteMany({
          where: { schedule: { quoteVersion: { quoteId: { in: ids } } } },
        });
        await db.paymentSchedule.deleteMany({
          where: { quoteVersion: { quoteId: { in: ids } } },
        });
        await db.quoteVersion.deleteMany({ where: { quoteId: { in: ids } } });
        await db.quote.deleteMany({ where: { id: { in: ids } } });
        await db.prospect.deleteMany({ where: { email } });
        await db.user.deleteMany({
          where: { id: { in: [client, admin, po, developer].filter(Boolean) } },
        });
      }
      if (categoryId) await db.category.delete({ where: { id: categoryId } });
      await app?.close();
    });
    it('creates one canonical portal quote, links Prospect, exposes safe lookup and persisted PDF', async () => {
      const payload = {
        solutionType: 'LANDING_PAGE',
        deliveryMode: 'NORMAL',
        options: [],
        contact: { fullName: 'Cliente de prueba', email, phone: '987654321' },
      };
      const res = await req()
        .post('/api/v1/public/project-quotes')
        .send(payload)
        .expect(201);
      code = res.body.data.code;
      expect(code).toMatch(/^Q-[A-Z2-9]{8}$/);
      expect(res.body.data.amountMinor).toBe(85000);
      const quote = await db.quote.findUniqueOrThrow({
        where: { publicCode: code },
        include: { prospect: true, items: true },
      });
      quoteId = quote.id;
      expect(quote.prospect?.email).toBe(email);
      expect(quote.items.length).toBeGreaterThan(0);
      expect(
        await db.publicQuote.count({
          where: { contact: { path: '$.email', equals: email } },
        }),
      ).toBe(0);
      const lookup = await req()
        .get(`/api/v1/public/quotes/${code}`)
        .expect(200);
      expect(lookup.body.data.code).toBe(code);
      expect(lookup.body.data).not.toHaveProperty('contactEmail');
      await req().get(`/api/v1/quotes/${code}/pdf`).expect(401);
      const pdf = await req()
        .get(`/api/v1/quotes/${code}/pdf`)
        .set(adminHeaders())
        .expect(200);
      expect(pdf.headers['content-type']).toContain('application/pdf');
      await req()
        .get(`/api/v1/quotes/${code}/pdf`)
        .set({
          'x-user': String(client),
          'x-role': 'CLIENT',
          'x-email': 'other@example.test',
        })
        .expect(403);
      await req()
        .post('/api/v1/public/quotes')
        .send({ ...payload, solutionType: 'UNKNOWN' })
        .expect(422);
    });
    it('persists scoped meetings, prevents overlapping bookings and applies idempotent domain events', async () => {
      const start = new Date(Date.now() + 86400000 * 10),
        end = new Date(start.getTime() + 3600000);
      const body = {
        advisorId: advisor,
        quoteId: code,
        email,
        name: 'Cliente de prueba',
        start: start.toISOString(),
        end: end.toISOString(),
      };
      const created = await req()
        .post('/api/v1/public/meetings')
        .send(body)
        .expect(201);
      const id = created.body.data.id;
      expect(created.body.data.status).toBe('PENDING');
      await req().post('/api/v1/public/meetings').send(body).expect(409);
      const stored = await db.meeting.findUniqueOrThrow({ where: { id } });
      expect(stored.quoteId).toBe(quoteId);
      expect(stored.prospectId).toBeTruthy();
      const own = await req()
        .get('/api/v1/meetings/my')
        .set(adminHeaders())
        .expect(200);
      expect(own.body.data.items.some((m) => m.id === id)).toBe(true);
      await req()
        .get('/api/v1/admin/meetings')
        .set({ 'x-user': String(client), 'x-role': 'CLIENT', 'x-email': email })
        .expect(403);
      await req()
        .get(
          `/api/v1/public/advisors/${advisor}/availability?from=${encodeURIComponent(start.toISOString())}&to=${encodeURIComponent(end.toISOString())}`,
        )
        .expect(200);
      const svc = app.get(MeetingPersistenceService),
        event = {
          externalEventId: randomUUID(),
          meetingId: id,
          status: 'SCHEDULED' as const,
          occurredAt: new Date(),
        };
      const first = await svc.recordExternalEvent(event);
      expect((await svc.recordExternalEvent(event)).id).toBe(first.id);
      await expect(
        svc.recordExternalEvent({ ...event, status: 'CANCELLED' }),
      ).rejects.toThrow();
    });
    it('versions official agreements, validates exact schedules and records payment idempotently', async () => {
      await req()
        .post(`/api/v1/admin/quotes/${quoteId}/versions`)
        .set({ 'x-user': String(client), 'x-role': 'CLIENT', 'x-email': email })
        .send(official())
        .expect(403);
      await req()
        .post(`/api/v1/admin/quotes/${quoteId}/versions`)
        .set(adminHeaders())
        .send({
          ...official(),
          installments: [
            { ...official().installments[0], percentageBasisPoints: 9900 },
          ],
        })
        .expect(400);
      const first = await req()
        .post(`/api/v1/admin/quotes/${quoteId}/versions`)
        .set(adminHeaders())
        .send(official())
        .expect(201);
      expect(first.body.data.version).toBe(1);
      const second = await req()
        .post(`/api/v1/admin/quotes/${quoteId}/versions`)
        .set(adminHeaders())
        .send({ ...official(), observations: 'Segunda versión' })
        .expect(201);
      expect(second.body.data.version).toBe(2);
      expect(await db.quoteVersion.count({ where: { quoteId } })).toBe(2);
      const payments = app.get(PaymentsService);
      await expect(payments.assertInitialPayment(quoteId)).rejects.toThrow(
        'pago inicial',
      );
      const part = second.body.data.schedules[0];
      const event = {
        scheduleId: part.id,
        externalEventId: randomUUID(),
        amountMinor: Number(part.amountMinor),
        currency: 'PEN',
        status: 'CONFIRMED',
      };
      const paid = await req()
        .post('/api/v1/admin/payments/events')
        .set(adminHeaders())
        .send(event)
        .expect(201);
      const duplicate = await req()
        .post('/api/v1/admin/payments/events')
        .set(adminHeaders())
        .send(event)
        .expect(201);
      expect(duplicate.body.data.id).toBe(paid.body.data.id);
      await req()
        .post('/api/v1/admin/payments/events')
        .set(adminHeaders())
        .send({ ...event, externalEventId: randomUUID() })
        .expect(409);
      await expect(
        payments.assertInitialPayment(quoteId),
      ).resolves.toMatchObject({ version: 2 });
      await req()
        .post(`/api/v1/admin/quotes/${quoteId}/versions`)
        .set(adminHeaders())
        .send(official())
        .expect(409);
    });

    it('creates kickoff only from paid official agreement and enforces team scope and traceability', async () => {
      const por = await db.role.findUniqueOrThrow({
          where: { name: 'PRODUCT_OWNER' },
        }),
        dr = await db.role.findUniqueOrThrow({ where: { name: 'DEVELOPER' } });
      po = (
        await db.user.create({
          data: {
            name: 'PO',
            email: 'po-' + email,
            passwordHash: 'test-only',
            roleId: por.id,
          },
        })
      ).id;
      developer = (
        await db.user.create({
          data: {
            name: 'Developer',
            email: 'dev-' + email,
            passwordHash: 'test-only',
            roleId: dr.id,
          },
        })
      ).id;
      categoryId = (
        await db.category.create({
          data: { name: 'commercial-' + randomUUID() },
        })
      ).id;
      const members = [
        { userId: po, role: 'PRODUCT_OWNER', participationBasisPoints: 2000 },
        {
          userId: developer,
          role: 'DEVELOPER',
          participationBasisPoints: 8000,
        },
      ];
      const kickoff = {
        quoteId,
        name: 'Proyecto acordado',
        slug: 'commercial-' + randomUUID(),
        categoryId,
        heldAt: new Date().toISOString(),
        members,
      };
      const pending = await req()
        .post('/api/v1/public/quotes')
        .send({
          solutionType: 'LANDING_PAGE',
          options: [],
          contact: { fullName: 'Cliente', email, phone: '987654321' },
        })
        .expect(201);
      const pendingQuote = await db.quote.findUniqueOrThrow({
        where: { publicCode: pending.body.data.code },
      });
      await req()
        .post('/api/v1/admin/quotes/' + pendingQuote.id + '/versions')
        .set(adminHeaders())
        .send(official())
        .expect(201);
      await req()
        .post('/api/v1/kickoff')
        .set(adminHeaders())
        .send({ ...kickoff, quoteId: pendingQuote.id })
        .expect(409);
      const created = await req()
        .post('/api/v1/kickoff')
        .set(adminHeaders())
        .send(kickoff)
        .expect(201);
      const project = created.body.data;
      expect(project.clientUserId).toBe(client);
      expect(project.productOwnerId).toBe(po);
      expect(project.prospectId).toBeTruthy();
      expect(project.milestones).toHaveLength(2);
      expect(
        project.milestones.every(
          (m) =>
            m.paymentScheduleId &&
            m.deliverables.length === 1 &&
            m.deliverables[0].milestoneId === m.id,
        ),
      ).toBe(true);
      expect(
        project.members.reduce((sum, m) => sum + m.participationBasisPoints, 0),
      ).toBe(10000);
      await req()
        .post('/api/v1/kickoff')
        .set(adminHeaders())
        .send(kickoff)
        .expect(409);
      const devHeaders = {
        'x-user': String(developer),
        'x-role': 'DEVELOPER',
        'x-email': 'dev-' + email,
      };
      await req()
        .patch('/api/v1/projects/' + project.id)
        .set(devHeaders)
        .send({ description: 'Alcance técnico documentado' })
        .expect(200);
      await req()
        .patch('/api/v1/projects/' + project.id)
        .set({
          'x-user': String(client),
          'x-role': 'DEVELOPER',
          'x-email': email,
        })
        .send({ description: 'Intento de modificación sin membresía activa' })
        .expect(403);
      await req()
        .patch('/api/v1/projects/' + project.id + '/members')
        .set(adminHeaders())
        .send({ members: [members[0]] })
        .expect(400);
      await req()
        .get('/api/v1/projects/' + project.id + '/operations')
        .set(devHeaders)
        .expect(200);
      const report = await req()
        .get('/api/v1/admin/audit?entityType=PROJECT')
        .set({ ...adminHeaders(), 'x-role': 'SUPER_ADMIN' })
        .expect(200);
      expect(
        report.body.data.items.some(
          (e) =>
            e.action === 'PROJECT_KICKOFF' && e.entityId === String(project.id),
        ),
      ).toBe(true);
      expect(JSON.stringify(report.body.data)).not.toContain('test-only');
      await req().get('/api/v1/admin/audit').set(devHeaders).expect(403);
      const csv = await req()
        .get('/api/v1/admin/audit/export?limit=1')
        .set({ ...adminHeaders(), 'x-role': 'SUPER_ADMIN' })
        .expect(200);
      expect(csv.headers['content-type']).toContain('text/csv');
      expect(csv.headers['x-next-cursor']).toBeTruthy();
      await req()
        .get('/api/v1/admin/audit/report')
        .set({ ...adminHeaders(), 'x-role': 'SUPER_ADMIN' })
        .expect(200);
    });
  },
);

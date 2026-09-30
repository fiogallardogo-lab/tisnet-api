import { createAppTestModule } from './helpers/create-app-test-module';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import { PrismaService } from '../src/prisma/prisma.service';
import { LocalSmtp } from './helpers/local-smtp';
import { NOTIFICATION_PROVIDER } from '../src/notifications/notification-provider.interface';
import { TransformInterceptor } from '../src/common/interceptors/transform/transform.interceptor';
import { HttpExceptionFilter } from '../src/common/filters/http-exception/http-exception.filter';

const dbName = new URL(
  process.env.DATABASE_URL || 'mysql://localhost/unknown',
).pathname.slice(1);
describe.skipIf(!/(^|[_-])test($|[_-])/i.test(dbName))(
  'Sprint 14 A: real HTTP + JWT + MySQL',
  () => {
    let app: INestApplication, db: PrismaService, mail: LocalSmtp;
    let adminToken: string,
      otherToken: string,
      clientToken: string,
      activationToken: string;
    let clientId: number,
      quoteId: number,
      code: string,
      version1: number,
      version2: number,
      advisorId: number;
    const suffix = randomUUID();
    const email = 's14-' + suffix + '@example.test';
    const api = '/api/v1';
    const req = () => request(app.getHttpServer());
    const jwt = new JwtService();
    const access = (id: number, role: string, tokenVersion = 0) =>
      jwt.sign(
        { sub: id, role, tokenVersion },
        { secret: process.env.JWT_SECRET!, expiresIn: 300 },
      );
    const official = () => ({
      clientUserId: clientId,
      amountMinor: 10001,
      currency: 'PEN',
      scope: 'Alcance comercial v1',
      installments: [
        {
          percentageBasisPoints: 5000,
          dueDate: '2027-01-01',
          milestone: 'Adelanto',
        },
        {
          percentageBasisPoints: 5000,
          dueDate: '2027-02-01',
          milestone: 'Entrega final',
        },
      ],
    });
    beforeAll(async () => {
      mail = await new LocalSmtp().start();
      const module = await createAppTestModule()
        .overrideProvider(NOTIFICATION_PROVIDER)
        .useValue(mail)
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

      mail.clear();
      const roles: Record<string, number> = {};
      for (const name of [
        'CLIENT',
        'ADMIN',
        'SUPER_ADMIN',
        'PRODUCT_OWNER',
        'DEVELOPER',
      ])
        roles[name] = (
          await db.role.upsert({
            where: { name },
            create: { name },
            update: {},
          })
        ).id;
      const admin = await db.user.create({
        data: {
          name: 'S14 Admin',
          email: 'admin-' + email,
          passwordHash: 'not-a-password',
          roleId: roles.ADMIN,
        },
      });
      const other = await db.user.create({
        data: {
          name: 'S14 Other',
          email: 'other-' + email,
          passwordHash: 'not-a-password',
          roleId: roles.CLIENT,
        },
      });
      adminToken = access(admin.id, 'ADMIN');
      otherToken = access(other.id, 'CLIENT');
      advisorId = (
        await db.adminProfile.create({
          data: { userId: admin.id, isPublicAdvisor: true },
        })
      ).id;
    }, 30000);
    afterAll(async () => {
      if (app) await app.close();
      if (mail) await mail.close();
    });
    it('documents payloads in Swagger and protects admin routes (401/403)', async () => {
      const doc = SwaggerModule.createDocument(
        app,
        new DocumentBuilder().addBearerAuth().build(),
      );
      expect(doc.paths[api + '/auth/activate']?.post).toBeDefined();
      expect(
        doc.components?.schemas?.OfficialQuoteDto?.['properties']?.installments,
      ).toBeDefined();
      await req()
        .post(api + '/auth/client-invitations')
        .send({ name: 'Client', email })
        .expect(401);
      await req()
        .post(api + '/auth/client-invitations')
        .auth(otherToken, { type: 'bearer' })
        .send({ name: 'Client', email })
        .expect(403);
    });
    it('persists a contact and returns a verifiable receipt (201/400)', async () => {
      const res = await req()
        .post(api + '/public/contact')
        .send({
          name: 'Cliente',
          email,
          subject: 'Consulta Sprint 14',
          message: 'Necesito una cotización comercial.',
        })
        .expect(201);
      expect(res.body.data.status).toBe('RECEIVED');
      expect(
        await db.contactInquiry.findUnique({
          where: { code: res.body.data.code },
        }),
      ).toMatchObject({ email, subject: 'Consulta Sprint 14' });
      await req()
        .post(api + '/public/contact')
        .send({ name: 'X', email: 'bad', message: 'short' })
        .expect(400);
    });
    it('invites inactive client without returning token (201/409)', async () => {
      const res = await req()
        .post(api + '/auth/client-invitations')
        .auth(adminToken, { type: 'bearer' })
        .send({ name: 'Cliente S14', email })
        .expect(201);
      clientId = res.body.data.id;
      expect(res.body.data).toMatchObject({
        isActive: false,
        delivery: 'SENT',
      });
      expect(res.body.data.token).toBeUndefined();
      const message = mail.getLastNotification()!;
      expect(message.recipient).toBe(email);
      activationToken = new URL(
        message.text!.match(/https?:\/\/\S+/)![0],
      ).searchParams.get('token')!;
      expect(activationToken).toBeTruthy();
      await req()
        .post(api + '/auth/client-invitations')
        .auth(adminToken, { type: 'bearer' })
        .send({ name: 'Cliente S14', email })
        .expect(409);
      await req()
        .get(api + '/auth/me')
        .auth(access(clientId, 'CLIENT'), { type: 'bearer' })
        .expect(401);
    });
    it('rejects invalid/expired/legal tokens and activates exactly once concurrently (400/200/409)', async () => {
      const body = {
        token: activationToken,
        password: 'Sprint14-Strong!',
        acceptedTerms: true,
        termsVersion: process.env.TERMS_VERSION,
        privacyVersion: process.env.PRIVACY_VERSION,
      };
      await req()
        .post(api + '/auth/activate')
        .send({ ...body, acceptedTerms: false })
        .expect(400);
      await req()
        .post(api + '/auth/activate')
        .send({ ...body, termsVersion: 'obsolete' })
        .expect(400);
      const expired = jwt.sign(
        { sub: clientId, tokenVersion: 0, purpose: 'activate' },
        {
          secret: process.env.JWT_SECRET!,
          audience: 'tisnet-activation',
          issuer: 'tisnet-api',
          expiresIn: -1,
        },
      );
      await req()
        .post(api + '/auth/activate')
        .send({ ...body, token: expired })
        .expect(400);
      const results = await Promise.all([
        req()
          .post(api + '/auth/activate')
          .send(body),
        req()
          .post(api + '/auth/activate')
          .send(body),
      ]);
      expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
      expect(
        await db.auditEvent.count({
          where: { action: 'ACCOUNT_ACTIVATED', entityId: String(clientId) },
        }),
      ).toBe(1);
      await req()
        .get(api + '/auth/me')
        .auth(activationToken, { type: 'bearer' })
        .expect(401);
      const login = await req()
        .post(api + '/auth/login')
        .send({ email, password: body.password })
        .expect(200);
      clientToken = login.body.data.accessToken;
      expect(clientToken).toBeTruthy();
      const user = await db.user.findUniqueOrThrow({ where: { id: clientId } });
      expect(user.acceptedTermsAt).not.toBeNull();
      expect(user.tokenVersion).toBe(1);
    }, 15000);
    it('returns same recovery response for absent and pending accounts (200)', async () => {
      const a = await req()
        .post(api + '/auth/request-activation')
        .send({ email })
        .expect(200);
      const b = await req()
        .post(api + '/auth/request-activation')
        .send({ email: 'missing-' + email })
        .expect(200);
      expect(a.body).toEqual(b.body);
    });
    it('creates quote and sends real PDF bytes to persisted contact with CTAs (201)', async () => {
      const res = await req()
        .post(api + '/public/quotes')
        .send({
          solutionType: 'LANDING_PAGE',
          options: [],
          contact: { fullName: 'Cliente S14', email, phone: '+51 999888777' },
        })
        .expect(201);
      code = res.body.data.code;
      const q = await db.quote.findUniqueOrThrow({
        where: { publicCode: code },
      });
      quoteId = q.id;
      const message = mail.getLastNotification()!;
      expect(message.recipient).toBe(email);
      expect(message.attachments?.[0].content.subarray(0, 4).toString()).toBe(
        '%PDF',
      );
      expect(message.text).toContain('/register');
      expect(message.html).toContain('Agendar asesoría');
    });
    it('rejects malformed, missing and foreign codes, links only once (400/404/403/201/409)', async () => {
      const link = (token: string, publicCode: string) =>
        req()
          .post(api + '/prospects/link-quote')
          .auth(token, { type: 'bearer' })
          .send({ publicCode });
      await link(clientToken, 'invalid').expect(400);
      await link(clientToken, 'Q-ZZZZZZZZ').expect(404);
      await link(otherToken, code).expect(403);
      const results = await Promise.all([
        link(clientToken, code),
        link(clientToken, code),
      ]);
      expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
      expect(
        await db.auditEvent.count({
          where: { action: 'QUOTE_LINKED', entityId: String(quoteId) },
        }),
      ).toBe(1);
    });
    it('edits draft with optimistic concurrency and rejects unknown fields (200/400/409/404)', async () => {
      const q = await db.quote.findUniqueOrThrow({ where: { id: quoteId } });
      const patch = (id: number, data: object) =>
        req()
          .patch(api + '/admin/quotes/' + id)
          .auth(adminToken, { type: 'bearer' })
          .send(data);
      await patch(quoteId, {
        expectedUpdatedAt: q.updatedAt.toISOString(),
        fullName: 'Cliente corregido',
      }).expect(200);
      await patch(quoteId, {
        expectedUpdatedAt: '2000-01-01T00:00:00Z',
        notes: 'Obsoleto',
      }).expect(409);
      await patch(quoteId, {
        expectedUpdatedAt: q.updatedAt.toISOString(),
        contactEmail: 'stolen@example.test',
      }).expect(400);
      await patch(2147483647, {
        expectedUpdatedAt: q.updatedAt.toISOString(),
        notes: 'No existe',
      }).expect(404);
    });
    it('validates exact quotas and officializes immutable history (400/201/409)', async () => {
      const post = (body: object) =>
        req()
          .post(api + '/admin/quotes/' + quoteId + '/versions')
          .auth(adminToken, { type: 'bearer' })
          .send(body);
      await post({
        ...official(),
        installments: [
          {
            percentageBasisPoints: 9999,
            dueDate: '2027-01-01',
            milestone: 'Adelanto',
          },
        ],
      }).expect(400);
      await post({
        ...official(),
        installments: [
          {
            percentageBasisPoints: 10000,
            dueDate: '2027-02-30',
            milestone: 'Adelanto',
          },
        ],
      }).expect(400);
      const first = await post(official()).expect(201);
      version1 = first.body.data.id;
      expect(
        first.body.data.schedules.reduce(
          (sum: number, x: any) => sum + Number(x.amountMinor),
          0,
        ),
      ).toBe(10001);
      const second = await post({
        ...official(),
        scope: 'Alcance comercial v2',
        amountMinor: 12001,
      }).expect(201);
      version2 = second.body.data.id;
      expect(
        await db.quoteVersion.findUniqueOrThrow({ where: { id: version1 } }),
      ).toMatchObject({
        version: 1,
        scope: { description: 'Alcance comercial v1' },
      });
      expect(mail.getLastNotification()?.attachments?.[0].filename).toContain(
        '-v2.pdf',
      );
      await req()
        .patch(api + '/admin/quotes/' + quoteId)
        .auth(adminToken, { type: 'bearer' })
        .send({
          expectedUpdatedAt: new Date().toISOString(),
          notes: 'Alteración',
        })
        .expect(409);
    });
    it('persists and audits client observations; prevents unauthorized/version changes (201/200/403/404/409)', async () => {
      const path = api + '/client/quotes/' + quoteId + '/observations';
      await req()
        .post(path)
        .auth(otherToken, { type: 'bearer' })
        .send({ versionId: version2, text: 'Ajena' })
        .expect(403);
      await req()
        .post(path)
        .auth(clientToken, { type: 'bearer' })
        .send({ versionId: 2147483647, text: 'No existe' })
        .expect(404);
      await req()
        .post(path)
        .auth(clientToken, { type: 'bearer' })
        .send({ versionId: version1, text: 'Anterior' })
        .expect(409);
      await req()
        .post(path)
        .auth(clientToken, { type: 'bearer' })
        .send({ versionId: version2, text: 'Confirmar entregables' })
        .expect(201);
      const res = await req()
        .get(api + '/admin/quotes/' + quoteId + '/observations')
        .auth(adminToken, { type: 'bearer' })
        .expect(200);
      expect(res.body.data.items).toHaveLength(1);
      expect(res.body.data.items[0]).toMatchObject({
        text: 'Confirmar entregables',
        authorId: clientId,
        versionId: version2,
      });
      expect(
        await db.auditEvent.count({
          where: {
            action: 'QUOTE_OBSERVATION_CREATED',
            entityId: String(quoteId),
          },
        }),
      ).toBe(1);
    });
    it('accepts persistent version ID exactly once with concurrent retry (200/201/400/409)', async () => {
      const base = api + '/client/quotes/' + quoteId;
      const agreement = await req()
        .get(base + '/agreement')
        .auth(clientToken, { type: 'bearer' })
        .expect(200);
      expect(agreement.body.data.versions.map((x: any) => x.id)).toEqual([
        version2,
        version1,
      ]);
      const accept = (versionId: number, accepted = true) =>
        req()
          .post(base + '/accept')
          .auth(clientToken, { type: 'bearer' })
          .send({ versionId, accepted });
      await accept(version2, false).expect(400);
      await accept(version1).expect(409);
      const results = await Promise.all([accept(version2), accept(version2)]);
      expect(results.map((r) => r.status)).toEqual([201, 201]);
      expect(results[0].body.data.acceptedAt).toBe(
        results[1].body.data.acceptedAt,
      );
      expect(
        await db.auditEvent.count({
          where: {
            action: 'CLIENT_ACCEPTED_QUOTE_VERSION',
            entityId: String(quoteId),
          },
        }),
      ).toBe(1);
      await req()
        .post(base + '/observations')
        .auth(clientToken, { type: 'bearer' })
        .send({ versionId: version2, text: 'Demasiado tarde' })
        .expect(409);
    });
    it('persists meeting and sends accurate pending/confirmed email to client and advisor (201/200)', async () => {
      const start = new Date(Date.now() + 10 * 86400000),
        end = new Date(start.getTime() + 3600000);
      const res = await req()
        .post(api + '/public/meetings')
        .send({
          advisorId,
          name: 'Cliente S14',
          email,
          quoteId: code,
          start: start.toISOString(),
          end: end.toISOString(),
        })
        .expect(201);
      expect(res.body.data.status).toBe('PENDING');
      expect(mail.getLastNotification()?.text).toContain(
        'pendiente de confirmación',
      );
      await req()
        .patch(api + '/meetings/' + res.body.data.id + '/status')
        .auth(adminToken, { type: 'bearer' })
        .send({ status: 'SCHEDULED' })
        .expect(200);
      const sent = mail.getSentNotifications().slice(-2);
      expect(sent.map((x) => x.recipient).sort()).toEqual(
        [email, 'admin-' + email].sort(),
      );
      for (const message of sent) {
        expect(message.text).toContain('Reunión confirmada');
        expect(message.text).toContain('/register');
      }
    });
    it('delivers activation, attached quote and meeting into a real local SMTP inbox', () => {
      expect(mail.inbox.length).toBe(mail.getSentNotifications().length);
      expect(
        mail.inbox.some((message) => message.includes('application/pdf')),
      ).toBe(true);
      expect(
        mail
          .getSentNotifications()
          .some((message) => message.text?.includes('Reunión confirmada')),
      ).toBe(true);
      expect(
        mail.inbox.every((message) => message.includes('Message-ID:')),
      ).toBe(true);
    });
    it('records mail failure and supports explicit retry without losing version (201)', async () => {
      mail.simulateFailure(true);
      const path = api + '/admin/quotes/' + quoteId + '/send';
      const failure = await req()
        .post(path)
        .auth(adminToken, { type: 'bearer' })
        .expect(201);
      expect(failure.body.data.delivery).toBe('FAILED');
      expect(await db.quoteVersion.count({ where: { quoteId } })).toBe(2);
      expect(
        await db.auditEvent.count({
          where: {
            action: 'COMMERCIAL_MAIL_FAILED',
            entityType: 'QUOTE',
            entityId: String(quoteId),
          },
        }),
      ).toBeGreaterThan(0);
      mail.simulateFailure(false);
      const retry = await req()
        .post(path)
        .auth(adminToken, { type: 'bearer' })
        .expect(201);
      expect(retry.body.data.delivery).toBe('SENT');
    });
  },
);

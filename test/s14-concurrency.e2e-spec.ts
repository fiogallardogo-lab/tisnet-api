import { createAppTestModule } from './helpers/create-app-test-module';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service';
import { TransformInterceptor } from '../src/common/interceptors/transform/transform.interceptor';

const dbName = new URL(
  process.env.DATABASE_URL || 'mysql://localhost/unknown',
).pathname.slice(1);
describe.skipIf(!/(^|[_-])test($|[_-])/i.test(dbName))(
  'S14 persisted concurrency (isolated MySQL)',
  () => {
    let app: INestApplication, db: PrismaService;
    let admin: number,
      client: number,
      po: number,
      dev: number,
      outsider: number;
    let quoteId: number,
      prospectId: number,
      versionId: number,
      scheduleId: number,
      projectId: number,
      categoryId: number,
      advisorId: number;
    const users: number[] = [];
    const tokens = new Map<number, string>();
    const key = randomUUID().slice(0, 8);
    const auth = (id: number) => ({
      Authorization: 'Bearer ' + tokens.get(id),
    });
    const req = () => request(app.getHttpServer());
    const payment = () => ({
      scheduleId,
      externalEventId: 's14-' + key,
      amountMinor: 10000,
      currency: 'PEN',
      status: 'CONFIRMED',
    });
    const scheduledAt = new Date(Date.now() + 7 * 86400000).toISOString();

    beforeAll(async () => {
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
      await app.init();
      db = app.get(PrismaService);
      const jwt = app.get(JwtService);
      async function user(role: string) {
        const r = await db.role.findUniqueOrThrow({ where: { name: role } });
        const u = await db.user.create({
          data: {
            name: 'S14 ' + role,
            email: role + '-' + randomUUID() + '@example.test',
            passwordHash: 'not-a-login-hash',
            roleId: r.id,
          },
        });
        users.push(u.id);
        tokens.set(
          u.id,
          jwt.sign({
            sub: u.id,
            tokenVersion: u.tokenVersion,
            email: u.email,
            role,
          }),
        );
        return u.id;
      }
      admin = await user('SUPER_ADMIN');
      client = await user('CLIENT');
      po = await user('PRODUCT_OWNER');
      dev = await user('DEVELOPER');
      outsider = await user('PRODUCT_OWNER');
      const advisorUser = await user('ADMIN');
      advisorId = (
        await db.adminProfile.create({
          data: { userId: advisorUser, isPublicAdvisor: true },
        })
      ).id;
      categoryId = (await db.category.create({ data: { name: 'S14-' + key } }))
        .id;
      prospectId = (
        await db.prospect.create({
          data: {
            userId: client,
            name: 'S14 Client',
            email: 'client-' + key + '@example.test',
            source: 'MANUAL',
          },
        })
      ).id;
      quoteId = (
        await db.quote.create({
          data: {
            publicCode: 'Q-' + key,
            status: 'RECEIVED',
            solutionType: 'SOFTWARE',
            contactName: 'S14',
            contactEmail: 'client-' + key + '@example.test',
            contactPhone: '123',
            prospectId,
            pricingStatus: 'CALCULATED',
            amountMinor: 10000,
            currency: 'PEN',
            deliveryMode: 'NORMAL',
            activeVersion: 1,
          },
        })
      ).id;
      versionId = (
        await db.quoteVersion.create({
          data: {
            quoteId,
            version: 1,
            clientUserId: client,
            authorId: admin,
            amountMinor: 10000,
            currency: 'PEN',
            scope: { description: 'S14 isolated fixture' },
          },
        })
      ).id;
      scheduleId = (
        await db.paymentSchedule.create({
          data: {
            quoteVersionId: versionId,
            sequence: 1,
            percentageBasisPoints: 10000,
            amountMinor: 10000,
            dueDate: new Date(),
            milestone: 'Inicio',
          },
        })
      ).id;
    }, 30000);

    afterAll(async () => {
      if (db && quoteId) {
        const projects = await db.project.findMany({
          where: { quoteId },
          select: { id: true },
        });
        const ids = projects.map((p) => p.id);
        await db.kickoff.deleteMany({ where: { projectId: { in: ids } } });
        await db.meeting.deleteMany({ where: { quoteId } });
        await db.projectDeliverable.deleteMany({
          where: { projectId: { in: ids } },
        });
        await db.projectMilestone.deleteMany({
          where: { projectId: { in: ids } },
        });
        await db.projectMember.deleteMany({
          where: { projectId: { in: ids } },
        });
        await db.project.deleteMany({ where: { id: { in: ids } } });
        const payments = await db.payment.findMany({
          where: { scheduleId },
          select: { id: true },
        });
        await db.auditEvent.deleteMany({
          where: {
            OR: [
              { actorId: { in: users } },
              { entityType: 'PROJECT', entityId: { in: ids.map(String) } },
              {
                entityType: 'PAYMENT',
                entityId: { in: payments.map((p) => String(p.id)) },
              },
            ],
          },
        });
        await db.payment.deleteMany({ where: { scheduleId } });
        await db.paymentSchedule.deleteMany({
          where: { quoteVersionId: versionId },
        });
        await db.quoteVersion.deleteMany({ where: { quoteId } });
        await db.quote.delete({ where: { id: quoteId } });
        await db.prospect.delete({ where: { id: prospectId } });
      }
      if (db && advisorId)
        await db.adminProfile.delete({ where: { id: advisorId } });
      if (db && users.length)
        await db.user.deleteMany({ where: { id: { in: users } } });
      if (db && categoryId)
        await db.category.delete({ where: { id: categoryId } });
      await app?.close();
    }, 30000);

    it('rolls back the payment when project enablement fails', async () => {
      await db.user.update({ where: { id: client }, data: { isActive: false } });
      try {
        const response = await req().post('/api/v1/admin/payments/events').set(auth(admin)).send(payment());
        expect(response.status).toBe(409);
        expect(await db.payment.count({ where: { scheduleId } })).toBe(0);
        expect(await db.project.count({ where: { quoteId } })).toBe(0);
      } finally { await db.user.update({ where: { id: client }, data: { isActive: true } }); }
    });
    it('persists one payment, one project, one milestone and one audit per event under replay', async () => {
      const results = await Promise.all(
        [1, 2].map(() =>
          req()
            .post('/api/v1/admin/payments/events')
            .set(auth(admin))
            .send(payment()),
        ),
      );
      expect(results.map((r) => r.status)).toEqual([201, 201]);
      expect(results[0].body.data.id).toBe(results[1].body.data.id);
      expect(await db.payment.count({ where: { scheduleId } })).toBe(1);
      const projects = await db.project.findMany({ where: { quoteId } });
      expect(projects).toHaveLength(1);
      projectId = projects[0].id;
      expect(await db.projectMilestone.count({ where: { projectId } })).toBe(1);
      expect(await db.projectDeliverable.count({ where: { projectId } })).toBe(
        1,
      );
      expect(
        await db.auditEvent.count({
          where: { action: 'PROJECT_ENABLED', entityId: String(projectId) },
        }),
      ).toBe(1);
      expect(
        await db.auditEvent.count({
          where: {
            action: 'PAYMENT_CONFIRMED',
            entityId: String(results[0].body.data.id),
          },
        }),
      ).toBe(1);
      const conflict = await req()
        .post('/api/v1/admin/payments/events')
        .set(auth(admin))
        .send({ ...payment(), amountMinor: 9999 });
      expect(conflict.status).toBe(409);
    });
    it('assigns one PO once and forbids an unrelated PO', async () => {
      const results = await Promise.all(
        [1, 2].map(() =>
          req()
            .put('/api/v1/projects/' + projectId + '/product-owner')
            .set(auth(admin))
            .send({ userId: po }),
        ),
      );
      expect(results.map((r) => r.status)).toEqual([200, 200]);
      expect(
        await db.projectMember.count({
          where: { projectId, memberRole: 'PRODUCT_OWNER', isActive: true },
        }),
      ).toBe(1);
      expect(
        await db.auditEvent.count({
          where: { action: 'PO_ASSIGNED', entityId: String(projectId) },
        }),
      ).toBe(1);
      expect(
        (
          await req()
            .post('/api/v1/projects/' + projectId + '/members')
            .set(auth(outsider))
            .send({ userId: dev, memberRole: 'DEVELOPER' })
        ).status,
      ).toBe(403);
    });
    it('binds concurrent client kickoff requests to one real meeting and advisor', async () => {
      const results = await Promise.all(
        [1, 2].map(() =>
          req()
            .post('/api/v1/client/projects/' + projectId + '/kickoff')
            .set(auth(client))
            .send({ scheduledAt, advisorId, notes: 'Agenda cliente' }),
        ),
      );
      expect(results.map((r) => r.status)).toEqual([201, 201]);
      const kickoff = await db.kickoff.findUniqueOrThrow({
        where: { projectId },
        include: { meeting: true },
      });
      expect(kickoff.meeting?.advisorProfileId).toBe(advisorId);
      expect(kickoff.meeting?.status).toBe('PENDING');
      expect(await db.meeting.count({ where: { quoteId } })).toBe(1);
      expect(
        await db.auditEvent.count({
          where: { action: 'KICKOFF_SCHEDULED', entityId: String(projectId) },
        }),
      ).toBe(1);
    });
    it('allows assigned PO team management without financial disclosure or role escalation', async () => {
      const results = await Promise.all(
        [1, 2].map(() =>
          req()
            .post('/api/v1/projects/' + projectId + '/members')
            .set(auth(po))
            .send({
              userId: dev,
              memberRole: 'DEVELOPER',
              participationBasisPoints: 8000,
              technicalRole: 'Backend',
            }),
        ),
      );
      expect(results.map((r) => r.status)).toEqual([201, 201]);
      expect(
        await db.projectMember.count({ where: { projectId, userId: dev } }),
      ).toBe(1);
      expect(
        (
          await req()
            .post('/api/v1/projects/' + projectId + '/members')
            .set(auth(po))
            .send({ userId: admin, memberRole: 'DEVELOPER' })
        ).status,
      ).toBe(400);
      const operations = await req()
        .get('/api/v1/projects/' + projectId + '/operations')
        .set(auth(po));
      expect(operations.status).toBe(200);
      expect(operations.body.data.canManageTeam).toBe(true);
      expect(operations.body.data.members.find((m) => m.userId === dev).technicalRole).toBe('Backend');
      expect(
        operations.body.data.members.find((m) => m.userId === dev)
          .participation,
      ).toBe(80);
      expect(JSON.stringify(operations.body.data)).not.toMatch(
        /amountMinor|percentageBasisPoints|paymentScheduleId/,
      );
    });
    it('blocks kickoff and team mutations without the initial confirmed payment', async () => {
      await db.payment.updateMany({ where: { scheduleId }, data: { status: 'FAILED' } });
      try {
        const kickoff = await req().post('/api/v1/projects/' + projectId + '/kickoff').set(auth(po)).send({ scheduledAt, notes: 'Resumen' });
        expect(kickoff.status).toBe(409);
        const member = await req().post('/api/v1/projects/' + projectId + '/members').set(auth(po)).send({ userId: dev, memberRole: 'DEVELOPER' });
        expect(member.status).toBe(409);
        const operations = await req().get('/api/v1/projects/' + projectId + '/operations').set(auth(po));
        expect(operations.body.data.kickoff.canStart).toBe(false);
      } finally { await db.payment.updateMany({ where: { scheduleId }, data: { status: 'CONFIRMED' } }); }
    });
  },
);

import { beforeAll, afterAll, describe, it, expect, vi } from 'vitest';
import { INestApplication, ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { randomUUID } from 'node:crypto';
import { writeFileSync, unlinkSync } from 'node:fs';
import { resolve } from 'node:path';
import request from 'supertest';
import { createAppTestModule } from './helpers/create-app-test-module';
import { LocalSmtp } from './helpers/local-smtp';
import { PrismaService } from '../src/prisma/prisma.service';
import { NOTIFICATION_PROVIDER } from '../src/notifications/notification-provider.interface';
import { RemindersService } from '../src/commercial-operations/reminders.service';
import { threeLimaBusinessDays } from '../src/commercial-operations/lima-calendar';
import { TransformInterceptor } from '../src/common/interceptors/transform/transform.interceptor';
import { HttpExceptionFilter } from '../src/common/filters/http-exception/http-exception.filter';
const suffix = randomUUID();
const email = 's15-' + suffix + '@example.test';
const api = '/api/v1';
describe('Sprint15 A MySQL + HTTP + real local SMTP', () => {
  let app: INestApplication,
    db: PrismaService,
    mail: LocalSmtp,
    worker: RemindersService,
    config: ConfigService;
  const users: Record<string, number> = {},
    tokens: Record<string, string> = {};
  let quoteId: number,
    versionId: number,
    scheduleId: number,
    oldScheduleId: number,
    projectId: number,
    deliverableId: number,
    reminderId: number,
    deliveryId: number,
    dueAt: Date;
  const legalFile = resolve('tmp/s15-legal-' + suffix + '.json');
  const logs: any[] = [];
  let logSpy: any;
  const req = () => request(app.getHttpServer());
  const auth = (r: any, role = 'ADMIN') =>
    r.auth(tokens[role], { type: 'bearer' });
  async function startApp() {
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
    config = app.get(ConfigService);
    worker = app.get(RemindersService);
    for (const [key, value] of Object.entries({
      PAYMENT_REMINDER_CUTOFF: '18:00',
      PAYMENT_REMINDER_POLICY_VERSION: 'TEST-ONLY-S15',
      PAYMENT_REMINDER_TRIGGER: 'APPROVED',
      PAYMENT_REMINDERS_ENABLED: 'false',
      PUBLIC_TEAM_MEDIA_HOSTS: 'public.example.test',
      LEGAL_CONTENT_FILE: legalFile,
    }))
      config.set(key, value);
  }
  beforeAll(async () => {
    if (
      !/(^|[_-])test($|[_-])/i.test(
        new URL(process.env.DATABASE_URL!).pathname.slice(1),
      )
    )
      throw Error('Isolated MySQL test database required');
    writeFileSync(
      legalFile,
      JSON.stringify({
        approvalReference: 'TEST FIXTURE ONLY; NOT PRODUCTION APPROVAL',
        approvedAt: '2026-01-01T00:00:00Z',
        terms: {
          version: process.env.TERMS_VERSION,
          text: 'Términos ficticios exclusivos para prueba automatizada.',
        },
        privacy: {
          version: process.env.PRIVACY_VERSION,
          text: 'Privacidad ficticia exclusiva para prueba automatizada.',
        },
      }),
    );
    mail = await new LocalSmtp().start();
    logSpy = vi.spyOn(Logger.prototype, 'log').mockImplementation((...args) => {
      logs.push(args);
    });
    await startApp();
    const jwt = new JwtService();
    for (const name of [
      'ADMIN',
      'SUPER_ADMIN',
      'CLIENT',
      'PRODUCT_OWNER',
      'DEVELOPER',
      'OTHER',
    ]) {
      const role = await db.role.findUniqueOrThrow({
        where: { name: name === 'OTHER' ? 'CLIENT' : name },
      });
      const user = await db.user.create({
        data: {
          name: 'S15 ' + name,
          email: name.toLowerCase() + '-' + email,
          passwordHash: 'private-hash',
          roleId: role.id,
        },
      });
      users[name] = user.id;
      tokens[name] = jwt.sign(
        { sub: user.id, role: role.name, tokenVersion: 0 },
        { secret: process.env.JWT_SECRET!, expiresIn: 3600 },
      );
    }
    const prospect = await db.prospect.create({
      data: { name: 'Client', email: 'client-' + email, userId: users.CLIENT },
    });
    const quote = await db.quote.create({
      data: {
        publicCode: 'S15' + suffix.slice(0, 12),
        solutionType: 'WEB',
        contactName: 'Client',
        contactEmail: 'client-' + email,
        contactPhone: '999999999',
        prospectId: prospect.id,
        activeVersion: 2,
      },
    });
    quoteId = quote.id;
    for (const version of [1, 2]) {
      const v = await db.quoteVersion.create({
        data: {
          quoteId,
          version,
          clientUserId: users.CLIENT,
          authorId: users.ADMIN,
          amountMinor: 10000,
          currency: 'PEN',
          scope: { description: 'Test' },
          acceptedAt: new Date(),
          acceptedByUserId: users.CLIENT,
          schedules: {
            create: {
              sequence: 1,
              percentageBasisPoints: 10000,
              amountMinor: 10000,
              dueDate: new Date('2026-12-01'),
              milestone: 'Entrega',
            },
          },
        },
        include: { schedules: true },
      });
      if (version === 2) {
        versionId = v.id;
        scheduleId = v.schedules[0].id;
      } else oldScheduleId = v.schedules[0].id;
    }
    await db.payment.create({
      data: {
        scheduleId: oldScheduleId,
        externalEventId: suffix + '-old',
        amountMinor: 10000,
        currency: 'PEN',
        status: 'CONFIRMED',
      },
    });
    const category = await db.category.create({
      data: { name: 'S15 ' + suffix },
    });
    const project = await db.project.create({
      data: {
        name: 'S15 Commercial',
        slug: 's15-' + suffix,
        shortDescription: 'Test',
        description: 'Test',
        categoryId: category.id,
        quoteId,
        clientUserId: users.CLIENT,
        productOwnerId: users.PRODUCT_OWNER,
        status: 'IN_DEVELOPMENT',
        members: {
          create: [
            { userId: users.CLIENT, memberRole: 'CLIENT' },
            { userId: users.PRODUCT_OWNER, memberRole: 'PRODUCT_OWNER' },
            { userId: users.DEVELOPER, memberRole: 'DEVELOPER' },
          ],
        },
      },
    });
    projectId = project.id;
    const milestone = await db.projectMilestone.create({
      data: {
        projectId,
        paymentScheduleId: scheduleId,
        title: 'Entrega',
        sequence: 1,
        dueDate: new Date('2026-12-01'),
      },
    });
    deliverableId = (
      await db.projectDeliverable.create({
        data: {
          projectId,
          milestoneId: milestone.id,
          title: 'Entrega',
          description: 'Test evidence',
          dueDate: new Date('2026-12-01'),
          milestoneOrder: 1,
          status: 'DRAFT',
        },
      })
    ).id;
  }, 30000);
  afterAll(async () => {
    if (app) await app.close();
    if (mail) await mail.close();
    logSpy?.mockRestore();
    try {
      unlinkSync(legalFile);
    } catch {}
  });
  it('publishes approved legal text and stores exact consent versions', async () => {
    const legal = await req()
      .get(api + '/public/legal/policy')
      .expect(200);
    expect(legal.body.data.terms.version).toBe(process.env.TERMS_VERSION);
    expect(legal.body.data.contentHash).toHaveLength(64);
    const registration = {
      name: 'Consent test',
      email: 'legal-' + email,
      password: 'PasswordSeguro123!',
      acceptedTerms: true,
      termsVersion: process.env.TERMS_VERSION,
      privacyVersion: process.env.PRIVACY_VERSION,
    };
    await req()
      .post(api + '/auth/register')
      .send({ ...registration, termsVersion: 'old' })
      .expect(400);
    await req()
      .post(api + '/auth/register')
      .send(registration)
      .expect(201);
    const user = await db.user.findUniqueOrThrow({
      where: { email: registration.email },
    });
    expect(user.termsVersion).toBe(registration.termsVersion);
    expect(user.acceptedTermsAt).not.toBeNull();
    config.set('LEGAL_CONTENT_FILE', 'missing-approved-content.json');
    await req()
      .get(api + '/public/legal/policy')
      .expect(503);
    config.set('LEGAL_CONTENT_FILE', legalFile);
  });
  it('publishes only curated approved team fields and permits withdrawal', async () => {
    const path = api + '/admin/public-team/' + users.DEVELOPER;
    const body = {
      displayName: 'Developer público',
      biography: 'Biografía aprobada de prueba',
      specialty: 'Backend',
      photoUrl: 'https://public.example.test/photo.png',
      approved: true,
      consentRecorded: true,
    };
    await req().put(path).send(body).expect(401);
    await auth(req().put(path), 'CLIENT').send(body).expect(403);
    await auth(req().put(path))
      .send({ ...body, consentRecorded: false })
      .expect(400);
    await auth(req().put(path))
      .send({ ...body, photoUrl: body.photoUrl + '?token=secret' })
      .expect(400);
    const published = await auth(req().put(path)).send(body).expect(200);
    let result = await req()
      .get(api + '/public/team?limit=100')
      .expect(200);
    const row = result.body.data.items.find(
      (x: any) => x.id === published.body.data.id,
    );
    expect(Object.keys(row).sort()).toEqual(
      [
        'advisorId',
        'biography',
        'cta',
        'displayName',
        'id',
        'photoUrl',
        'role',
        'specialty',
      ].sort(),
    );
    expect(JSON.stringify(result.body)).not.toContain(email);
    await db.user.update({
      where: { id: users.DEVELOPER },
      data: { isActive: false },
    });
    result = await req().get(api + '/public/team?limit=100');
    expect(result.body.data.items.some((x: any) => x.id === row.id)).toBe(
      false,
    );
    await db.user.update({
      where: { id: users.DEVELOPER },
      data: { isActive: true },
    });
    await auth(req().put(path))
      .send({ ...body, approved: false })
      .expect(200);
    result = await req().get(api + '/public/team?limit=100');
    expect(result.body.data.items.some((x: any) => x.id === row.id)).toBe(
      false,
    );
  });
  it('blocks finance to PO/Developer/another client and rejects replaced-version charges', async () => {
    const path = api + '/quotes/' + quoteId + '/financial-status';
    await req().get(path).expect(401);
    for (const role of ['PRODUCT_OWNER', 'DEVELOPER', 'OTHER'])
      await auth(req().get(path), role).expect(403);
    const state = await auth(req().get(path), 'CLIENT').expect(200);
    expect(state.body.data).toMatchObject({
      versionId,
      paidMinor: 0,
      outstandingMinor: 10000,
      complete: false,
    });
    await auth(
      req().post(api + '/client/payments/' + oldScheduleId + '/checkout'),
      'CLIENT',
    ).expect(409);
    await auth(
      req().post(api + '/client/payments/' + oldScheduleId + '/charge'),
      'CLIENT',
    )
      .send({ tokenId: 'tkn_test_S15' })
      .expect(409);
  });
  it('submits evidence, approves atomically and persists a single 3-business-day reminder', async () => {
    const path = api + '/projects/' + projectId + '/milestones/1';
    await auth(req().post(path + '/evidence'), 'DEVELOPER')
      .send({
        pdfUrl: 'https://storage.tisnet.pe/test.pdf',
        videoUrl: 'https://www.loom.com/share/test',
      })
      .expect(201);
    expect(await db.paymentReminder.count({ where: { scheduleId } })).toBe(0);
    config.set('PAYMENT_REMINDER_CUTOFF', '');
    await auth(req().post(path + '/review'), 'CLIENT')
      .send({ status: 'APPROVED' })
      .expect(503);
    expect(
      (
        await db.projectDeliverable.findUniqueOrThrow({
          where: { id: deliverableId },
        })
      ).status,
    ).toBe('IN_REVIEW');
    config.set('PAYMENT_REMINDER_CUTOFF', '18:00');
    await auth(req().post(path + '/review'), 'CLIENT')
      .send({ status: 'APPROVED' })
      .expect(201);
    const reminder = await db.paymentReminder.findUniqueOrThrow({
      where: { scheduleId },
      include: { deliveries: true },
    });
    reminderId = reminder.id;
    dueAt = reminder.dueAt;
    deliveryId = reminder.deliveries.find((x) => x.userId === users.CLIENT)!.id;
    expect(dueAt).toEqual(threeLimaBusinessDays(reminder.occurredAt, '18:00'));
    expect(reminder.deliveries.some((x) => x.audience === 'ADMIN')).toBe(true);
    expect(reminder.deliveries.some((x) => x.audience === 'CLIENT')).toBe(true);
    await db.$transaction((tx) =>
      worker.schedule(tx, deliverableId, 'APPROVED', users.CLIENT),
    );
    expect(await db.paymentReminder.count({ where: { scheduleId } })).toBe(1);
    // Other suites' administrators remain scheduled, but outside this controlled inbox dispatch window.
    await db.paymentReminderDelivery.updateMany({
      where: { reminderId, userId: { notIn: Object.values(users) } },
      data: { nextAttemptAt: new Date('2090-01-01') },
    });
    const list = await auth(
      req().get(api + '/quotes/' + quoteId + '/payment-reminders'),
      'CLIENT',
    ).expect(200);
    expect(list.body.data[0].deliveries).toHaveLength(1);
    expect(JSON.stringify(list.body)).not.toMatch(/email|claimToken|messageId/);
    await db.$disconnect();
    await db.$connect();
    expect(await db.paymentReminder.count({ where: { id: reminderId } })).toBe(
      1,
    );
  });
  it('survives API restart and concurrent workers without duplicate SMTP delivery', async () => {
    await app.close();
    await startApp();
    const before = mail.inbox.length;
    await Promise.all([worker.dispatch(dueAt), worker.dispatch(dueAt)]);
    const sent = await db.paymentReminderDelivery.findMany({
      where: { reminderId, userId: { in: Object.values(users) } },
    });
    expect(sent).toHaveLength(3);
    expect(sent.every((x) => x.status === 'SENT')).toBe(true);
    expect(mail.inbox.length - before).toBe(3);
    const ids = sent.map((x) => x.messageId);
    expect(new Set(ids).size).toBe(3);
    await worker.dispatch(dueAt);
    expect(mail.inbox.length - before).toBe(3);
    expect(
      mail
        .getSentNotifications()
        .some(
          (x) =>
            x.recipient === 'client-' + email &&
            x.text?.includes('America/Lima'),
        ),
    ).toBe(true);
  }, 15000);
  it('bounds SMTP failures and recovers through the authorized retry endpoint', async () => {
    await db.paymentReminderDelivery.update({
      where: { id: deliveryId },
      data: { status: 'PENDING', attempts: 4, nextAttemptAt: new Date() },
    });
    mail.simulateFailure(true);
    await worker.dispatch();
    mail.simulateFailure(false);
    let job = await db.paymentReminderDelivery.findUniqueOrThrow({
      where: { id: deliveryId },
    });
    expect(job.status).toBe('FAILED');
    expect(job.lastErrorCode).toBe('DELIVERY_FAILED');
    const path = api + '/admin/payment-reminders/' + deliveryId + '/retry';
    await auth(req().post(path), 'CLIENT').expect(403);
    await auth(req().post(path)).expect(201);
    await worker.dispatch();
    job = await db.paymentReminderDelivery.findUniqueOrThrow({
      where: { id: deliveryId },
    });
    expect(job.status).toBe('SENT');
    expect(job.attempts).toBe(1);
    await auth(req().post(path)).expect(409);
  });
  it('reclaims an expired worker lease and cancels a superseded debt', async () => {
    await db.paymentReminderDelivery.update({
      where: { id: deliveryId },
      data: {
        status: 'SENDING',
        claimToken: 'crashed-process',
        leaseUntil: new Date(0),
        nextAttemptAt: new Date(0),
      },
    });
    await db.quote.update({
      where: { id: quoteId },
      data: { activeVersion: 1 },
    });
    const count = mail.inbox.length;
    await worker.dispatch();
    expect(
      (
        await db.paymentReminderDelivery.findUniqueOrThrow({
          where: { id: deliveryId },
        })
      ).status,
    ).toBe('CANCELLED');
    expect(mail.inbox).toHaveLength(count);
    await db.quote.update({
      where: { id: quoteId },
      data: { activeVersion: 2 },
    });
  });
  it('requires current complete payments for closing, cancels paid reminders and omits team email/finance', async () => {
    const path = api + '/projects/' + projectId + '/close';
    await auth(req().post(path), 'PRODUCT_OWNER').expect(409);
    await auth(req().post(path), 'DEVELOPER').expect(403);
    await db.payment.create({
      data: {
        scheduleId,
        externalEventId: suffix + '-current',
        amountMinor: 10000,
        currency: 'PEN',
        status: 'CONFIRMED',
      },
    });
    await db.paymentReminderDelivery.update({
      where: { id: deliveryId },
      data: { status: 'PENDING', nextAttemptAt: new Date(0) },
    });
    const count = mail.inbox.length;
    await worker.dispatch();
    expect(mail.inbox.length).toBe(count);
    expect(
      (
        await db.paymentReminderDelivery.findUniqueOrThrow({
          where: { id: deliveryId },
        })
      ).status,
    ).toBe('CANCELLED');
    const closed = await auth(req().post(path), 'PRODUCT_OWNER').expect(201);
    expect(closed.body.data.status).toBe('COMPLETED');
    expect(Object.keys(closed.body.data).sort()).toEqual([
      'id',
      'name',
      'status',
    ]);
    const finance = await auth(
      req().get(api + '/quotes/' + quoteId + '/financial-status'),
      'CLIENT',
    ).expect(200);
    expect(finance.body.data.paidMinor).toBe(10000);
    expect(finance.body.data.complete).toBe(true);
    for (const role of ['DEVELOPER', 'PRODUCT_OWNER']) {
      const report = await auth(
        req().get(
          api + '/reports/projects/' + projectId + '/report?format=json',
        ),
        role,
      ).expect(200);
      expect(JSON.stringify(report.body)).not.toMatch(
        /amountMinor|contactEmail|passwordHash|"email"|"dni"|"ruc"/,
      );
    }
  });
  it('receives the application email through real SMTP and keeps CV/photo/DNI private', async () => {
    const fields = {
      requestedRole: 'DEVELOPER',
      fullName: 'Applicant test',
      age: '25',
      district: 'Lima',
      email: 'applicant-' + email,
      phone: '999999999',
      dni: String(Math.floor(10000000 + Math.random() * 89999999)),
      career: 'Ingeniería',
      university: 'Universidad',
      experienceYears: '2',
      programmingLanguages: 'TypeScript',
      specialty: 'BACKEND',
      consent: 'true',
    };
    let submission = req().post(api + '/public/team-applications');
    for (const [key, value] of Object.entries(fields))
      submission = submission.field(key, value);
    const count = mail.inbox.length;
    const response = await submission
      .attach('cv', Buffer.from('%PDF-1.4\nTEST CV\n%%EOF'), {
        filename: 'private-cv.pdf',
        contentType: 'application/pdf',
      })
      .attach('photo', Buffer.from([255, 216, 255, 0, 255, 217]), {
        filename: 'private-photo.jpg',
        contentType: 'image/jpeg',
      })
      .expect(201);
    expect(response.body.data.notificationStatus).toBe('SENT');
    expect(mail.inbox.length).toBe(count + 1);
    expect(JSON.stringify(response.body)).not.toContain(fields.dni);
    expect(JSON.stringify(response.body)).not.toContain(fields.email);
    const application = await db.teamApplication.findUniqueOrThrow({
      where: { email: fields.email },
    });
    await req()
      .get(api + '/team-applications/' + application.id + '/cv')
      .expect(401);
    await auth(
      req().get(api + '/team-applications/' + application.id + '/cv'),
      'DEVELOPER',
    ).expect(403);
    expect(JSON.stringify(logs)).not.toContain(fields.email);
    expect(JSON.stringify(logs)).not.toContain(fields.dni);
    expect(JSON.stringify(logs)).not.toContain('private-hash');
  });
});

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { randomUUID, createHmac } from 'node:crypto';
import request from 'supertest';
import { createAppTestModule } from './helpers/create-app-test-module';
import { PrismaService } from '../src/prisma/prisma.service';
import { TransformInterceptor } from '../src/common/interceptors/transform/transform.interceptor';
import { HttpExceptionFilter } from '../src/common/filters/http-exception/http-exception.filter';
import { NOTIFICATION_PROVIDER } from '../src/notifications/notification-provider.interface';
const roles = ['CLIENT', 'DEVELOPER', 'PRODUCT_OWNER', 'ADMIN', 'SUPER_ADMIN'];
const routes = ['client', 'developer', 'po', 'admin', 'superadmin'];
const suffix = randomUUID();
describe('Unified sprint HTTP + real MySQL + real RBAC', () => {
  let app: INestApplication,
    db: PrismaService,
    project: number,
    otherProject: number,
    task: number,
    resource: number,
    cv: string,
    file: string;
  const users: Record<string, number> = {},
    tokens: Record<string, string> = {};
  const req = () => request(app.getHttpServer());
  const auth = (r: any, role = 'DEVELOPER') =>
    r.auth(tokens[role], { type: 'bearer' });
  beforeAll(async () => {
    if (!new URL(process.env.DATABASE_URL!).pathname.includes('_test'))
      throw Error('Test database required');
    process.env.CALENDLY_WEBHOOK_SECRET = 'local-test-only-signed-webhook';
    const mod = await createAppTestModule()
      .overrideProvider(NOTIFICATION_PROVIDER)
      .useValue({ send: async () => ({}) })
      .compile();
    app = mod.createNestApplication({ rawBody: true });
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
    for (const role of [...roles, 'OUTSIDER']) {
      const r = await db.role.upsert({
        where: { name: role === 'OUTSIDER' ? 'DEVELOPER' : role },
        create: { name: role === 'OUTSIDER' ? 'DEVELOPER' : role },
        update: {},
      });
      const u = await db.user.create({
        data: {
          name: role,
          email: role + '-' + suffix + '@example.test',
          passwordHash: 'disabled-password',
          roleId: r.id,
        },
      });
      users[role] = u.id;
      tokens[role] = app
        .get(JwtService)
        .sign({ sub: u.id, email: u.email, role: r.name, tokenVersion: 0 });
    }
    const category = await db.category.create({
      data: { name: 'Unified ' + suffix },
    });
    const data = {
      name: 'Unified test',
      slug: 'unified-' + suffix,
      shortDescription: 'Test',
      description: 'Test',
      categoryId: category.id,
      status: 'IN_DEVELOPMENT' as const,
    };
    project = (
      await db.project.create({
        data: {
          ...data,
          clientUserId: users.CLIENT,
          productOwnerId: users.PRODUCT_OWNER,
          members: {
            create: ['CLIENT', 'DEVELOPER', 'PRODUCT_OWNER'].map((role) => ({
              userId: users[role],
              memberRole: role as any,
            })),
          },
        },
      })
    ).id;
    otherProject = (
      await db.project.create({ data: { ...data, slug: 'other-' + suffix } })
    ).id;
  }, 60000);
  afterAll(async () => {
    await app?.close();
  });
  for (let i = 0; i < roles.length; i++)
    for (let j = 0; j < roles.length; j++)
      it(roles[i] + ' -> dashboard ' + routes[j], async () => {
        const r = await auth(
          req().get('/api/v1/dashboard/' + routes[j]),
          roles[i],
        );
        expect(r.status).toBe(i === j ? 200 : 403);
        if (i === j) {
          expect(r.body.data.user.role).toBe(roles[i]);
          expect(r.body.data.previewLimit).toBe(50);
        }
      });
  it('anonymous blocked, outsider cannot see work', async () => {
    await req().get('/api/v1/dashboard/admin').expect(401);
    await auth(
      req().get(`/api/v1/projects/${project}/tasks`),
      'OUTSIDER',
    ).expect(403);
  });
  it('PO creates task, Developer cannot create or reassign', async () => {
    const body = {
      title: 'Implementar API',
      description: 'Trabajo',
      assigneeId: users.DEVELOPER,
      dueDate: '2026-12-01',
    };
    await auth(req().post(`/api/v1/projects/${project}/tasks`))
      .send(body)
      .expect(403);
    const r = await auth(
      req().post(`/api/v1/projects/${project}/tasks`),
      'PRODUCT_OWNER',
    )
      .send(body)
      .expect(201);
    task = r.body.data.id;
    await auth(req().patch(`/api/v1/projects/${project}/tasks/${task}`))
      .send({ assigneeId: users.CLIENT })
      .expect(403);
    await auth(req().post(`/api/v1/projects/${project}/tasks`), 'PRODUCT_OWNER')
      .send({ ...body, assigneeId: users.OUTSIDER })
      .expect(400);
  });
  it('task transitions, scoping, filtering and page validation', async () => {
    await auth(req().patch(`/api/v1/projects/${project}/tasks/${task}`))
      .send({ status: 'DONE' })
      .expect(409);
    await auth(req().patch(`/api/v1/projects/${project}/tasks/${task}`))
      .send({ status: 'IN_PROGRESS' })
      .expect(200);
    await auth(
      req().patch(`/api/v1/projects/${otherProject}/tasks/${task}`),
      'ADMIN',
    )
      .send({ status: 'DONE' })
      .expect(404);
    const r = await auth(
      req().get(`/api/v1/projects/${project}/tasks?status=IN_PROGRESS&limit=1`),
    ).expect(200);
    expect(r.body.data.items[0].id).toBe(task);
    expect(r.body.data.totalItems).toBe(1);
    await auth(req().get(`/api/v1/projects/${project}/tasks?limit=101`)).expect(
      400,
    );
  });
  it('resources: author writes, client reads, outsider denied', async () => {
    const r = await auth(req().post(`/api/v1/projects/${project}/resources`))
      .send({ name: 'Repository', url: 'https://example.test/repo' })
      .expect(201);
    resource = r.body.data.id;
    await auth(
      req().patch(`/api/v1/projects/${project}/resources/${resource}`),
      'CLIENT',
    )
      .send({ name: 'Changed' })
      .expect(403);
    await auth(
      req().get(`/api/v1/projects/${project}/resources`),
      'CLIENT',
    ).expect(200);
    await auth(req().patch(`/api/v1/projects/${project}/resources/${resource}`))
      .send({ url: 'javascript:alert(1)' })
      .expect(400);
    await auth(
      req().delete(`/api/v1/projects/${project}/resources/${resource}`),
    ).expect(200);
  });
  it('hours: own work, daily cap, task protection, client excluded', async () => {
    const body = {
      taskId: task,
      date: '2026-09-30',
      minutes: 1000,
      summary: 'Implementación verificada',
    };
    await auth(req().post(`/api/v1/projects/${project}/work-logs`))
      .send(body)
      .expect(201);
    await auth(req().post(`/api/v1/projects/${project}/work-logs`))
      .send(body)
      .expect(409);
    await auth(
      req().get(`/api/v1/projects/${project}/work-logs`),
      'CLIENT',
    ).expect(403);
    const r = await auth(
      req().get(
        `/api/v1/projects/${project}/work-logs?userId=${users.OUTSIDER}`,
      ),
    ).expect(200);
    expect(
      r.body.data.items.every((l: any) => l.userId === users.DEVELOPER),
    ).toBe(true);
    await auth(
      req().delete(`/api/v1/projects/${project}/tasks/${task}`),
      'PRODUCT_OWNER',
    ).expect(409);
  });
  it('CV upload/download protected and invalid signature rejected', async () => {
    await auth(req().post('/api/v1/users/me/cv'))
      .attach('file', Buffer.from('fake'), {
        filename: 'bad.pdf',
        contentType: 'application/pdf',
      })
      .expect(400);
    const r = await auth(req().post('/api/v1/users/me/cv'))
      .attach('file', Buffer.from('%PDF-1.4\n%%EOF'), {
        filename: 'cv.pdf',
        contentType: 'application/pdf',
      })
      .expect(201);
    cv = r.body.data.id;
    await auth(req().get('/api/v1/users/me/cv/' + cv))
      .expect(200)
      .expect('Content-Type', /application\/pdf/);
    await auth(req().get('/api/v1/users/me/cv/' + cv), 'OUTSIDER').expect(404);
    await auth(req().post('/api/v1/users/me/cv'), 'CLIENT')
      .attach('file', Buffer.from('%PDF-1.4'), {
        filename: 'cv.pdf',
        contentType: 'application/pdf',
      })
      .expect(403);
  });
  it('project private files require membership at download time', async () => {
    const r = await auth(req().post(`/api/v1/projects/${project}/files`))
      .attach('file', Buffer.from('%PDF-1.4\n%%EOF'), {
        filename: 'deliverable.pdf',
        contentType: 'application/pdf',
      })
      .expect(201);
    file = r.body.data.id;
    await auth(
      req().get(`/api/v1/projects/${project}/files/${file}/download`),
      'CLIENT',
    )
      .expect(200)
      .expect('Content-Disposition', /attachment/);
    await auth(
      req().get(`/api/v1/projects/${project}/files/${file}/download`),
      'OUTSIDER',
    ).expect(403);
  });
  it('signed Calendly persists and duplicate is idempotent', async () => {
    const payload = {
      event: 'invitee.created',
      created_at: new Date().toISOString(),
      payload: {
        uri: `https://api.calendly.com/scheduled_events/${suffix}/invitees/a`,
        name: 'Cliente',
        email: `CLIENT-${suffix}@example.test`,
        scheduled_event: {
          uri: `https://api.calendly.com/scheduled_events/${suffix}`,
          start_time: '2026-12-01T15:00:00Z',
          end_time: '2026-12-01T16:00:00Z',
        },
      },
    };
    const raw = JSON.stringify(payload),
      t = String(Math.floor(Date.now() / 1000)),
      sig = createHmac('sha256', process.env.CALENDLY_WEBHOOK_SECRET!)
        .update(t + '.' + raw)
        .digest('hex');
    await req()
      .post('/api/v1/integrations/calendly/webhook')
      .send(payload)
      .expect(401);
    for (let n = 0; n < 2; n++)
      await req()
        .post('/api/v1/integrations/calendly/webhook')
        .set('Calendly-Webhook-Signature', `t=${t},v1=${sig}`)
        .set('Content-Type', 'application/json')
        .send(raw)
        .expect(200);
    const m = await db.meeting.findUnique({
      where: { externalEventUri: payload.payload.uri },
    });
    expect(m?.status).toBe('SCHEDULED');
    expect(await db.meetingEvent.count({ where: { meetingId: m!.id } })).toBe(
      1,
    );
  });
  it('critical mutations audited and public catalogs readable', async () => {
    expect(
      await db.auditEvent.count({
        where: { actorId: users.PRODUCT_OWNER, action: 'TASK_CREATED' },
      }),
    ).toBe(1);
    await req().get('/api/v1/public/categories').expect(200);
    await req().get('/api/v1/public/technologies').expect(200);
    await req().get('/api/v1/health').expect(200);
  });
  it('parallel hour submissions cannot exceed the daily cap', async () => {
    const body = {
      date: '2026-09-29',
      minutes: 1000,
      summary: 'Concurrent work',
    };
    const results = await Promise.all([
      auth(req().post('/api/v1/projects/' + project + '/work-logs')).send(body),
      auth(req().post('/api/v1/projects/' + project + '/work-logs')).send(body),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
  });
  it('dashboard data excludes unrelated projects and client cannot see staff hours', async () => {
    const r = await auth(req().get('/api/v1/dashboard/developer')).expect(200);
    expect(r.body.data.projects.some((p: any) => p.id === project)).toBe(true);
    expect(r.body.data.projects.some((p: any) => p.id === otherProject)).toBe(
      false,
    );
    expect(r.body.data.tasks.some((t: any) => t.id === task)).toBe(true);
    expect(r.body.data.revenue).toEqual([]);
    await auth(req().get('/api/v1/workspace/meetings')).expect(200);
    await auth(req().get('/api/v1/workspace/meetings'), 'CLIENT').expect(403);
  });
  it('webhook reschedule creates the replacement and cancels the old invitee', async () => {
    const oldUri =
      'https://api.calendly.com/scheduled_events/' + suffix + '/invitees/a';
    const newUri =
      'https://api.calendly.com/scheduled_events/' + suffix + '/invitees/b';
    const send = async (payload: any) => {
      const raw = JSON.stringify(payload),
        t = String(Math.floor(Date.now() / 1000)),
        sig = createHmac('sha256', process.env.CALENDLY_WEBHOOK_SECRET!)
          .update(t + '.' + raw)
          .digest('hex');
      return req()
        .post('/api/v1/integrations/calendly/webhook')
        .set('Calendly-Webhook-Signature', 't=' + t + ',v1=' + sig)
        .set('Content-Type', 'application/json')
        .send(raw);
    };
    const base = {
      name: 'Cliente',
      email: 'CLIENT-' + suffix + '@example.test',
      scheduled_event: {
        uri: 'https://api.calendly.com/scheduled_events/' + suffix,
        start_time: '2026-12-02T15:00:00Z',
        end_time: '2026-12-02T16:00:00Z',
      },
    };
    expect(
      (
        await send({
          event: 'invitee.created',
          created_at: new Date().toISOString(),
          payload: { ...base, uri: newUri, old_invitee: oldUri },
        })
      ).status,
    ).toBe(200);
    expect(
      (await db.meeting.findUnique({ where: { externalEventUri: oldUri } }))
        ?.status,
    ).toBe('CANCELLED');
    expect(
      (await db.meeting.findUnique({ where: { externalEventUri: newUri } }))
        ?.status,
    ).toBe('SCHEDULED');
    expect(
      (
        await send({
          event: 'invitee.canceled',
          created_at: new Date().toISOString(),
          payload: { ...base, uri: oldUri, rescheduled: true },
        })
      ).status,
    ).toBe(200);
    expect(
      (await db.meeting.findUnique({ where: { externalEventUri: newUri } }))
        ?.status,
    ).toBe('SCHEDULED');
  });
  it('archive blocks work writes without deleting history', async () => {
    await db.project.update({
      where: { id: project },
      data: { status: 'ARCHIVED' },
    });
    await auth(req().patch('/api/v1/projects/' + project + '/tasks/' + task))
      .send({ status: 'DONE' })
      .expect(409);
    await auth(req().post('/api/v1/projects/' + project + '/resources'))
      .send({ name: 'Blocked', url: 'https://example.test' })
      .expect(409);
    await auth(
      req().get('/api/v1/projects/' + project + '/work-logs'),
      'PRODUCT_OWNER',
    ).expect(200);
  });
});

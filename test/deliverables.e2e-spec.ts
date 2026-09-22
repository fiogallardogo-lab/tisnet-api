import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module.js';
import { HttpExceptionFilter } from '../src/common/filters/http-exception/http-exception.filter.js';
import { TransformInterceptor } from '../src/common/interceptors/transform/transform.interceptor.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

describe('Project deliverables API (e2e, base aislada)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const password = 'PasswordSegura123!';
  const emails = {
    client: `deliverables-client-${suffix}@example.test`,
    developer: `deliverables-developer-${suffix}@example.test`,
    productOwner: `deliverables-po-${suffix}@example.test`,
    admin: `deliverables-admin-${suffix}@example.test`,
  };
  const tokens: Record<keyof typeof emails, string> = {} as Record<
    keyof typeof emails,
    string
  >;
  let categoryId: number;
  let projectId: number;
  let foreignProjectId: number;
  let firstDeliverableId: number;

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
    const users: Record<string, { id: number }> = {};
    for (const [key, roleName] of [
      ['client', 'CLIENT'],
      ['developer', 'DEVELOPER'],
      ['productOwner', 'PRODUCT_OWNER'],
      ['admin', 'ADMIN'],
    ] as const) {
      const role = await prisma.role.findUniqueOrThrow({
        where: { name: roleName },
      });
      users[key] = await prisma.user.create({
        data: {
          name: `${roleName} Deliverables E2E`,
          email: emails[key],
          passwordHash,
          roleId: role.id,
        },
      });
      tokens[key] = await login(emails[key]);
    }

    const category = await prisma.category.create({
      data: { name: `Deliverables E2E ${suffix}` },
    });
    categoryId = category.id;
    const projectData = {
      shortDescription: 'Proyecto para pruebas de entregables',
      description: 'Proyecto aislado para validar RBAC y transiciones.',
      categoryId,
    };
    const project = await prisma.project.create({
      data: {
        ...projectData,
        name: 'Proyecto entregables E2E',
        slug: `deliverables-${suffix}`,
      },
    });
    const foreignProject = await prisma.project.create({
      data: {
        ...projectData,
        name: 'Proyecto ajeno E2E',
        slug: `deliverables-foreign-${suffix}`,
      },
    });
    projectId = project.id;
    foreignProjectId = foreignProject.id;

    await prisma.projectMember.createMany({
      data: [
        { projectId, userId: users.client.id, memberRole: 'CLIENT' },
        { projectId, userId: users.developer.id, memberRole: 'DEVELOPER' },
        {
          projectId,
          userId: users.productOwner.id,
          memberRole: 'PRODUCT_OWNER',
        },
      ],
    });
  });

  afterAll(async () => {
    if (prisma) {
      await prisma.project.deleteMany({
        where: { id: { in: [projectId, foreignProjectId].filter(Boolean) } },
      });
      await prisma.category.deleteMany({ where: { id: categoryId } });
      await prisma.user.deleteMany({
        where: { email: { in: Object.values(emails) } },
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

  it('responde 401 sin sesión', async () => {
    await request(app.getHttpServer())
      .get(`/api/v1/projects/${projectId}/deliverables`)
      .expect(401);
  });

  it('lista para miembros activos y administradores, pero rechaza proyectos ajenos', async () => {
    await request(app.getHttpServer())
      .get(`/api/v1/projects/${projectId}/deliverables`)
      .set('Authorization', `Bearer ${tokens.developer}`)
      .expect(200);
    await request(app.getHttpServer())
      .get(`/api/v1/projects/${projectId}/deliverables`)
      .set('Authorization', `Bearer ${tokens.admin}`)
      .expect(200);
    await request(app.getHttpServer())
      .get(`/api/v1/projects/${foreignProjectId}/deliverables`)
      .set('Authorization', `Bearer ${tokens.developer}`)
      .expect(403);
  });

  it('permite crear a PO asignado y bloquea developer, payload inválido y orden repetido', async () => {
    const body = {
      title: 'Prototipo navegable',
      description: 'Primera versión para revisión.',
      milestoneOrder: 1,
      dueDate: '2026-10-15',
    };
    await request(app.getHttpServer())
      .post(`/api/v1/projects/${projectId}/deliverables`)
      .set('Authorization', `Bearer ${tokens.developer}`)
      .send(body)
      .expect(403);
    await request(app.getHttpServer())
      .post(`/api/v1/projects/${projectId}/deliverables`)
      .set('Authorization', `Bearer ${tokens.productOwner}`)
      .send({ ...body, milestoneOrder: 0 })
      .expect(400);
    const created = await request(app.getHttpServer())
      .post(`/api/v1/projects/${projectId}/deliverables`)
      .set('Authorization', `Bearer ${tokens.productOwner}`)
      .send(body)
      .expect(201);
    expect(created.body.data).toMatchObject({
      status: 'DRAFT',
      milestoneOrder: 1,
    });
    firstDeliverableId = created.body.data.id as number;
    await request(app.getHttpServer())
      .post(`/api/v1/projects/${projectId}/deliverables`)
      .set('Authorization', `Bearer ${tokens.admin}`)
      .send({ ...body, title: 'Duplicado' })
      .expect(409);
  });

  it('valida evidencia y aplica permisos de submit', async () => {
    const url = `/api/v1/projects/${projectId}/deliverables/${firstDeliverableId}/submit`;
    await request(app.getHttpServer())
      .patch(url)
      .set('Authorization', `Bearer ${tokens.client}`)
      .send({ fileUrl: 'https://example.com/file.pdf' })
      .expect(403);
    await request(app.getHttpServer())
      .patch(url)
      .set('Authorization', `Bearer ${tokens.developer}`)
      .send({})
      .expect(400);
    await request(app.getHttpServer())
      .patch(url)
      .set('Authorization', `Bearer ${tokens.developer}`)
      .send({ fileUrl: 'ftp://example.com/file.pdf' })
      .expect(400);
    const submitted = await request(app.getHttpServer())
      .patch(url)
      .set('Authorization', `Bearer ${tokens.developer}`)
      .send({ externalLink: 'https://www.figma.com/proto/example' })
      .expect(200);
    expect(submitted.body.data).toMatchObject({ status: 'IN_REVIEW' });
    expect(submitted.body.data.submittedAt).toBeTruthy();
    await request(app.getHttpServer())
      .patch(url)
      .set('Authorization', `Bearer ${tokens.developer}`)
      .send({ externalLink: 'https://example.com/again' })
      .expect(409);
  });

  it('observa, reenvía y aprueba respetando la máquina de estados', async () => {
    const reviewUrl = `/api/v1/projects/${projectId}/deliverables/${firstDeliverableId}/review`;
    const submitUrl = `/api/v1/projects/${projectId}/deliverables/${firstDeliverableId}/submit`;
    await request(app.getHttpServer())
      .patch(reviewUrl)
      .set('Authorization', `Bearer ${tokens.developer}`)
      .send({ decision: 'APPROVE' })
      .expect(403);
    await request(app.getHttpServer())
      .patch(reviewUrl)
      .set('Authorization', `Bearer ${tokens.client}`)
      .send({ decision: 'OBSERVE' })
      .expect(400);
    const observed = await request(app.getHttpServer())
      .patch(reviewUrl)
      .set('Authorization', `Bearer ${tokens.client}`)
      .send({ decision: 'OBSERVE', feedbackNotes: 'Adjuntar evidencia móvil.' })
      .expect(200);
    expect(observed.body.data).toMatchObject({
      status: 'OBSERVED',
      reviewedById: expect.any(Number),
    });
    await request(app.getHttpServer())
      .patch(submitUrl)
      .set('Authorization', `Bearer ${tokens.developer}`)
      .send({ fileUrl: 'https://example.com/version-2.pdf' })
      .expect(200);
    const approved = await request(app.getHttpServer())
      .patch(reviewUrl)
      .set('Authorization', `Bearer ${tokens.productOwner}`)
      .send({ decision: 'APPROVE' })
      .expect(200);
    expect(approved.body.data).toMatchObject({
      status: 'APPROVED',
      feedbackNotes: null,
    });
    await request(app.getHttpServer())
      .patch(reviewUrl)
      .set('Authorization', `Bearer ${tokens.admin}`)
      .send({ decision: 'APPROVE' })
      .expect(409);
  });

  it('distingue proyecto y entregable inexistentes con 404', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/projects/999999999/deliverables')
      .set('Authorization', `Bearer ${tokens.admin}`)
      .expect(404);
    await request(app.getHttpServer())
      .patch(`/api/v1/projects/${projectId}/deliverables/999999999/submit`)
      .set('Authorization', `Bearer ${tokens.admin}`)
      .send({ fileUrl: 'https://example.com/file.pdf' })
      .expect(404);
  });
});

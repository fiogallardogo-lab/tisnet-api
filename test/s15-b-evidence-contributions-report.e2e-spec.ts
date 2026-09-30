import { createAppTestModule } from './helpers/create-app-test-module';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import type { TestingModule } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import request from 'supertest';
import { App } from 'supertest/types';
import { HttpExceptionFilter } from '../src/common/filters/http-exception/http-exception.filter.js';
import { TransformInterceptor } from '../src/common/interceptors/transform/transform.interceptor.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

describe('Sprint 15 B: Evidencias, Contribuciones, Informe y Cierre (E2E MySQL)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const password = 'PasswordSegura123!';

  const emails = {
    client: `s15b-cli-${suffix}@example.test`,
    po: `s15b-po-${suffix}@example.test`,
    dev1: `s15b-dev1-${suffix}@example.test`,
    dev2: `s15b-dev2-${suffix}@example.test`,
    admin: `s15b-admin-${suffix}@example.test`,
  };

  const users: Record<string, { id: number }> = {};
  const tokens: Record<string, string> = {};
  let categoryId: number;
  let projectId: number;
  let _deliverableId: number;

  beforeAll(async () => {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) throw new Error('Falta DATABASE_URL para E2E.');

    const moduleFixture: TestingModule = await createAppTestModule().compile();
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
    for (const [key, roleName] of [
      ['client', 'CLIENT'],
      ['po', 'PRODUCT_OWNER'],
      ['dev1', 'DEVELOPER'],
      ['dev2', 'DEVELOPER'],
      ['admin', 'ADMIN'],
    ] as const) {
      const role = await prisma.role.findUniqueOrThrow({
        where: { name: roleName },
      });
      users[key] = await prisma.user.create({
        data: {
          name: `${roleName} S15B`,
          email: emails[key],
          passwordHash,
          roleId: role.id,
        },
      });
      tokens[key] = await login(emails[key]);
    }

    const category = await prisma.category.create({
      data: { name: `S15B Category ${suffix}` },
    });
    categoryId = category.id;

    // Create active project with PO and Client
    const project = await prisma.project.create({
      data: {
        name: `Proyecto S15B Trazabilidad ${suffix}`,
        slug: `s15b-project-${suffix}`,
        shortDescription: 'Proyecto para pruebas de evidencias y contribuciones S15',
        description: 'Descripción completa para validar el cierre e informes.',
        categoryId,
        clientUserId: users.client.id,
        productOwnerId: users.po.id,
        status: 'IN_DEVELOPMENT',
      },
    });
    projectId = project.id;

    // Add memberships
    await prisma.projectMember.createMany({
      data: [
        { projectId, userId: users.client.id, memberRole: 'CLIENT', isActive: true },
        { projectId, userId: users.po.id, memberRole: 'PRODUCT_OWNER', isActive: true },
        { projectId, userId: users.dev1.id, memberRole: 'DEVELOPER', technicalRole: 'Backend Lead', isActive: true },
        { projectId, userId: users.dev2.id, memberRole: 'DEVELOPER', technicalRole: 'Frontend Dev', isActive: true },
      ],
    });

    // Create Milestone and Deliverable
    const deliverable = await prisma.projectDeliverable.create({
      data: {
        projectId,
        title: 'Hito 1: Backend y Arquitectura',
        description: 'Entrega inicial con base de datos y contratos.',
        milestoneOrder: 1,
        dueDate: new Date('2026-10-20'),
        status: 'DRAFT',
      },
    });
    _deliverableId = deliverable.id;
  });

  afterAll(async () => {
    if (projectId) {
      await prisma.milestoneContribution.deleteMany({ where: { projectId } });
      await prisma.deliverableHistory.deleteMany({ where: { deliverable: { projectId } } });
      await prisma.projectDeliverable.deleteMany({ where: { projectId } });
      await prisma.projectMember.deleteMany({ where: { projectId } });
      await prisma.project.deleteMany({ where: { id: projectId } });
    }
    if (categoryId) {
      await prisma.category.deleteMany({ where: { id: categoryId } });
    }
    for (const key of Object.keys(emails)) {
      if (users[key]?.id) {
        await prisma.user.deleteMany({ where: { id: users[key].id } });
      }
    }
    await app.close();
  });

  async function login(email: string) {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password })
      .expect(200);
    return res.body.data.accessToken as string;
  }

  it('S15-B01 & S15-C01: Subir evidencia completa (PDF + Video) y pasar a IN_REVIEW', async () => {
    // 1. Fails if missing video
    const failRes1 = await request(app.getHttpServer())
      .post(`/api/v1/projects/${projectId}/milestones/1/evidence`)
      .set('Authorization', `Bearer ${tokens.dev1}`)
      .send({ pdfUrl: 'https://storage.tisnet.pe/doc.pdf', videoUrl: '' });
    expect(failRes1.status).toBe(400);

    // 2. Fails if missing PDF
    const failRes2 = await request(app.getHttpServer())
      .post(`/api/v1/projects/${projectId}/milestones/1/evidence`)
      .set('Authorization', `Bearer ${tokens.dev1}`)
      .send({ videoUrl: 'https://loom.com/share/demo' });
    expect(failRes2.status).toBe(400);

    // 3. Succeeds with both
    const successRes = await request(app.getHttpServer())
      .post(`/api/v1/projects/${projectId}/milestones/1/evidence`)
      .set('Authorization', `Bearer ${tokens.dev1}`)
      .send({
        pdfUrl: 'https://storage.tisnet.pe/entregable-1.pdf',
        videoUrl: 'https://www.loom.com/share/demo-hito-1',
        notes: 'Documentación técnica completa adjunta.',
      });

    expect(successRes.status).toBe(201);
    expect(successRes.body.data.status).toBe('IN_REVIEW');
    expect(successRes.body.data.pdfUrl).toBe('https://storage.tisnet.pe/entregable-1.pdf');
    expect(successRes.body.data.videoUrl).toBe('https://www.loom.com/share/demo-hito-1');
  });

  it('S15-B05 & S15-C03: Historial registra el envío y permite consultarlo cronológicamente', async () => {
    const historyRes = await request(app.getHttpServer())
      .get(`/api/v1/projects/${projectId}/milestones/1/history`)
      .set('Authorization', `Bearer ${tokens.client}`);

    expect(historyRes.status).toBe(200);
    expect(historyRes.body.data.length).toBeGreaterThanOrEqual(1);
    expect(historyRes.body.data[0].action).toBe('SUBMITTED');
    expect(historyRes.body.data[0].fileUrl).toBe('https://storage.tisnet.pe/entregable-1.pdf');
  });

  it('S15-B01 & S15-C02: Revisión del hito (Aprobar u Observar)', async () => {
    // Client can approve the milestone
    const reviewRes = await request(app.getHttpServer())
      .post(`/api/v1/projects/${projectId}/milestones/1/review`)
      .set('Authorization', `Bearer ${tokens.client}`)
      .send({
        decision: 'APPROVE',
        comments: 'Aprobado sin observaciones técnicas.',
      });

    expect(reviewRes.status).toBe(201);
    expect(reviewRes.body.data.status).toBe('APPROVED');

    // History now contains SUBMITTED and APPROVED
    const historyRes = await request(app.getHttpServer())
      .get(`/api/v1/projects/${projectId}/milestones/1/history`)
      .set('Authorization', `Bearer ${tokens.po}`);
    expect(historyRes.body.data.length).toBe(2);
    expect(historyRes.body.data[1].action).toBe('APPROVED');
    expect(historyRes.body.data[1].comments).toBe('Aprobado sin observaciones técnicas.');
  });

  it('S15-B04 & S15-C04: Registro y consulta de contribuciones del equipo (PO)', async () => {
    // 1. Fails if sum != 100%
    const failRes = await request(app.getHttpServer())
      .post(`/api/v1/projects/${projectId}/milestones/1/contributions`)
      .set('Authorization', `Bearer ${tokens.po}`)
      .send({
        contributions: [
          { userId: users.dev1.id, percentage: 60, description: 'Backend' },
          { userId: users.dev2.id, percentage: 30, description: 'Frontend' },
        ],
      });
    expect(failRes.status).toBe(400);

    // 2. Succeeds when sum == 100%
    const successRes = await request(app.getHttpServer())
      .post(`/api/v1/projects/${projectId}/milestones/1/contributions`)
      .set('Authorization', `Bearer ${tokens.po}`)
      .send({
        contributions: [
          { userId: users.dev1.id, percentage: 70, description: 'Backend y arquitectura API' },
          { userId: users.dev2.id, percentage: 30, description: 'QA e interfaz de usuario' },
        ],
      });
    expect(successRes.status).toBe(201);
    expect(successRes.body.data.length).toBe(2);

    // 3. Query project-wide contributions summary
    const summaryRes = await request(app.getHttpServer())
      .get(`/api/v1/projects/${projectId}/contributions`)
      .set('Authorization', `Bearer ${tokens.dev1}`);

    expect(summaryRes.status).toBe(200);
    expect(summaryRes.body.data.teamSummary.length).toBe(2);
    const dev1Sum = summaryRes.body.data.teamSummary.find(
      (s: any) => s.user.id === users.dev1.id,
    );
    expect(dev1Sum.averagePercentage).toBe(70);
  });

  it('S15-B06 & S15-C05: Generar informe oficial de trazabilidad en JSON y PDF', async () => {
    // JSON format
    const jsonRes = await request(app.getHttpServer())
      .get(`/api/v1/projects/${projectId}/report?format=json`)
      .set('Authorization', `Bearer ${tokens.po}`);

    expect(jsonRes.status).toBe(200);
    expect(jsonRes.body.data.project.name).toContain('Proyecto S15B');
    expect(jsonRes.body.data.milestones.length).toBe(1);
    expect(jsonRes.body.data.teamContributions.length).toBe(2);

    // PDF binary format
    const pdfRes = await request(app.getHttpServer())
      .get(`/api/v1/projects/${projectId}/report?format=pdf`)
      .set('Authorization', `Bearer ${tokens.client}`);

    expect(pdfRes.status).toBe(200);
    expect(pdfRes.headers['content-type']).toContain('application/pdf');
    expect(pdfRes.headers['content-disposition']).toContain('.pdf');
    expect(pdfRes.body.length).toBeGreaterThan(100);
  });

  it('S15-B07: Cerrar formalmente el proyecto tras completar hitos', async () => {
    const closeRes = await request(app.getHttpServer())
      .post(`/api/v1/projects/${projectId}/close`)
      .set('Authorization', `Bearer ${tokens.po}`);

    expect(closeRes.status).toBe(201);
    const bodyData = closeRes.body.data || closeRes.body;
    expect(bodyData.status).toBe('COMPLETED');

    const projectInDb = await prisma.project.findUnique({
      where: { id: projectId },
    });
    expect(projectInDb?.status).toBe('COMPLETED');
  });
});

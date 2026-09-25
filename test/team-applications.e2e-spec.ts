import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module.js';
import { HttpExceptionFilter } from '../src/common/filters/http-exception/http-exception.filter.js';
import { TransformInterceptor } from '../src/common/interceptors/transform/transform.interceptor.js';
import { FakeNotificationProvider } from '../src/notifications/fake-notification.provider.js';
import { NOTIFICATION_PROVIDER } from '../src/notifications/notification-provider.interface.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

describe('Team applications API (e2e, base aislada)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let notifications: FakeNotificationProvider;

  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const password = 'PasswordSegura123!';
  const superAdminEmail = `team-super-${suffix}@example.test`;
  const adminEmail = `team-admin-${suffix}@example.test`;
  const firstApplicantEmail = `team-applicant-a-${suffix}@example.test`;
  const secondApplicantEmail = `team-applicant-b-${suffix}@example.test`;
  const firstCode = `TEAM-E2E-A-${suffix}`;
  const secondCode = `TEAM-E2E-B-${suffix}`;
  const dniSeed = Date.now().toString().slice(-7);

  let superAdminToken: string;
  let adminToken: string;
  let adminProfileId: number;
  let firstApplicationId: number;
  let secondApplicationId: number;

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
    notifications = app.get(NOTIFICATION_PROVIDER);
    notifications.clear();

    const passwordHash = await bcrypt.hash(password, 4);
    const [superAdminRole, adminRole] = await Promise.all([
      prisma.role.findUniqueOrThrow({ where: { name: 'SUPER_ADMIN' } }),
      prisma.role.findUniqueOrThrow({ where: { name: 'ADMIN' } }),
    ]);

    await prisma.user.create({
      data: {
        name: 'Super Admin Team E2E',
        email: superAdminEmail,
        passwordHash,
        roleId: superAdminRole.id,
      },
    });
    const admin = await prisma.user.create({
      data: {
        name: 'Entrevistador Team E2E',
        email: adminEmail,
        passwordHash,
        roleId: adminRole.id,
        adminProfile: {
          create: {
            executiveTitle: 'Asesor técnico',
            specialty: 'Soluciones web',
            calendlyUrl: 'https://calendly.com/tisnet/e2e',
          },
        },
      },
      include: { adminProfile: true },
    });
    adminProfileId = admin.adminProfile!.id;

    const applications = await Promise.all([
      prisma.teamApplication.create({
        data: {
          code: firstCode,
          email: firstApplicantEmail,
          dni: `7${dniSeed}`,
          requestedRole: 'DEVELOPER',
          profile: {
            fullName: 'Postulante Developer E2E',
            age: 24,
            district: 'Miraflores',
            phone: '999999999',
            career: 'Ingeniería de Sistemas',
            university: 'Universidad E2E',
            experienceYears: 2,
            programmingLanguages: 'TypeScript, Node.js',
            specialty: 'FULL_STACK',
          },
          cv: Buffer.from('%PDF-e2e-developer'),
          cvName: 'cv-developer-e2e.pdf',
          photo: Buffer.from([0xff, 0xd8, 0xff, 0xd9]),
          photoMime: 'image/jpeg',
          consent: true,
        },
      }),
      prisma.teamApplication.create({
        data: {
          code: secondCode,
          email: secondApplicantEmail,
          dni: `8${dniSeed}`,
          requestedRole: 'PRODUCT_OWNER',
          profile: {
            fullName: 'Postulante Product Owner E2E',
            age: 28,
            district: 'San Isidro',
            phone: '988888888',
            career: 'Administración',
            university: 'Universidad E2E',
            experienceYears: 4,
            programmingLanguages: 'Jira, Scrum',
            specialty: 'FULL_STACK',
          },
          cv: Buffer.from('%PDF-e2e-product-owner'),
          cvName: 'cv-product-owner-e2e.pdf',
          photo: Buffer.from([0x89, 0x50, 0x4e, 0x47]),
          photoMime: 'image/png',
          consent: true,
        },
      }),
    ]);
    firstApplicationId = applications[0].id;
    secondApplicationId = applications[1].id;

    superAdminToken = await login(superAdminEmail);
    adminToken = await login(adminEmail);
  });

  afterAll(async () => {
    if (prisma) {
      await prisma.teamApplication.deleteMany({
        where: { code: { in: [firstCode, secondCode] } },
      });
      await prisma.user.deleteMany({
        where: { email: { in: [superAdminEmail, adminEmail] } },
      });
    }
    notifications?.clear();
    await app?.close();
  });

  async function login(email: string) {
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password })
      .expect(200);
    return response.body.data.accessToken as string;
  }

  it('restricts the administrative inbox to SUPER_ADMIN', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/team-applications')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(403);

    const response = await request(app.getHttpServer())
      .get('/api/v1/team-applications')
      .query({ status: 'PENDING_REVIEW', search: 'Postulante' })
      .set('Authorization', `Bearer ${superAdminToken}`)
      .expect(200);

    expect(response.body.data.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: firstApplicationId,
          fullName: 'Postulante Developer E2E',
          status: 'PENDING_REVIEW',
        }),
      ]),
    );
    expect(response.body.data.items[0]).not.toHaveProperty('cv');
    expect(response.body.data.items[0]).not.toHaveProperty('photo');
  });

  it('returns detail, private photo, CV and active interviewers', async () => {
    const detail = await request(app.getHttpServer())
      .get(`/api/v1/team-applications/${firstApplicationId}`)
      .set('Authorization', `Bearer ${superAdminToken}`)
      .expect(200);
    expect(detail.body.data).toMatchObject({
      id: firstApplicationId,
      requestedRole: 'DEVELOPER',
      profile: { fullName: 'Postulante Developer E2E' },
      files: { cvName: 'cv-developer-e2e.pdf' },
    });

    await request(app.getHttpServer())
      .get(`/api/v1/team-applications/${firstApplicationId}/photo`)
      .set('Authorization', `Bearer ${superAdminToken}`)
      .expect('Content-Type', /image\/jpeg/)
      .expect(200);

    await request(app.getHttpServer())
      .get(`/api/v1/team-applications/${firstApplicationId}/cv`)
      .set('Authorization', `Bearer ${superAdminToken}`)
      .expect('Content-Type', /application\/pdf/)
      .expect('Content-Disposition', /cv-developer-e2e\.pdf/)
      .expect(200);

    const interviewers = await request(app.getHttpServer())
      .get('/api/v1/team-applications/interviewers')
      .set('Authorization', `Bearer ${superAdminToken}`)
      .expect(200);
    expect(interviewers.body.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          adminProfileId,
          name: 'Entrevistador Team E2E',
        }),
      ]),
    );
  });

  it('assigns an interview once and records a notification', async () => {
    const response = await request(app.getHttpServer())
      .patch(`/api/v1/team-applications/${firstApplicationId}/assign-interview`)
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({ adminProfileId })
      .expect(200);

    expect(response.body.data).toMatchObject({
      id: firstApplicationId,
      status: 'INTERVIEW_ASSIGNED',
      notificationStatus: 'SENT',
      assignedAdmin: { adminProfileId },
    });
    expect(notifications.getLastNotification()).toMatchObject({
      recipient: firstApplicantEmail,
      metadata: { event: 'TEAM_APPLICATION_INTERVIEW_ASSIGNED' },
    });

    await request(app.getHttpServer())
      .patch(`/api/v1/team-applications/${firstApplicationId}/assign-interview`)
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({ adminProfileId })
      .expect(409);
  });

  it('rejects with a reason and records a notification', async () => {
    const reason =
      'Actualmente buscamos un perfil con mayor experiencia en producción.';
    const response = await request(app.getHttpServer())
      .patch(`/api/v1/team-applications/${secondApplicationId}/reject`)
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({ reason })
      .expect(200);

    expect(response.body.data).toMatchObject({
      id: secondApplicationId,
      status: 'REJECTED',
      rejectionReason: reason,
      notificationStatus: 'SENT',
    });
    expect(notifications.getLastNotification()).toMatchObject({
      recipient: secondApplicantEmail,
      metadata: { event: 'TEAM_APPLICATION_REJECTED' },
    });
  });
});

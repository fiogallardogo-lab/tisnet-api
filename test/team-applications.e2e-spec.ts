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
  const otherAdminEmail = `team-admin2-${suffix}@example.test`;
  const clientEmail = `team-client-${suffix}@example.test`;
  const existingDevEmail = `team-existing-dev-${suffix}@example.test`;

  const firstApplicantEmail = `team-applicant-a-${suffix}@example.test`;
  const secondApplicantEmail = `team-applicant-b-${suffix}@example.test`;
  const thirdApplicantEmail = `team-applicant-c-${suffix}@example.test`;
  const fourthApplicantEmail = `team-applicant-d-${suffix}@example.test`;
  const fifthApplicantEmail = existingDevEmail;

  const firstCode = `TEAM-E2E-A-${suffix}`;
  const secondCode = `TEAM-E2E-B-${suffix}`;
  const thirdCode = `TEAM-E2E-C-${suffix}`;
  const fourthCode = `TEAM-E2E-D-${suffix}`;
  const fifthCode = `TEAM-E2E-E-${suffix}`;
  const dniSeed = Date.now().toString().slice(-6);

  let superAdminToken: string;
  let adminToken: string;
  let otherAdminToken: string;
  let clientToken: string;

  let adminProfileId: number;
  let _otherAdminProfileId: number;
  let adminUserId: number;
  let existingDevUserId: number;

  let firstApplicationId: number;
  let secondApplicationId: number;
  let thirdApplicationId: number;
  let fourthApplicationId: number;
  let fifthApplicationId: number;

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
    const [superAdminRole, adminRole, clientRole, devRole] = await Promise.all([
      prisma.role.findUniqueOrThrow({ where: { name: 'SUPER_ADMIN' } }),
      prisma.role.findUniqueOrThrow({ where: { name: 'ADMIN' } }),
      prisma.role.findUniqueOrThrow({ where: { name: 'CLIENT' } }),
      prisma.role.findUniqueOrThrow({ where: { name: 'DEVELOPER' } }),
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
            executiveTitle: 'Asesor t+®cnico',
            specialty: 'Soluciones web',
            calendlyUrl: 'https://calendly.com/tisnet/e2e',
          },
        },
      },
      include: { adminProfile: true },
    });
    adminProfileId = admin.adminProfile!.id;
    adminUserId = admin.id;

    const otherAdmin = await prisma.user.create({
      data: {
        name: 'Segundo Administrador E2E',
        email: otherAdminEmail,
        passwordHash,
        roleId: adminRole.id,
        adminProfile: {
          create: {
            executiveTitle: 'Asesor t+®cnico secundario',
            specialty: 'M+¦vil',
          },
        },
      },
      include: { adminProfile: true },
    });
    _otherAdminProfileId = otherAdmin.adminProfile!.id;

    await prisma.user.create({
      data: {
        name: 'Cliente E2E',
        email: clientEmail,
        passwordHash,
        roleId: clientRole.id,
      },
    });

    const existingDev = await prisma.user.create({
      data: {
        name: 'Existing Dev Pre-Application',
        email: existingDevEmail,
        passwordHash,
        roleId: devRole.id,
        developerProfile: { create: {} },
      },
    });
    existingDevUserId = existingDev.id;

    const applications = await Promise.all([
      prisma.teamApplication.create({
        data: {
          code: firstCode,
          email: firstApplicantEmail,
          dni: `10${dniSeed}`,
          requestedRole: 'DEVELOPER',
          profile: {
            fullName: 'Postulante Developer E2E',
            age: 24,
            district: 'Miraflores',
            phone: '999999999',
            career: 'Ingenier+¡a de Sistemas',
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
          dni: `20${dniSeed}`,
          requestedRole: 'PRODUCT_OWNER',
          profile: {
            fullName: 'Postulante Product Owner E2E',
            age: 28,
            district: 'San Isidro',
            phone: '988888888',
            career: 'Administraci+¦n',
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
      prisma.teamApplication.create({
        data: {
          code: thirdCode,
          email: thirdApplicantEmail,
          dni: `30${dniSeed}`,
          requestedRole: 'DEVELOPER',
          profile: {
            fullName: 'Postulante Rechazo Entrevista',
            phone: '977777777',
          },
          cv: Buffer.from('%PDF-e2e-third'),
          cvName: 'cv-third.pdf',
          photo: Buffer.from([0xff, 0xd8, 0xff, 0xd9]),
          photoMime: 'image/jpeg',
          consent: true,
        },
      }),
      prisma.teamApplication.create({
        data: {
          code: fourthCode,
          email: fourthApplicantEmail,
          dni: `40${dniSeed}`,
          requestedRole: 'PRODUCT_OWNER',
          profile: {
            fullName: 'Postulante Decision Super Admin',
            phone: '966666666',
          },
          cv: Buffer.from('%PDF-e2e-fourth'),
          cvName: 'cv-fourth.pdf',
          photo: Buffer.from([0xff, 0xd8, 0xff, 0xd9]),
          photoMime: 'image/jpeg',
          consent: true,
        },
      }),
      prisma.teamApplication.create({
        data: {
          code: fifthCode,
          email: fifthApplicantEmail,
          dni: `50${dniSeed}`,
          requestedRole: 'DEVELOPER',
          profile: {
            fullName: 'Existing Dev Applicant',
            phone: '955555555',
          },
          cv: Buffer.from('%PDF-e2e-fifth'),
          cvName: 'cv-fifth.pdf',
          photo: Buffer.from([0xff, 0xd8, 0xff, 0xd9]),
          photoMime: 'image/jpeg',
          consent: true,
        },
      }),
    ]);

    firstApplicationId = applications[0].id;
    secondApplicationId = applications[1].id;
    thirdApplicationId = applications[2].id;
    fourthApplicationId = applications[3].id;
    fifthApplicationId = applications[4].id;

    superAdminToken = await login(superAdminEmail);
    adminToken = await login(adminEmail);
    otherAdminToken = await login(otherAdminEmail);
    clientToken = await login(clientEmail);
  });

  afterAll(async () => {
    if (prisma) {
      await prisma.auditEvent.deleteMany({
        where: {
          entityType: 'TEAM_APPLICATION',
          entityId: {
            in: [
              String(firstApplicationId),
              String(secondApplicationId),
              String(thirdApplicationId),
              String(fourthApplicationId),
              String(fifthApplicationId),
            ],
          },
        },
      });
      await prisma.teamApplication.deleteMany({
        where: {
          code: {
            in: [firstCode, secondCode, thirdCode, fourthCode, fifthCode],
          },
        },
      });
      await prisma.user.deleteMany({
        where: {
          email: {
            in: [
              superAdminEmail,
              adminEmail,
              otherAdminEmail,
              clientEmail,
              existingDevEmail,
              firstApplicantEmail,
              secondApplicantEmail,
              thirdApplicantEmail,
              fourthApplicantEmail,
            ],
          },
        },
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

  it('rejects with a reason and records a notification at initial review', async () => {
    const reason =
      'Actualmente buscamos un perfil con mayor experiencia en producci+¦n.';
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

    // Check audit event
    const audit = await prisma.auditEvent.findFirst({
      where: {
        entityType: 'TEAM_APPLICATION',
        entityId: String(secondApplicationId),
        action: 'TEAM_APPLICATION_REJECTED',
      },
    });
    expect(audit).not.toBeNull();
  });

  it('ADMIN no autorizado sobre entrevista ajena (RBAC 403)', async () => {
    // firstApplicationId is assigned to adminProfileId (adminToken)
    // otherAdminToken is assigned otherAdminProfileId
    await request(app.getHttpServer())
      .patch(`/api/v1/team-applications/my-interviews/${firstApplicationId}/decision`)
      .set('Authorization', `Bearer ${otherAdminToken}`)
      .send({ decision: 'ACCEPTED' })
      .expect(403);
  });

  it('CLIENT no autorizado para decidir entrevista (RBAC 403)', async () => {
    await request(app.getHttpServer())
      .patch(`/api/v1/team-applications/my-interviews/${firstApplicationId}/decision`)
      .set('Authorization', `Bearer ${clientToken}`)
      .send({ decision: 'ACCEPTED' })
      .expect(403);
  });

  it('acepta entrevista, crea User, vincula aplicaci+¦n y registra auditor+¡a en transacci+¦n', async () => {
    const response = await request(app.getHttpServer())
      .patch(`/api/v1/team-applications/my-interviews/${firstApplicationId}/decision`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        decision: 'ACCEPTED',
        reason: 'Aprobado con honores en evaluaci+¦n t+®cnica y de fit cultural.',
      })
      .expect(200);

    const appData = response.body.data;
    expect(appData.status).toBe('ACCEPTED');
    expect(appData.resultingUserId).toBeDefined();
    expect(appData.decidedBy.id).toBe(adminUserId);
    expect(appData.decidedAt).toBeDefined();
    expect(appData.interviewCompletedAt).toBeDefined();

    // Verify User was created in DB
    const createdUser = await prisma.user.findUnique({
      where: { email: firstApplicantEmail },
      include: { role: true, developerProfile: true },
    });
    expect(createdUser).not.toBeNull();
    expect(createdUser!.role.name).toBe('DEVELOPER');
    expect(createdUser!.developerProfile).not.toBeNull();
    expect(createdUser!.id).toBe(appData.resultingUserId);

    // Verify TeamApplication in DB
    const appInDb = await prisma.teamApplication.findUnique({
      where: { id: firstApplicationId },
    });
    expect(appInDb!.status).toBe('ACCEPTED');
    expect(appInDb!.resultingUserId).toBe(createdUser!.id);
    expect(appInDb!.decidedByUserId).toBe(adminUserId);

    // Verify AuditEvents in DB
    const auditAccepted = await prisma.auditEvent.findFirst({
      where: {
        entityType: 'TEAM_APPLICATION',
        entityId: String(firstApplicationId),
        action: 'TEAM_APPLICATION_ACCEPTED',
      },
    });
    expect(auditAccepted).not.toBeNull();
    expect(auditAccepted!.actorId).toBe(adminUserId);
    expect((auditAccepted!.metadata as any).resultingUserId).toBe(createdUser!.id);

    const auditLinked = await prisma.auditEvent.findFirst({
      where: {
        entityType: 'TEAM_APPLICATION',
        entityId: String(firstApplicationId),
        action: 'TEAM_APPLICATION_USER_LINKED',
      },
    });
    expect(auditLinked).not.toBeNull();
    expect((auditLinked!.metadata as any).resultingUserId).toBe(createdUser!.id);
  });

  it('segundo intento controlado: rechaza doble decisi+¦n con 409', async () => {
    await request(app.getHttpServer())
      .patch(`/api/v1/team-applications/my-interviews/${firstApplicationId}/decision`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ decision: 'ACCEPTED' })
      .expect(409);
  });

  it('rechazo de entrevista: asigna, rechaza con motivo, audita y no crea User', async () => {
    // 1. Assign interview to admin
    await request(app.getHttpServer())
      .patch(`/api/v1/team-applications/${thirdApplicationId}/assign-interview`)
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({ adminProfileId })
      .expect(200);

    // 2. Reject interview
    const reason = 'El postulante no demostr+¦ el nivel requerido para la vacante.';
    const response = await request(app.getHttpServer())
      .patch(`/api/v1/team-applications/my-interviews/${thirdApplicationId}/decision`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ decision: 'REJECTED', reason })
      .expect(200);

    expect(response.body.data.status).toBe('REJECTED');
    expect(response.body.data.resultingUserId).toBeNull();

    // Verify no user was created
    const userInDb = await prisma.user.findUnique({
      where: { email: thirdApplicantEmail },
    });
    expect(userInDb).toBeNull();

    // Verify AuditEvent
    const audit = await prisma.auditEvent.findFirst({
      where: {
        entityType: 'TEAM_APPLICATION',
        entityId: String(thirdApplicationId),
        action: 'TEAM_APPLICATION_REJECTED',
      },
    });
    expect(audit).not.toBeNull();
    expect(audit!.actorId).toBe(adminUserId);
  });

  it('SUPER_ADMIN autorizado para aceptar postulaci+¦n en entrevista', async () => {
    // 1. Assign interview
    await request(app.getHttpServer())
      .patch(`/api/v1/team-applications/${fourthApplicationId}/assign-interview`)
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({ adminProfileId })
      .expect(200);

    // 2. SUPER_ADMIN accepts directly via :id/decision
    const response = await request(app.getHttpServer())
      .patch(`/api/v1/team-applications/${fourthApplicationId}/decision`)
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({ decision: 'ACCEPTED' })
      .expect(200);

    expect(response.body.data.status).toBe('ACCEPTED');
    expect(response.body.data.resultingUserId).toBeDefined();

    // Verify User was created as PRODUCT_OWNER
    const createdUser = await prisma.user.findUnique({
      where: { email: fourthApplicantEmail },
      include: { role: true, productOwnerProfile: true },
    });
    expect(createdUser).not.toBeNull();
    expect(createdUser!.role.name).toBe('PRODUCT_OWNER');
    expect(createdUser!.productOwnerProfile).not.toBeNull();
  });

  it('vinculaci+¦n a User existente: reutiliza cuenta y no crea duplicado', async () => {
    // 1. Assign interview
    await request(app.getHttpServer())
      .patch(`/api/v1/team-applications/${fifthApplicationId}/assign-interview`)
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({ adminProfileId })
      .expect(200);

    // 2. Accept
    const response = await request(app.getHttpServer())
      .patch(`/api/v1/team-applications/my-interviews/${fifthApplicationId}/decision`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ decision: 'ACCEPTED' })
      .expect(200);

    expect(response.body.data.status).toBe('ACCEPTED');
    expect(response.body.data.resultingUserId).toBe(existingDevUserId);

    // Verify count of users with this email is still 1
    const userCount = await prisma.user.count({
      where: { email: fifthApplicantEmail },
    });
    expect(userCount).toBe(1);
  });
});

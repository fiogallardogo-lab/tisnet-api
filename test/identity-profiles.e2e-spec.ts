import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import request from 'supertest';
import { App } from 'supertest/types';

import { AppModule } from '../src/app.module.js';
import { HttpExceptionFilter } from '../src/common/filters/http-exception/http-exception.filter.js';
import { TransformInterceptor } from '../src/common/interceptors/transform/transform.interceptor.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

describe('Identity and profiles API (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const password = 'PasswordSegura123!';
  const termsVersion = 'v1.0-e2e';
  const privacyVersion = 'v1.0-e2e';
  const clientEmail = `client-${suffix}@example.test`;
  const developerEmail = `developer-${suffix}@example.test`;
  const productOwnerEmail = `product-owner-${suffix}@example.test`;
  const adminEmail = `admin-${suffix}@example.test`;
  const superAdminEmail = `super-admin-${suffix}@example.test`;
  const otherClientEmail = `other-client-${suffix}@example.test`;
  const technologyIds: number[] = [];
  const testEmails = [
    clientEmail,
    developerEmail,
    productOwnerEmail,
    adminEmail,
    superAdminEmail,
    otherClientEmail,
  ];

  let clientAccessToken: string;
  let developerAccessToken: string;
  let productOwnerAccessToken: string;
  let adminAccessToken: string;

  beforeAll(async () => {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      throw new Error('Falta DATABASE_URL para ejecutar las pruebas E2E.');
    }

    const databaseName = new URL(databaseUrl).pathname.replace(/^\//, '');
    if (!/(^|[_-])test($|[_-])/i.test(databaseName)) {
      throw new Error(
        `E2E cancelado: la base "${databaseName}" no parece una base aislada de pruebas.`,
      );
    }

    process.env.TERMS_VERSION = termsVersion;
    process.env.PRIVACY_VERSION = privacyVersion;

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
    for (const [email, roleName] of [
      [developerEmail, 'DEVELOPER'],
      [productOwnerEmail, 'PRODUCT_OWNER'],
      [adminEmail, 'ADMIN'],
      [superAdminEmail, 'SUPER_ADMIN'],
      [otherClientEmail, 'CLIENT'],
    ] as const) {
      const role = await prisma.role.findUniqueOrThrow({
        where: { name: roleName },
      });
      await prisma.user.create({
        data: {
          name: `${roleName} E2E`,
          email,
          passwordHash,
          roleId: role.id,
        },
      });
    }
  });

  afterAll(async () => {
    if (prisma) {
      await prisma.user.deleteMany({ where: { email: { in: testEmails } } });
      await prisma.technology.deleteMany({
        where: { id: { in: technologyIds } },
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

  it('registra únicamente un CLIENT y no expone campos sensibles', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        name: '  Cliente E2E  ',
        email: `  ${clientEmail.toUpperCase()}  `,
        password,
        acceptedTerms: true,
        termsVersion,
        privacyVersion,
      })
      .expect(201);

    expect(response.body.success).toBe(true);
    expect(response.body.data).toMatchObject({
      name: 'Cliente E2E',
      email: clientEmail,
      role: 'CLIENT',
      isActive: true,
      termsVersion,
      privacyVersion,
    });
    expect(response.body.data).not.toHaveProperty('passwordHash');
    expect(response.body.data).not.toHaveProperty('tokenVersion');
    expect(response.body.data).not.toHaveProperty('roleId');

    clientAccessToken = await login(clientEmail);
  });

  it('rechaza email duplicado, consentimiento inválido y campos privilegiados', async () => {
    const validBody = {
      name: 'Cliente E2E',
      email: clientEmail,
      password,
      acceptedTerms: true,
      termsVersion,
      privacyVersion,
    };

    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send(validBody)
      .expect(409);

    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        ...validBody,
        email: `consent-${suffix}@example.test`,
        acceptedTerms: false,
      })
      .expect(400);

    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        ...validBody,
        email: `role-${suffix}@example.test`,
        role: 'SUPER_ADMIN',
      })
      .expect(400);
  });

  it('rechaza versiones legales que no estén vigentes', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        name: 'Cliente versión inválida',
        email: `legal-${suffix}@example.test`,
        password,
        acceptedTerms: true,
        termsVersion: 'version-obsoleta',
        privacyVersion,
      })
      .expect(400);
  });

  it('consulta y actualiza únicamente el usuario CLIENT autenticado', async () => {
    const initial = await request(app.getHttpServer())
      .get('/api/v1/users/me/profile')
      .set('Authorization', `Bearer ${clientAccessToken}`)
      .expect(200);

    expect(initial.body.data.user.email).toBe(clientEmail);
    expect(initial.body.data.profile.type).toBe('CLIENT');
    expect(initial.body.data.user).not.toHaveProperty('passwordHash');
    expect(initial.body.data.user).not.toHaveProperty('tokenVersion');

    const updated = await request(app.getHttpServer())
      .patch('/api/v1/users/me/client-profile')
      .set('Authorization', `Bearer ${clientAccessToken}`)
      .send({ phone: '+51 999 888 777', district: 'Lima' })
      .expect(200);

    expect(updated.body.data).toMatchObject({
      type: 'CLIENT',
      phone: '+51 999 888 777',
      district: 'Lima',
    });
    expect(updated.body.data).not.toHaveProperty('userId');

    const renamed = await request(app.getHttpServer())
      .patch('/api/v1/users/me')
      .set('Authorization', `Bearer ${clientAccessToken}`)
      .send({ name: 'Cliente actualizado' })
      .expect(200);

    expect(renamed.body.data.name).toBe('Cliente actualizado');
  });

  it('impide que CLIENT edite un perfil ADMIN', async () => {
    await request(app.getHttpServer())
      .patch('/api/v1/users/me/admin-profile')
      .set('Authorization', `Bearer ${clientAccessToken}`)
      .send({ executiveTitle: 'No autorizado' })
      .expect(403);
  });

  it('crea y consulta el perfil DEVELOPER propio', async () => {
    developerAccessToken = await login(developerEmail);

    const updated = await request(app.getHttpServer())
      .patch('/api/v1/users/me/developer-profile')
      .set('Authorization', `Bearer ${developerAccessToken}`)
      .send({
        career: 'Ingeniería de Software',
        experienceYears: 3,
        technologyIds: [],
      })
      .expect(200);

    expect(updated.body.data).toMatchObject({
      type: 'DEVELOPER',
      career: 'Ingeniería de Software',
      experienceYears: 3,
      technologies: [],
    });

    const profile = await request(app.getHttpServer())
      .get('/api/v1/users/me/profile')
      .set('Authorization', `Bearer ${developerAccessToken}`)
      .expect(200);

    expect(profile.body.data.user.email).toBe(developerEmail);
    expect(profile.body.data.profile.type).toBe('DEVELOPER');
  });

  it('rechaza tecnologías inexistentes incluso si están repetidas', async () => {
    await request(app.getHttpServer())
      .patch('/api/v1/users/me/developer-profile')
      .set('Authorization', `Bearer ${developerAccessToken}`)
      .send({ technologyIds: [999999999, 999999999] })
      .expect(400);

    await request(app.getHttpServer())
      .patch('/api/v1/users/me/developer-profile')
      .set('Authorization', `Bearer ${developerAccessToken}`)
      .send({ technologyIds: [999999999] })
      .expect(400);
  });

  it('crea los perfiles PRODUCT_OWNER y ADMIN sin exponer userId', async () => {
    productOwnerAccessToken = await login(productOwnerEmail);
    adminAccessToken = await login(adminEmail);

    const productOwner = await request(app.getHttpServer())
      .patch('/api/v1/users/me/product-owner-profile')
      .set('Authorization', `Bearer ${productOwnerAccessToken}`)
      .send({ bio: 'Product Owner E2E', specialty: 'Producto digital' })
      .expect(200);

    expect(productOwner.body.data).toMatchObject({
      type: 'PRODUCT_OWNER',
      bio: 'Product Owner E2E',
    });
    expect(productOwner.body.data).not.toHaveProperty('userId');

    const admin = await request(app.getHttpServer())
      .patch('/api/v1/users/me/admin-profile')
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .send({ executiveTitle: 'Administrador E2E' })
      .expect(200);

    expect(admin.body.data).toMatchObject({
      type: 'ADMIN',
      executiveTitle: 'Administrador E2E',
      isPublicAdvisor: false,
    });
    expect(admin.body.data).not.toHaveProperty('userId');
  });

  it('consulta los cinco roles y conserva SUPER_ADMIN sin perfil especializado', async () => {
    for (const [email, role] of [
      [clientEmail, 'CLIENT'],
      [developerEmail, 'DEVELOPER'],
      [productOwnerEmail, 'PRODUCT_OWNER'],
      [adminEmail, 'ADMIN'],
      [superAdminEmail, 'SUPER_ADMIN'],
    ]) {
      const token = await login(email);
      const response = await request(app.getHttpServer())
        .get('/api/v1/users/me/profile')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      expect(response.body.data.user).toEqual({
        id: expect.any(Number),
        name: expect.any(String),
        email,
        role,
        isActive: true,
      });
      expect(JSON.stringify(response.body.data)).not.toContain('userId');
      if (role === 'SUPER_ADMIN') {
        expect(response.body.data.profile).toBeNull();
        await request(app.getHttpServer())
          .patch('/api/v1/users/me')
          .set('Authorization', `Bearer ${token}`)
          .send({ name: 'Super Admin actualizado' })
          .expect(200);
      } else {
        expect(response.body.data.profile.type).toBe(role);
      }
    }
    const token = await login(otherClientEmail);
    const response = await request(app.getHttpServer())
      .get('/api/v1/users/me/profile')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(response.body.data.profile).toBeNull();
  });

  it('aplica JWT y toda la matriz RBAC de perfiles', async () => {
    const endpoints = [
      'client-profile',
      'developer-profile',
      'product-owner-profile',
      'admin-profile',
    ];
    await request(app.getHttpServer())
      .get('/api/v1/users/me/profile')
      .expect(401);
    await request(app.getHttpServer())
      .get('/api/v1/users/me/profile')
      .set('Authorization', 'Bearer invalid')
      .expect(401);
    for (const endpoint of ['', ...endpoints]) {
      await request(app.getHttpServer())
        .patch(`/api/v1/users/me/${endpoint}`)
        .send({})
        .expect(401);
    }
    for (const [index, email] of [
      clientEmail,
      developerEmail,
      productOwnerEmail,
      adminEmail,
      superAdminEmail,
    ].entries()) {
      const token = await login(email);
      for (const [endpointIndex, endpoint] of endpoints.entries()) {
        if (index === endpointIndex) continue;
        await request(app.getHttpServer())
          .patch(`/api/v1/users/me/${endpoint}`)
          .set('Authorization', `Bearer ${token}`)
          .send({})
          .expect(403);
      }
    }
  });

  it('persiste tecnologías deduplicadas y ordenadas, conserva omisiones y rechaza inactivas sin cambios', async () => {
    for (const [prefix, isActive] of [
      ['Z', true],
      ['A', true],
      ['Inactive', false],
    ] as const) {
      const technology = await prisma.technology.create({
        data: { name: `${prefix}-${suffix}`, isActive },
      });
      technologyIds.push(technology.id);
    }
    const patch = (body: object) =>
      request(app.getHttpServer())
        .patch('/api/v1/users/me/developer-profile')
        .set('Authorization', `Bearer ${developerAccessToken}`)
        .send(body);
    const updated = await patch({
      technologyIds: [technologyIds[0], technologyIds[1], technologyIds[0]],
    }).expect(200);
    expect(
      updated.body.data.technologies.map((t: { id: number }) => t.id),
    ).toEqual([technologyIds[1], technologyIds[0]]);
    const saved = await prisma.developerProfile.findUniqueOrThrow({
      where: {
        userId: (
          await prisma.user.findUniqueOrThrow({
            where: { email: developerEmail },
          })
        ).id,
      },
      include: { technologies: true },
    });
    expect(saved.technologies).toHaveLength(2);
    const omitted = await patch({ specialty: 'Backend' }).expect(200);
    expect(omitted.body.data.technologies).toEqual(
      updated.body.data.technologies,
    );
    await patch({
      specialty: 'No guardar',
      technologyIds: [technologyIds[2]],
    }).expect(400);
    await patch({ technologyIds: [2147483647] }).expect(400);
    await patch({ technologyIds: null }).expect(400);
    const read = await request(app.getHttpServer())
      .get('/api/v1/users/me/profile')
      .set('Authorization', `Bearer ${developerAccessToken}`)
      .expect(200);
    expect(read.body.data.profile.specialty).toBe('Backend');
    expect(read.body.data.profile.technologies).toEqual(
      updated.body.data.technologies,
    );
    expect(JSON.stringify(read.body.data.profile)).not.toContain(
      'developerProfileId',
    );
    const cleared = await patch({ technologyIds: [] }).expect(200);
    expect(cleared.body.data.technologies).toEqual([]);
    expect(
      await prisma.developerTechnology.count({
        where: { developerProfileId: saved.id },
      }),
    ).toBe(0);
  });

  it('valida DNI/RUC y devuelve 409 ante duplicados reales en MySQL', async () => {
    const client = await prisma.user.findUniqueOrThrow({
      where: { email: clientEmail },
    });
    const dni = String(client.id).padStart(8, '0');
    const ruc = String(client.id).padStart(11, '0');
    const patch = (token: string, body: object) =>
      request(app.getHttpServer())
        .patch('/api/v1/users/me/client-profile')
        .set('Authorization', `Bearer ${token}`)
        .send(body);
    for (const body of [
      { dni: '1234567' },
      { dni: 'abcdefgh' },
      { ruc: '1234567890' },
      { ruc: '1234567890x' },
    ]) {
      await patch(clientAccessToken, body).expect(400);
    }
    await patch(clientAccessToken, { dni, ruc }).expect(200);
    const token = await login(otherClientEmail);
    for (const body of [{ dni }, { ruc }]) {
      const conflict = await patch(token, body).expect(409);
      expect(JSON.stringify(conflict.body)).toContain(
        'El DNI o RUC ya está registrado',
      );
    }
    expect(
      await prisma.clientProfile.findUnique({ where: { userId: client.id } }),
    ).toMatchObject({ dni, ruc });
  });

  it('valida todas las URLs de perfiles en HTTP', async () => {
    for (const [endpoint, token, fields] of [
      [
        'developer-profile',
        developerAccessToken,
        ['cvUrl', 'photoUrl', 'linkedinUrl', 'githubUrl'],
      ],
      ['product-owner-profile', productOwnerAccessToken, ['photoUrl']],
      ['admin-profile', adminAccessToken, ['photoUrl', 'calendlyUrl']],
    ] as const) {
      for (const field of fields) {
        for (const value of [
          'example.com',
          'ftp://example.com',
          'https://example.com/' + 'a'.repeat(482),
        ]) {
          await request(app.getHttpServer())
            .patch(`/api/v1/users/me/${endpoint}`)
            .set('Authorization', `Bearer ${token}`)
            .send({ [field]: value })
            .expect(400);
        }
      }
    }
  });
});

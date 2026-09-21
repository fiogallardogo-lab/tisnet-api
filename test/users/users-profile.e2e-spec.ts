import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import request from 'supertest';
import { App } from 'supertest/types';

import { AppModule } from '../../src/app.module';
import { HttpExceptionFilter } from '../../src/common/filters/http-exception/http-exception.filter';
import { TransformInterceptor } from '../../src/common/interceptors/transform/transform.interceptor';
import { PrismaService } from '../../src/prisma/prisma.service';

describe('Sprint 5 users, profiles, catalog and legal versions (MySQL e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  const suffix = `s5-${Date.now()}-${Math.random().toString(16).slice(2)}`;

  const password = 'Sprint5Password!';

  const roles = [
    'CLIENT',
    'DEVELOPER',
    'PRODUCT_OWNER',
    'ADMIN',
    'SUPER_ADMIN',
  ] as const;

  const tokens: Record<string, string> = {};
  const userIds: Record<string, number> = {};

  const emails = roles.map(
    (role) => `${role.toLowerCase()}-${suffix}@example.test`,
  );

  const registrationEmail = `register-${suffix}@example.test`;

  const adminCreatedClientEmail = `admin-created-client-${suffix}@example.test`;

  const superAdminCreatedDeveloperEmail = `super-admin-created-developer-${suffix}@example.test`;

  const technologyIds: number[] = [];

  const legal = {
    acceptedTerms: true,
    termsVersion: 'terms-s5',
    privacyVersion: 'privacy-s5',
  };

  const previousTerms = process.env.TERMS_VERSION;

  const previousPrivacy = process.env.PRIVACY_VERSION;

  beforeAll(async () => {
    const databaseUrl = process.env.DATABASE_URL;

    if (
      !databaseUrl ||
      !/(^|[_-])test($|[_-])/i.test(new URL(databaseUrl).pathname.slice(1))
    ) {
      throw new Error('Se requiere una base MySQL aislada de pruebas para E2E');
    }

    process.env.TERMS_VERSION = legal.termsVersion;

    process.env.PRIVACY_VERSION = legal.privacyVersion;

    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

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

    prisma = app.get(PrismaService);

    const passwordHash = await bcrypt.hash(password, 4);

    for (const [index, role] of roles.entries()) {
      const user = await prisma.user.create({
        data: {
          name: `${role} S5`,
          email: emails[index],
          passwordHash,
          role: {
            connect: {
              name: role,
            },
          },
        },
      });

      userIds[role] = user.id;

      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          email: user.email,
          password,
        })
        .expect(200);

      tokens[role] = response.body.data.accessToken;
    }

    for (const [name, isActive] of [
      [`Z-${suffix}`, true],
      [`A-${suffix}`, true],
      [`Inactive-${suffix}`, false],
    ] as const) {
      const technology = await prisma.technology.create({
        data: {
          name,
          isActive,
          icon: 'test.svg',
        },
      });

      technologyIds.push(technology.id);
    }
  }, 30000);

  afterAll(async () => {
    try {
      if (prisma) {
        await prisma.user.deleteMany({
          where: {
            email: {
              in: [
                ...emails,
                registrationEmail,
                adminCreatedClientEmail,
                superAdminCreatedDeveloperEmail,
              ],
            },
          },
        });

        await prisma.technology.deleteMany({
          where: {
            id: {
              in: technologyIds,
            },
          },
        });
      }
    } finally {
      await app?.close();

      if (previousTerms === undefined) {
        delete process.env.TERMS_VERSION;
      } else {
        process.env.TERMS_VERSION = previousTerms;
      }

      if (previousPrivacy === undefined) {
        delete process.env.PRIVACY_VERSION;
      } else {
        process.env.PRIVACY_VERSION = previousPrivacy;
      }
    }
  });

  const getProfile = (role: string) =>
    request(app.getHttpServer())
      .get('/api/v1/users/me/profile')
      .set('Authorization', `Bearer ${tokens[role]}`);

  const patchUser = (body: object, role = 'CLIENT') =>
    request(app.getHttpServer())
      .patch('/api/v1/users/me')
      .set('Authorization', `Bearer ${tokens[role]}`)
      .send(body);

  const register = (body: object) =>
    request(app.getHttpServer()).post('/api/v1/auth/register').send(body);

  it.each(roles)(
    '%s authenticates, reads, updates, rereads and persists its own profile',
    async (role) => {
      const initial = await getProfile(role).expect(200);

      expect(initial.body.data.user.role).toBe(role);

      expect(initial.body.data.profile).toBeNull();

      const bodies = {
        CLIENT: {
          district: 'Lima Sprint 5',
        },

        DEVELOPER: {
          career: 'Ingeniería',
          technologyIds: [technologyIds[0], technologyIds[0]],
        },

        PRODUCT_OWNER: {
          bio: 'Producto Sprint 5',
        },

        ADMIN: {
          executiveTitle: 'Administración Sprint 5',
        },

        SUPER_ADMIN: {
          executiveTitle: 'Super Administrador Sprint 5',
        },
      };

      const endpoint =
        role === 'SUPER_ADMIN'
          ? '/admin-profile'
          : `/${role.toLowerCase().replaceAll('_', '-')}-profile`;

      const updated = await request(app.getHttpServer())
        .patch(`/api/v1/users/me${endpoint}`)
        .set('Authorization', `Bearer ${tokens[role]}`)
        .send(bodies[role])
        .expect(200);

      const read = await getProfile(role).expect(200);

      expect(read.body.data.profile).toEqual(updated.body.data);

      expect(read.body.data.profile).not.toHaveProperty('userId');

      expect(read.body.data.profile.type).toBe(role);

      const saved = await prisma.user.findUniqueOrThrow({
        where: {
          id: userIds[role],
        },
        include: {
          clientProfile: true,
          developerProfile: {
            include: {
              technologies: true,
            },
          },
          productOwnerProfile: true,
          adminProfile: true,
        },
      });

      if (role === 'CLIENT') {
        expect(saved.clientProfile).toMatchObject(bodies.CLIENT);
      }

      if (role === 'DEVELOPER') {
        expect(saved.developerProfile?.career).toBe(bodies.DEVELOPER.career);

        expect(saved.developerProfile?.technologies).toHaveLength(1);
      }

      if (role === 'PRODUCT_OWNER') {
        expect(saved.productOwnerProfile).toMatchObject(bodies.PRODUCT_OWNER);
      }

      if (role === 'ADMIN') {
        expect(saved.adminProfile).toMatchObject(bodies.ADMIN);
      }

      if (role === 'SUPER_ADMIN') {
        expect(saved.adminProfile).toMatchObject(bodies.SUPER_ADMIN);
      }
    },
  );

  it('ADMIN puede crear un CLIENT mediante alta administrativa', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/users')
      .set('Authorization', `Bearer ${tokens.ADMIN}`)
      .send({
        name: 'Cliente creado por Admin',
        email: adminCreatedClientEmail,
        password,
        role: 'CLIENT',
        ...legal,
      })
      .expect(201);

    expect(response.body.data).toMatchObject({
      name: 'Cliente creado por Admin',
      email: adminCreatedClientEmail,
      role: 'CLIENT',
      isActive: true,
      termsVersion: legal.termsVersion,
      privacyVersion: legal.privacyVersion,
    });

    expect(response.body.data).not.toHaveProperty('passwordHash');

    const saved = await prisma.user.findUniqueOrThrow({
      where: {
        email: adminCreatedClientEmail,
      },
      include: {
        clientProfile: true,
      },
    });

    expect(saved.clientProfile).not.toBeNull();

    expect(saved.termsVersion).toBe(legal.termsVersion);

    expect(saved.privacyVersion).toBe(legal.privacyVersion);

    expect(saved.acceptedTermsAt).toBeInstanceOf(Date);
  });

  it('SUPER_ADMIN puede crear un DEVELOPER mediante alta administrativa', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/users')
      .set('Authorization', `Bearer ${tokens.SUPER_ADMIN}`)
      .send({
        name: 'Developer creado por Super Admin',
        email: superAdminCreatedDeveloperEmail,
        password,
        role: 'DEVELOPER',
        ...legal,
      })
      .expect(201);

    expect(response.body.data).toMatchObject({
      email: superAdminCreatedDeveloperEmail,
      role: 'DEVELOPER',
      termsVersion: legal.termsVersion,
      privacyVersion: legal.privacyVersion,
    });

    const saved = await prisma.user.findUniqueOrThrow({
      where: {
        email: superAdminCreatedDeveloperEmail,
      },
      include: {
        developerProfile: true,
      },
    });

    expect(saved.developerProfile).not.toBeNull();
  });

  it('rechaza alta administrativa sin JWT o con roles no autorizados', async () => {
    const body = {
      name: 'Usuario no autorizado',
      email: `unauthorized-${suffix}@example.test`,
      password,
      role: 'CLIENT',
      ...legal,
    };

    await request(app.getHttpServer())
      .post('/api/v1/users')
      .send(body)
      .expect(401);

    for (const role of ['CLIENT', 'DEVELOPER', 'PRODUCT_OWNER']) {
      await request(app.getHttpServer())
        .post('/api/v1/users')
        .set('Authorization', `Bearer ${tokens[role]}`)
        .send(body)
        .expect(403);
    }
  });

  it('alta administrativa rechaza versiones legales obsoletas', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/users')
      .set('Authorization', `Bearer ${tokens.ADMIN}`)
      .send({
        name: 'Legal inválido',
        email: `invalid-legal-${suffix}@example.test`,
        password,
        role: 'CLIENT',
        acceptedTerms: true,
        termsVersion: 'old',
        privacyVersion: legal.privacyVersion,
      })
      .expect(400);
  });

  it('catalog requires JWT and allows every authenticated role with active UI fields in stable order', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/technologies/catalog')
      .expect(401);

    const expected = await prisma.technology.findMany({
      where: {
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        icon: true,
      },
      orderBy: [
        {
          name: 'asc',
        },
        {
          id: 'asc',
        },
      ],
    });

    for (const role of roles) {
      const response = await request(app.getHttpServer())
        .get('/api/v1/technologies/catalog')
        .set('Authorization', `Bearer ${tokens[role]}`)
        .expect(200);

      expect(response.body.data).toEqual(expected);

      const own = response.body.data.filter((item: { id: number }) =>
        technologyIds.includes(item.id),
      );

      expect(own.map((item: { id: number }) => item.id)).toEqual([
        technologyIds[1],
        technologyIds[0],
      ]);

      for (const item of response.body.data) {
        expect(Object.keys(item).sort()).toEqual(['icon', 'id', 'name']);
      }
    }
  });

  it.each(['category=backend', 'category=', 'isActive=false', 'unknown=1'])(
    'rejects unsupported catalog query %s',
    async (query) => {
      await request(app.getHttpServer())
        .get(`/api/v1/technologies/catalog?${query}`)
        .set('Authorization', `Bearer ${tokens.DEVELOPER}`)
        .expect(400);
    },
  );

  it('keeps the complete administrative technology CRUD protected', async () => {
    for (const role of ['CLIENT', 'DEVELOPER', 'PRODUCT_OWNER']) {
      for (const [method, path] of [
        ['post', ''],
        ['get', ''],
        ['get', `/${technologyIds[0]}`],
        ['patch', `/${technologyIds[0]}`],
      ] as const) {
        await request(app.getHttpServer())
          [method](`/api/v1/technologies${path}`)
          .set('Authorization', `Bearer ${tokens[role]}`)
          .send({})
          .expect(403);
      }
    }

    for (const role of ['ADMIN', 'SUPER_ADMIN']) {
      const created = await request(app.getHttpServer())
        .post('/api/v1/technologies')
        .set('Authorization', `Bearer ${tokens[role]}`)
        .send({
          name: `${role}-${suffix}`,
        })
        .expect(201);

      technologyIds.push(created.body.data.id);

      await request(app.getHttpServer())
        .get('/api/v1/technologies')
        .set('Authorization', `Bearer ${tokens[role]}`)
        .expect(200);

      await request(app.getHttpServer())
        .get(`/api/v1/technologies/${created.body.data.id}`)
        .set('Authorization', `Bearer ${tokens[role]}`)
        .expect(200);

      await request(app.getHttpServer())
        .patch(`/api/v1/technologies/${created.body.data.id}`)
        .set('Authorization', `Bearer ${tokens[role]}`)
        .send({
          isActive: false,
        })
        .expect(200);
    }
  });

  it('aplica RBAC correcto en perfiles y valida DTOs', async () => {
    const superAdminUpdate = await request(app.getHttpServer())
      .patch('/api/v1/users/me/admin-profile')
      .set('Authorization', `Bearer ${tokens.SUPER_ADMIN}`)
      .send({
        executiveTitle: 'Super Administrador E2E',
      })
      .expect(200);

    expect(superAdminUpdate.body.data).toMatchObject({
      type: 'SUPER_ADMIN',
      executiveTitle: 'Super Administrador E2E',
    });

    await request(app.getHttpServer())
      .patch('/api/v1/users/me/developer-profile')
      .set('Authorization', `Bearer ${tokens.CLIENT}`)
      .send({})
      .expect(403);

    await request(app.getHttpServer())
      .patch('/api/v1/users/me/developer-profile')
      .set('Authorization', `Bearer ${tokens.DEVELOPER}`)
      .send({
        githubUrl: 'ftp://example.com',
      })
      .expect(400);

    await patchUser({
      userId: userIds.ADMIN,
      name: 'No permitido',
    }).expect(400);
  });

  it('registration rejects missing, blank, null, stale or unauthorized legal fields without writes', async () => {
    const valid = {
      name: 'Cliente Registro',
      email: registrationEmail,
      password,
      ...legal,
    };

    for (const field of ['termsVersion', 'privacyVersion'] as const) {
      for (const value of [undefined, '', '  ', null, 'old', 'a'.repeat(51)]) {
        await register({
          ...valid,
          [field]: value,
        }).expect(400);

        expect(
          await prisma.user.findUnique({
            where: {
              email: registrationEmail,
            },
          }),
        ).toBeNull();
      }
    }

    await register({
      ...valid,
      acceptedTerms: false,
    }).expect(400);
  });

  it('registration persists the configured legal versions and server timestamp in MySQL', async () => {
    const response = await register({
      name: 'Cliente Registro',
      email: registrationEmail,
      password,
      ...legal,
    }).expect(201);

    const saved = await prisma.user.findUniqueOrThrow({
      where: {
        email: registrationEmail,
      },
    });

    expect(saved.termsVersion).toBe(legal.termsVersion);

    expect(saved.privacyVersion).toBe(legal.privacyVersion);

    expect(saved.acceptedTermsAt?.toISOString()).toBe(
      response.body.data.acceptedTermsAt,
    );

    expect(saved.acceptedTermsAt).toBeInstanceOf(Date);
  });

  it('updates legal acceptance atomically and name-only updates preserve it', async () => {
    await prisma.user.update({
      where: {
        id: userIds.CLIENT,
      },
      data: {
        termsVersion: 'old',
        privacyVersion: 'old',
        acceptedTermsAt: new Date('2020-01-01'),
      },
    });

    const response = await patchUser({
      name: 'Cliente actualizado S5',
      ...legal,
    }).expect(200);

    const saved = await prisma.user.findUniqueOrThrow({
      where: {
        id: userIds.CLIENT,
      },
    });

    expect(saved).toMatchObject({
      name: 'Cliente actualizado S5',
      termsVersion: legal.termsVersion,
      privacyVersion: legal.privacyVersion,
    });

    expect(saved.acceptedTermsAt!.getTime()).toBeGreaterThan(
      new Date('2020-01-01').getTime(),
    );

    expect(response.body.data.acceptedTermsAt).toBe(
      saved.acceptedTermsAt?.toISOString(),
    );

    expect(response.body.data.termsVersion).toBe(legal.termsVersion);

    const read = await getProfile('CLIENT').expect(200);

    expect(read.body.data.user.name).toBe('Cliente actualizado S5');

    await patchUser({
      name: 'Solo nombre S5',
    }).expect(200);

    const renamed = await prisma.user.findUniqueOrThrow({
      where: {
        id: userIds.CLIENT,
      },
    });

    expect(renamed).toMatchObject({
      termsVersion: saved.termsVersion,
      privacyVersion: saved.privacyVersion,
      acceptedTermsAt: saved.acceptedTermsAt,
    });

    // Legal-only renewal also applies to SUPER_ADMIN.
    await patchUser(legal, 'SUPER_ADMIN').expect(200);

    expect(
      await prisma.user.findUniqueOrThrow({
        where: {
          id: userIds.SUPER_ADMIN,
        },
      }),
    ).toMatchObject({
      termsVersion: legal.termsVersion,
      privacyVersion: legal.privacyVersion,
    });
  });

  it('rejects invalid legal updates and preserves every persisted user field', async () => {
    const before = await prisma.user.findUniqueOrThrow({
      where: {
        id: userIds.CLIENT,
      },
    });

    for (const body of [
      {},
      {
        termsVersion: legal.termsVersion,
      },
      {
        privacyVersion: legal.privacyVersion,
      },
      {
        acceptedTerms: true,
      },
      {
        ...legal,
        acceptedTerms: false,
      },
      {
        ...legal,
        termsVersion: null,
      },
      {
        ...legal,
        privacyVersion: '',
      },
      {
        ...legal,
        termsVersion: 'old',
      },
      {
        ...legal,
        privacyVersion: 'old',
      },
    ]) {
      await patchUser(body).expect(400);

      expect(
        await prisma.user.findUniqueOrThrow({
          where: {
            id: userIds.CLIENT,
          },
        }),
      ).toEqual(before);
    }

    await patchUser({
      name: 'No debe persistir',
      ...legal,
      termsVersion: 'old',
    }).expect(400);

    expect(
      await prisma.user.findUniqueOrThrow({
        where: {
          id: userIds.CLIENT,
        },
      }),
    ).toEqual(before);
  });
});

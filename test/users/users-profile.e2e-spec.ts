import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
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
  const technologyCategoryIds: number[] = [];
  const extraEmails: string[] = [];

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

    const document = SwaggerModule.createDocument(
      app,
      new DocumentBuilder().addBearerAuth().build(),
    );
    SwaggerModule.setup('/api/docs', app, document);

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

    const frontendCategory = await prisma.technologyCategory.create({
      data: {
        name: `Frontend-${suffix}`,
        slug: `frontend-${suffix}`,
        description: 'Categoría temporal E2E de frontend',
        isActive: true,
        displayOrder: 1,
      },
    });

    const backendCategory = await prisma.technologyCategory.create({
      data: {
        name: `Backend-${suffix}`,
        slug: `backend-${suffix}`,
        description: 'Categoría temporal E2E de backend',
        isActive: true,
        displayOrder: 2,
      },
    });

    technologyCategoryIds.push(frontendCategory.id, backendCategory.id);

    const technologies = [
      {
        name: `Z-${suffix}`,
        isActive: true,
        icon: 'test.svg',
        categoryId: frontendCategory.id,
      },
      {
        name: `A-${suffix}`,
        isActive: true,
        icon: 'test.svg',
        categoryId: backendCategory.id,
      },
      {
        name: `Legacy-${suffix}`,
        isActive: true,
        icon: 'test.svg',
        categoryId: null,
      },
      {
        name: `Inactive-${suffix}`,
        isActive: false,
        icon: 'test.svg',
        categoryId: frontendCategory.id,
      },
    ];

    for (const data of technologies) {
      const technology = await prisma.technology.create({
        data,
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
                ...extraEmails,
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

        await prisma.technologyCategory.deleteMany({
          where: {
            id: {
              in: technologyCategoryIds,
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

  it('Swagger serves the real routes, legal responses and supported catalog search', async () => {
    await request(app.getHttpServer()).get('/api/docs/').expect(200);
    const response = await request(app.getHttpServer())
      .get('/api/docs-json')
      .expect(200);
    const paths = response.body.paths;
    for (const [method, path] of [
      ['get', '/users/me/profile'],
      ['patch', '/users/me'],
      ['patch', '/users/me/client-profile'],
      ['patch', '/users/me/developer-profile'],
      ['patch', '/users/me/product-owner-profile'],
      ['patch', '/users/me/admin-profile'],
      ['post', '/users'],
      ['get', '/technologies/catalog'],
    ]) {
      expect(paths[`/api/v1${path}`][method].security).toEqual([
        { bearer: [] },
      ]);
    }
    const create = paths['/api/v1/users'].post;
    for (const status of ['201', '400', '401', '403', '409', '503'])
      expect(create.responses[status]).toBeDefined();
    const catalog = paths['/api/v1/technologies/catalog'].get;
    expect(catalog.parameters).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'search',
          required: false,
        }),
        expect.objectContaining({
          name: 'categoryId',
          required: false,
        }),
      ]),
    );
  });

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

  it.each(['termsVersion', 'privacyVersion'])(
    'alta administrativa rechaza %s obsoleta',
    async (field) => {
      await request(app.getHttpServer())
        .post('/api/v1/users')
        .set('Authorization', `Bearer ${tokens.ADMIN}`)
        .send({
          name: 'Legal inválido',
          email: `invalid-legal-${suffix}@example.test`,
          password,
          role: 'CLIENT',
          ...legal,
          [field]: 'old',
        })
        .expect(400);
    },
  );

  it.each([
    ['PRODUCT_OWNER', 'productOwnerProfile'],
    ['ADMIN', 'adminProfile'],
  ] as const)(
    'alta administrativa persiste %s y su perfil',
    async (role, profile) => {
      const email = `${role.toLowerCase()}-created-${suffix}@example.test`;
      extraEmails.push(email);
      const response = await request(app.getHttpServer())
        .post('/api/v1/users')
        .set('Authorization', `Bearer ${tokens.ADMIN}`)
        .send({ name: 'Alta administrativa', email, password, role, ...legal })
        .expect(201);
      const saved = await prisma.user.findUniqueOrThrow({
        where: { email },
        include: {
          role: true,
          clientProfile: true,
          developerProfile: true,
          productOwnerProfile: true,
          adminProfile: true,
        },
      });
      expect(saved.role.name).toBe(role);
      for (const key of [
        'clientProfile',
        'developerProfile',
        'productOwnerProfile',
        'adminProfile',
      ] as const) {
        if (key === profile) expect(saved[key]).not.toBeNull();
        else expect(saved[key]).toBeNull();
      }
      expect(saved.termsVersion).toBe(legal.termsVersion);
      expect(saved.privacyVersion).toBe(legal.privacyVersion);
      expect(saved.acceptedTermsAt?.toISOString()).toBe(
        response.body.data.acceptedTermsAt,
      );
      expect(saved.acceptedTermsAt).toBeInstanceOf(Date);
      expect(await bcrypt.compare(password, saved.passwordHash)).toBe(true);
      expect(response.body.data).not.toHaveProperty('passwordHash');
    },
  );

  it('alta administrativa devuelve 409 por email duplicado sin modificar el usuario', async () => {
    const before = await prisma.user.findUniqueOrThrow({
      where: { id: userIds.CLIENT },
    });
    await request(app.getHttpServer())
      .post('/api/v1/users')
      .set('Authorization', `Bearer ${tokens.ADMIN}`)
      .send({
        name: 'Duplicado',
        email: before.email,
        password,
        role: 'ADMIN',
        ...legal,
      })
      .expect(409);
    expect(
      await prisma.user.findUniqueOrThrow({ where: { id: before.id } }),
    ).toEqual(before);
  });

  it('ningún administrador puede crear SUPER_ADMIN', async () => {
    const email = `forbidden-super-${suffix}@example.test`;
    extraEmails.push(email);
    for (const role of ['ADMIN', 'SUPER_ADMIN']) {
      await request(app.getHttpServer())
        .post('/api/v1/users')
        .set('Authorization', `Bearer ${tokens[role]}`)
        .send({
          name: 'Prohibido',
          email,
          password,
          role: 'SUPER_ADMIN',
          ...legal,
        })
        .expect(400);
    }
    expect(await prisma.user.findUnique({ where: { email } })).toBeNull();
  });

  it.each(['TERMS_VERSION', 'PRIVACY_VERSION'])(
    'sin %s devuelve 503 en alta y renovación sin escrituras',
    async (missingKey) => {
      const config = app.get(ConfigService);
      const originalGet = config.get.bind(config);
      const spy = vi
        .spyOn(config, 'get')
        .mockImplementation((key: string) =>
          key === missingKey ? undefined : originalGet(key),
        );
      const email = `missing-${missingKey}-${suffix}@example.test`;
      extraEmails.push(email);
      const before = await prisma.user.findUniqueOrThrow({
        where: { id: userIds.ADMIN },
      });
      try {
        await request(app.getHttpServer())
          .post('/api/v1/users')
          .set('Authorization', `Bearer ${tokens.ADMIN}`)
          .send({
            name: 'Sin configuración',
            email,
            password,
            role: 'CLIENT',
            ...legal,
          })
          .expect(503);
        await patchUser(legal, 'ADMIN').expect(503);
        expect(await prisma.user.findUnique({ where: { email } })).toBeNull();
        expect(
          await prisma.user.findUniqueOrThrow({ where: { id: before.id } }),
        ).toEqual(before);
      } finally {
        spy.mockRestore();
      }
    },
  );

  it('catalog requires JWT and allows every authenticated role with active category fields in stable order', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/technologies/catalog')
      .expect(401);

    const expectedFromDatabase = await prisma.technology.findMany({
      where: {
        isActive: true,
        id: {
          in: technologyIds,
        },
      },
      select: {
        id: true,
        name: true,
        icon: true,
        categoryId: true,
        category: {
          select: {
            name: true,
          },
        },
        isActive: true,
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

    const expected = expectedFromDatabase.map((technology) => ({
      id: technology.id,
      name: technology.name,
      icon: technology.icon,
      categoryId: technology.categoryId,
      categoryName: technology.category?.name ?? null,
      isActive: technology.isActive,
    }));

    for (const role of roles) {
      const response = await request(app.getHttpServer())
        .get('/api/v1/technologies/catalog')
        .set('Authorization', `Bearer ${tokens[role]}`)
        .expect(200);

      const own = response.body.data.filter((item: { id: number }) =>
        technologyIds.includes(item.id),
      );

      // Other suites create/delete their fixtures concurrently in the same test DB.
      expect(own).toEqual(expected);

      expect(own.map((item: { id: number }) => item.id)).toEqual([
        technologyIds[1],
        technologyIds[2],
        technologyIds[0],
      ]);

      for (const item of response.body.data) {
        expect(item.isActive).toBe(true);
        expect(Object.keys(item).sort()).toEqual([
          'categoryId',
          'categoryName',
          'icon',
          'id',
          'isActive',
          'name',
        ]);
      }

      const legacy = own.find(
        (item: { id: number }) => item.id === technologyIds[2],
      );

      expect(legacy).toMatchObject({
        categoryId: null,
        categoryName: null,
      });
    }
  });

  it.each([
    'category=backend',
    'category=',
    'categoryId=0',
    'categoryId=-1',
    'categoryId=1.5',
    'categoryId=abc',
    'isActive=false',
    'unknown=1',
    'search=' + 'a'.repeat(101),
    'search=one&search=two',
  ])('rejects invalid or unsupported catalog query %s', async (query) => {
    await request(app.getHttpServer())
      .get(`/api/v1/technologies/catalog?${query}`)
      .set('Authorization', `Bearer ${tokens.DEVELOPER}`)
      .expect(400);
  });

  it('catalog search trims, filters active names and returns an empty array without matches', async () => {
    const catalog = (search: string) =>
      request(app.getHttpServer())
        .get('/api/v1/technologies/catalog')
        .set('Authorization', `Bearer ${tokens.CLIENT}`)
        .query({ search });

    const filtered = await catalog(`  ${suffix}  `).expect(200);

    expect(filtered.body.data.map((item: { id: number }) => item.id)).toEqual([
      technologyIds[1],
      technologyIds[2],
      technologyIds[0],
    ]);

    const exact = await catalog(`A-${suffix}`).expect(200);

    expect(exact.body.data).toHaveLength(1);
    expect(exact.body.data[0].id).toBe(technologyIds[1]);

    expect((await catalog(`Inactive-${suffix}`).expect(200)).body.data).toEqual(
      [],
    );

    expect((await catalog(`missing-${suffix}`).expect(200)).body.data).toEqual(
      [],
    );

    const blank = await catalog('   ').expect(200);

    expect(blank.body.data.length).toBeGreaterThanOrEqual(3);

    expect(
      blank.body.data.every((item: { isActive: boolean }) => item.isActive),
    ).toBe(true);
  });

  it('catalog filters active technologies by categoryId', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/technologies/catalog')
      .set('Authorization', `Bearer ${tokens.DEVELOPER}`)
      .query({
        categoryId: technologyCategoryIds[0],
      })
      .expect(200);

    const own = response.body.data.filter((item: { id: number }) =>
      technologyIds.includes(item.id),
    );

    expect(own).toHaveLength(1);

    expect(own[0]).toMatchObject({
      id: technologyIds[0],
      categoryId: technologyCategoryIds[0],
      categoryName: `Frontend-${suffix}`,
      isActive: true,
    });

    expect(
      own.some((item: { id: number }) => item.id === technologyIds[3]),
    ).toBe(false);
  });

  it('catalog combines search and categoryId filters', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/technologies/catalog')
      .set('Authorization', `Bearer ${tokens.CLIENT}`)
      .query({
        search: `Z-${suffix}`,
        categoryId: technologyCategoryIds[0],
      })
      .expect(200);

    expect(response.body.data).toHaveLength(1);

    expect(response.body.data[0]).toMatchObject({
      id: technologyIds[0],
      name: `Z-${suffix}`,
      categoryId: technologyCategoryIds[0],
      categoryName: `Frontend-${suffix}`,
      isActive: true,
    });
  });

  it('catalog returns an empty array when a valid categoryId has no matches', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/technologies/catalog')
      .set('Authorization', `Bearer ${tokens.CLIENT}`)
      .query({
        categoryId: 999999999,
      })
      .expect(200);

    expect(response.body.data).toEqual([]);
  });

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

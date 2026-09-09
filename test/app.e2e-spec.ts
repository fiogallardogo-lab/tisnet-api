import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';

import { AppModule } from './../src/app.module.js';
import { TransformInterceptor } from '../src/common/interceptors/transform/transform.interceptor.js';
import { HttpExceptionFilter } from '../src/common/filters/http-exception/http-exception.filter.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

describe('TISNET API (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  let adminAccessToken: string;
  let adminRefreshToken: string;
  let developerAccessToken: string;

  let createdCategoryId: number;

  const adminEmail = process.env.SEED_ADMIN_EMAIL;
  const adminPassword = process.env.SEED_ADMIN_PASSWORD;
  const developerEmail = process.env.SEED_DEVELOPER_EMAIL;
  const developerPassword = process.env.SEED_DEVELOPER_PASSWORD;

  const adminUser = {
    email: adminEmail ?? '',
    password: adminPassword ?? '',
  };

  const developerUser = {
    email: developerEmail ?? '',
    password: developerPassword ?? '',
  };

  const testCategoryName = `Categoria E2E ${Date.now()}`;

  beforeAll(async () => {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      throw new Error('Falta DATABASE_URL para ejecutar las pruebas E2E.');
    }

    let databaseName: string;
    try {
      databaseName = new URL(databaseUrl).pathname.replace(/^\//, '');
    } catch {
      throw new Error(
        'DATABASE_URL no tiene un formato válido para las pruebas E2E.',
      );
    }

    if (!/(^|[_-])test($|[_-])/i.test(databaseName)) {
      throw new Error(
        `E2E cancelado: la base "${databaseName}" no parece una base aislada de pruebas.`,
      );
    }

    if (!adminEmail || !adminPassword) {
      throw new Error(
        'Faltan variables de entorno para E2E: SEED_ADMIN_EMAIL y/o SEED_ADMIN_PASSWORD no están definidas.',
      );
    }
    if (!developerEmail || !developerPassword) {
      throw new Error(
        'Faltan variables de entorno para E2E: SEED_DEVELOPER_EMAIL y/o SEED_DEVELOPER_PASSWORD no están definidas.',
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
      }),
    );

    app.useGlobalInterceptors(new TransformInterceptor());
    app.useGlobalFilters(new HttpExceptionFilter());

    await app.init();
    prisma = app.get(PrismaService);
  });

  describe('Authentication', () => {
    describe('POST /api/v1/auth/login', () => {
      it('debe rechazar credenciales inválidas con 401', async () => {
        const response = await request(app.getHttpServer())
          .post('/api/v1/auth/login')
          .send({
            email: adminUser.email,
            password: 'ContraseñaIncorrecta123!',
          })
          .expect(401);

        expect(response.body.success).toBe(false);
        expect(response.body.message).toBe('Credenciales inválidas');
      });

      it('debe iniciar sesión como SUPER_ADMIN', async () => {
        const response = await request(app.getHttpServer())
          .post('/api/v1/auth/login')
          .send(adminUser)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data).toBeDefined();

        expect(response.body.data.accessToken).toBeDefined();
        expect(response.body.data.refreshToken).toBeDefined();

        expect(response.body.data.user).toBeDefined();
        expect(response.body.data.user.email).toBe(adminUser.email);

        adminAccessToken = response.body.data.accessToken;
        adminRefreshToken = response.body.data.refreshToken;
      });

      it('debe iniciar sesión como DEVELOPER', async () => {
        const response = await request(app.getHttpServer())
          .post('/api/v1/auth/login')
          .send(developerUser)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.accessToken).toBeDefined();

        developerAccessToken = response.body.data.accessToken;
      });
    });

    describe('GET /api/v1/auth/me', () => {
      it('debe rechazar solicitudes sin token con 401', async () => {
        const response = await request(app.getHttpServer())
          .get('/api/v1/auth/me')
          .expect(401);

        expect(response.body.success).toBe(false);
      });

      it('debe devolver el SUPER_ADMIN autenticado', async () => {
        expect(adminAccessToken).toBeDefined();

        const response = await request(app.getHttpServer())
          .get('/api/v1/auth/me')
          .set('Authorization', `Bearer ${adminAccessToken}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data).toBeDefined();

        expect(response.body.data.email).toBe(adminUser.email);
        expect(response.body.data.role).toBe('SUPER_ADMIN');
      });

      it('debe devolver el DEVELOPER autenticado', async () => {
        expect(developerAccessToken).toBeDefined();

        const response = await request(app.getHttpServer())
          .get('/api/v1/auth/me')
          .set('Authorization', `Bearer ${developerAccessToken}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.email).toBe(developerUser.email);
        expect(response.body.data.role).toBe('DEVELOPER');
      });
    });

    describe('POST /api/v1/auth/refresh', () => {
      it('debe rechazar un body vacío con 400', async () => {
        const response = await request(app.getHttpServer())
          .post('/api/v1/auth/refresh')
          .send({})
          .expect(400);

        expect(response.body.success).toBe(false);
      });

      it('debe generar un nuevo access token con refresh token válido', async () => {
        expect(adminRefreshToken).toBeDefined();

        const response = await request(app.getHttpServer())
          .post('/api/v1/auth/refresh')
          .send({
            refreshToken: adminRefreshToken,
          })
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data).toBeDefined();
        expect(response.body.data.accessToken).toBeDefined();

        adminAccessToken = response.body.data.accessToken;
      });
    });

    describe('Revocación de tokens (logout real)', () => {
      it('PRUEBA A — access token queda inválido tras logout', async () => {
        // 1. Login independiente
        const loginRes = await request(app.getHttpServer())
          .post('/api/v1/auth/login')
          .send(adminUser)
          .expect(200);

        const token = loginRes.body.data.accessToken as string;

        // 2. El token es válido antes del logout
        await request(app.getHttpServer())
          .get('/api/v1/auth/me')
          .set('Authorization', `Bearer ${token}`)
          .expect(200);

        // 3. Logout — invalida tokenVersion en BD
        await request(app.getHttpServer())
          .post('/api/v1/auth/logout')
          .set('Authorization', `Bearer ${token}`)
          .expect(200);

        // 4. El mismo token ahora debe ser rechazado con 401
        const meRes = await request(app.getHttpServer())
          .get('/api/v1/auth/me')
          .set('Authorization', `Bearer ${token}`)
          .expect(401);

        expect(meRes.body.success).toBe(false);

        // 5. Restaurar adminAccessToken con un nuevo login para los demás tests
        const newLogin = await request(app.getHttpServer())
          .post('/api/v1/auth/login')
          .send(adminUser)
          .expect(200);
        adminAccessToken = newLogin.body.data.accessToken;
      });

      it('PRUEBA B — refresh token queda inválido tras logout', async () => {
        // 1. Login independiente
        const loginRes = await request(app.getHttpServer())
          .post('/api/v1/auth/login')
          .send(adminUser)
          .expect(200);

        const token = loginRes.body.data.accessToken as string;
        const rToken = loginRes.body.data.refreshToken as string;

        // 2. Logout con el access token
        await request(app.getHttpServer())
          .post('/api/v1/auth/logout')
          .set('Authorization', `Bearer ${token}`)
          .expect(200);

        // 3. El refresh token anterior debe ser rechazado con 401
        const refreshRes = await request(app.getHttpServer())
          .post('/api/v1/auth/refresh')
          .send({ refreshToken: rToken })
          .expect(401);

        expect(refreshRes.body.success).toBe(false);

        // 4. Restaurar adminAccessToken con un nuevo login para los demás tests
        const newLogin = await request(app.getHttpServer())
          .post('/api/v1/auth/login')
          .send(adminUser)
          .expect(200);
        adminAccessToken = newLogin.body.data.accessToken;
      });
    });
  });

  describe('Categories', () => {
    describe('RBAC', () => {
      it('debe rechazar GET /categories sin token con 401', async () => {
        const response = await request(app.getHttpServer())
          .get('/api/v1/categories')
          .expect(401);

        expect(response.body.success).toBe(false);
      });

      it('debe rechazar a DEVELOPER con 403', async () => {
        expect(developerAccessToken).toBeDefined();

        const response = await request(app.getHttpServer())
          .get('/api/v1/categories')
          .set('Authorization', `Bearer ${developerAccessToken}`)
          .expect(403);

        expect(response.body.success).toBe(false);
        expect(response.body.message).toBe('No tienes permisos suficientes');
      });

      it('debe permitir a SUPER_ADMIN listar categorías', async () => {
        expect(adminAccessToken).toBeDefined();

        const response = await request(app.getHttpServer())
          .get('/api/v1/categories')
          .set('Authorization', `Bearer ${adminAccessToken}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(Array.isArray(response.body.data)).toBe(true);
      });
    });

    describe('POST /api/v1/categories', () => {
      it('debe rechazar un nombre vacío con 400', async () => {
        const response = await request(app.getHttpServer())
          .post('/api/v1/categories')
          .set('Authorization', `Bearer ${adminAccessToken}`)
          .send({
            name: '',
          })
          .expect(400);

        expect(response.body.success).toBe(false);
      });

      it('debe crear una categoría con SUPER_ADMIN', async () => {
        const response = await request(app.getHttpServer())
          .post('/api/v1/categories')
          .set('Authorization', `Bearer ${adminAccessToken}`)
          .send({
            name: testCategoryName,
            description: 'Categoría creada automáticamente por e2e',
            isActive: true,
          })
          .expect(201);

        expect(response.body.success).toBe(true);
        expect(response.body.data).toBeDefined();

        expect(response.body.data.name).toBe(testCategoryName);
        expect(response.body.data.description).toBe(
          'Categoría creada automáticamente por e2e',
        );
        expect(response.body.data.isActive).toBe(true);

        createdCategoryId = response.body.data.id;

        expect(createdCategoryId).toBeDefined();
      });

      it('debe rechazar una categoría duplicada con 409', async () => {
        const response = await request(app.getHttpServer())
          .post('/api/v1/categories')
          .set('Authorization', `Bearer ${adminAccessToken}`)
          .send({
            name: testCategoryName,
            description: 'Intento duplicado',
            isActive: true,
          })
          .expect(409);

        expect(response.body.success).toBe(false);
        expect(response.body.message).toBe('La categoría ya existe');
      });
    });

    describe('GET /api/v1/categories', () => {
      it('debe listar las categorías', async () => {
        const response = await request(app.getHttpServer())
          .get('/api/v1/categories')
          .set('Authorization', `Bearer ${adminAccessToken}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(Array.isArray(response.body.data)).toBe(true);

        const category = response.body.data.find(
          (item: { id: number }) => item.id === createdCategoryId,
        );

        expect(category).toBeDefined();
        expect(category.name).toBe(testCategoryName);
      });
    });

    describe('GET /api/v1/categories/:id', () => {
      it('debe devolver una categoría existente', async () => {
        expect(createdCategoryId).toBeDefined();

        const response = await request(app.getHttpServer())
          .get(`/api/v1/categories/${createdCategoryId}`)
          .set('Authorization', `Bearer ${adminAccessToken}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.id).toBe(createdCategoryId);
        expect(response.body.data.name).toBe(testCategoryName);
      });

      it('debe devolver 404 para una categoría inexistente', async () => {
        const response = await request(app.getHttpServer())
          .get('/api/v1/categories/999999')
          .set('Authorization', `Bearer ${adminAccessToken}`)
          .expect(404);

        expect(response.body.success).toBe(false);
        expect(response.body.message).toBe('Categoría no encontrada');
      });
    });

    describe('PATCH /api/v1/categories/:id', () => {
      it('debe actualizar una categoría existente', async () => {
        expect(createdCategoryId).toBeDefined();

        const response = await request(app.getHttpServer())
          .patch(`/api/v1/categories/${createdCategoryId}`)
          .set('Authorization', `Bearer ${adminAccessToken}`)
          .send({
            description: 'Categoría actualizada mediante e2e',
          })
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.id).toBe(createdCategoryId);
        expect(response.body.data.description).toBe(
          'Categoría actualizada mediante e2e',
        );
      });

      it('debe devolver 404 al actualizar una categoría inexistente', async () => {
        const response = await request(app.getHttpServer())
          .patch('/api/v1/categories/999999')
          .set('Authorization', `Bearer ${adminAccessToken}`)
          .send({
            description: 'No debería actualizarse',
          })
          .expect(404);

        expect(response.body.success).toBe(false);
        expect(response.body.message).toBe('Categoría no encontrada');
      });
    });
  });

  describe('Technologies', () => {
    let createdTechnologyId: number;
    const testTechnologyName = `Tecnologia E2E ${Date.now()}`;

    describe('RBAC', () => {
      it('debe rechazar POST /technologies sin token con 401', async () => {
        const response = await request(app.getHttpServer())
          .post('/api/v1/technologies')
          .send({ name: testTechnologyName })
          .expect(401);

        expect(response.body.success).toBe(false);
      });

      it('debe rechazar GET /technologies con DEVELOPER con 403', async () => {
        expect(developerAccessToken).toBeDefined();

        const response = await request(app.getHttpServer())
          .get('/api/v1/technologies')
          .set('Authorization', `Bearer ${developerAccessToken}`)
          .expect(403);

        expect(response.body.success).toBe(false);
        expect(response.body.message).toBe('No tienes permisos suficientes');
      });

      it('debe permitir a SUPER_ADMIN listar tecnologías', async () => {
        expect(adminAccessToken).toBeDefined();

        const response = await request(app.getHttpServer())
          .get('/api/v1/technologies')
          .set('Authorization', `Bearer ${adminAccessToken}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(Array.isArray(response.body.data)).toBe(true);
      });
    });

    describe('POST /api/v1/technologies', () => {
      it('debe rechazar un nombre vacío con 400', async () => {
        const response = await request(app.getHttpServer())
          .post('/api/v1/technologies')
          .set('Authorization', `Bearer ${adminAccessToken}`)
          .send({ name: '' })
          .expect(400);

        expect(response.body.success).toBe(false);
      });

      it('debe crear una tecnología con SUPER_ADMIN', async () => {
        const response = await request(app.getHttpServer())
          .post('/api/v1/technologies')
          .set('Authorization', `Bearer ${adminAccessToken}`)
          .send({
            name: testTechnologyName,
            description: 'Tecnología creada automáticamente por e2e',
            icon: 'tech-icon.svg',
            isActive: true,
          })
          .expect(201);

        expect(response.body.success).toBe(true);
        expect(response.body.data).toBeDefined();
        expect(response.body.data.name).toBe(testTechnologyName);
        expect(response.body.data.description).toBe(
          'Tecnología creada automáticamente por e2e',
        );
        expect(response.body.data.icon).toBe('tech-icon.svg');
        expect(response.body.data.isActive).toBe(true);

        createdTechnologyId = response.body.data.id;
        expect(createdTechnologyId).toBeDefined();
      });

      it('debe rechazar una tecnología duplicada con 409', async () => {
        const response = await request(app.getHttpServer())
          .post('/api/v1/technologies')
          .set('Authorization', `Bearer ${adminAccessToken}`)
          .send({
            name: testTechnologyName,
            description: 'Intento duplicado',
          })
          .expect(409);

        expect(response.body.success).toBe(false);
        expect(response.body.message).toBe('La tecnología ya existe');
      });
    });

    describe('GET /api/v1/technologies', () => {
      it('debe listar las tecnologías', async () => {
        const response = await request(app.getHttpServer())
          .get('/api/v1/technologies')
          .set('Authorization', `Bearer ${adminAccessToken}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(Array.isArray(response.body.data)).toBe(true);

        const technology = response.body.data.find(
          (item: { id: number }) => item.id === createdTechnologyId,
        );

        expect(technology).toBeDefined();
        expect(technology.name).toBe(testTechnologyName);
      });
    });

    describe('GET /api/v1/technologies/:id', () => {
      it('debe devolver una tecnología existente', async () => {
        expect(createdTechnologyId).toBeDefined();

        const response = await request(app.getHttpServer())
          .get(`/api/v1/technologies/${createdTechnologyId}`)
          .set('Authorization', `Bearer ${adminAccessToken}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.id).toBe(createdTechnologyId);
        expect(response.body.data.name).toBe(testTechnologyName);
      });

      it('debe devolver 404 para una tecnología inexistente', async () => {
        const response = await request(app.getHttpServer())
          .get('/api/v1/technologies/999999')
          .set('Authorization', `Bearer ${adminAccessToken}`)
          .expect(404);

        expect(response.body.success).toBe(false);
        expect(response.body.message).toBe('Tecnología no encontrada');
      });
    });

    describe('PATCH /api/v1/technologies/:id', () => {
      it('debe actualizar una tecnología existente', async () => {
        expect(createdTechnologyId).toBeDefined();

        const response = await request(app.getHttpServer())
          .patch(`/api/v1/technologies/${createdTechnologyId}`)
          .set('Authorization', `Bearer ${adminAccessToken}`)
          .send({
            description: 'Tecnología actualizada mediante e2e',
          })
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.id).toBe(createdTechnologyId);
        expect(response.body.data.description).toBe(
          'Tecnología actualizada mediante e2e',
        );
      });

      it('debe devolver 404 al actualizar una tecnología inexistente', async () => {
        const response = await request(app.getHttpServer())
          .patch('/api/v1/technologies/999999')
          .set('Authorization', `Bearer ${adminAccessToken}`)
          .send({
            description: 'No debería actualizarse',
          })
          .expect(404);

        expect(response.body.success).toBe(false);
        expect(response.body.message).toBe('Tecnología no encontrada');
      });
    });
  });

  describe('Projects Lifecycle (E2E)', () => {
    let projectCategoryId: number;
    let inactiveCategoryId: number;
    let projectTechnologyId: number;
    let inactiveTechnologyId: number;

    let createdProjectId: number;
    const projectSlug = `proyecto-e2e-${Date.now()}`;
    const projectName = `Proyecto E2E ${Date.now()}`;

    beforeAll(async () => {
      // 1. Crear categoría activa para pruebas de proyectos
      const activeCategoryRes = await request(app.getHttpServer())
        .post('/api/v1/categories')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send({
          name: `Cat Proyecto ${Date.now()}`,
          description: 'Categoría activa para proyectos E2E',
          isActive: true,
        })
        .expect(201);
      projectCategoryId = activeCategoryRes.body.data.id;

      // 2. Crear categoría inactiva para validar rechazos
      const inactiveCategoryRes = await request(app.getHttpServer())
        .post('/api/v1/categories')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send({
          name: `Cat Inactiva ${Date.now()}`,
          description: 'Categoría inactiva para validación E2E',
          isActive: false,
        })
        .expect(201);
      inactiveCategoryId = inactiveCategoryRes.body.data.id;

      // 3. Crear tecnología activa para proyectos
      const activeTechRes = await request(app.getHttpServer())
        .post('/api/v1/technologies')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send({
          name: `Tech Proyecto ${Date.now()}`,
          description: 'Tecnología activa para proyectos E2E',
          icon: 'tech-e2e.svg',
          isActive: true,
        })
        .expect(201);
      projectTechnologyId = activeTechRes.body.data.id;

      // 4. Crear tecnología inactiva para validar rechazos
      const inactiveTechRes = await request(app.getHttpServer())
        .post('/api/v1/technologies')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send({
          name: `Tech Inactiva ${Date.now()}`,
          description: 'Tecnología inactiva para validación E2E',
          icon: 'tech-inactive.svg',
          isActive: false,
        })
        .expect(201);
      inactiveTechnologyId = inactiveTechRes.body.data.id;
    });

    describe('Seguridad y RBAC', () => {
      it('debe rechazar GET /api/v1/projects sin token con 401', async () => {
        const response = await request(app.getHttpServer())
          .get('/api/v1/projects')
          .expect(401);

        expect(response.body.success).toBe(false);
      });

      it('debe rechazar POST /api/v1/projects sin token con 401', async () => {
        const response = await request(app.getHttpServer())
          .post('/api/v1/projects')
          .send({ name: 'Proyecto no autorizado' })
          .expect(401);

        expect(response.body.success).toBe(false);
      });

      it('debe rechazar acceso de DEVELOPER a GET /api/v1/projects con 403', async () => {
        expect(developerAccessToken).toBeDefined();

        const response = await request(app.getHttpServer())
          .get('/api/v1/projects')
          .set('Authorization', `Bearer ${developerAccessToken}`)
          .expect(403);

        expect(response.body.success).toBe(false);
        expect(response.body.message).toBe('No tienes permisos suficientes');
      });

      it('debe rechazar creación de proyecto con DEVELOPER con 403', async () => {
        expect(developerAccessToken).toBeDefined();

        const response = await request(app.getHttpServer())
          .post('/api/v1/projects')
          .set('Authorization', `Bearer ${developerAccessToken}`)
          .send({
            name: 'Proyecto Developer Denegado',
            slug: `dev-denegado-${Date.now()}`,
            shortDescription: 'Descripción breve de intento no autorizado.',
            description: 'Descripción completa de intento no autorizado.',
            categoryId: projectCategoryId,
          })
          .expect(403);

        expect(response.body.success).toBe(false);
        expect(response.body.message).toBe('No tienes permisos suficientes');
      });
    });

    describe('Creación y Validaciones de Proyecto', () => {
      it('debe rechazar proyecto con payload inválido con 400', async () => {
        const response = await request(app.getHttpServer())
          .post('/api/v1/projects')
          .set('Authorization', `Bearer ${adminAccessToken}`)
          .send({
            name: '',
          })
          .expect(400);

        expect(response.body.success).toBe(false);
      });

      it('debe rechazar creación con categoría inactiva con 400', async () => {
        const response = await request(app.getHttpServer())
          .post('/api/v1/projects')
          .set('Authorization', `Bearer ${adminAccessToken}`)
          .send({
            name: 'Proyecto Categoría Inactiva',
            slug: `cat-inactiva-${Date.now()}`,
            shortDescription:
              'Descripción breve para validación de categoría inactiva.',
            description:
              'Descripción completa para validación de categoría inactiva en E2E.',
            categoryId: inactiveCategoryId,
          })
          .expect(400);

        expect(response.body.success).toBe(false);
        expect(response.body.message).toBe(
          'La categoría no existe o está inactiva',
        );
      });

      it('debe rechazar creación con tecnología inactiva con 400', async () => {
        const response = await request(app.getHttpServer())
          .post('/api/v1/projects')
          .set('Authorization', `Bearer ${adminAccessToken}`)
          .send({
            name: 'Proyecto Tecnología Inactiva',
            slug: `tech-inactiva-${Date.now()}`,
            shortDescription:
              'Descripción breve para validación de tecnología inactiva.',
            description:
              'Descripción completa para validación de tecnología inactiva en E2E.',
            categoryId: projectCategoryId,
            technologyIds: [inactiveTechnologyId],
          })
          .expect(400);

        expect(response.body.success).toBe(false);
        expect(response.body.message).toBe(
          'Una o más tecnologías no existen o están inactivas',
        );
      });

      it('debe rechazar creación con tecnología inexistente con 400', async () => {
        const response = await request(app.getHttpServer())
          .post('/api/v1/projects')
          .set('Authorization', `Bearer ${adminAccessToken}`)
          .send({
            name: 'Proyecto Tecnología Inexistente',
            slug: `tech-inexistente-${Date.now()}`,
            shortDescription:
              'Descripción breve para validación de tecnología inexistente.',
            description:
              'Descripción completa para validación de tecnología inexistente en E2E.',
            categoryId: projectCategoryId,
            technologyIds: [999999],
          })
          .expect(400);

        expect(response.body.success).toBe(false);
        expect(response.body.message).toBe(
          'Una o más tecnologías no existen o están inactivas',
        );
      });

      it('debe crear un proyecto válido en estado DRAFT e isPublished false', async () => {
        const response = await request(app.getHttpServer())
          .post('/api/v1/projects')
          .set('Authorization', `Bearer ${adminAccessToken}`)
          .send({
            name: projectName,
            slug: projectSlug,
            shortDescription: 'Plataforma centralizada creada en prueba E2E.',
            description:
              'Descripción pública completa del proyecto para validación de ciclo de vida E2E.',
            problem: 'Problema de prueba E2E.',
            solution: 'Solución de prueba E2E.',
            objective: 'Objetivo de prueba E2E.',
            features: ['Característica 1 E2E', 'Característica 2 E2E'],
            categoryId: projectCategoryId,
            technologyIds: [projectTechnologyId],
            developmentDate: '2026-09-08',
            clientName: 'Cliente Privado E2E',
            demoUrl: 'https://demo.e2e.tisnet.test',
            externalUrl: 'https://github.com/tisnet-lab/e2e-project',
            coverImageUrl: 'https://cdn.tisnet.test/e2e-cover.webp',
            isFeatured: true,
            displayOrder: 1,
          })
          .expect(201);

        expect(response.body.success).toBe(true);
        expect(response.body.data).toBeDefined();

        createdProjectId = response.body.data.id;
        expect(createdProjectId).toBeDefined();
        expect(response.body.data.name).toBe(projectName);
        expect(response.body.data.slug).toBe(projectSlug);
        expect(response.body.data.status).toBe('DRAFT');
        expect(response.body.data.isPublished).toBe(false);
        expect(response.body.data.isFeatured).toBe(true);
        expect(response.body.data.category.id).toBe(projectCategoryId);
        expect(response.body.data.technologies[0].id).toBe(projectTechnologyId);
      });

      it('debe rechazar la creación de un proyecto con slug duplicado con 409', async () => {
        const response = await request(app.getHttpServer())
          .post('/api/v1/projects')
          .set('Authorization', `Bearer ${adminAccessToken}`)
          .send({
            name: `${projectName} Duplicado`,
            slug: projectSlug,
            shortDescription: 'Intento de registro con slug repetido.',
            description: 'Descripción completa para intento duplicado.',
            categoryId: projectCategoryId,
          })
          .expect(409);

        expect(response.body.success).toBe(false);
        expect(response.body.message).toBe('El slug ya está registrado');
      });
    });

    describe('Consultas Administrativas y Edición', () => {
      it('debe listar proyectos administrativos incluyendo el proyecto borrador', async () => {
        const response = await request(app.getHttpServer())
          .get(`/api/v1/projects?search=${encodeURIComponent(projectSlug)}`)
          .set('Authorization', `Bearer ${adminAccessToken}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.items).toBeDefined();

        const foundProject = response.body.data.items.find(
          (item: { id: number }) => item.id === createdProjectId,
        );

        expect(foundProject).toBeDefined();
        expect(foundProject.slug).toBe(projectSlug);
      });

      it('debe consultar el detalle administrativo por ID', async () => {
        const response = await request(app.getHttpServer())
          .get(`/api/v1/projects/${createdProjectId}`)
          .set('Authorization', `Bearer ${adminAccessToken}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.id).toBe(createdProjectId);
        expect(response.body.data.clientName).toBe('Cliente Privado E2E');
      });

      it('debe editar un proyecto administrativo con PATCH /projects/:id', async () => {
        const response = await request(app.getHttpServer())
          .patch(`/api/v1/projects/${createdProjectId}`)
          .set('Authorization', `Bearer ${adminAccessToken}`)
          .send({
            shortDescription: 'Descripción breve actualizada durante E2E.',
          })
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.shortDescription).toBe(
          'Descripción breve actualizada durante E2E.',
        );
      });
    });

    describe('Privacidad Pública de Borradores', () => {
      it('no debe mostrar el proyecto borrador en el listado público', async () => {
        const response = await request(app.getHttpServer())
          .get(
            `/api/v1/public/projects?search=${encodeURIComponent(projectName)}`,
          )
          .expect(200);

        expect(response.body.success).toBe(true);
        const found = response.body.data.items.find(
          (item: { id: number }) => item.id === createdProjectId,
        );
        expect(found).toBeUndefined();
      });

      it('debe responder 404 en el detalle público para el proyecto borrador', async () => {
        const response = await request(app.getHttpServer())
          .get(`/api/v1/public/projects/${projectSlug}`)
          .expect(404);

        expect(response.body.success).toBe(false);
        expect(response.body.message).toBe('Proyecto no encontrado');
      });
    });

    describe('Publicación y Visibilidad Pública', () => {
      it('debe publicar el proyecto con PATCH /projects/:id/publish', async () => {
        const response = await request(app.getHttpServer())
          .patch(`/api/v1/projects/${createdProjectId}/publish`)
          .set('Authorization', `Bearer ${adminAccessToken}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.id).toBe(createdProjectId);
        expect(response.body.data.isPublished).toBe(true);
      });

      it('debe mostrar el proyecto publicado en el listado público', async () => {
        const response = await request(app.getHttpServer())
          .get(
            `/api/v1/public/projects?search=${encodeURIComponent(projectName)}`,
          )
          .expect(200);

        expect(response.body.success).toBe(true);
        const found = response.body.data.items.find(
          (item: { id: number }) => item.id === createdProjectId,
        );
        expect(found).toBeDefined();
        expect(found.slug).toBe(projectSlug);
        expect(found).not.toHaveProperty('clientName');
        expect(found).not.toHaveProperty('status');
        expect(found).not.toHaveProperty('isPublished');
        expect(found).not.toHaveProperty('createdAt');
        expect(found).not.toHaveProperty('updatedAt');
      });

      it('debe mostrar el detalle público por slug omitiendo campos internos', async () => {
        const response = await request(app.getHttpServer())
          .get(`/api/v1/public/projects/${projectSlug}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.id).toBe(createdProjectId);
        expect(response.body.data.slug).toBe(projectSlug);
        expect(response.body.data.name).toBe(projectName);
        expect(response.body.data).not.toHaveProperty('clientName');
        expect(response.body.data).not.toHaveProperty('status');
        expect(response.body.data).not.toHaveProperty('isPublished');
        expect(response.body.data).not.toHaveProperty('createdAt');
        expect(response.body.data).not.toHaveProperty('updatedAt');
      });
    });

    describe('Despublicación', () => {
      it('debe despublicar el proyecto con PATCH /projects/:id/unpublish', async () => {
        const response = await request(app.getHttpServer())
          .patch(`/api/v1/projects/${createdProjectId}/unpublish`)
          .set('Authorization', `Bearer ${adminAccessToken}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.isPublished).toBe(false);
      });

      it('debe responder 404 en el detalle público tras despublicar', async () => {
        const response = await request(app.getHttpServer())
          .get(`/api/v1/public/projects/${projectSlug}`)
          .expect(404);

        expect(response.body.success).toBe(false);
        expect(response.body.message).toBe('Proyecto no encontrado');
      });

      it('no debe mostrar el proyecto despublicado en el listado público', async () => {
        const response = await request(app.getHttpServer())
          .get(
            `/api/v1/public/projects?search=${encodeURIComponent(projectName)}`,
          )
          .expect(200);

        expect(response.body.success).toBe(true);
        const found = response.body.data.items.find(
          (item: { id: number }) => item.id === createdProjectId,
        );
        expect(found).toBeUndefined();
      });
    });

    describe('Archivado Lógico y Restricciones', () => {
      it('debe archivar el proyecto con PATCH /projects/:id/archive', async () => {
        const response = await request(app.getHttpServer())
          .patch(`/api/v1/projects/${createdProjectId}/archive`)
          .set('Authorization', `Bearer ${adminAccessToken}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.status).toBe('ARCHIVED');
        expect(response.body.data.isPublished).toBe(false);
      });

      it('no debe mostrar el proyecto archivado en el detalle público (404)', async () => {
        const response = await request(app.getHttpServer())
          .get(`/api/v1/public/projects/${projectSlug}`)
          .expect(404);

        expect(response.body.success).toBe(false);
        expect(response.body.message).toBe('Proyecto no encontrado');
      });

      it('debe rechazar la publicación de un proyecto archivado con 400', async () => {
        const response = await request(app.getHttpServer())
          .patch(`/api/v1/projects/${createdProjectId}/publish`)
          .set('Authorization', `Bearer ${adminAccessToken}`)
          .expect(400);

        expect(response.body.success).toBe(false);
        expect(response.body.message).toBe(
          'Un proyecto archivado no puede publicarse',
        );
      });
    });
  });

  describe('Logout', () => {
    it('debe permitir cerrar sesión a un usuario autenticado', async () => {
      expect(adminAccessToken).toBeDefined();

      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/logout')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Sesión cerrada correctamente');
    });
  });

  afterAll(async () => {
    if (prisma) {
      await prisma.project.deleteMany({
        where: { slug: { startsWith: 'proyecto-e2e-' } },
      });
      await prisma.category.deleteMany({
        where: {
          OR: [
            { name: { startsWith: 'Categoria E2E ' } },
            { name: { startsWith: 'Cat Proyecto ' } },
            { name: { startsWith: 'Cat Inactiva ' } },
          ],
        },
      });
      await prisma.technology.deleteMany({
        where: {
          OR: [
            { name: { startsWith: 'Tecnologia E2E ' } },
            { name: { startsWith: 'Tech Proyecto ' } },
            { name: { startsWith: 'Tech Inactiva ' } },
          ],
        },
      });
    }
    if (app) {
      await app.close();
    }
  });
});

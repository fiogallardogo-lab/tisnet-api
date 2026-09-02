import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';

import { AppModule } from './../src/app.module.js';
import { TransformInterceptor } from '../src/common/interceptors/transform/transform.interceptor.js';
import { HttpExceptionFilter } from '../src/common/filters/http-exception/http-exception.filter.js';

describe('TISNET API (e2e)', () => {
  let app: INestApplication<App>;

  let adminAccessToken: string;
  let adminRefreshToken: string;
  let developerAccessToken: string;

  let createdCategoryId: number;

  const adminUser = {
    email: 'admin@tisnet.test',
    password: 'Test1234!',
  };

  const developerUser = {
    email: 'developer@tisnet.test',
    password: 'DevTest1234!',
  };

  const testCategoryName = `Categoria E2E ${Date.now()}`;

  beforeAll(async () => {
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
        expect(response.body.message).toBe(
          'No tienes permisos suficientes',
        );
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
    await app.close();
  });
});
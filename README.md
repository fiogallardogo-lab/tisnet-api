# TISNET API

API REST del portal público y panel privado de TISNET. Utiliza NestJS, Prisma y MySQL bajo el prefijo `/api/v1`.

## Requisitos

- Node.js 24
- npm
- MySQL 8 o Docker Compose

## Configuración local

```bash
npm ci
copy .env.example .env
npm run prisma:generate
npm run prisma:migrate
npm run prisma:seed
npm run start:dev
```

Reemplaza primero los valores `change_me_*` de `.env`. Nunca publiques ese archivo.

- API: `http://localhost:3000/api/v1`
- Swagger: `http://localhost:3000/api/docs`
- Frontend permitido por defecto: `http://localhost:5173`

## Autenticación

| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| POST | `/api/v1/auth/login` | No | Devuelve tokens y usuario |
| POST | `/api/v1/auth/refresh` | No | Recibe `refreshToken` en JSON |
| GET | `/api/v1/auth/me` | Bearer | Devuelve el usuario actual |
| POST | `/api/v1/auth/logout` | Bearer | Invalida los tokens anteriores |

Las respuestas exitosas usan:

```json
{
  "success": true,
  "message": "Operación realizada correctamente",
  "data": {}
}
```

Los errores usan `{ "success": false, "message": "...", "error": "..." }`. En errores de validación, `message` puede ser una lista.

El access token se envía como `Authorization: Bearer <token>`. El refresh token viaja en el body; actualmente no usa cookies ni rotación. Logout incrementa `tokenVersion`, por lo que cierra todas las sesiones previas del usuario.

## Docker

```bash
copy .env.example .env
docker compose up --build
```

MySQL se expone localmente en `3307` y la API en `3000`. El contenedor aplica las migraciones antes de iniciar.

## Calidad

```bash
npm run lint
npm run build
npm run test
npm run test:e2e
npm run test:cov
```

Los e2e requieren una base MySQL exclusiva para pruebas y los usuarios generados con `npm run prisma:seed`.

## Variables principales

Consulta `.env.example`. Las variables esenciales son `DATABASE_URL`, secretos y duraciones JWT, `FRONTEND_URL`, `PORT` y las variables `SEED_*` para usuarios locales.

Nunca publiques secretos, contraseñas reales ni tokens activos.

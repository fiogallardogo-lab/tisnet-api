# TISNET - Contrato API de usuarios y perfiles

Versión: 1.1 - Sprint 5, Backend 1, partes 1 y 2

Fecha: 21/09/2026

Implementación: `feature/s5-users-profiles-api`. Se conserva la arquitectura y las rutas del Sprint 3.

Este contrato cubre identidad, perfiles, registro de Cliente y autorización por rol. El módulo Quote tiene un contrato independiente a cargo del Responsable B.

## 1. Compatibilidad y decisiones técnicas

- Base local: `http://localhost:3000/api/v1`.
- Se conservan login, refresh, logout y `GET /auth/me`.
- Las rutas privadas usan `Authorization: Bearer <accessToken>`.
- Roles: `CLIENT`, `DEVELOPER`, `PRODUCT_OWNER`, `ADMIN`, `SUPER_ADMIN`.
- `SUPERADMIN` del documento SCRUM se implementa como `SUPER_ADMIN` para conservar guards y datos existentes.
- Un visitante solo puede registrar una cuenta CLIENT. El body nunca acepta `role`, `roleId`, `isActive`, `tokenVersion` ni identificadores de otro usuario.
- SUPER_ADMIN no necesita perfil extendido en este Sprint; su `profile` es `null`.
- Cambiar roles y administrar usuarios ajenos quedan fuera hasta una historia administrativa explícita.

## 2. Convenciones

Éxito: `{ "success": true, "message": "Operación realizada correctamente", "data": {} }`.
Los errores mantienen el filtro HTTP global con `success`, `message` y `error`.

| HTTP | Uso                                     |
| ---- | --------------------------------------- |
| 200  | Consulta o actualización correcta       |
| 201  | Registro correcto                       |
| 400  | DTO, consentimiento o versión inválidos |
| 401  | Credenciales o sesión inválidas         |
| 403  | Rol sin permiso para ese perfil         |
| 404  | Tecnología inexistente en GET/PATCH administrativo; usuario eliminado entre autenticación y actualización de `/users/me` |
| 409  | Email, DNI, RUC u otra clave única ya registrados |
| 503  | Versiones legales del servidor ausentes, vacías o de más de 50 caracteres |

Nunca se devuelven `passwordHash`, `tokenVersion`, secretos o tokens en recursos de usuario. Las fechas usan ISO 8601. En PATCH, un campo omitido conserva su valor; `null` limpia campos escalares opcionales del perfil especializado. `technologyIds` y los campos de aceptación legal no aceptan `null`. `name` no se puede borrar: un `name: null` no actualiza el nombre y, sin una renovación legal válida, devuelve 400.

## 3. Endpoints finales

Todas las rutas de esta tabla tienen el prefijo `/api/v1`.

| Método | Ruta                              | Permiso       | Estado                                   |
| ------ | --------------------------------- | ------------- | ---------------------------------------- |
| GET    | `/auth/me`                        | Autenticado   | Existente, sin cambios                   |
| POST   | `/auth/register`                  | Público       | Crea exclusivamente CLIENT               |
| PATCH  | `/users/me`                       | Autenticado   | Actualiza nombre y/o aceptación legal    |
| GET    | `/users/me/profile`               | Autenticado   | Devuelve usuario seguro y perfil del rol |
| PATCH  | `/users/me/client-profile`        | CLIENT        | Upsert del perfil propio                 |
| PATCH  | `/users/me/developer-profile`     | DEVELOPER     | Upsert del perfil propio                 |
| PATCH  | `/users/me/product-owner-profile` | PRODUCT_OWNER | Upsert del perfil propio                 |
| PATCH  | `/users/me/admin-profile`         | ADMIN         | Upsert del perfil propio                 |
| GET    | `/technologies/catalog`          | Autenticado, cualquier rol | Tecnologías activas para selector |
| POST   | `/technologies`                  | ADMIN, SUPER_ADMIN | Crear tecnología |
| GET    | `/technologies`                  | ADMIN, SUPER_ADMIN | Listado administrativo; admite `isActive` |
| GET    | `/technologies/:id`              | ADMIN, SUPER_ADMIN | Detalle administrativo |
| PATCH  | `/technologies/:id`              | ADMIN, SUPER_ADMIN | Actualización administrativa |

El usuario se obtiene siempre del JWT. Ninguna ruta personal recibe `userId` por path, query o body.

## 4. Registro de Cliente

`POST /auth/register`

```json
{
  "name": "Cliente de ejemplo",
  "email": "cliente@example.test",
  "password": "PasswordSegura123!",
  "acceptedTerms": true,
  "termsVersion": "v1.0",
  "privacyVersion": "v1.0"
}
```

Reglas:

- name: 2-100 caracteres.
- email: válido, normalizado a minúsculas y sin espacios externos.
- password: 8-72 caracteres; nunca se registra ni devuelve.
- acceptedTerms debe ser literalmente true.
- termsVersion y privacyVersion deben coincidir con `TERMS_VERSION` y `PRIVACY_VERSION` del backend.
- Ambas versiones son cadenas obligatorias de 1–50 caracteres tras quitar espacios externos. Se rechazan valores vacíos, nulos, omitidos o distintos de la configuración vigente.
- Sin versiones legales configuradas se responde 503 y no se crean datos.
- User y ClientProfile se crean en una transacción con rol CLIENT.
- La respuesta 201 no inicia sesión automáticamente.

Respuesta data: `id`, `name`, `email`, `role`, `isActive`, `acceptedTermsAt`, `termsVersion` y `privacyVersion`.

## 5. Usuario y perfil propio

`PATCH /users/me`: `{ "name": "Nombre actualizado" }`. `name` tiene 2–100 caracteres tras quitar espacios externos. No modifica email, contraseña, rol o estado. Un cuerpo vacío devuelve 400.

También permite renovar la aceptación legal, para cualquiera de los cinco roles:

```json
{
  "acceptedTerms": true,
  "termsVersion": "v1.0",
  "privacyVersion": "v1.0"
}
```

Se puede añadir `name` al mismo cuerpo. Si se envía cualquiera de los tres campos legales, los tres son obligatorios: `acceptedTerms` debe ser el booleano `true` y ambas versiones deben estar vigentes. No se aceptan renovaciones parciales, versiones arbitrarias, cadenas vacías ni `null`. Un error impide guardar también el cambio de nombre.

El backend valida con la misma función central utilizada en registro (`src/common/legal/legal-versions.ts`). Luego actualiza `User.termsVersion`, `User.privacyVersion` y `User.acceptedTermsAt` (fecha del servidor) en una única escritura MySQL, junto con el nombre si se envió. Actualizar solo el nombre conserva los tres valores legales existentes y no requiere configuración legal disponible.

La respuesta `data` de PATCH contiene `id`, `name`, `email`, `role`, `isActive`, `acceptedTermsAt`, `termsVersion` y `privacyVersion`. Los tres últimos pueden ser `null` en cuentas antiguas. El cuerpo no acepta `acceptedTermsAt`: la fecha no la decide el cliente.

`GET /users/me/profile`:

```json
{
  "success": true,
  "message": "Operación realizada correctamente",
  "data": {
    "user": {
      "id": 12,
      "name": "Cliente",
      "email": "cliente@example.test",
      "role": "CLIENT",
      "isActive": true
    },
    "profile": {
      "type": "CLIENT",
      "phone": "+51999999999",
      "district": "Lima",
      "businessName": null
    }
  }
}
```

El ejemplo muestra un extracto del perfil. En la respuesta real cada perfil incluye `id`, `type`, sus campos persistidos y `createdAt`/`updatedAt`, sin `userId`. El usuario de GET mantiene exactamente `id`, `name`, `email`, `role` e `isActive`; los datos de aceptación legal se devuelven en registro y PATCH `/users/me`.

Si aún no existe el perfil correspondiente, `profile` es `null`, no 404. SUPER_ADMIN siempre recibe `profile: null`, puede actualizar su nombre y aceptación legal, y recibe 403 en PATCH `admin-profile`. No comparte AdminProfile ni se crea un modelo adicional. Una cuenta inexistente, inactiva o con token revocado recibe 401 por el guard JWT.

## 6. Payloads de perfiles

Todos los campos son opcionales en PATCH. Campos desconocidos se rechazan.

### CLIENT - `PATCH /users/me/client-profile`

Campos: `dni`, `age`, `phone`, `district`, `businessName`, `ruc`, `commercialName`, `businessDistrict`.
DNI acepta 8 dígitos; RUC 11; age un entero 0-130; phone entre 6 y 20 caracteres permitiendo dígitos, espacios, `+`, `-` y paréntesis.
Los documentos se envían como cadenas (se conservan ceros iniciales) y son únicos dentro de ClientProfile: los duplicados devuelven 409. `district` y `businessDistrict`: máximo 100 caracteres; `businessName` y `commercialName`: máximo 150.

### DEVELOPER - `PATCH /users/me/developer-profile`

Campos: `career`, `university`, `academicStatus`, `experienceYears`, `specialty`, `technologyIds`, `cvUrl`, `photoUrl`, `linkedinUrl`, `githubUrl`.
`career`: máximo 150; `university`: 180; `academicStatus`: 100; `specialty`: 120 caracteres. `experienceYears`: entero entre 0 y 80.

`technologyIds` es un arreglo opcional de enteros positivos. Los duplicados se eliminan. Todas las tecnologías deben existir y estar activas; si alguna no cumple se devuelve 400 sin guardar cambios. Omitir el campo conserva las relaciones; `[]` elimina la selección; `null` es inválido. La validación, upsert y sustitución de DeveloperTechnology ocurren dentro de una transacción.

GET y PATCH devuelven `technologies: [{ "id": 1, "name": "TypeScript", "icon": null }]`, ordenadas por nombre (único en el modelo), sin identificadores internos de la tabla intermedia. Se mantienen visibles las relaciones ya guardadas aunque posteriormente una tecnología se desactive; no se puede volver a seleccionarla en un PATCH.

Todas las URLs de perfiles requieren `http://` o `https://` y tienen máximo 500 caracteres tras quitar espacios externos. Si se omiten no se validan ni cambian; `null` permite borrar una URL; una cadena vacía o URL sin protocolo devuelve 400.

### PRODUCT_OWNER - `PATCH /users/me/product-owner-profile`

Campos: `bio`, `specialty`, `availabilityNotes`, `photoUrl`.
Límites: `bio` 5000, `specialty` 120, `availabilityNotes` 500 y `photoUrl` 500 caracteres. La URL sigue la regla HTTP(S).

### ADMIN - `PATCH /users/me/admin-profile`

Campos: `executiveTitle`, `specialty`, `photoUrl`, `calendlyUrl`.
Límites: título y especialidad 120 caracteres; ambas URLs HTTP(S), máximo 500.
`isPublicAdvisor` existe en el modelo, pero no puede modificarse desde el perfil propio; su autorización pertenece al Sprint de reuniones/asesores.

Cada PATCH especializado devuelve el perfil actualizado dentro de `data`, con `type`, `id`, campos del perfil y fechas, sin `userId`. El upsert crea el perfil si aún no existe; `{}` es válido en estas rutas. P2002 se traduce a 409 con un mensaje legible.

## 7. Catálogo para selección de tecnologías

`GET /api/v1/technologies/catalog` requiere JWT válido y no exige rol administrativo. CLIENT, DEVELOPER, PRODUCT_OWNER, ADMIN y SUPER_ADMIN pueden consultarlo. Sin sesión devuelve 401. Se registra antes de `/:id`, y solo el CRUD administrativo aplica RolesGuard con ADMIN/SUPER_ADMIN.

Respuesta:

```json
{
  "success": true,
  "message": "Operación realizada correctamente",
  "data": [
    { "id": 2, "name": "Node.js", "icon": null },
    { "id": 1, "name": "TypeScript", "icon": "typescript.svg" }
  ]
}
```

Devuelve exclusivamente tecnologías con `isActive = true`, ordenadas por nombre ascendente y luego ID. Solo incluye `id`, `name` e `icon`; no expone descripción, estado ni fechas. Sin resultados devuelve `data: []`.

`CatalogQueryDto` no admite parámetros en esta versión. La validación global rechaza cualquier query desconocida con 400, incluyendo `?isActive=false` y `?category=backend` (también una categoría vacía). No se ignoran filtros silenciosamente.

**Limitación de categorías:** Technology no tiene campo ni relación con Category. Category pertenece a Project y no define la categoría de una tecnología. Para ofrecer ese filtro faltaría acordar una clasificación de tecnologías, su cardinalidad y asignación de datos existentes, y luego añadir schema, migración y validación. Esta entrega no inventa esa relación ni modifica otros dominios.

## 8. Seguridad y persistencia

- Cada perfil tiene `userId` único y relación uno-a-uno con User.
- El rol determina qué perfil puede consultarse y actualizarse.
- Parámetros o un `userId` inyectado no alteran el propietario.
- Los perfiles antiguos no se eliminan automáticamente ante futuros cambios de rol.
- Registro con bcrypt usando el costo actual de autenticación.
- No incluir datos personales en logs, fixtures versionados o capturas.
- Reemplazo de tecnologías y altas compuestas usan transacciones.
- ProfilesModule sigue siendo el módulo oficial conectado a AppModule; no se trasladan rutas a UsersModule. UsersService soporta la escritura del usuario y su aceptación legal.
- Los cuatro perfiles, Technology y DeveloperTechnology ya existen en Prisma/MySQL. Se conservan índices únicos de userId/DNI/RUC, clave compuesta de DeveloperTechnology y claves foráneas. No fue necesaria una migración en Sprint 5.
- La configuración del backend `TERMS_VERSION`/`PRIVACY_VERSION` es la fuente de verdad para las versiones vigentes, no el frontend. Los valores `v1.0` de los ejemplos no sustituyen la aprobación de textos legales ni la configuración del despliegue.
- El modelo conserva la última aceptación mediante `acceptedTermsAt` y ambas versiones; no existe un historial legal ni campos separados `termsAccepted`/`privacyAccepted`. `acceptedTerms: true` representa la aceptación conjunta en registro y renovación.
- El consentimiento de TeamApplication pertenece al flujo de postulaciones y no se transforma en aceptación legal de User.
- No se agrega un endpoint de textos/versiones legales. El frontend debe usar textos aprobados y versiones coordinadas con el backend; una versión obsoleta se rechaza con 400. Sin configuración válida, registro y renovación legal devuelven 503 sin escribir datos.

## 9. Pruebas

- Registro correcto, email duplicado, consentimiento falso, versiones inválidas y configuración ausente.
- El registro no puede asignar un rol privilegiado.
- Cada rol consulta y actualiza únicamente su perfil permitido.
- Campos sensibles/desconocidos se rechazan.
- Perfil inexistente retorna null; PATCH crea y luego actualiza.
- technologyIds inexistentes/inactivos se rechazan; duplicados se deduplican.
- Catálogo autenticado para los cinco roles: solo activas, orden estable, campos mínimos, queries inválidas rechazadas y CRUD administrativo protegido.
- Renovación legal válida y persistida; rechazos parciales, nulos, vacíos y obsoletos; preservación de datos ante errores; nombre sin cambios de aceptación.
- Las respuestas no contienen passwordHash ni tokenVersion.
- Regresión de login, refresh, logout, Projects y Services.
- E2E en base aislada, nunca en la base compartida de desarrollo.

Suites de integración: `test/identity-profiles.e2e-spec.ts` (Parte 1) y `test/users/users-profile.e2e-spec.ts` (Parte 2). Ambas usan Nest, JWT, validación y Prisma/MySQL reales; no sustituyen servicios productivos por mocks. Eliminan únicamente fixtures propios al finalizar.

Validación de entrega:

```sh
npx prisma generate
npm run lint
npm run build
npm test
npm run test:e2e -- test/identity-profiles.e2e-spec.ts test/users/users-profile.e2e-spec.ts
```

## 10. Entrega a frontend

El Responsable A comparte contrato, rama/commit, Swagger y ejemplos reales sin secretos. El frontend puede usar mocks equivalentes, pero la integración final se prueba contra la API real.

## 11. Inventario de entrega Sprint 5 (partes 1 y 2)

Archivos modificados:

- `.env.example`
- `docs/contracts/users-profiles-api.md`
- `src/auth/auth.service.ts`
- `src/profiles/dto/update-developer-profile.dto.ts`
- `src/profiles/dto/update-own-user.dto.ts`
- `src/profiles/profiles.controller.ts`
- `src/profiles/profiles.module.ts`
- `src/profiles/profiles.service.ts`
- `src/profiles/profiles.service.spec.ts`
- `src/technologies/technologies.controller.ts`
- `src/technologies/technologies.service.ts`
- `src/technologies/technologies.service.spec.ts`
- `src/users/users.service.ts`
- `test/identity-profiles.e2e-spec.ts`

Archivos nuevos:

- `src/common/legal/legal-versions.ts`
- `src/common/legal/legal-versions.spec.ts`
- `src/profiles/dto/profile-validation.spec.ts`
- `src/profiles/dto/update-own-user.dto.spec.ts`
- `src/technologies/dto/catalog-query.dto.ts`
- `test/users/users-profile.e2e-spec.ts`

No se modifican schema, archivos de migraciones ni entregables de Backend 2. Para la regresión completa se aplicaron a `tisnet_test` las dos migraciones existentes pendientes (`20260918120000_add_prospects_meetings` y `20260918170000_public_quotes_team_applications`), sin reset ni modificaciones a sus archivos.

Resultado de regresión del 21/09/2026: Prisma generate, lint y build correctos; 279 pruebas unitarias aprobadas (40 archivos), 142 E2E aprobadas (5 archivos), incluidas 29 pruebas de las dos suites de usuarios/perfiles. Las nuevas pruebas cubren selección de tecnologías activas, orden, campos mínimos, rechazo de filtros no soportados, permisos administrativos, validación legal central, renovación atómica y persistencia MySQL.

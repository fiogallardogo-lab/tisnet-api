# TISNET - Contrato API de usuarios y perfiles

Versión: 1.2 - Sprint 5, Backend 1, partes 1 y 2

Fecha: 22/09/2026

Implementación: `feature/s5-profiles-catalog-hardening`. Se conserva la arquitectura y las rutas del Sprint 3.

Este contrato cubre identidad, perfiles, registro de Cliente y autorización por rol. El módulo Quote tiene un contrato independiente a cargo del Responsable B.

## 1. Compatibilidad y decisiones técnicas

- Base local: `http://localhost:3000/api/v1`.
- Se conservan login, refresh, logout y `GET /auth/me`.
- Las rutas privadas usan `Authorization: Bearer <accessToken>`.
- Roles: `CLIENT`, `DEVELOPER`, `PRODUCT_OWNER`, `ADMIN`, `SUPER_ADMIN`.
- `SUPERADMIN` del documento SCRUM se implementa como `SUPER_ADMIN` para conservar guards y datos existentes.
- Un visitante solo puede registrar una cuenta CLIENT. El body nunca acepta `role`, `roleId`, `isActive`, `tokenVersion` ni identificadores de otro usuario.
- SUPER_ADMIN reutiliza AdminProfile; conserva su rol real en user.role y profile.type.
- POST /users permite altas administrativas. Cambiar roles de usuarios existentes queda fuera de este contrato.

## 2. Convenciones

Éxito: `{ "success": true, "message": "Operación realizada correctamente", "data": {} }`.
Los errores mantienen el filtro HTTP global con `success`, `message` y `error`.

| HTTP | Uso                                                                                                                      |
| ---- | ------------------------------------------------------------------------------------------------------------------------ |
| 200  | Consulta o actualización correcta                                                                                        |
| 201  | Registro correcto                                                                                                        |
| 400  | DTO, consentimiento o versión inválidos                                                                                  |
| 401  | Credenciales o sesión inválidas                                                                                          |
| 403  | Rol sin permiso para ese perfil                                                                                          |
| 404  | Tecnología inexistente en GET/PATCH administrativo; usuario eliminado entre autenticación y actualización de `/users/me` |
| 409  | Email, DNI, RUC u otra clave única ya registrados                                                                        |
| 503  | Versiones legales del servidor ausentes, vacías o de más de 50 caracteres                                                |

Nunca se devuelven `passwordHash`, `tokenVersion`, secretos o tokens en recursos de usuario. Las fechas usan ISO 8601. En PATCH, un campo omitido conserva su valor; `null` limpia campos escalares opcionales del perfil especializado. `technologyIds` y los campos de aceptación legal no aceptan `null`. `name` no se puede borrar: un `name: null` no actualiza el nombre y, sin una renovación legal válida, devuelve 400.

## 3. Endpoints finales

Todas las rutas de esta tabla tienen el prefijo `/api/v1`.

| Método | Ruta                              | Permiso                    | Estado                                    |
| ------ | --------------------------------- | -------------------------- | ----------------------------------------- |
| GET    | `/auth/me`                        | Autenticado                | Existente, sin cambios                    |
| POST   | `/auth/register`                  | Público                    | Crea exclusivamente CLIENT                |
| POST   | `/users`                          | ADMIN, SUPER_ADMIN         | Alta administrativa con perfil y versiones legales |
| PATCH  | `/users/me`                       | Autenticado                | Actualiza nombre y/o aceptación legal     |
| GET    | `/users/me/profile`               | Autenticado                | Devuelve usuario seguro y perfil del rol  |
| PATCH  | `/users/me/client-profile`        | CLIENT                     | Upsert del perfil propio                  |
| PATCH  | `/users/me/developer-profile`     | DEVELOPER                  | Upsert del perfil propio                  |
| PATCH  | `/users/me/product-owner-profile` | PRODUCT_OWNER              | Upsert del perfil propio                  |
| PATCH  | `/users/me/admin-profile`         | ADMIN, SUPER_ADMIN         | Upsert del perfil propio                  |
| GET    | `/technologies/catalog`           | Autenticado, cualquier rol | Tecnologías activas para selector         |
| POST   | `/technologies`                   | ADMIN, SUPER_ADMIN         | Crear tecnología                          |
| GET    | `/technologies`                   | ADMIN, SUPER_ADMIN         | Listado administrativo; admite `isActive` |
| GET    | `/technologies/:id`               | ADMIN, SUPER_ADMIN         | Detalle administrativo                    |
| PATCH  | `/technologies/:id`               | ADMIN, SUPER_ADMIN         | Actualización administrativa              |

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

Si aún no existe el perfil correspondiente, `profile` es `null`, no 404. SUPER_ADMIN comparte AdminProfile: si falta inicialmente devuelve null; PATCH admin-profile lo crea y devuelve 200, y GET posterior lo devuelve con type SUPER_ADMIN, sin userId. No existe SuperAdminProfile. Una cuenta inexistente, inactiva o con token revocado recibe 401 por el guard JWT.

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

### ADMIN y SUPER_ADMIN - `PATCH /users/me/admin-profile`

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
    { "id": 2, "name": "Node.js", "icon": null, "isActive": true },
    {
      "id": 1,
      "name": "TypeScript",
      "icon": "typescript.svg",
      "isActive": true
    }
  ]
}
```

Devuelve exclusivamente tecnologías con `isActive = true`, ordenadas por nombre ascendente y luego ID. Incluye `id`, `name`, `icon` e `isActive`; no expone descripción ni fechas. Sin resultados devuelve `data: []`.

`CatalogQueryDto` admite search opcional: string, trim y máximo 100 caracteres. GET /technologies/catalog?search=react filtra por name (contains, según collation de MySQL); search vacío equivale a no filtrar. Queries desconocidas devuelven 400, incluyendo isActive, category y categoryId. GET /catalog?categoryId=2 y GET /catalog?categoryId=2&search=react NO están implementados: devuelven 400. No se ignoran filtros silenciosamente.

**BE1-04 BLOQUEADO por dependencia externa — Esperando migración de Backend B:** Technology no tiene campo ni relación con Category. Category pertenece a Project y no define la categoría de una tecnología. El modelo independiente TechnologyCategory ya está acordado (sección 13); falta integrar el schema y la migración de Backend B. Esta entrega no inventa esa relación ni modifica otros dominios. categoryId y categoryName se omiten de la respuesta; no se fabrican valores null ni categorías. Backend B tiene prioridad sobre Prisma. Se requiere recibir esa migración antes de implementar categoryId entero >= 1 y sus filtros combinados.

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

Suites de integración: `test/identity-profiles.e2e-spec.ts` y `test/users/users-profile.e2e-spec.ts`. Ambas usan Nest, JWT, validación y Prisma/MySQL reales. Solo los casos 503 simulan una clave legal ausente mediante ConfigService; la persistencia sigue siendo real. Eliminan únicamente fixtures propios al finalizar.

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

## 11. Alta administrativa

`POST /api/v1/users`, JWT obligatorio, exclusivamente ADMIN y SUPER_ADMIN.

```json
{
  "name": "Developer de ejemplo",
  "email": "developer@example.test",
  "password": "PasswordSegura123!",
  "role": "DEVELOPER",
  "acceptedTerms": true,
  "termsVersion": "v1.0",
  "privacyVersion": "v1.0"
}
```

Roles creados: CLIENT -> ClientProfile, DEVELOPER -> DeveloperProfile,
PRODUCT_OWNER -> ProductOwnerProfile, ADMIN -> AdminProfile. No permite SUPER_ADMIN.
Crea User y perfil en una transacción; contraseña hasheada con bcrypt (costo 12).
Las reglas de name/email/password/consentimiento/versiones son las del registro.
validateLegalVersions() es compartida por alta administrativa, registro y renovación.
Persiste acceptedTermsAt del servidor, termsVersion y privacyVersion.
Respuesta 201: data contiene id, name, email, role, isActive, acceptedTermsAt,
termsVersion y privacyVersion. No devuelve passwordHash ni inicia sesión.
400: DTO/rol/consentimiento/versiones obsoletas; 401: sin JWT válido;
403: CLIENT/DEVELOPER/PRODUCT_OWNER; 409: email duplicado;
503: configuración legal ausente o inválida. Los errores no crean el usuario.

## 12. Swagger y cierre

`/api/docs` expone las rutas con base `/api/v1`, autorización Bearer, los DTO de
perfiles y alta administrativa, search y la limitación explícita de categoryId.
categoryId no se anuncia como parámetro soportado mientras no exista el modelo.
BE1-04 no está completo. Evidencias de comandos y regresión: `../sprint5-backend1-evidence.md`.

## 13. Acuerdo de cierre pendiente de integración

Auditoría de la rama feature/s5-profiles-catalog-hardening sobre 40fbc08:
no existe TechnologyCategory ni Technology.categoryId/category en schema.prisma;
las migraciones presentes solo relacionan Project.categoryId con Category.

El equipo acordó un modelo independiente TechnologyCategory con id, name,
description, isActive, createdAt y updatedAt. Backend B implementará el modelo,
Technology.categoryId Int? y la relación con onDelete: Restrict, junto con su migración.
No se reutilizará Category de proyectos. Backend A no crea schema, seed ni migración.

Lo siguiente es un criterio de aceptación futuro, NO funcionalidad disponible:
- categoryId opcional, entero >= 1; combinado con search y siempre isActive=true.
- Respuesta con id, name, icon, categoryId, categoryName e isActive.
- Tecnologías históricas sin asignación: categoryId/categoryName null.
- Categoría inexistente o sin coincidencias: 200 con data [].
- Categoría inactiva: se permite filtrar; se devuelven solo tecnologías activas.
- Formato inválido y queries desconocidas, incluido isActive: 400.
- No se amplía POST/PATCH administrativo para categoryId sin acuerdo explícito.

Hasta integrar y probar esa dependencia, la respuesta real sigue siendo
id/name/icon/isActive, search está disponible y categoryId devuelve 400.
No se declara el cierre del Sprint al 100%.

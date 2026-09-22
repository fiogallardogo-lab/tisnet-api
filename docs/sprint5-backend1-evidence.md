# Sprint 5 corregido — evidencias Responsable A

Fecha: 22/09/2026. Rama: `feature/s5-profiles-catalog-hardening`.
Incluye las partes 1 y 2; cambios sin commit ni push.

| Historia | Estado |
| --- | --- |
| BE1-01 | COMPLETO |
| BE1-02 | COMPLETO |
| BE1-03 | COMPLETO |
| BE1-04 | PARCIAL — categoría bloqueada por modelo |
| BE1-05 | COMPLETO |
| BE1-06 | COMPLETO — regresión y documentación; DoD global pendiente de bloqueos |

## Evidencia funcional

- El 404 de POST /api/v1/users se debía a UsersController no registrado en UsersModule. Se registró y se importaron ConfigModule y PassportModule sin ciclo con AuthModule.
- ADMIN/SUPER_ADMIN crean CLIENT, DEVELOPER, PRODUCT_OWNER y ADMIN con su perfil en MySQL. Crear SUPER_ADMIN: 400. Sin JWT: 401. Roles restantes: 403. Email duplicado: 409.
- SUPER_ADMIN usa AdminProfile, mantiene user.role y profile.type, no expone userId. GET inicial sin perfil: null; PATCH admin-profile: 200 y crea perfil; GET posterior lo devuelve.
- validateLegalVersions centraliza alta, registro y renovación. Versiones obsoletas: 400; configuración ausente: 503; persistencia de acceptedTermsAt y versiones comprobada.
- Catálogo con JWT para los cinco roles; solo activas, orden name asc/id asc, search con trim y máximo 100 caracteres. Respuesta: id/name/icon/isActive. CRUD administrativo conserva sus guards.
- prisma/schema.prisma: Category (línea 249) tiene projects; Technology (línea 259) solo relaciones projects/developers. La relación a través de Project no define una categoría propia y única de Technology.
- categoryId y categoryName no están implementados. categoryId solo o combinado devuelve 400. No se inventaron categorías ni se crearon migraciones. Requiere coordinación con Backend B.

## Comandos y resultados

| Comando | Resultado final |
| --- | --- |
| npm run lint | Correcto |
| npm run build | Correcto |
| npm test | 287/287, 40 archivos |
| npm run test:e2e -- test/identity-profiles.e2e-spec.ts test/users/users-profile.e2e-spec.ts | 51/51, 2 archivos |
| npm run test:e2e | 164/164, 5 archivos; MySQL tisnet_test |
| npx prisma format | Ejecutado; se retiró únicamente el cambio de formato ajeno en PublicQuote, conservando el schema original |
| npx prisma validate | Schema válido |
| npx prisma generate | Cliente 6.19.3 generado |
| npx prisma migrate status | tisnet: dos migraciones existentes pendientes, salida 1 |
| node --env-file=.env.test ./node_modules/prisma/build/index.js migrate status | tisnet_test: 10 migraciones, actualizado |
| git diff --check | Correcto |

Migraciones pendientes en desarrollo: `20260918120000_add_prospects_meetings` y
`20260918170000_public_quotes_team_applications`. No se aplicaron ni modificaron.
No se ejecutó reset. El DoD de despliegue no se declara cerrado con estas pendientes.

La primera corrida E2E completa detectó una carrera entre fixtures de suites:
la comparación del catálogo incluía datos que otra suite eliminaba. Se corrigió
comparando la persistencia y el orden de fixtures propios, manteniendo la validación
de isActive y campos para toda la respuesta. La siguiente corrida completa pasó.

## Swagger y contrato

E2E levanta AppModule y publica Swagger con las mismas rutas de main.ts.
GET /api/docs/ y /api/docs-json: 200; las ocho rutas solicitadas están presentes,
con Bearer, search y respuestas 201/400/401/403/409/503 de POST /users.
categoryId se documenta como limitación, no como filtro disponible.
Esta comprobación corresponde a la aplicación levantada por E2E, no a un despliegue externo.

Contrato: [users-profiles-api.md](contracts/users-profiles-api.md).
Rutas con base /api/v1: GET /users/me/profile; PATCH /users/me;
PATCH /users/me/client-profile, developer-profile, product-owner-profile y admin-profile;
POST /users; GET /technologies/catalog?search=react. POST /auth/register se conserva.

## Archivos de la entrega acumulada

- docs/contracts/users-profiles-api.md
- docs/sprint5-backend1-evidence.md (nuevo)
- src/technologies/dto/catalog-query.dto.ts
- src/technologies/technologies.controller.ts
- src/technologies/technologies.service.ts
- src/technologies/technologies.service.spec.ts
- src/users/users.controller.ts
- src/users/users.module.ts
- test/identity-profiles.e2e-spec.ts
- test/users/users-profile.e2e-spec.ts

Se revisaron git status, git diff --stat y git diff. Sin cambios finales en schema,
migraciones, src/deliverables/** ni docs/contracts/deliverables-api.md.
No se ejecutaron git add, commit, push, merge ni rebase.

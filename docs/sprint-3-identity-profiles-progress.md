# Sprint 3 - Avance de identidad y perfiles

Fecha de actualización: 17/09/2026

Responsable: A - Backend de identidad, perfiles y Prisma

Estado: alcance de backend del Responsable A implementado y validado; pendiente únicamente la integración de entrega mediante PR.

## Alcance implementado

- Contrato de usuarios y perfiles actualizado con la línea base SCRUM aprobada.
- Roles canónicos: CLIENT, DEVELOPER, PRODUCT_OWNER, ADMIN y SUPER_ADMIN.
- Registro público limitado al rol CLIENT y condicionado a términos vigentes.
- Consulta y edición segura del usuario autenticado.
- Perfiles independientes para Cliente, Developer, Product Owner y Admin.
- Tecnologías activas asociadas al perfil Developer mediante una tabla intermedia.
- DTO, validación global estricta, JWT y autorización por rol.
- Seed idempotente que preserva contraseñas de usuarios existentes.
- Modelos Quote, QuoteOption y QuoteItem integrados con sus enums e índices.
- QuoteItem incluido desde la primera migración; SP-01 continúa pendiente.

## Verificaciones ejecutadas

| Comprobación                | Resultado                                             |
| --------------------------- | ----------------------------------------------------- |
| `npx prisma format`         | Correcto                                              |
| `npx prisma validate`       | Correcto                                              |
| `npx prisma generate`       | Correcto                                              |
| `npx prisma migrate deploy` | Migración consolidada aplicada correctamente          |
| `npx prisma migrate status` | Base de datos actualizada, 8 migraciones              |
| `npm test`                  | 24 archivos, 131 pruebas aprobadas                    |
| `npm run test:e2e:full`     | 3 archivos, 114 pruebas aprobadas sobre `tisnet_test` |
| `npm run lint`              | Sin errores                                           |
| `npm run build`             | Correcto                                              |

## Controles de seguridad comprobados

- El propietario se obtiene del JWT y no de parámetros enviados por el cliente.
- Cada endpoint de perfil exige el rol correspondiente.
- Registro no acepta roles privilegiados.
- `passwordHash`, `tokenVersion` y `userId` interno no se serializan en perfiles.
- Tecnologías inexistentes o inactivas se rechazan antes de actualizar Developer.
- Campos desconocidos se rechazan mediante ValidationPipe.

## Evidencia HTTP incorporada

`test/identity-profiles.e2e-spec.ts` valida en una base aislada:

1. Registro exclusivo de CLIENT, normalización y ausencia de campos sensibles.
2. Rechazo de email duplicado, consentimiento inválido, versiones legales obsoletas y campos privilegiados.
3. Consulta y actualización del usuario y perfil propios.
4. Autorización por rol y rechazo del acceso cruzado.
5. Creación de perfiles CLIENT, DEVELOPER, PRODUCT_OWNER y ADMIN.
6. Rechazo de tecnologías duplicadas o inexistentes.

La prueba cancela su ejecución si el nombre de la base no identifica explícitamente un entorno de test.

## Estado de entrega

- `TERMS_VERSION` y `PRIVACY_VERSION` están documentadas en `.env.example`.
- El seed aislado crea los roles y usuarios requeridos para E2E.
- La migración `20260916155021_add_identity_profiles_quotes` está aplicada en desarrollo y test.
- Prisma y `QuotesModule` ya están integrados en `AppModule` con `quotesCatalogV1`.
- Los commits previos están publicados en `test/s5-quotes-integration`.

Pendiente operativo: confirmar esta evidencia en un commit, publicar la rama y completar el PR. SP-01 sigue siendo una dependencia externa de Producto y no bloquea el flujo `PENDING_RULES`.

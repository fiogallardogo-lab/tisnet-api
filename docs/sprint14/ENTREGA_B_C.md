# Sprint 14 — Entrega del Responsable A a B y C

## Base y alcance

Implementación sobre origin/develop 6b2c5fb en checkout aislado tisnet-api-s14. El checkout anterior tisnet-api contenía cambios locales y no fue sobrescrito. Backend comercial A01–A09. Pagos, proyectos, kickoff y equipos siguen siendo responsabilidad B; pantallas, accesibilidad y E2E de navegador corresponden a C.

## Migración para B

Nueva migración: prisma/migrations/20260928170000_s14_commercial/migration.sql.
Solo añade QuoteObservation (FK a Quote, QuoteVersion, User) y ContactInquiry; no borra ni actualiza datos existentes. Activación reutiliza User.tokenVersion, isActive y campos legales existentes.

B debe aplicar el procedimiento de migraciones de su entorno antes de arrancar este backend. No ejecutar db push ni reset contra producción. Se entrega validación de la migración incremental sobre el schema previo en MySQL temporal; véase informe.

**Bloqueo previo reproducido al instalar desde cero:** migrate deploy falla con P3018/MySQL 1146 en 20260925170000_project_kickoff_audit, consulta 2: ALTER TABLE ProjectMember. La tabla se crea recién en 20260928100000_add_project_members_deliverables. También debe revisarse ProjectDeliverable en esa secuencia. No se han reescrito migraciones históricas: B debe revisar cuáles fueron aplicadas en cada entorno y acordar recuperación/baseline, sin alterar checksums de migraciones desplegadas a ciegas.

## Integración de C

- Usar PATCH admin/quotes/:id con expectedUpdatedAt del detalle; ante 409 refrescar datos. La cabecera oficial se protege; nueva versión para cambiar alcance/importes/cuotas.
- Editor oficial: 1–5 cuotas, porcentaje*100 -> puntos base enteros; exacto 10000; fechas YYYY-MM-DD ordenadas.
- Observaciones: enviar QuoteVersion.id persistido y texto. Mostrar historial con GET correspondiente; no existe edición/borrado.
- Aceptación: enviar id persistido, no número secuencial de versión. El acuerdo incluye todas las versiones.
- Vincular código: el segundo intento responde 409 por requisito S14-A04; recargar prospecto para mostrar vínculo actual.
- /activate: presentar textos legales aprobados y versiones reales; manejar 400, 409, 503; después redirigir a login.
- Contacto: éxito solo tras 201 de /public/contact; mostrar code; no afirmar envío por email.
- Reunión interna: PENDING no significa confirmada. Admin confirma con SCHEDULED; correo refleja estado persistido.
- Rutas, cuerpos, respuestas y permisos completos: CONTRATOS_RESPONSABLE_A.md y Swagger /api/docs.

## Configuración externa pendiente

1. Proveedor SMTP/Resend de pruebas, MAIL_FROM y PUBLIC_FRONTEND_URL.
2. TERMS_VERSION/PRIVACY_VERSION aprobadas y textos publicados por el equipo responsable; no usar valores test-s14 de tests en demo.
3. Revisión de migraciones históricas por B.
4. Demo integrada con Culqi sandbox, frontend C, proyecto/kickoff/equipo B. Las pruebas de A no acreditan por sí solas el cierre completo del Sprint 14.

## Reproducción de pruebas

Instalar dependencias con npm ci --ignore-scripts y ejecutar npm run prisma:generate. Configurar .env.test con una base MySQL exclusiva cuyo nombre contenga test, JWT_SECRET, JWT_REFRESH_SECRET, TERMS_VERSION, PRIVACY_VERSION, NOTIFICATION_PROVIDER=fake y credenciales aleatorias SEED_ADMIN_EMAIL/PASSWORD, SEED_DEVELOPER_EMAIL/PASSWORD. No copiar secretos al repositorio.

Para las pruebas locales se usó una instancia MySQL 8.0 independiente enlazada solo a 127.0.0.1:13316; esquema completo cargado únicamente en esa base por el bloqueo histórico citado. Preparar usuarios con npm run prisma:seed:test. Ejecutar npm test -- --maxWorkers=2 y npm run test:e2e -- --maxWorkers=1. E2E nuevo usa guards JWT/RBAC reales y MySQL; solo sustituye transporte de correo y limita rate limiting en el helper de pruebas existente. No equivale a demo con proveedor real.

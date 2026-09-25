# Auditoría y reportes — Sprint 12

AuditEvent contiene actorId nullable, action, entityType, entityId, metadata JSON segura, createdAt. No tiene endpoints de modificación/borrado. El actor tiene FK SET NULL para conservar evidencia si la cuenta se elimina.

Eventos de oficialización, pagos y kickoff/equipo se guardan dentro de la transacción del cambio. El interceptor de operaciones HTTP registra cambios exitosos de usuarios/perfiles, registro público, proyectos y entregables. No registra login, refresh, contraseñas, tokens, headers, body, CV, fotografías ni enlaces. Metadata admite exclusivamente claves/tipos conocidos. Las operaciones hechas directamente por SQL fuera de la aplicación no se auditan automáticamente. Para usuarios/entregables el interceptor escribe después de la operación; una caída de base entre ambas escrituras puede dejar esa operación sin evento. No se declara un log transaccional universal ni infraestructura de captura de cambios.

Solo SUPER_ADMIN:

- GET /api/v1/admin/audit — filtros entityType, actorId, from, to, cursor, limit (1–1000).
- GET /api/v1/admin/audit/report — conteos por entidad/acción con los mismos filtros temporales.
- GET /api/v1/admin/audit/payments — conteos y suma de importes agrupados por moneda y estado; nunca mezcla monedas.
- GET /api/v1/admin/audit/export — CSV de una página, encabezado X-Next-Cursor si hay más. Recorrer cursor para exportar todo; no se carga toda la tabla en memoria. Fórmulas de hoja de cálculo se neutralizan.

Rango por defecto 30 días, máximo 366. Pagina por ID descendente para evitar offset creciente. El rango temporal debe mantenerse fijo al recorrer un reporte histórico.

## Índices y consultas reales

- Quote: índices existentes por pricingStatus/createdAt y prospectId/createdAt sirven a bandeja y Prospect. legacyCode y legacyPublicQuoteId son únicos para reconciliación. La búsqueda contiene sobre nombre/correo no aprovecha B-tree; no se añade un índice ficticio de texto completo sin medir volumen.
- Meeting: advisorProfileId/scheduledAt y status/scheduledAt existentes para solapamientos; bookingKey único para reserva exacta, bloqueo de fila del asesor para intervalos solapados. MeetingEvent externo único y meetingId/occurredAt para orden.
- PaymentSchedule: quoteVersionId/sequence único para cuota inicial y orden comercial. Payment: scheduleId/status para confirmaciones y evento externo único para idempotencia.
- Project: clientUserId/status, productOwnerId/status, prospectId y quoteId único. ProjectMember mantiene userId/isActive y projectId/memberRole/isActive.
- AuditEvent: entityType/createdAt/id, actorId/createdAt/id y createdAt/id para filtros temporales. Los reportes financieros agregados requieren recorrer su conjunto; no se declara una mejora de rendimiento sin benchmark con volumen representativo.

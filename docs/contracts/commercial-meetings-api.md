# Persistencia comercial de reuniones — Sprint 8

A implementa la persistencia en Prospects usando el modelo Meeting existente. B mantiene src/meetings y SchedulingProvider; no se implementa Calendly en A.

- GET /api/v1/public/advisors: asesores activos publicados.
- GET /api/v1/public/advisors/:id/availability?from=ISO&to=ISO: intervalo máximo 31 días, devuelve slots AVAILABLE del proveedor, descontando reservas persistidas. El proveedor fake puede devolver []: no se inventan horarios.
- POST /api/v1/public/meetings: {advisorId:number,quoteId:code,name,email,phone?,start:ISO,end:ISO}. Requiere cotización cuyo contacto coincida, asesor público activo y fecha futura; duración máxima 24 horas. Devuelve 201 {id,status,start,end,quoteId,advisorId} dentro del envelope estándar.
- GET /api/v1/meetings/my?page=1&limit=20: JWT CLIENT ve reuniones de su Prospect; ADMIN/SUPER_ADMIN ve las de su perfil asesor.
- GET /api/v1/admin/meetings?page=1&limit=20: ADMIN/SUPER_ADMIN, paginado (máximo 100).

Estados de dominio: PENDING, SCHEDULED, COMPLETED, CANCELLED. Prisma @map conserva las etiquetas históricas REQUESTED/CONFIRMED/CANCELED en MySQL para evitar una conversión destructiva. C debe adaptar su presentación a los nombres de dominio nuevos.

Crear una solicitud NO confirma agenda externa. A devuelve PENDING. La reserva y detección de solapamientos se serializan bloqueando AdminProfile, con bookingKey único. La cancelación libera la clave. La ruta antigua del portal cliente aplica el mismo bloqueo, duración de una hora por compatibilidad.

B debe autenticar el webhook antes de llamar MeetingPersistenceService.recordExternalEvent({externalEventId,meetingId,status,occurredAt}). Se registra MeetingEvent con identificador único y se rechazan reusos con otro contenido, eventos anteriores y transiciones inválidas. No hay endpoint público sin firma que permita confirmar reuniones.

Errores: 400 intervalo/DTO inválido; 401 sin JWT en privadas; 403 rol incorrecto; 404 asesor/cotización/contacto no disponible; 409 horario ocupado o transición/evento inválido.

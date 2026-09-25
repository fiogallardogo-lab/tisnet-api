# Kickoff, equipo y trazabilidad — Sprint 10

POST /api/v1/kickoff — ADMIN/SUPER_ADMIN. Body:

```json
{"quoteId":1,"name":"Proyecto acordado","slug":"proyecto-acordado","categoryId":1,"heldAt":"2026-09-25T15:00:00Z","notes":"Acuerdos iniciales","members":[{"userId":8,"role":"PRODUCT_OWNER","participationBasisPoints":2000},{"userId":9,"role":"DEVELOPER","participationBasisPoints":8000}]}
```

Requiere versión oficial vigente, cliente CLIENT activo, Prospect asociado y primera cuota confirmada. Quote se bloquea durante la operación, como en pagos/oficialización. Una Quote admite un solo Project. Los miembros deben estar activos y sus roles coincidir con User; exactamente un PO; IDs sin duplicados; porcentajes enteros en puntos base, suma exacta 10000 entre miembros del equipo. El cliente se añade con participación cero.

Crea Project IN_DEVELOPMENT, relaciones Quote/Prospect/Client/User/PO, Kickoff con actor/fecha y un ProjectMilestone por cuota oficial. Cada hito conserva paymentScheduleId; se crea su entregable con milestoneId. Así queda PaymentSchedule → ProjectMilestone → ProjectDeliverable. No se crean hitos desde datos independientes del acuerdo. Entregables adicionales en proyectos comerciales deben referir el hito/orden existente, con título y fecha acordados.

GET /api/v1/projects/:id/operations y GET /api/v1/projects/:id/members: administración o miembro activo con rol coincidente. PATCH /api/v1/projects/:id/members: administración, reemplazo atómico de equipo, mismos criterios de porcentajes/PO; conserva histórico de miembros desactivándolos.

PATCH /api/v1/projects/:id: DEVELOPER/PRODUCT_OWNER solo si tienen membresía activa en ese proyecto. No pueden alterar estado ni flags destacados. ADMIN/SUPER_ADMIN conserva funciones administrativas. Toda transición operativa requiere pago inicial; no se permite crear un proyecto directamente operativo por la ruta genérica.

409 si falta acuerdo/pago, Quote ya usada o slug duplicado; 400 datos/participaciones/hito inválidos; 403 falta de membresía; 404 proyecto inexistente.

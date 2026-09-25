# Acuerdos oficiales y pagos — Sprint 9

POST /api/v1/admin/quotes/:id/versions (ADMIN/SUPER_ADMIN):

```json
{"clientUserId":7,"amountMinor":10001,"currency":"PEN","scope":"Alcance acordado","observations":"Observaciones","installments":[{"percentageBasisPoints":5000,"dueDate":"2026-12-01","milestone":"Diseño aprobado"},{"percentageBasisPoints":5000,"dueDate":"2026-12-20","milestone":"Entrega final"}]}
```

Crea una versión oficial inmutable (201) con autor autenticado, cliente, fecha, observaciones y alcance. Ediciones posteriores crean otra versión; nunca sobrescriben historia. Quote.activeVersion señala la vigente. El cliente debe estar activo, tener rol CLIENT y coincidir con contacto/Prospect. No puede sustituirse una cotización con pagos confirmados.

Entre 1 y 5 cuotas. Porcentajes expresados en puntos base enteros: 10000=100%; suma EXACTA 10000. Importes enteros en unidades menores, cálculo con BigInt y residuo en última cuota; suma exacta igual al acuerdo. Cada cuota debe ser positiva, tener fecha y un hito comercial acordado.

GET /api/v1/admin/quotes/:id/versions: historial con cuotas y pagos, mismo RBAC.

POST /api/v1/admin/payments/events: conciliación administrativa autenticada, NO webhook público. Body {scheduleId,externalEventId,amountMinor,currency,status:CONFIRMED|FAILED}. Se requiere importe/moneda exactos de cuota vigente. Misma clave y contenido retorna el mismo pago; clave reutilizada con contenido distinto o segunda confirmación de cuota retorna 409. Fallidos no habilitan kickoff.

B implementa firma, origen del evento y pasarela; después llama PaymentsService.processEvent. Se serializa por Quote para evitar carreras entre oficialización y pago. `externalEventId` es único; B debe prefijarlo con el proveedor si sus claves no son globalmente únicas.

PaymentsService.assertInitialPayment verifica primera cuota de la versión vigente. Crear proyectos operativos o transicionar IN_DEVELOPMENT/IN_REVIEW/COMPLETED sin cotización oficial/pago inicial está bloqueado. Los registros de portafolio existentes permanecen intactos; nuevas altas administrativas comienzan en DRAFT. Kickoff del Sprint 10 será el camino para materializar el proyecto vinculado.

Errores: 400 cuotas/importes/cliente inválidos; 401/403 autenticación y RBAC; 404 Quote/cuota; 409 versión sustituida, pago inicial pendiente o conflicto de idempotencia.

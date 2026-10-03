# Solicitudes de activación de cuentas cliente

Las solicitudes permiten que ADMIN derive al SUPER_ADMIN la creación de una cuenta cliente para
un visitante. Enviar la solicitud no crea una cuenta ni envía un correo.

## Endpoints

- `POST /api/v1/admin/client-activation-requests` — ADMIN o SUPER_ADMIN; cuerpo `{ "prospectId": 123 }`.
  Es idempotente mientras exista una solicitud pendiente para el visitante.
- `GET /api/v1/admin/client-activation-requests` — ADMIN recibe sus solicitudes; SUPER_ADMIN recibe
  las solicitudes pendientes globales.
- El SUPER_ADMIN abre el formulario administrativo `POST /api/v1/users` y crea manualmente el rol
  `CLIENT`. Al incluir `activationRequestId` en el cuerpo, la creación de la cuenta, la vinculación
  con el visitante y el cierre de la solicitud se realizan en una sola transacción.

Las respuestas usan el envoltorio global `{ success, message, data }`. La respuesta de creación
incluye `id`, `prospectId`, `status`, `createdAt` y `alreadyPending`. El listado contiene `items` con
el visitante, la cotización más reciente y el administrador solicitante.

El correo del usuario nuevo debe coincidir con el correo del visitante. Si la creación de cuenta
falla, la solicitud permanece pendiente; si tiene éxito, se marca atendida y el prospecto queda
vinculado al cliente. Una segunda atención o un visitante ya convertido devuelve `409`.

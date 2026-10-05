# Solicitudes de activación de cuentas cliente

Las solicitudes permiten que ADMIN derive al SUPER_ADMIN la creación de una cuenta cliente para
un visitante. Enviar la solicitud no crea una cuenta ni envía un correo.

## Endpoints

- `POST /api/v1/admin/client-activation-requests` — ADMIN o SUPER_ADMIN; cuerpo `{ "prospectId": 123 }`.
  Es idempotente mientras exista una solicitud pendiente para el visitante.
- `GET /api/v1/admin/client-activation-requests` — ADMIN recibe sus solicitudes; SUPER_ADMIN recibe
  las solicitudes pendientes globales.
- El SUPER_ADMIN llama a POST /api/v1/auth/client-invitations con el nombre, el correo y activationRequestId. El servidor crea una cuenta CLIENT inactiva, vincula la cuenta con el visitante y atiende la solicitud en una sola transacción; después envía un enlace de activación de un solo uso al correo registrado.
- No se envía una contraseña en texto claro. El cliente define su contraseña al activar la cuenta.
- Si falla el correo, la cuenta y la solicitud quedan creadas y vinculadas; la respuesta informa delivery: FAILED y el cliente puede volver a solicitar el enlace de activación.

### Configurar correo real

Para usar Gmail sin dominio propio, habilita la verificación en dos pasos y crea una contraseña de aplicación. Configura NOTIFICATION_PROVIDER=smtp, SMTP_HOST=smtp.gmail.com, SMTP_PORT=465, SMTP_SECURE=true, SMTP_USER, SMTP_PASS y MAIL_FROM en el entorno del backend. No compartas ni registres SMTP_PASS. Reinicia la API después de cambiar estas variables. El modo fake no entrega mensajes y las invitaciones quedan bloqueadas mientras no haya proveedor real.
Las respuestas usan el envoltorio global { success, message, data }. La respuesta de creación
incluye id, email, isActive y delivery. El listado contiene items con el visitante, la cotización
más reciente y el administrador solicitante.

El correo del usuario nuevo debe coincidir con el correo del visitante. Una segunda atención, un
correo diferente o un visitante ya convertido devuelve 409.

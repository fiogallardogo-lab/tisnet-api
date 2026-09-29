# Sprint 14 — Contratos del Responsable A

Fecha: 2026-09-29. Base HTTP: /api/v1. Swagger: /api/docs (JSON: /api/docs-json).

## Convenciones y permisos

Respuestas JSON exitosas: { "success": true, "message": "…", "data": … }.
Errores: { "success": false, "message": "…" o ["…"], "error": "…" }.
DTO rechaza campos desconocidos. IDs numéricos positivos. Importes en unidades menores (céntimos); porcentaje en puntos base: 10000 = 100%.
El JSON de Prisma puede serializar Decimal como string; consumidores deben normalizar amountMinor. El acuerdo del cliente normaliza importes a number.

| Operación | Roles | Éxito | Errores de dominio |
|---|---|---|---|
| POST /public/quotes | Público | 201 | 400, 422, 429, 503 |
| PATCH /admin/quotes/:id | ADMIN, SUPER_ADMIN | 200 | 400, 401, 403, 404, 409 |
| POST /admin/quotes/:id/versions | ADMIN, SUPER_ADMIN | 201 | 400, 401, 403, 404, 409 |
| GET /admin/quotes/:id/versions | ADMIN, SUPER_ADMIN | 200 | 401, 403 |
| POST /admin/quotes/:id/send | ADMIN, SUPER_ADMIN | 201 | 401, 403, 404 |
| POST /prospects/link-quote | CLIENT | 201 | 400, 401, 403, 404, 409 |
| POST /client/quotes/:id/observations | CLIENT propietario | 201 | 400, 401, 403, 404, 409 |
| GET /client/quotes/:id/observations | CLIENT propietario | 200 | 401, 403, 404 |
| GET /admin/quotes/:id/observations | ADMIN, SUPER_ADMIN | 200 | 401, 403, 404 |
| GET /client/quotes/:id/agreement | CLIENT propietario | 200 | 401, 403, 404 |
| POST /client/quotes/:id/accept | CLIENT propietario | 201 | 400, 401, 403, 404, 409 |
| POST /auth/client-invitations | ADMIN, SUPER_ADMIN | 201 | 400, 401, 403, 409, 503 |
| POST /auth/request-activation | Público | 200 | 400, 429 |
| POST /auth/activate | Público con token | 200 | 400, 409, 429, 503 |
| POST /public/contact | Público | 201 | 400, 429 |

PRODUCT_OWNER y DEVELOPER no reciben permisos comerciales nuevos. Los endpoints protegidos requieren Authorization: Bearer <accessToken>. Persisten los límites globales de solicitudes.

## Edición de borrador y versiones

PATCH /admin/quotes/42

~~~json
{
  "expectedUpdatedAt": "2026-09-29T10:00:00.000Z",
  "fullName": "Ana Torres",
  "phone": "+51 987654321",
  "company": "Empresa SAC",
  "notes": "Ajustar alcance en reunión"
}
~~~

Solo estos cuatro campos de contenido son editables. expectedUpdatedAt se obtiene del detalle administrativo. Se requiere al menos uno; null no es válido. Email, propietario, estado, precio e IDs no se modifican aquí. Devuelve la cabecera persistida con nuevo updatedAt. Revisión obsoleta: 409. Tras crear una versión oficial, el PATCH devuelve 409; usar nueva versión para cambios de alcance, importe y cuotas. No se sobrescribe el historial.

POST /admin/quotes/42/versions

~~~json
{
  "clientUserId": 7,
  "amountMinor": 10001,
  "currency": "PEN",
  "scope": "Sitio web acordado",
  "observations": "Incluye dos revisiones",
  "installments": [
    { "percentageBasisPoints": 5000, "dueDate": "2027-01-01", "milestone": "Adelanto" },
    { "percentageBasisPoints": 5000, "dueDate": "2027-02-01", "milestone": "Entrega final" }
  ]
}
~~~

Cliente activo de rol CLIENT, con email coincidente y prospecto compatible. 1–5 cuotas, fechas civiles válidas YYYY-MM-DD en orden no decreciente, descripción no vacía y suma EXACTA de 10000. Cada importe debe ser positivo; la última cuota absorbe el resto de redondeo. El ejemplo produce 5000 + 5001 céntimos. Una cotización con pagos confirmados no admite sustitución (409).

Respuesta data: QuoteVersion con id, quoteId, version (secuencia), clientUserId, authorId, scope, observations, amountMinor, currency, createdAt, officialAt, acceptedAt, acceptedByUserId y schedules. Cada schedule incluye id, sequence, percentageBasisPoints, amountMinor, dueDate y milestone. La nueva versión y la auditoría se guardan en transacción bajo bloqueo de la cotización. Después se intenta enviar el PDF de ese ID exacto de versión.

GET /admin/quotes/:id/versions devuelve array descendente; si no hay versiones devuelve []. GET del acuerdo conserva campos anteriores y añade versions[] con id persistido, version secuencial, kind, status, notes, canAccept e installments. Consumir el ID persistido para observar y aceptar.

## Vinculación, observaciones y aceptación

POST /prospects/link-quote: { "publicCode": "Q-ABCDEFGH" }.
Normaliza espacios y mayúsculas; formato Q- + 8 caracteres sin I/O/0/1. Código malformado: 400; inexistente: 404; email ajeno: 403; ya usado u otro vínculo: 409. El primer éxito devuelve prospecto y cotizaciones. Bloqueo de fila y marca QUOTE_LINKED en auditoría impiden doble consumo concurrente. Es un cambio intencional respecto al reintento 201 del contrato anterior: C debe mostrar «ya vinculada» y recargar /prospects/me.

POST /client/quotes/42/observations: { "versionId": 123, "text": "Confirmar entregables" }.
Texto 1–2000 caracteres tras trim. Solo versión activa aún no aceptada. Devuelve { id, quoteId, versionId, authorId, text, createdAt }. Lecturas devuelven { items: [...] } en orden ascendente. Las observaciones son append-only: sin PATCH/DELETE. Contenido en QuoteObservation; auditoría registra actor, cotización y secuencia de versión, sin copiar texto libre.

POST /client/quotes/42/accept: { "versionId": 123, "accepted": true }.
versionId es QuoteVersion.id; NO es QuoteVersion.version. Devuelve { accepted: true, acceptedAt: ISODate }. Dos aceptaciones concurrentes conservan fecha y un solo evento de auditoría. Versión sustituida: 409; versión no accesible: 404; false/string o campos inválidos: 400. No admite observaciones posteriores a aceptar.

## Invitación y activación

POST /auth/client-invitations: { "name": "Ana Torres", "email": "ana@example.test" }.
Crea CLIENT inactivo con contraseña aleatoria inaccesible. Devuelve { id, email, isActive: false, delivery: "SENT"|"FAILED", messageId? }. No devuelve token ni passwordHash. Correo existente: 409. Cuenta recuperable mediante request-activation si falla el envío.

POST /auth/request-activation: { "email": "ana@example.test" }.
Respuesta genérica { requested: true, message: "Si tu cuenta está pendiente de activación, recibirás las instrucciones." }. No reactiva cuentas suspendidas con consentimiento previo. Solo envía a CLIENT inactivo sin aceptación legal.

POST /auth/activate

~~~json
{
  "token": "token recibido exclusivamente por correo",
  "password": "Una contraseña elegida por el usuario",
  "acceptedTerms": true,
  "termsVersion": "VERSION_APROBADA_TERMINOS",
  "privacyVersion": "VERSION_APROBADA_PRIVACIDAD"
}
~~~

Devuelve { activated: true }. Token JWT HS256, audiencia tisnet-activation, issuer tisnet-api, propósito activate, expiración 24 horas. Verifica versión de revocación y actualiza estado/contraseña/consentimiento/tokenVersion en una sola transacción. Reutilización o cuenta no elegible: 409; token inválido/vencido: 400. Contraseña 8–72 caracteres y máximo 72 bytes UTF-8 por bcrypt. Versiones legales deben coincidir con TERMS_VERSION y PRIVACY_VERSION del servidor; configuración ausente devuelve 503. C debe presentar textos legales aprobados antes de enviar aceptación. Este cambio no inventa ni aprueba textos legales.

El acceso normal sigue usando /auth/login. El token de activación no concede sesión: la cuenta está inactiva antes de usarlo y tokenVersion queda revocado después. El registro público existente /auth/register se conserva como flujo separado.

## Contacto

POST /public/contact

~~~json
{
  "name": "Ana Torres",
  "email": "ana@example.test",
  "phone": "+51 987654321",
  "subject": "Consulta comercial",
  "message": "Necesito información de sus servicios."
}
~~~

name 2–100, email válido hasta 150, phone opcional hasta 30, subject 3–150, message 10–5000. Normaliza email/espacios. Respuesta { code: "C-<UUID>", status: "RECEIVED", createdAt: ISODate } solo después de persistir. La confirmación se verifica en ContactInquiry por code. No significa correo entregado; no expone mensajes mediante un buscador público.

## Correos, PDF y reuniones

POST /public/quotes intenta correo con PDF después de guardar. Oficialización envía el PDF de la versión recién creada. POST /admin/quotes/:id/send reintenta la última versión al contacto guardado, sin aceptar destinatario arbitrario; devuelve delivery SENT/FAILED y messageId cuando aplica. SENT significa que el proveedor aceptó el mensaje, no garantiza lectura ni entrega final.

Agenda interna existente: POST /public/meetings con { advisorId, name, email, phone?, quoteId: publicCode, start: ISODate, end: ISODate }. Requiere cotización/contacto coincidentes. Devuelve reunión PENDING; correo dice pendiente. PATCH /meetings/:id/status con { status: "SCHEDULED" } (ADMIN/SUPER_ADMIN) guarda confirmación y envía correo confirmado a cliente/asesor. También comunica cancelación, finalización y reprogramación del flujo interno. Este entregable utiliza la agenda interna; el webhook Calendly existente no se declara parte de la prueba final A07.

Correos de cotización y reunión incluyen Cotizar, Registrarse y Agendar asesoría. URLs parten de PUBLIC_FRONTEND_URL, o primer FRONTEND_URL; en desarrollo se permite localhost:5173. Agenda enlaza al flujo público /quote. Configurar dominio correcto antes de demo. Los fallos comerciales se auditan como COMMERCIAL_MAIL_FAILED y conservan la operación principal; los éxitos como COMMERCIAL_MAIL_SENT. No hay cola durable ni confirmación de lectura; reintento de cotización es administrativo y activación usa request-activation.

NOTIFICATION_PROVIDER=smtp o resend para entorno real. fake está prohibido con NODE_ENV=production/staging o S14_DEMO=true. Tests automáticos capturan mensajes sin contactar personas; la demo final exige proveedor real/sandbox y verificación de buzón.

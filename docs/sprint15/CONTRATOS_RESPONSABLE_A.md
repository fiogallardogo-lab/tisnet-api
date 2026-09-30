# Sprint 15 — Contratos del Responsable A

Base de API: /api/v1. Respuestas normales: {success:true,data:...}. JWT y permisos se verifican en servidor. Errores usan el filtro común; no contienen credenciales del proveedor.

## Recordatorios y calendario

- La entrega o aprobación programa un recordatorio por cuota oficial vigente, aceptada y pendiente. Evento configurable: PAYMENT_REMINDER_TRIGGER=APPROVED (predeterminado) o SUBMITTED. Las observaciones no crean nuevos recordatorios.
- El evento, el recordatorio, sus destinatarios y su auditoría se confirman dentro de la misma transacción. Si falta política aprobada o cliente/administración activos, el evento se rechaza con 503 y se revierte.
- Fecha civil de America/Lima, sin contar el día del evento; se cuentan los siguientes tres días laborables excluyendo sábados, domingos y feriados nacionales. Al tercer día se aplica PAYMENT_REMINDER_CUTOFF, formato HH:mm. No cambia la fecha contractual de la cuota.
- Calendario nacional: 16 feriados, incluidos Jueves/Viernes Santo calculados por año. Referencia: [calendario oficial peruano](https://www.gob.pe/feriados). Los días no laborables sujetos a acuerdo se agregan expresamente mediante PAYMENT_REMINDER_EXTRA_HOLIDAYS, fechas ISO separadas por comas. La hora y el evento deben aprobarse antes de habilitar el flujo real.
- Se guarda PAYMENT_REMINDER_POLICY_VERSION, la hora, la fecha del evento y el vencimiento. Una modificación posterior de configuración no recalcula deudas ya programadas.
- Un registro único por scheduleId evita duplicar o reiniciar el plazo al reenviar. Destinatarios: cliente y todos los Admin/Superadmin activos al programar. Incorporar después otro administrador no altera los destinatarios históricos.
- Worker cada 60 segundos cuando PAYMENT_REMINDERS_ENABLED=true; lotes de 50, reserva atómica de tres minutos. Revalida propietario/rol/actividad, aceptación, versión vigente y saldo antes de enviar. Deuda pagada/reemplazada o destinatario sin acceso: CANCELLED. Evidencia observada: aplaza una hora sin consumir intento de correo.
- Hasta cinco intentos con espera exponencial, luego FAILED. Una reserva vencida se recupera tras caída de proceso. Resend recibe Idempotency-Key estable; SMTP usa Message-ID estable. SMTP ofrece entrega al menos una vez: una caída tras aceptación SMTP y antes de guardar SENT puede duplicar un mensaje. No se promete exactamente una vez ni entrega en bandeja externa sin evidencia del proveedor.

| Método/ruta | Permiso | Resultado |
| --- | --- | --- |
| GET /quotes/:id/payment-reminders | Admin/Superadmin; cliente propietario | Fechas, política y estados; cliente solo ve sus envíos. Sin email, userId, claimToken ni messageId. |
| POST /admin/payment-reminders/:id/retry | Admin/Superadmin | Solo FAILED: {queued:true}; 409 en otro estado. Worker vuelve a comprobar deuda. |

## Contenido legal

GET /public/legal/policy entrega terms{version,text}, privacy{version,text}, approvedAt y contentHash SHA-256. Son textos planos: C debe renderizarlos escapados, sin HTML directo. El endpoint devuelve 503 si no hay contenido aprobado válido.

LEGAL_CONTENT_FILE debe apuntar a JSON administrado por despliegue, no al CV/fotos ni a datos enviados por usuarios. Estructura (marcadores; NO son textos aprobados):

    {
      "approvalReference": "<acta o referencia de aprobación>",
      "approvedAt": "<fecha ISO de aprobación, no futura>",
      "terms": {"version": "<TERMS_VERSION>", "text": "<texto definitivo aprobado>"},
      "privacy": {"version": "<PRIVACY_VERSION>", "text": "<texto definitivo aprobado>"}
    }

Versiones: máximo 50 caracteres; texto: 20–150000 caracteres; archivo: máximo 500000 bytes. Referencia y propiedades ajenas al contrato no se publican. La referencia registra la declaración operativa de aprobación; la API no puede sustituir la aprobación jurídica humana.

Registro, activación y renovación de consentimiento persisten versiones y fecha en User. En production/staging, con LEGAL_REQUIRE_PUBLISHED=true o LEGAL_CONTENT_FILE configurado, no se acepta una versión sin el contenido correspondiente publicado. Desarrollo/test conservan compatibilidad con las pruebas anteriores basadas en versiones. Cada cambio de texto debe introducir nueva versión; conservar las copias históricas del archivo legal en el repositorio documental aprobado.

## Equipo público

GET /public/team?page=1&limit=20 (máximo 100) entrega items, page, hasMore. Cada item contiene únicamente id, displayName, biography, specialty, photoUrl, role, advisorId y cta. CTA: /quote; advisorId permite a C preseleccionar asesor donde proceda.

PUT /admin/public-team/:userId requiere Admin/Superadmin y cuerpo:

    {"displayName":"Nombre público","biography":"Presentación aprobada",
     "specialty":"Backend","photoUrl":"https://<host-aprobado>/foto.png",
     "approved":true,"consentRecorded":true}

Publica solo Developer, PO o Admin activo con aprobación y consentimiento. Para retirar: approved=false. No copia automáticamente nombre legal, DNI/RUC, email, CV ni foto privada de la postulación. El editor debe aprobar también el contenido libre de biografía. Foto opcional, HTTPS, host incluido en PUBLIC_TEAM_MEDIA_HOSTS, sin credenciales, query ni fragmento; rechaza rutas de CV/documentos privados. Revocar el host oculta la imagen. El directorio histórico de asesores conserva isPublicAdvisor y sanea URLs públicas.

## Cierre económico

GET /quotes/:id/financial-status: Admin/Superadmin o cliente propietario. PO/Developer no reciben montos. Estados: NO_OFFICIAL_VERSION, INCONSISTENT, UNACCEPTED, OPEN, PAID. Incluye versiones, importes en unidades menores, saldo y desglose de cuotas.

Solo cuenta Quote.activeVersion. Requiere aceptación, de una a cinco cuotas, suma igual al total oficial, misma moneda y pago confirmado exacto por cuota. Pagos fallidos, incompletos, excesivos o de versiones anteriores no habilitan cierre.

POST /projects/:id/close: Admin/Superadmin o PO asignado. Requiere entregables aprobados para todos los hitos; en proyectos comerciales, todas las cuotas vigentes completadas y vinculadas a hitos del proyecto. Respuesta mínima {id,name,status}; nunca expone finanzas al PO. El cierre ya completado es idempotente. 400 si faltan aprobaciones; 409 por deuda, versión/hitos incompatibles o archivo; 403 por permisos.

Checkout y cargo continúan rechazando versiones reemplazadas antes de invocar proveedor. Los informes financieros cuentan solo la versión vigente; los informes de PO/Developer omiten montos y todos los informes de trazabilidad omiten correos personales.

## Correo de postulación

POST /public/team-applications conserva el contrato multipart existente y añade notificationStatus SENT/FAILED. Envía confirmación sin adjuntar CV/foto/DNI; una falla de correo no pierde la postulación. Auditoría registra APPLICATION_RECEIPT_SENT/FAILED sin contenido personal. SENT significa aceptación SMTP/HTTP del proveedor, no prueba de lectura o bandeja externa.

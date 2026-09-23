# Sprint 6 — Notificaciones de postulaciones (cierre del Responsable B)

Rama: `feature/s6-application-notifications`, creada desde `develop` local.
Fuente funcional: instrucciones de las partes 1 y 2 entregadas por el equipo. El documento
completo «Plan de Desarrollo Sprint 6 TISNET» no está presente en este checkout.

## Auditoría y compatibilidad

- `src/notifications/notification-provider.interface.ts`: contrato existente
  `NotificationProvider.send(SendNotificationInput): Promise<NotificationResult>` y
  token `NOTIFICATION_PROVIDER` (Symbol). Se conservan sin cambios.
- `src/notifications/notifications.module.ts`: ya exportaba el token y seleccionaba
  `FakeNotificationProvider`. Ahora carga la configuración validada dentro del mismo
  módulo y exporta también la misma instancia fake para pruebas.
- `src/notifications/fake-notification.provider.ts` y su spec: historial en memoria,
  IDs incrementales, simulación de errores y `clear()`. No había transporte real,
  plantillas de postulaciones, timeouts ni reintentos.
- `src/documents/quote-delivery.service.ts`, su spec y `documents.module.ts`:
  consumidor existente de la abstracción para adjuntar cotizaciones PDF. Se conserva
  su contrato y sus pruebas; no se modifican estos archivos.
- `src/config/` no existía. `package.json` no declara un SDK de correo ni nodemailer.
  La búsqueda de configuración local no encontró claves NOTIFICATION/MAIL/SMTP/
  RESEND/SENDGRID configuradas. No se copiaron valores secretos.
- Se revisaron el inventario y convenciones de `test/**`, `docs/contracts/**`,
  `.env.example`, `vitest.config.ts`, `vitest.config.e2e.ts` y `tsconfig.json`.
  Los contratos de cotizaciones describen el proveedor abstracto; Services menciona
  SMTP/SendGrid/Resend como posibilidades fuera de alcance, no como elección aprobada.
- Las pruebas usan Vitest y Nest TestingModule; los E2E existentes con Prisma
  requieren una base aislada. La suite de notificaciones no usa base ni red externa.
- AppModule ya importa NotificationsModule; no se modificó ni se registró otro módulo.

## Contrato para Responsable A

Importar desde `src/notifications` (o rutas directas equivalentes):

```ts
import {
  NOTIFICATION_PROVIDER,
  NotificationsModule,
  renderInterviewAssigned,
  renderRejectedApplication,
} from '../notifications';
import type { NotificationProvider } from '../notifications';

// En el módulo consumidor: imports: [NotificationsModule].
// En su servicio: @Inject(NOTIFICATION_PROVIDER) private readonly notifications: NotificationProvider
await notifications.send(renderInterviewAssigned({
  recipient: 'candidate@example.com',
  candidateName: 'Ana',
  applicationCode: 'TEAM-12345678',
  requestedRole: 'DEVELOPER',
  interviewerName: 'Alex',
  calendlyUrl: 'https://calendly.com/tisnet/entrevista', // opcional/null
}));

await notifications.send(renderRejectedApplication({
  recipient: 'candidate@example.com',
  candidateName: 'Ana',
  applicationCode: 'TEAM-12345678',
  requestedRole: 'DEVELOPER',
  rejectionReason: 'En esta convocatoria necesitamos otra especialidad.',
}));
```

`InterviewAssignedNotification` y `RejectedApplicationNotification` son tipos
propios sin referencias a Prisma, controllers ni DTO de postulaciones. Los builders
devuelven `ApplicationNotificationMessage`, compatible con SendNotificationInput.
Proyectan explícitamente los campos: no copian objetos de dominio ni adjuntan archivos.
El destinatario debe ser un email válido; textos obligatorios no vacíos; el código
no puede contener CR/LF (protección del asunto). No se impone un formato nuevo al código.
Errores de entrada se propagan antes de llamar al proveedor, con mensajes sin payload.

Metadata obligatoria generada por los builders:

```json
{ "type": "INTERVIEW_ASSIGNED", "applicationCode": "TEAM-12345678" }
```

Para rechazo: `type: 'APPLICATION_REJECTED'`. A debe conservar esta metadata y
usar el código persistido del dominio. No añadir DNI, CV, fotografía, credenciales,
tokens ni datos de perfil a metadata o cuerpos. El motivo debe ser apto para
comunicarse al candidato: escapar HTML no elimina información privada del texto.

## Fake y trazabilidad

`getApplicationAttempts()` devuelve copias de `{ type, recipient, applicationCode }`
de cada intento, incluso cuando `simulateFailure(true)` provoca
`NotificationDeliveryError`. Es una traza en memoria de pruebas, no una auditoría
persistente ni confirmación de entrega. No se escribe a consola.

Para los dos tipos de postulaciones, `getSentNotifications()` conserva únicamente
destinatario, asunto fijo `Application notification (content omitted)` y metadata
permitida. No retiene HTML/texto, motivo, nombre, URL, adjuntos ni metadata arbitraria.
Los cuerpos se verifican directamente sobre el resultado de los builders en tests.
Un fallo no aparece en el historial de éxitos; sí aparece en los intentos.
`clear()` limpia ambos historiales, el error y la secuencia de IDs.

El comportamiento anterior del fake para cotizaciones se conserva, incluyendo sus
adjuntos en memoria, para no romper el consumidor existente. La minimización nueva
se aplica a los dos tipos de postulaciones identificados en metadata.

## Configuración y bloqueo del correo real

PROVEEDOR REAL: PENDIENTE DE DECISIÓN DEL EQUIPO.

DEPENDENCIAS EXTERNAS PENDIENTES:
- proveedor de correo
- remitente verificado
- credenciales

Mientras tanto, FakeNotificationProvider es la implementación utilizada para
desarrollo y pruebas. No se instalaron SDKs ni se realizaron llamadas a Internet.

Única variable añadida: `NOTIFICATION_PROVIDER=fake` (también valor predeterminado
si está ausente). Vacío u otro valor rechaza el arranque con un error explícito;
nunca cae silenciosamente al fake ante una selección de proveedor real.
La carga se realiza con ConfigModule.forFeature dentro de NotificationsModule.
No requiere claves, remitente, red externa ni cambios en AppModule.

**Bloqueo externo:** falta que el equipo elija y apruebe proveedor, remitente
verificado y acceso a un entorno de pruebas con credenciales por variables de entorno.
No se añadió SDK, adaptador ficticio de correo real, secreto ni dependencia nueva.
La frontera técnicamente verificable es el contrato existente y los mensajes completos.
El futuro adaptador deberá implementar NotificationProvider y seleccionarse aquí.

No se añaden MAIL_FROM, MAIL_FROM_NAME, MAIL_API_KEY, MAIL_TIMEOUT_MS ni
MAIL_MAX_RETRIES todavía: no hay transporte que las consuma ni proveedor que determine
cuáles son necesarias. La validación de remitente válido, timeout entero positivo,
reintentos acotados y credenciales obligatorias condicionadas al proveedor queda
pendiente junto con ese adaptador. No se afirma haber implementado timeout, retry,
idempotencia, cola/outbox, entrega garantizada o envío de correo real en esta parte.
Antes de habilitar reintentos debe acordarse la política frente a timeout ambiguo
y duplicados; el fake no se presenta como evidencia de entrega externa.

## Plantilla de entrevista (ejemplo)

Asunto: `Entrevista asignada — Postulación TEAM-12345678`

Texto plano:

```text
Hola, Ana.

Tu postulación TEAM-12345678 para el rol DEVELOPER avanzó a la etapa de entrevista.

Tu entrevistador será Alex.

Coordina tu entrevista aquí: https://calendly.com/tisnet/entrevista

Gracias por tu interés en formar parte de TISNET.
Equipo TISNET
```

HTML:

```html
<p>Hola, Ana.</p>
<p>Tu postulación <strong>TEAM-12345678</strong> para el rol DEVELOPER avanzó a la etapa de entrevista.</p>
<p>Tu entrevistador será Alex.</p>
<p>Coordina tu entrevista aquí: <a href="https://calendly.com/tisnet/entrevista">https://calendly.com/tisnet/entrevista</a></p>
<p>Gracias por tu interés en formar parte de TISNET.<br>Equipo TISNET</p>
```

Sin enlace, ambos formatos indican que el equipo se pondrá en contacto para
coordinar la entrevista. No se inventa una URL ni se imprime null/undefined.

## Plantilla de rechazo (ejemplo)

Asunto: `Resultado de postulación — TEAM-12345678`

Texto plano:

```text
Hola, Ana.

Gracias por postular a TISNET. En esta oportunidad, tu postulación TEAM-12345678 para el rol DEVELOPER no continuará en el proceso.

Motivo: En esta convocatoria necesitamos otra especialidad.

Agradecemos tu tiempo y tu interés. Te deseamos éxito en tus próximos proyectos.
Equipo TISNET
```

HTML:

```html
<p>Hola, Ana.</p>
<p>Gracias por postular a TISNET. En esta oportunidad, tu postulación <strong>TEAM-12345678</strong> para el rol DEVELOPER no continuará en el proceso.</p>
<p>Motivo: En esta convocatoria necesitamos otra especialidad.</p>
<p>Agradecemos tu tiempo y tu interés. Te deseamos éxito en tus próximos proyectos.<br>Equipo TISNET</p>
```

## HTML y URLs

`escapeHtml` reemplaza `& < > " '` por entidades en una sola pasada. Se usa para
nombre, código, rol, entrevistador, motivo y URL (atributo y texto). El texto plano
mantiene los caracteres originales. Solo después del escapado del motivo se
transforman saltos de línea en `<br>` estáticos.
Las URLs se parsean con URL y requieren HTTPS sin usuario/contraseña; se rechazan
javascript:, data:, HTTP y URLs relativas. No se limita el host exclusivamente a
Calendly: el dominio debe proporcionar el enlace aprobado del entrevistador.
La codificación HTML y la validación de esquema resuelven riesgos distintos.

## Validación

```sh
npm run lint
npm run build
npm test -- src/notifications src/documents/quote-delivery.service.spec.ts
npm run test:e2e -- test/notifications.e2e-spec.ts
```

Cobertura: contenido mínimo en ambos formatos, enlace ausente y peligroso, escapado
de todos los campos dinámicos, CR/LF, datos privados extra, trazas de éxito/fallo,
reset del fake, configuración inválida, exportación e inyección desde un módulo
consumidor Nest y regresión de cotizaciones. El archivo E2E verifica integración
del módulo; no prueba endpoints administrativos ni correos reales.

Resultado de parte 1: lint y build exitosos; 40 pruebas aprobadas en las cuatro suites
unitarias seleccionadas (incluye fake y cotizaciones existentes); 2 pruebas de
integración Nest aprobadas. Vitest emite advertencias preexistentes sobre el futuro
configLoader de Vite y vite-tsconfig-paths; no se cambiaron esas configuraciones.

## Archivos entregados

Modificados: `.env.example`, `src/notifications/fake-notification.provider.ts`,
`src/notifications/notifications.module.ts`.

Nuevos:
- `src/config/notification.config.ts`
- `src/config/notification.validation.ts`
- `src/notifications/application-notification.types.ts`
- `src/notifications/templates/application-notifications.ts`
- `src/notifications/templates/escape-html.ts`
- `src/notifications/index.ts`
- `src/notifications/application-notifications.spec.ts`
- `src/notifications/notification-config.spec.ts`
- `src/notifications/notification-errors.ts`
- `src/notifications/notification-errors.spec.ts`
- `src/notifications/application-security.spec.ts`
- `test/notifications.e2e-spec.ts`
- `docs/contracts/application-notifications.md`

## Dependencias de A y alcance

**Responsable A debe conservar la decisión administrativa aunque el proveedor de
notificaciones falle.** B no persiste errores, intentos ni decisiones en la base.

A integrará las llamadas en las transiciones administrativas y mapeará los datos
del dominio a estos tipos. A debe decidir persistencia del intento/resultado,
tratamiento de fallos después de confirmar la transacción y prevención de duplicados.
Un `fake-message-*` solo acredita simulación, nunca una entrega al destinatario.
La integración del flujo, su RBAC y sus E2E quedan pendientes para A.

No se modifican Prisma, migraciones, src/team-applications, AppModule,
test/team-applications.e2e-spec.ts, package.json ni el frontend. No se envían correos,
no se hacen commits, push o merge.

## Resultado y fallos controlados (parte 2)

Se mantiene `send(): Promise<NotificationResult>` y la clase original
`NotificationDeliveryError(message)` sin cambios. El éxito conserva messageId,
recipient y sentAt. En fake, éxito significa simulación, no entrega externa.

Las clases nuevas extienden NotificationDeliveryError y están exportadas desde
`src/notifications`. Sus constructores no reciben payload ni respuestas externas:

| Error | Código seguro | retryable |
| --- | --- | --- |
| NotificationTransientError | NOTIFICATION_TRANSIENT | true |
| NotificationPermanentError | NOTIFICATION_PERMANENT | false |
| NotificationTimeoutError | NOTIFICATION_TIMEOUT | true |
| Error genérico/legacy/desconocido | NOTIFICATION_UNKNOWN | false |

`describeNotificationFailure(error: unknown)` proyecta exclusivamente código y
retryable. Nunca copia message, stack, cause, email ni respuesta del proveedor.
Un error desconocido se trata conservadoramente: no se adivina un HTTP status a
partir del mensaje. El futuro adaptador mapeará los errores específicos a estas clases.
Los errores de validación de plantillas también se pueden capturar como desconocidos
no reintentables; sus mensajes estáticos existentes no incluyen datos de entrada.

El fake ya permite `simulateFailure(true, new NotificationTransientError())`,
`new NotificationPermanentError()` y `new NotificationTimeoutError()`; falla
inmediatamente, registra un intento y no registra éxito. No introduce timers,
red, sleeps ni retries. `simulateFailure(false)` permite volver a enviar y
`clear()` restablece ambos historiales, contador y fallo.

Ejemplo conceptual para A (persistencia y logger pertenecen a A):

```ts
// Primero confirmar la decisión administrativa en la transacción del dominio.
try {
  const message = renderRejectedApplication(notificationInput);
  const result = await notifications.send(message);
  // A registra el resultado sin asumir que fake equivale a correo entregado.
} catch (error: unknown) {
  const failure = describeNotificationFailure(error);
  // A conserva la decisión ya confirmada y registra solo failure.code + trazabilidad.
  // Nunca registrar el objeto error, notificationInput o el cuerpo HTML.
}
```

## Logging seguro

El módulo no emite logs de payloads ni errores. Las trazas en memoria del fake
incluyen email solo para inspección de pruebas, no para consola. No se añade email
a logs: el contrato previo de cotizaciones pide evitarlo. Si A instrumenta eventos,
debe permitir únicamente notificationType, applicationCode validado del dominio,
provider, attempt, código seguro y timestamp. Debe evitar mensajes/stack/cause
externos y toda metadata libre. Sanitizar caracteres de control en identificadores
antes de introducirlos en un sistema de logs.

La privacidad se verifica con marcadores sintéticos de DNI, CV, foto, ruta privada,
access/refresh tokens, contraseña, API key, secreto y Authorization añadidos como
campos ajenos. Ambos builders los descartan y el fake no conserva esos extras,
adjuntos ni cuerpos en las notificaciones de postulaciones. Las pruebas también
vigilan console.log/error/warn/info/debug ante éxito y fallo. Esto no promete
detectar secretos escritos dentro de un nombre o motivo permitido: A debe proyectar
solo datos apropiados para el destinatario y nunca copiar el perfil completo.

## Política de timeout — DISEÑADO

No hay un helper ejecutable: sin adaptador no existe una operación de envío que
cancelar. Añadir Promise.race al fake daría una falsa garantía de cancelación.
Para el futuro adaptador se define:

- NOTIFICATION_TIMEOUT_MS opcional con default 5000 ms; validar entero 1..60000.
- Un límite por intento, incluyendo lectura de respuesta, y cancelación mediante
  la capacidad real del transporte (p. ej. señal abortable) cuando esté disponible.
- Nunca espera infinita; liberar timers/recursos en todos los caminos.
- Al agotar el límite, NotificationTimeoutError. Un timeout puede ocurrir después
  de que el proveedor aceptó el mensaje: no implica que no se haya entregado.
- Fake no requiere timeout ni credenciales. La simulación de timeout es inmediata.

## Política de retries — DISEÑADO

No hay bucle ni reintentos automáticos en esta entrega. Para el adaptador futuro:

- NOTIFICATION_MAX_RETRIES default 2; entero 0..5 (0 desactiva). Número total de
  intentos: 1 + maxRetries. Rechazar vacío, negativos, decimales, NaN e infinito.
- Candidatos: fallo transitorio de red, HTTP 429, HTTP 5xx y timeout. Mapear a
  NotificationTransientError o NotificationTimeoutError según corresponda.
- Nunca reintentar credenciales/configuración/destinatario inválidos ni 4xx
  definitivos: NotificationPermanentError. Desconocidos: sin retry automático.
- Backoff previsto: 250 ms * 2^(retry-1), tope 2000 ms con jitter acotado; respetar
  Retry-After solo dentro del presupuesto total, o devolver el fallo controlado.
- Presupuesto máximo finito: (1 + retries) * timeoutMs + retries * 2000 ms.
- Antes de repetir un timeout o resultado ambiguo, exigir idempotencia real del
  proveedor o reconciliación de su estado. `retryable: true` es una clasificación,
  no autorización a duplicar un envío. applicationCode solo no es clave suficiente:
  A debe distinguir transición/evento y notificación, incluida una reasignación.
- Tests futuros del adaptador con transporte simulado y reloj falso, sin sleeps largos.

Las dos variables aparecen solo comentadas en .env.example como política futura;
la configuración actual no las lee ni afirma validarlas. Solo NOTIFICATION_PROVIDER
está activo y validado. La validación de números y su aplicación se implementarán
junto con el transporte elegido; no se agregan opciones inertes al modo fake.

## Validación final de parte 2 (2026-09-23)

| Comando / revisión | Resultado |
| --- | --- |
| npm test -- src/notifications | 74 totales, 74 aprobadas, 0 fallidas (5 suites) |
| npm run lint | Correcto, salida 0 |
| npm run build | Correcto, salida 0 |
| npm test | 364 totales, 364 aprobadas, 0 fallidas (45 suites); incluye las 74 anteriores |
| npm run test:e2e -- test/notifications.e2e-spec.ts | 8 totales, 8 aprobadas, 0 fallidas; integración Nest aislada |
| npm run test:e2e general | No ejecutado: .env.test apunta a tisnet_test local pero faltan SEED_ADMIN_EMAIL/PASSWORD y SEED_DEVELOPER_EMAIL/PASSWORD |
| git diff --check | Sin errores |
| Auditoría de archivos modificados y nuevos | 16 archivos, todos dentro de la propiedad de B |

No se suman los 74 tests dirigidos a los 364 de la suite general: son los mismos.
Las 8 pruebas del archivo E2E son las pruebas de integración de notificaciones,
no una segunda suite distinta. No se preparó ni alteró una base para los E2E generales.
Las advertencias de configuración de Vite existentes no afectan el resultado.

Auditoría manual de DNI/CV/foto/password/token/API_KEY/secret/authorization:
coincidencias limitadas a marcadores sintéticos de tests, placeholders existentes,
documentación, token de DI y rechazo de URLs con credenciales. Sin secretos reales
ni cuerpos privados en logs. El contrato y el token originales no fueron modificados.
No hay cambios en Prisma, migraciones, team-applications, su E2E ni AppModule.
No se hizo commit, push ni merge.

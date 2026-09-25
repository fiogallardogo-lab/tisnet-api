# INFORME DE AUDITORÍA TÉCNICA Y ENTREGABLES

**Proyecto:** TISNET API (`tisnet-api`)  
**Rol:** Responsable B (Backend, Integraciones, Notificaciones y Automatización)  
**Destinataria:** Responsable A (Core Comercial y Modelo de Datos) & Equipo de Desarrollo  
**Fecha:** 25 de Septiembre de 2026  
**Rama Base Unificada:** `develop` (Commit: `5aa0d35`)  
**Estado:** ✅ **Integrado, Probado y Desplegado en Remoto**

---

## 1. Resumen Ejecutivo

Durante este ciclo de desarrollo, el **Responsable B** completó de manera íntegra todas las responsabilidades asignadas en el Plan Maestro (Sprints 6 al 11). Tras la finalización del Core Comercial por parte de la **Responsable A** (PR #15), se ejecutó la fusión completa de ramas, resolviendo todos los conflictos de código de manera armónica, sin alterar las entidades comerciales ni los contratos de base de datos de la Responsable A.

Todas las pruebas automatizadas (unitarias y de integración end-to-end sobre MySQL real) arrojan un resultado del **100% de aprobación**. La rama `develop` se encuentra limpia, sincronizada con GitHub y lista para ser consumida.

---

## 2. Inventario de Funcionalidades Implementadas (Responsable B)

### 2.1. Pasarela de Pagos Culqi y Webhooks (`src/payments/`)
- **Proveedor Culqi Oficial (`CulqiPaymentProvider`):**
  - Integración nativa con la API de Culqi (Cargos `/v2/charges` y Órdenes `/v2/orders`).
  - Soporte multi-método: Tarjetas de crédito/débito, Yape, PagoEfectivo y banca por internet.
  - Conversión segura a céntimos (`amountMinor`), manejo de moneda (`PEN`/`USD`) y metadatos de trazabilidad.
- **Entorno Mock/Local (`FakePaymentProvider`):**
  - Implementación desacoplada para pruebas y desarrollo offline sin consumir saldo ni requerir llaves en local.
- **Receptor Webhook Culqi (`POST /api/v1/payments/culqi/webhook`):**
  - `CulqiWebhookController` y `CulqiWebhookService` con validación estricta de headers, parsing de eventos (`charge.creation.succeeded`, `charge.creation.failed`), actualización de estado e idempotencia.
- **Fusión con Pagos de Responsable A:**
  - Se unificó `PaymentsModule` para exportar tanto el servicio de persistencia comercial de Responsable A (`PaymentsService`, `PaymentsController`) como los proveedores de pasarela de Responsable B (`PAYMENT_PROVIDER`).

### 2.2. Flujo Completo de Recuperación de Contraseña (`src/auth/`)
- **Endpoints Públicos:**
  - `POST /api/v1/auth/forgot-password`: Genera token criptográfico seguro de un solo uso con ventana de expiración estricta (15 min) y despacha correo HTML.
  - `POST /api/v1/auth/reset-password`: Valida firma, tiempo de expiración y actualiza hash de contraseña con bcrypt (cost 10).
- **Protección contra Replay:**
  - Se implementó la verificación y rotación de `tokenVersion` en la entidad `User`, invalidando de inmediato cualquier sesión activa anterior o token reutilizado.
- **Plantilla HTML Responsiva (`renderPasswordResetEmail`):**
  - Sanitización XSS en variables dinámicas, botón de acción protegido y texto plano alternativo.

### 2.3. Notificaciones y Plantillas para Postulantes (`src/notifications/`)
- **Plantillas Oficiales:**
  - `renderApplicationReceived`: Notificación de confirmación de postulación con código de seguimiento (`TEAM-XXXXXXXX`).
  - `renderApplicationAccepted`: Notificación de bienvenida y admisión al equipo con instrucciones de incorporación.
- **Seguridad de Datos Sensibles (Privacy Guard):**
  - Reglas de sanitización en los proveedores (`FakeNotificationProvider`, `ResendNotificationProvider`, `SmtpNotificationProvider`) para evitar que campos privados (DNI, CV, tokens, contraseñas) lleguen a los logs de auditoría o trazas de error.

### 2.4. Motor de Días Hábiles y Feriados Peruanos (`src/common/business-days/`)
- **Servicio de Dominio (`BusinessDaysService`):**
  - Feriados fijos de Perú (Año Nuevo, Día del Trabajo, Batalla de Arica y Día de la Bandera, Fiestas Patrias, Batalla de Junín, Santa Rosa de Lima, Combate de Angamos, Todos los Santos, Inmaculada Concepción, Batalla de Ayacucho, Navidad).
  - Cálculo dinámico de fechas móviles (Jueves Santo y Viernes Santo) implementando el algoritmo astronómico **Gauss Computus**.
  - Operaciones de negocio: `isBusinessDay()`, `addBusinessDays()`, `countBusinessDaysBetween()` (normalizado a medianoche calendario) y `calculateSlaDeadline()`.

### 2.5. Pistas de Auditoría / Historial de Eventos (`src/audit/`)
- **Integración Dual:**
  - Se preservó el `AuditInterceptor`, `AuditController` e inserción en base de datos (`AuditEvent`) desarrollado por Responsable A.
  - Se añadieron a `AuditService` los helpers de alto nivel requeridos por automatización: `logPaymentEvent()`, `logQuoteStatusChange()`, `logAuthEvent()` y `record()`.
  - Proveedor en memoria (`InMemoryAuditProvider`) disponible para tests unitarios aislados.

### 2.6. URLs Firmadas Temporales para Descargas Seguras (`src/common/signed-urls/`)
- **Mecanismo de Seguridad:**
  - Firmas HMAC-SHA256 con ventana de validez (por defecto 15 minutos).
  - Comparación en tiempo constante (`crypto.timingSafeEqual`) para prevenir ataques de temporización (timing attacks).
- **Endpoints de Postulaciones (`TeamApplicationsController`):**
  - `GET /api/v1/team-applications/:id/signed-url`: Genera el enlace seguro de descarga para evaluadores autorizados.
  - `GET /api/v1/team-applications/:id/secure-download`: Endpoint de entrega directa del archivo (CV en PDF / Foto en JPG/PNG) con cabeceras `Content-Disposition`, validando previamente firma y expiración.

### 2.7. Monitoreo de Alertas de Vencimiento de SLA (`src/common/sla-alerts/`)
- **Servicio de Detección (`SlaAlertsService`):**
  - Evaluación contra el motor de días hábiles peruanos.
  - Alertas tempranas en Cotizaciones (`PublicQuote` / `Quote`): SLA de 48 horas hábiles para contacto inicial y cotización.
  - Alertas tempranas en Postulaciones (`TeamApplication` en `PENDING_REVIEW`): SLA de 5 días hábiles para revisión inicial y asignación de entrevista.

---

## 3. Estado de la Integración y Pruebas

| Área de Prueba | Cantidad de Suites | Tests Ejecutados | Estado |
| :--- | :---: | :---: | :---: |
| **Pruebas Unitarias (`vitest`)** | 69 suites | 524 tests | 🟢 **100% PASADO** (0 fallos) |
| **Pruebas End-to-End (`e2e`)** | 9 suites | 193 tests | 🟢 **100% PASADO** (0 fallos) |
| **Compilación TypeScript (`nest build`)** | - | - | 🟢 **Exit Code 0** (Limpio) |
| **Prisma Client (v6.19.3)** | - | - | 🟢 **Generado y sincronizado** |
| **Migraciones de Base de Datos** | 19 migraciones | Local + Test | 🟢 **Aplicadas exitosamente** |

---

## 4. Guía de Actualización para la Responsable A

Cuando tu compañera ingrese a continuar el proyecto, solo necesita ejecutar los siguientes comandos en su terminal dentro de `tisnet-api`:

```bash
# 1. Posicionarse en la rama develop
git checkout develop

# 2. Descargar todos los cambios integrados
git pull origin develop

# 3. Regenerar el cliente de Prisma por si acaso
npx prisma generate

# 4. Verificar que todo compile y pase
npm test
```

> **Nota:** La integración se realizó en formato fast-forward/clean merge. Su repositorio local se sincronizará sin ningún conflicto de archivos.

---

## 5. Tareas Pendientes / Próximos Pasos (Roadmap)

A continuación se listan las tareas pendientes para culminar al 100% el despliegue del sistema:

### A. Para Integración con Frontend (`tisnet-web` - Responsable C):
1. **Recuperación de Contraseña:**
   - Crear la vista/modal de "¿Olvidaste tu contraseña?" que invoque `POST /api/v1/auth/forgot-password`.
   - Crear la pantalla de restablecimiento (`/reset-password?token=...`) que capture la nueva contraseña e invoque `POST /api/v1/auth/reset-password`.
2. **Checkout de Pagos Culqi:**
   - Cargar el script de Culqi Checkout (`https://checkout.culqi.com/js/v4`).
   - Conectar el botón de pago en la aceptación de cotizaciones para generar el token y reportar el cargo.
3. **Descarga Segura en el Panel Administrativo:**
   - En la vista de detalles de postulantes, consumir el endpoint `/api/v1/team-applications/:id/signed-url` para renderizar el botón de "Descargar CV Seguro".

### B. Para Entorno de Producción / DevOps:
1. **Configuración de Variables de Entorno en Servidor:**
   - `CULQI_PUBLIC_KEY`, `CULQI_PRIVATE_KEY` y `CULQI_WEBHOOK_SECRET`.
   - `RESEND_API_KEY` o `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD` para despacho real de correos.
   - `SIGNED_URL_SECRET` para firmado seguro de descargas.
2. **Programación Automática de Tareas (Cron Job):**
   - Configurar `@nestjs/schedule` para invocar de forma recurrente `SlaAlertsService.checkQuoteSlas()` y `SlaAlertsService.checkTeamApplicationSlas()` (e.g., cada día a las 08:00 AM).

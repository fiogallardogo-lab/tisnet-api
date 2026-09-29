# INFORME DE AUDITORÍA TÉCNICA Y ENTREGABLES

**TISNET — Sprint 14 — Responsable A (Backend comercial)**  
**Fecha:** 29 de septiembre de 2026  
**Repositorio:** https://github.com/fiogallardogo-lab/tisnet-api  
**Checkout de trabajo:** C:/Users/hp/tisnet-api-s14  
**Rama de trabajo:** codex/s14-commercial; destino de integración: develop.  
**Base final integrada:** develop 013fc1d, incluidos los cambios remotos del Responsable B.

## 1. Dictamen y alcance

El alcance funcional del Responsable A está implementado y cuenta con regresión automática aprobada: **587 pruebas unitarias y 223 E2E**, compilación correcta y lint sin errores. Los nuevos flujos comerciales se probaron con MySQL real, guards JWT/RBAC reales y captura de correo controlada exclusivamente para pruebas.

**No se certifica el cierre global del Sprint 14 ni un despliegue productivo.** La demostración con proveedor de correo real/sandbox, textos legales aprobados y recorrido frontend–Culqi–proyecto–kickoff–equipo sigue dependiendo de configuración y validación conjunta. También permanecen hallazgos previos de migraciones y dependencias detallados abajo. No se enviaron correos a personas ni se modificaron bases productivas.

El backend original C:/Users/hp/tisnet-api tenía cambios sin confirmar; se conservó intacto. Este trabajo se realizó en un checkout separado. El frontend tisnet-web no fue modificado para suplantar tareas del Responsable C.

## 2. Matriz de entregables A01–A09

| ID | Implementación entregada | Verificación y límite |
|---|---|---|
| S14-A01 | Edición administrativa de nombre, teléfono, empresa y notas con revisión expectedUpdatedAt; nuevas versiones oficiales sin sobrescritura. | 200/400/404/409, campos desconocidos rechazados, historial anterior conservado. Cabecera oficial bloqueada; cambios comerciales mediante nueva versión. |
| S14-A02 | 1–5 cuotas con descripción, fechas civiles válidas ordenadas y suma exacta 10000 puntos base. | Casos inválidos, cinco cuotas, redondeo íntegro de céntimos y persistencia del cronograma. |
| S14-A03 | Observaciones append-only del propietario, lectura administrativa y auditoría transaccional. | Acceso ajeno 403, versión inexistente 404, sustituida/aceptada 409; comprobación de contenido y evento en MySQL. |
| S14-A04 | Vinculación por código normalizado y consumo único bajo bloqueo de fila. | 400 malformado, 404 inexistente, 403 ajeno, 409 reutilizado; dos solicitudes simultáneas generan un único vínculo auditado. |
| S14-A05 | Invitación CLIENT inactivo, reenvío genérico, token de activación de 24 h, contraseña bcrypt, consentimiento y revocación atómica. | Token inválido/vencido, propósito incorrecto, términos obsoletos, contraseña UTF-8, concurrencia y reutilización. Login funciona después de activar. Textos/versiones aprobados y buzón real son dependencias externas. |
| S14-A06 | POST público de contacto con persistencia ContactInquiry y recibo C-UUID. | 201 solo después de guardar; validación 400 y código verificable en base. No afirma entrega por correo. |
| S14-A07 | Envío de PDF preliminar/oficial; correo de reunión interna según estado; CTA cotizar/registrar/agendar; fallos auditados y reintento administrativo. | PDF real capturado, destinatario persistido, ID exacto de versión, errores de render/proveedor y conservación del negocio. Confirmación real de entrega en sandbox pendiente. |
| S14-A08 | DTO/Swagger, contratos completos y entrega para B/C. | Swagger generado en E2E; rutas, permisos, ejemplos, respuestas y errores documentados. |
| S14-A09 | Nuevas pruebas comerciales y regresión integrada con últimos cambios de develop. | 587 unitarias + 223 E2E aprobadas, sin omitidas en la ejecución final. Incluye 200/201/400/401/403/404/409 y carreras reales de activación/vinculación/aceptación. |

## 3. Cambios técnicos relevantes

- Nuevo módulo commercial con servicios de edición/observaciones/contacto, activación y notificaciones.
- Nuevas tablas QuoteObservation y ContactInquiry con índices y claves foráneas. No se introduce tabla de tokens: la activación usa la versión de revocación y consentimiento existentes en User.
- Aceptación corregida para consumir QuoteVersion.id persistido, en lugar del número secuencial version. El acuerdo expone el historial completo y conserva campos anteriores para compatibilidad.
- Las mutaciones comerciales sensibles se auditan dentro de su transacción; el texto libre de observaciones permanece fuera de los metadatos de auditoría.
- El envío ocurre después del guardado; un fallo de correo no revierte la cotización. Cada oficialización envía la versión exacta que acaba de crear, incluso si hay otra posterior.
- Se exige SMTP o Resend en production/staging o con S14_DEMO=true. El modo fake queda disponible para tests/desarrollo.
- Se preservaron los servicios de habilitación y proyectos incorporados por B. Se resolvieron los conflictos de integración de PaymentsModule y PaymentsService conservando ambas dependencias.
- El E2E s14-concurrency incorporado desde develop tenía un TestingModuleBuilder en lugar de una aplicación y tokens ficticios; ahora arranca Nest, usa JWT y fixtures reales, comprueba persistencia única y respuestas exactas.

## 4. Evidencia de validación

| Comprobación | Resultado |
|---|---|
| npm run build | Exit 0 |
| npm run lint | Exit 0; 13 advertencias preexistentes, sin errores |
| npm test -- --maxWorkers=2 | 77 archivos, 587 pruebas aprobadas |
| npm run test:e2e -- --maxWorkers=1 | 12 archivos, 223 pruebas aprobadas |
| Prisma: schema anterior + SQL nuevo + migrate diff | Migración aplicada; No difference detected |
| Instalación completa con migrate deploy en base vacía | Bloqueada por migración histórica anterior a A; P3018/1146 |
| npm audit | 11 alertas: 8 altas, 1 moderada, 2 bajas; 0 críticas |

Evidencia resumida y sin secretos: EVIDENCIAS.json. Inventario de dependencias afectadas: DEPENDENCIAS_AUDIT.json. Las salidas detalladas de Vitest permanecen en tmp/s14-integrated-unit.json y tmp/s14-integrated-e2e.json, ignoradas por Git.

Las pruebas se ejecutaron en una instancia MySQL 8.0.46 temporal, independiente del servicio local existente, accesible únicamente por loopback y protegida con contraseña aleatoria. Las credenciales están en .env.test ignorado por Git. Se prepararon usuarios exclusivos de pruebas. El transporte de correo fake permite inspeccionar PDF, destinatarios y enlaces sin contactar personas; esto no sustituye la prueba final de buzón requerida por el plan.

## 5. Hallazgos abiertos y límites de certificación

### H01 — Alta: instalación desde cero bloqueada por orden histórico de migraciones

20260925170000_project_kickoff_audit ejecuta ALTER TABLE ProjectMember antes de su creación en 20260928100000_add_project_members_deliverables. MySQL devuelve 1146 y Prisma P3018. El fallo se reprodujo antes de llegar a la nueva migración de A. También debe revisarse la secuencia de ProjectDeliverable. Responsable: B, propietario de migraciones. No se reescribieron migraciones ya distribuidas ni se ejecutó reset en entornos existentes.

La migración nueva 20260928170000_s14_commercial sí fue aplicada sobre el schema anterior completo y su resultado coincide exactamente con el schema final. Ambas evidencias son distintas: el incremento de A es válido, pero la cadena histórica completa requiere reparación coordinada antes de instalar desde cero.

### H02 — Alta: alertas del árbol de dependencias existente

npm audit reportó ocho alertas altas y otras tres de menor gravedad; el inventario entregado identifica paquetes directos y transitivos. package.json y package-lock.json no cambian respecto de develop. Algunas soluciones propuestas por npm implican cambios de versión mayor o retrocesos; no se aplicó audit fix --force. El equipo debe actualizar y verificar dependencias como tarea de seguridad. Este informe no declara cumplido el criterio global «sin incidencias altas».

### H03 — Pendiente externo: demo de correo y aprobación legal

Faltan credenciales del proveedor/buzón de pruebas y confirmación de textos/versiones legales aprobados. El código exige versiones actuales; los valores test-s14 usados en tests son fixtures, no aprobación legal. El frontend debe presentar los documentos antes del consentimiento. Configurar PUBLIC_FRONTEND_URL y SMTP/Resend antes de la demo; el indicador SENT solo acredita aceptación del proveedor, no lectura del destinatario.

### H04 — Operación y cobertura del flujo integrado de B/C

La habilitación automática recibida de B necesita una Category activa. Dos suites legacy sin esa categoría registran esa dependencia; el nuevo E2E con fixture completo verifica un proyecto y un evento PROJECT_ENABLED. El procesamiento asíncrono y el resto de garantías operativas de pagos/kickoff/equipos permanecen en el alcance de B.

Las pruebas recuperadas verifican pagos/proyecto únicos y errores 404 concurrentes de proyectos inexistentes; no se presentan como prueba de kickoff positivo concurrente ni de equipos simultáneos. La recepción del webhook mantiene un evento de auditoría por entrega, separado de la habilitación única. No se ejecutó una transacción real de Culqi sandbox ni un recorrido de navegador de C.

### H05 — Limitaciones explícitas del correo

El envío comercial es posterior al commit y tiene auditoría de éxito/fallo y reintento explícito de cotización/activación; no incluye una cola durable de reintentos ni confirmación de lectura. A07 se comprobó con agenda interna. La variante Calendly existente requiere validación independiente si el equipo decide usarla para la demo.

## 6. Archivos entregados

- src/commercial/: implementación y 31 pruebas unitarias nuevas.
- test/sprint14-commercial.e2e-spec.ts: 13 escenarios HTTP/MySQL nuevos del Responsable A.
- test/s14-concurrency.e2e-spec.ts: 4 escenarios integrados recuperados y verificados.
- prisma/migrations/20260928170000_s14_commercial/migration.sql: incremento aditivo de base.
- docs/sprint14/CONTRATOS_RESPONSABLE_A.md: integración de frontend y consumo de API.
- docs/sprint14/ENTREGA_B_C.md: migración, configuración, coordinación y reproducción.
- docs/sprint14/EVIDENCIAS.json: resultados resumidos de verificación.
- docs/sprint14/DEPENDENCIAS_AUDIT.json: hallazgos de dependencias.
- Este informe de auditoría técnica y entregables.

## 7. Condiciones para el cierre conjunto del sprint

Aplicar la migración de A mediante el procedimiento coordinado con B; resolver la cadena histórica y las alertas altas; configurar correo sandbox y textos legales aprobados; conectar y validar pantallas de C; demostrar el recorrido real con Culqi, proyecto, kickoff, PO y equipo. Integrar el código en develop no equivale a desplegar ni acredita por sí solo esa demostración.

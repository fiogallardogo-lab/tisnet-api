# INFORME DE AUDITORÍA TÉCNICA Y ENTREGABLES

**TISNET · Sprint 15 · Responsable A — Backend comercial**  
**Fecha:** 30 de septiembre de 2026  
**Repositorio:** tisnet-api · rama de integración: develop

## Dictamen

Desarrollo del alcance A implementado y verificado localmente; **pendiente de validación externa y habilitación operativa**. No corresponde declarar el proyecto terminado al 100% ni aprobado para producción. El correo externo, los textos legales definitivos y la política horaria requieren aprobación/configuración; existen además incidencias anteriores de migraciones y dependencias.

Se integraron los entregables de B y las actualizaciones posteriores de Calendly, fotos de perfil y proyectos asignados presentes en develop (540e7ed). La implementación principal de A está en 5f5d400; la integración con el equipo, en 8e18f8a. El historial posterior registra el refuerzo final del cierre y este informe. Se preservó el checkout original con cambios previos; el trabajo se realizó en el checkout aislado tisnet-api-s14.

## Entregables y trazabilidad

| Historia | Entrega | Verificación y estado |
| --- | --- | --- |
| S15-A01 | Recordatorio persistente por cuota, evento de entrega/aprobación, cliente y Administración; auditoría, reserva, reintento y cancelación | MySQL/HTTP/SMTP local; atomicidad, duplicados y concurrencia comprobados |
| S15-A02 | Tres días hábiles con fecha civil America/Lima, fines de semana, feriados y calendario adicional; política persistida | Casos de Semana Santa, julio, cambio de año y cruce UTC/Lima aprobados. Hora/evento reales pendientes de aprobación |
| S15-A03 | SMTP/Resend, confirmación de postulación conectada al flujo público, identificadores estables de recordatorio y temporizadores liberados | Cinco categorías recibidas mediante protocolo SMTP real en buzón local: activación, cotización/PDF, reunión, recordatorio y postulación. Falta buzón externo autorizado |
| S15-A04 | API de textos/versiones aprobadas; validación de publicación y persistencia de consentimiento | Aprobado con fixtures claramente ficticias. Archivo jurídico definitivo pendiente; producción/staging fallan de forma cerrada sin publicación válida |
| S15-A05 | Directorio curado de Developer/PO/asesores, aprobación y consentimiento explícitos, retiro y control de fotos públicas | Whitelist de campos, permisos, actividad y URLs comprobados. No se publicaron personas reales automáticamente |
| S15-A06 | Estado económico de versión vigente, totales exactos, moneda, aceptación, cuotas e hitos; cierre autorizado | Cobro de versión reemplazada bloqueado; pagos anteriores no completan la vigente; rechazo de hitos de otra versión y respuesta sin montos al PO |
| S15-A07 | Eliminación de correos y errores crudos en logs revisados; informes sin correos ni finanzas para PO/Developer; fotos públicas saneadas | Pruebas de RBAC/propiedad y proyecciones. Revisión del alcance modificado; no es certificación de seguridad de todo el sistema |
| S15-A08 | Regresión API/JWT/MySQL, correo SMTP local, reinicio de API y MySQL, fallos/reintentos y concurrencia | Suites aprobadas; E2E de navegador/staging, Culqi y Calendly externos siguen siendo validaciones compartidas con B/C |

## Evidencia ejecutada

- Compilación NestJS: aprobada, incluidos cambios finales de cierre.
- Suite unitaria de la integración: **635 aprobadas, 0 fallidas**. Después del último refuerzo se ejecutaron **29 pruebas de ProjectsService**, todas aprobadas, incluyendo el nuevo rechazo de hitos ajenos a la versión vigente. Los conteos no se suman porque hay solapamiento.
- Suite E2E completa: **245 aprobadas, 0 fallidas, 0 omitidas** contra MySQL aislado. Los flujos comerciales usaron el proveedor SMTP real contra un servidor de prueba local, sin enviar a Internet.
- Regresión E2E dirigida posterior al refuerzo final: suites de Sprint 15 A y B aprobadas; conteo exacto en EVIDENCIA_VALIDACION_A.json.
- Lint: 0 errores; 12 advertencias existentes, principalmente imports/variables sin uso y estilo.
- Prisma validate: aprobado. Migración incremental nueva aplicada sobre el esquema base de develop: **sin diferencias de esquema (drift 0)**.
- Reinicio real del servidor MySQL de prueba: **5 recordatorios con fechas, política, estados e intentos idénticos antes y después**. Reinicio de API y recuperación de reserva vencida cubiertos por E2E.
- Revisión de dependencias: **12 alertas: 9 altas, 1 moderada y 2 bajas; 0 críticas**. package.json y package-lock.json no fueron modificados respecto de develop. Una alerta de paquete no prueba por sí sola explotabilidad, pero debe resolverse o evaluarse antes del pase a producción.

La evidencia resumida y sin secretos está en [EVIDENCIA_VALIDACION_A.json](EVIDENCIA_VALIDACION_A.json). Las salidas completas de pruebas y los buzones MIME permanecen en tmp/ ignorado; no se incorporaron credenciales ni tokens a Git.

## Hallazgos corregidos

1. Informes incluían correos personales y montos para roles operativos. Ahora las proyecciones respetan el rol/propiedad y omiten correos del informe de trazabilidad.
2. El reporte sumaba pagos de versiones anteriores. Ahora usa únicamente Quote.activeVersion; el cierre exige exactitud de importes y correspondencia de hitos oficiales.
3. La postulación pública persistía los archivos pero no enviaba confirmación. Ahora envía mediante el proveedor configurado y devuelve SENT/FAILED sin perder la solicitud si falla el correo.
4. Los logs de SMTP, Resend, pagos simulados y Calendly incluían datos de destinatarios o mensajes crudos. Se conservaron identificadores/códigos operativos y se retiraron esos datos en los puntos revisados.
5. Recordatorios necesitaban sobrevivir reinicios y coordinar procesos. Ahora se reservan mediante actualización condicional, clave única por cuota y destinatario, vencimiento de reserva y reintento acotado.

## Pendientes que impiden aceptación productiva

| Pendiente | Evidencia / impacto | Responsable de cierre |
| --- | --- | --- |
| Cadena histórica de migraciones | Instalación desde cero falla P3018/1146: 20260925170000_project_kickoff_audit altera ProjectMember antes de su creación. La migración de A es válida; la cadena completa no está certificada | B: reconciliar baseline/historial y repetir CI limpio |
| Correo externo | Configuración inspeccionada sin SMTP/Resend autorizado ni buzón de prueba designado; SMTP local no demuestra DNS/TLS ni llegada a bandeja externa | A + dueño del entorno |
| Textos legales y política de recordatorio | No se proporcionaron textos definitivos, referencia de aprobación ni hora límite aprobada. No se inventaron valores de producción | Responsable del negocio/legal + A |
| Dependencias | 9 alertas altas en el árbol heredado; detalle de paquetes en evidencia | B/equipo: evaluar alcance, actualizar y repetir regresión |
| Staging y aceptación conjunta | No se ejecutaron navegador de cinco roles, proveedores externos, CI desplegado, backup/restauración ni rollback de staging | B/C + A para flujo comercial |

SMTP no garantiza exactamente una entrega ante una caída entre la aceptación del mensaje y el registro SENT. Se usa Message-ID estable para trazabilidad; Resend recibe clave de idempotencia. La aceptación del proveedor tampoco equivale a lectura o recepción en la bandeja final. Estas limitaciones se explicitan para operación.

## Archivos entregados

- Módulo src/commercial-operations: calendario, contenido legal, equipo público, recordatorios, estados económicos y endpoints protegidos.
- Migración prisma/migrations/20260929200000_s15_commercial_operations/migration.sql y modelos Prisma.
- Integración transaccional con entregables y cierre de proyectos; ajustes de informes y privacidad.
- Proveedores de correo, confirmación de postulación y configuración de ejemplo sin secretos.
- test/helpers/local-smtp.ts, suites comerciales de Sprint 14/15 y pruebas unitarias de validación/cierre.
- [Contratos para B/C](CONTRATOS_RESPONSABLE_A.md).
- [Guía de operación y validación externa](OPERACION_Y_VALIDACION_EXTERNA_A.md).

**Estado de entrega:** código implementado y pruebas locales aprobadas; habilitación productiva pendiente de los puntos anteriores. La integración Git no equivale a aprobación de producción.

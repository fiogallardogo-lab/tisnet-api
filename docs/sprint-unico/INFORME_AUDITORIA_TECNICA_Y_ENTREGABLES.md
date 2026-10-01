# INFORME DE AUDITORÍA TÉCNICA Y ENTREGABLES

**Sprint único · Responsable Backend · 01/10/2026**

## Resultado

Implementación backend completada y validada localmente para los cinco paneles. Se añaden 24 operaciones HTTP para dashboards, tareas, recursos, horas/avances, agenda del equipo, CV, documentos privados, catálogos y readiness. Se conserva la API comercial previa. **No se declara staging remoto listo:** no hay proveedor, host, dominio ni credenciales de infraestructura verificables en esta sesión.

## Matriz del plan

| Trabajo Backend del plan | Resultado | Evidencia |
| --- | --- | --- |
| DTOs para cinco dashboards | IMPLEMENTADO Y PROBADO LOCALMENTE | src/dashboard/dashboard.dto.ts; openapi.json; contracts.ts |
| Swagger y TypeScript para ambos frontends | ENTREGADO | Exportación real: 142 rutas registradas y 90 esquemas; tipos autónomos compilan |
| Roles y GET /auth/me | EXISTENTE, VERIFICADO | JWT real, tokenVersion y matriz de 25 accesos de rol/dashboard |
| /dashboard/client, developer, po, admin | IMPLEMENTADO Y PROBADO | Pruebas HTTP y demo con login real |
| /dashboard/superadmin | IMPLEMENTADO Y PROBADO | Distribución de roles/proyectos; estado de configuración sin afirmar conectividad externa |
| Entregables upload/approve/observe | EXISTENTE, REGRESIÓN PASA | decision obligatorio; 283 E2E de todo el backend |
| Estados de proyectos | EXISTENTE + ENDURECIDO | PATCH no permite saltarse cierre contractual con status=COMPLETED; usar POST /projects/:id/close |
| Tareas Kanban y supervisión PO | IMPLEMENTADO Y PROBADO | CRUD, membresía, asignación, filtros, paginación y estados |
| Recursos técnicos | IMPLEMENTADO Y PROBADO | CRUD de referencias HTTP/HTTPS, autorización por autor/PO |
| Horas y reporte de avance | IMPLEMENTADO Y PROBADO | Registros propios append-only, minutos y resumen; progreso contractual sigue calculado |
| CV y documentos privados | IMPLEMENTADO Y PROBADO | Upload PDF con firma/tamaño, UUID, descarga autenticada, storage privado |
| Agenda Developer/PO | IMPLEMENTADO Y PROBADO | Reuniones vinculadas al kickoff de proyectos con membresía activa |
| Calendly | IMPLEMENTADO Y PROBADO CON EVENTOS FIRMADOS SINTÉTICOS | Firma HMAC obligatoria, raw body, persistencia, duplicados y reprogramación |
| Auditoría | IMPLEMENTADO EN TRANSACCIONES | Tareas/recursos/horas/archivos/reuniones persisten AuditEvent |
| Catálogos públicos | IMPLEMENTADO | Categorías, tecnologías y categorías de tecnologías activas; servicios públicos ya existentes |
| Queries sin N+1 en dashboards | REVISADO | Agregados y lecturas por lote; ningún query por cada proyecto del resultado |
| Despliegue staging y demo pública | BLOQUEADO POR INFRAESTRUCTURA | Compose/env/verificador entregados; faltan host, acceso, dominio y proveedores reales |

## Pruebas y comprobaciones

- Build NestJS: correcto.
- Unitarias: **639 pruebas, 81 archivos, todas pasan**.
- Regresión E2E completa: **283 pruebas, 15 archivos, todas pasan**, sobre MySQL 8 local aislado.
- Suite nueva: **38 pruebas HTTP/MySQL**; incluye 25 combinaciones rol/dashboard, JWT anónimo, acceso entre proyectos, validación/paginación, estados de tareas, recursos, horas concurrentes, topes diarios, CV privado, descargas, firma Calendly, duplicados, reprogramación y auditoría.
- Repetición dirigida final de esas 38 pruebas tras los últimos ajustes: correcta.
- Demo: **38 solicitudes HTTP reales** con usuarios autenticados, cuentas de cinco roles y almacenamiento en disco. Evidencia redactada en evidence-local.json. Incluye OPTIONS 204, Swagger y descargas con Content-Disposition.
- Migración incremental 20261001120000_unified_dashboards_work aplicada sobre schema anterior en otra base local: **sin diferencias** con schema.prisma.
- Arranque de base vacía con baseline: correcto; 26 migraciones reconocidas. Probado rechazo seguro al intentar baseline sobre base ya poblada.
- Contratos TypeScript compilados en modo estricto; OpenAPI generado desde Nest.
- Lint sin errores; **12 advertencias heredadas** fuera de los módulos nuevos.
- Docker/Compose no ejecutados: CLI Docker no disponible. La configuración requiere validación en el host de despliegue.

Los E2E nuevos usan guards JWT/RBAC reales y MySQL. El transporte de correo se sustituye para no enviar mensajes externos; se desactiva throttling solo en el helper de pruebas. La demo HTTP usa el backend compilado y configuración de pruebas local, con proveedores simulados. Ninguna de esas pruebas acredita entrega SMTP/Culqi/Calendly externa.

## Datos de prueba y evidencias

- Credenciales aleatorias por rol e IDs reales locales: output/sprint-demo-credentials.json, excluido de Git. No hay contraseñas en los entregables versionados.
- Login real y respuestas sanitizadas: evidence-local.json. Los pagos sembrados son DEMO ficticios, no transacciones de proveedor.
- API local: http://127.0.0.1:13318/api/v1. Swagger local: http://127.0.0.1:13318/api/docs. No son direcciones de staging.
- Reproducir: scripts/seed-sprint-demo.cjs y scripts/verify-sprint-demo.cjs. Requieren una base test/staging explícitamente autorizada; el verificador de demo solo permite loopback.

## Decisiones de contrato

1. Los cinco dashboards usan un DTO común con nombres de DTO específicos por rol. Cada ruta exige el rol exacto; el Superadmin utiliza su propia ruta.
2. Las tareas y recursos tienen IDs persistidos, sin reinterpretación como número de hito. Las contribuciones conservan su ruta exacta por deliverable.id.
3. Registro de trabajo separado de contribuciones porcentuales. No modifica automáticamente el progreso contractual.
4. Los registros de horas no se borran ni editan en este alcance; una tarea con horas no se elimina. Tope diario serializado por usuario con READ COMMITTED para evitar sobrepasarlo por concurrencia.
5. CV/documentos nuevos son privados y PDF hasta 5 MiB; los archivos legacy no se migran automáticamente. Recursos técnicos son enlaces; el upload privado es una operación separada.
6. Reprogramación Calendly sigue el modelo de dos eventos de Calendly. Se conserva cancelada la cita anterior y se vincula la nueva; el webhook responde después de persistir.
7. CORS conserva allowlist FRONTEND_URL y expone Content-Disposition. No se agregó un comodín de dominios.
8. Baseline únicamente para base vacía. No se modificaron migraciones históricas ya aplicadas ni se intentó reconciliar una base productiva.

## Riesgos y condiciones restantes

- Falta staging real: host/proveedor, acceso de despliegue, dominio frontend, secretos y TLS. No se pueden entregar cuentas o IDs de ese entorno aún.
- Proveedores externos y políticas legales/comerciales requieren configuración aprobada. Los estados CONFIGURED del dashboard no son pruebas de conectividad.
- Las migraciones históricas siguen requiriendo reconciliación específica si una base existente no está alineada; el bootstrap solo resuelve instalaciones vacías.
- Archivos: almacenamiento persistente requiere volumen, backup y restauración verificados. El chequeo PDF no sustituye análisis antimalware.
- Foto Cliente continúa fuera del soporte existente; el plan solicita perfil Developer, que sí está disponible.
- El dashboard limita vistas previas; se usan APIs paginadas de trabajo para listados completos. No se promete una agenda de videollamadas ajenas al proyecto.
- Las incidencias de dependencias documentadas en Sprint 15 no quedan resueltas por este sprint de funcionalidades. No se afirma una auditoría de vulnerabilidades limpia.

## Disponibilidad y responsabilidad

Código y contratos: disponibles en esta entrega, responsabilidad Backend. Infraestructura: sin persona/ETA confirmada; no inventar fecha de publicación. El frontend puede integrar contra la demo local y conservar mocks como respaldo. Para declarar LISTO EN STAGING ejecutar el verificador con host, SHA y tokens reales, más aceptación de mutaciones/archivos y proveedores.

## Fuentes técnicas

Calendly, reprogramación y relación entre invitees: https://developer.calendly.com/docs/api-guides/see-how-webhook-payloads-change-when-invitees-reschedule-events

Las restantes conclusiones proceden del código, migraciones y pruebas de este repositorio.

Comprobación adicional: sintaxis YAML de CI y Compose válida mediante js-yaml; esto no sustituye un build Docker.

# Sprint único — Backend para los cinco paneles

Corte: 01/10/2026. Base API: /api/v1. Entrega backend para Frontend A y B.

**Implementación y validación local; staging remoto NO confirmado.** No sustituir el host real por localhost ni interpretar los datos de demo como producción.

## Entregables

- [openapi.json](openapi.json): snapshot generado desde los controladores reales; en ejecución, /api/docs y /api/docs-json.
- [contracts.ts](contracts.ts): tipos TypeScript autónomos generados desde OpenAPI, incluidos los cinco DashboardDto, requests y responses nuevos.
- [evidence-local.json](evidence-local.json): requests/responses HTTP reales de la demo local, con secretos redactados.
- [INFORME_AUDITORIA_TECNICA_Y_ENTREGABLES.md](INFORME_AUDITORIA_TECNICA_Y_ENTREGABLES.md): validación, alcance y límites.
- Scripts: export-sprint-contracts.cjs, bootstrap-empty-db.cjs, seed-sprint-demo.cjs, verify-sprint-demo.cjs y verify-staging-readiness.cjs.

El catálogo anterior docs/frontend-a corresponde al corte anterior. Para las funcionalidades nuevas de este sprint prevalece esta entrega. Los contratos anteriores de cotizaciones, aceptación/PDF, perfiles, entregables, contribuciones y cierre siguen disponibles.

## Rutas nuevas y permisos

Todas requieren JWT Bearer salvo catálogos públicos y health. Admin incluye SUPER_ADMIN cuando se indica. Las operaciones de proyecto validan membresía activa y coincidencia de rol; Admin/Superadmin pueden supervisar globalmente.

| Funcionalidad | Método y ruta sin prefijo | Request / response data | Permisos |
| --- | --- | --- | --- |
| Cliente | GET /dashboard/client | Sin body → ClientDashboardDto | CLIENT exacto |
| Developer | GET /dashboard/developer | Sin body → DeveloperDashboardDto | DEVELOPER exacto |
| Product Owner | GET /dashboard/po | Sin body → ProductOwnerDashboardDto | PRODUCT_OWNER exacto |
| Administrador | GET /dashboard/admin | Sin body → AdminDashboardDto | ADMIN exacto |
| Superadmin | GET /dashboard/superadmin | Sin body → SuperAdminDashboardDto | SUPER_ADMIN exacto |
| Tareas | GET /projects/{projectId}/tasks | TaskQuery → TaskPageDto | Miembros, Admin |
| Crear tarea | POST /projects/{projectId}/tasks | CreateTaskDto → TaskDto, 201 | PO del proyecto, Admin |
| Editar tarea | PATCH /projects/{projectId}/tasks/{id} | UpdateTaskDto → TaskDto | PO/Admin; Developer asignado solo status |
| Eliminar tarea | DELETE /projects/{projectId}/tasks/{id} | Sin body → null, 200 | PO/Admin; 409 si tiene horas |
| Recursos | GET /projects/{projectId}/resources | WorkPageQuery → ResourcePageDto | Miembros, Admin |
| Crear recurso | POST /projects/{projectId}/resources | CreateResourceDto → ResourceDto, 201 | Developer/PO/Admin |
| Editar recurso | PATCH /projects/{projectId}/resources/{id} | UpdateResourceDto → ResourceDto | Autor Developer o PO/Admin |
| Eliminar recurso | DELETE /projects/{projectId}/resources/{id} | Sin body → null, 200 | Autor Developer o PO/Admin |
| Horas/avances | GET /projects/{projectId}/work-logs | LogQuery → WorkLogPageDto | Developer ve sus registros; PO/Admin ve equipo; Cliente no accede |
| Registrar horas/avance | POST /projects/{projectId}/work-logs | CreateWorkLogDto → WorkLogDto, 201 | Developer/PO, siempre trabajo propio |
| Agenda de proyectos | GET /workspace/meetings | page,limit,from,to → MeetingsPageDto | Developer/PO; reuniones vinculadas al kickoff de sus proyectos |
| Asesores asignables | GET /advisors/assignable | Sin body → perfiles activos con rol ADMIN | ADMIN, SUPER_ADMIN |
| Asignar asesor a prospecto | PATCH /prospects/{id}/advisor | {advisorProfileId:number|null} → prospecto actualizado | ADMIN, SUPER_ADMIN; null retira asignación |
| Subir CV | POST /users/me/cv | multipart file=PDF → CvFileDto, 201 | DEVELOPER propio |
| Descargar CV | GET /users/me/cv/{id} | PDF binario | DEVELOPER propietario, no URL pública |
| Subir documento privado | POST /projects/{projectId}/files | multipart file=PDF → PrivateFileDto, 201 | Developer/PO/Admin |
| Descargar documento privado | GET /projects/{projectId}/files/{id}/download | PDF binario | Miembro activo del proyecto o Admin |
| Categorías públicas | GET /public/categories | Arreglo id,name,description | Público, solo activas |
| Tecnologías públicas | GET /public/technologies | Arreglo id,name,icon,categoryId | Público; excluye categorías inactivas |
| Categorías de tecnología | GET /public/technology-categories | Arreglo id,name,slug | Público, solo activas |
| Readiness y versión | GET /health | status,apiVersion,commit,timestamp | Público; SELECT 1 real, commit de APP_COMMIT |

## Convenciones definitivas del sprint

- Respuesta: {success:true,message:string,data:T}. Error: {success:false,message:string|string[],error:string}. GET/PATCH/DELETE 200; POST 201. Autenticación conserva sus 200 existentes.
- Paginación nueva: page=1, limit=20, máximo 100; data={items,page,limit,totalItems,totalPages}. Orden por id descendente salvo reuniones (fecha/id ascendentes). Búsqueda search por título de tarea, nombre de recurso o resumen de horas. Tareas: status y assigneeId. Horas: userId (Developer no puede ampliar alcance), from/to fechas civiles inclusivas. Agenda: from/to ISO con offset, sin search.
- Dashboards: vista previa de hasta 50 proyectos/tareas/reuniones/entregables. stats cuenta todo el alcance permitido, no solo la muestra. Consulta agregada de entregables por proyecto; ninguna consulta dentro del bucle de resultados. workload agrupado por usuario; solo PO/Admin/Superadmin. Importes confirmados agrupados por moneda, como texto de unidades menores. Cliente/Developer no reciben revenue.
- En dashboard, deliverables está ordenado por fecha y contiene pendientes: sirve para próximo hito y cola de revisión. pendingDeliverables cuenta IN_REVIEW. Progreso=aprobados/total; sin entregables=0. No es un porcentaje manual.
- Integraciones solo Superadmin: CONFIGURED/NOT_CONFIGURED y connectivity=NOT_PROBED. No afirma entrega de correo ni conectividad Calendly. database=READ_OK solo acredita las lecturas de esa petición.
- Tareas: TODO, IN_PROGRESS, DONE. Developer asignado: TODO→IN_PROGRESS; IN_PROGRESS→TODO/DONE; DONE→IN_PROGRESS. PO/Admin pueden ajustar cualquier estado válido. No se cambian asignación, título o fechas como Developer.
- Reuniones: PENDING, SCHEDULED, CANCELLED, COMPLETED. Entregables: DRAFT, IN_REVIEW, APPROVED, OBSERVED. Contribuciones porcentuales no tienen estado ni representan horas.
- IDs: enteros persistidos para proyecto/tarea/recurso/reunión/entregable/hito/contribución; archivos privados UUID. Para contribuciones usar exclusivamente deliverable.id en /deliverables/{deliverableId}/contributions. Nunca milestoneOrder.
- Horas: minutos enteros 1..1440, tope diario por usuario de 1440 entre todos los proyectos, protegido por bloqueo de fila y transacción READ COMMITTED. Fecha no futura según America/Lima. Resumen obligatorio. Tarea opcional pero del mismo proyecto y asignada al Developer que registra. Los registros se conservan; no se incluyen endpoints de borrado/edición contable.
- Trabajo cerrado: COMPLETED/ARCHIVED rechaza escrituras con 409; lectura permanece autorizada.
- Fechas de request dueDate/date: YYYY-MM-DD. Tablas Prisma serializan Date como ISO UTC; dashboards simplifican dueDate a YYYY-MM-DD. No convertir fecha civil a zona local cambiando de día. Instantes de reunión llevan offset explícito y se muestran en America/Lima.
- PDF privado/CV: campo file, máximo 5 MiB, MIME application/pdf y cabecera %PDF-. No es análisis antivirus. Retorna URL relativa protegida; descargar con fetch autenticado, no enlace público sin token. Content-Disposition expuesto por CORS. Cada descarga revalida acceso; no entrega storageKey. Los endpoints legacy de evidencia conservan sus límites anteriores (50/100 MiB) y no migran archivos existentes automáticamente.
- Foto: endpoint existente POST /users/me/photo, campo photo, JPG/PNG/WebP hasta 5 MiB. Developer soportado; foto Cliente no se agrega en este sprint.
- Errores: 400 validación, 401 sesión, 403 rol/membresía, 404 recurso ajeno/inexistente, 409 estado/cupo, 413 archivo, 429 throttling, 500 fallo interno y 503 dependencia/configuración cuando corresponda.

## Ejemplos para comenzar

POST /projects/11/tasks (PO):
~~~json
{"title":"Implementar formulario","description":"Validar datos","assigneeId":8,"dueDate":"2026-10-15"}
~~~
PATCH /projects/11/tasks/21 (Developer asignado):
~~~json
{"status":"IN_PROGRESS"}
~~~
POST /projects/11/work-logs (Developer):
~~~json
{"taskId":21,"date":"2026-10-01","minutes":90,"summary":"Formulario implementado y probado"}
~~~
POST /projects/11/resources (Developer/PO):
~~~json
{"name":"Repositorio","url":"https://example.test/repo"}
~~~
Estos IDs son ilustrativos. Los IDs reales de la demo local se encuentran en evidence-local.json y en output/sprint-demo-credentials.json. No son IDs de staging.

## Calendly y auditoría

POST /integrations/calendly/webhook requiere Calendly-Webhook-Signature HMAC sobre raw body. Falta de secreto: 503; firma inválida/vencida: 401. Se persiste antes de responder 200. invitee.created e invitee.canceled crean/actualizan reuniones, MeetingEvent y AuditEvent. Repeticiones no duplican registros. Se soporta payload invitee v2 y el formato anidado histórico. La reprogramación relaciona old_invitee con la nueva cita y cancela la antigua; un evento tardío no reactiva la cita cancelada. Notificación posterior best effort: la persistencia se garantiza por transacción; no se promete entrega externa de email.

Referencia primaria: https://developer.calendly.com/docs/api-guides/see-how-webhook-payloads-change-when-invitees-reschedule-events

Tareas, recursos, horas, archivos y eventos Calendly registran auditoría en la misma transacción de negocio. Autorización JWT consulta usuario activo/tokenVersion existentes. No se crea una segunda sesión paralela ni se relajan los guards administrativos.

## Migración y ejecución

1. Base existente y reconciliada: respaldar; ejecutar prisma migrate deploy para aplicar 20261001120000_unified_dashboards_work.
2. Base nueva vacía: ALLOW_EMPTY_DB_BASELINE=true node scripts/bootstrap-empty-db.cjs. Comprueba que el baseline coincide con schema y que NO hay tablas. Carga schema completo y registra las migraciones como aplicadas. Después usar ALLOW_EMPTY_DB_BASELINE=false. No usar sobre bases existentes. El historial antiguo contiene ALTER antes de CREATE: el baseline evita ese orden solo en instalaciones vacías, no reconcilia bases existentes.
3. npm run build; node scripts/export-sprint-contracts.cjs con configuración del entorno.
4. Demo autorizada en test/staging: SEED_SPRINT_DEMO=true node scripts/seed-sprint-demo.cjs. Genera contraseñas aleatorias; no cambia contraseñas existentes. Credenciales quedan en output ignorado. Los importes/pagos sembrados son ficticios y etiquetados DEMO.
5. La demo local usa 127.0.0.1:13318 para API y 127.0.0.1:13317 para MySQL. Ejecutar node scripts/verify-sprint-demo.cjs para registrar evidencia. No es staging público.

## Despliegue pendiente de infraestructura

compose.staging.yml mantiene MySQL sin puerto público y la API en loopback detrás de un proxy HTTPS. Copiar .env.staging.example a .env.staging fuera de Git, completar dominio, secretos, proveedor real de correo y política legal/recordatorios desde .env.example. APP_COMMIT debe contener el SHA realmente construido. Disco requiere volumen persistente y respaldo. Docker no estaba disponible en esta máquina: el build de imagen/Compose no está certificado.

Ejecutar docker compose --env-file .env.staging -f compose.staging.yml up -d --build desde el host autorizado. El primer arranque vacío requiere baseline explícito y luego desactivarlo. Un reinicio con baseline=true se detendrá por seguridad al encontrar tablas.

Con host real y tokens seguros de cinco roles: configurar STAGING_API_ORIGIN, FRONTEND_ORIGIN, EXPECTED_COMMIT, STAGING_TOKEN_CLIENT/DEVELOPER/PRODUCT_OWNER/ADMIN/SUPER_ADMIN y ejecutar scripts/verify-staging-readiness.cjs. El script prueba salud/versión, Swagger, roles y preflight, sin guardar tokens. No reemplaza pruebas de mutación ni de proveedores externos.

Responsable funcional: Backend de este sprint. Código disponible en esta entrega. Fecha de disponibilidad remota: por confirmar al disponer de host/proveedor/dominio y accesos. Conservar respaldo mock hasta verificar el entorno remoto.

Actualización de cierre: /health se sirve desde un único controlador, devuelve apiVersion y commit, y usa HTTP 503 con data.status=DEGRADED cuando falla MySQL. Conserva su payload de diagnóstico; esta respuesta 503 es distinta del envelope de excepciones. Se incorporó el commit remoto b20987f de cotizaciones antes del cierre.

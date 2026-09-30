> Actualización posterior a 7af3ed8: ver [CIERRE_INTEGRACION.md](CIERRE_INTEGRACION.md). Se exige decision, las rutas /deliverables/.../contributions resuelven ID exacto y CORS expone Content-Disposition. Las observaciones históricas de abajo sobre esos tres puntos quedan sustituidas. Despliegue sin confirmar.

# Disponibilidad y contratos propuestos — no implementados

Corte30/09/2026. Los48 endpoints de OPERACIONES.md existen en código; disponibilidad desplegada sin confirmar. Para los siguientes **ETA=null / fecha por acordar con el responsable backend**. El plan de diez días del sprint no proporciona una fecha de inicio ni una asignación individual que permita prometer entrega. Se pueden desarrollar mocks hoy; eso no equivale a disponibilidad de API.

Las rutas de esta tabla son propuestas y NO se incluyeron en Swagger implementado. Request/response usan las convenciones propuestas, sujetas a aprobación conjunta. En el backend actual su ausencia normalmente devuelve404; los permisos y errores de la tabla describen el diseño propuesto, no un guard existente.

| Operación propuesta | Request ejemplo | data de response ejemplo | Permisos propuestos / estados | Errores de diseño | ETA |
| --- | --- | --- | --- | --- | --- |
| GET /workspace/overview | Sin body | {projects:[],tasks:[],upcomingMeetings:[]} | Developer activo, solo asignaciones propias |401/403/503| Sin compromiso |
| GET /projects/{id}/tasks?page=1&limit=20 | Query page/limit/status/assigneeId | {items:[{id:1,projectId:11,title:"Implementar formulario",assigneeId:8,status:"TODO",dueDate:"2026-10-10"}],page:1,limit:20,totalItems:1,totalPages:1} | Cliente/Developer miembros activos: lectura; filtrar acceso a proyecto |400/401/403/404| Sin compromiso |
| POST /projects/{id}/tasks | {title:"Implementar formulario",assigneeId:8,dueDate:"2026-10-10"} | {id:1,projectId:11,title:"Implementar formulario",assigneeId:8,status:"TODO",dueDate:"2026-10-10"} | PO/Admin crean; proyecto no cerrado/archivado |400/401/403/404/409| Sin compromiso |
| PATCH /projects/{id}/tasks/{taskId} | {status:"IN_PROGRESS"} | Tarea actualizada como arriba | Developer asignado puede cambiar TODO→IN_PROGRESS→DONE; PO/Admin pueden reasignar. Cliente no escribe |400/401/403/404/409| Sin compromiso |
| DELETE /projects/{id}/tasks/{taskId} | Sin body | null (200 propuesto) | PO/Admin; sin proyecto cerrado |401/403/404/409| Sin compromiso |
| GET /workspace/meetings | Query from/to ISO con offset | {items:[],page:1,limit:20,totalItems:0,totalPages:0} | Developer: reuniones del equipo; no datos comerciales del Cliente |400/401/403| Sin compromiso |
| PATCH /client/meetings/{id}/reschedule | {scheduledAt:"2026-10-12T10:00:00-05:00"} | {id:81,status:"PENDING",scheduledAt:"2026-10-12T15:00:00Z"} | Cliente propietario, desde PENDING/SCHEDULED; revalidar conflicto y proveedor |400/401/403/404/409/503| Sin compromiso |
| GET /projects/{id}/resources | Query page/limit | {items:[{id:1,projectId:11,name:"Repositorio",url:"https://example.test/repo",kind:"LINK"}],page:1,limit:20,totalItems:1,totalPages:1} | Miembros activos, acceso por proyecto |401/403/404| Sin compromiso |
| POST /projects/{id}/resources | {name:"Repositorio",url:"https://example.test/repo",kind:"LINK"} | Recurso con id/projectId | Developer/PO/Admin; proyecto activo |400/401/403/404/409| Sin compromiso |
| PATCH /projects/{id}/resources/{resourceId} | {name:"Repositorio actualizado"} | Recurso actualizado | Autor o PO/Admin; proyecto activo |400/401/403/404/409| Sin compromiso |
| DELETE /projects/{id}/resources/{resourceId} | Sin body | null (200 propuesto) | Autor o PO/Admin |401/403/404/409| Sin compromiso |
| GET /projects/{id}/files/{fileId}/download | Sin body | Blob con Content-Type correcto | Miembro autorizado; descarga privada por id, sin keys públicas |401/403/404/410| Sin compromiso |
| POST /users/me/cv | multipart file=PDF | {cvUrl:"<referencia protegida>"} | Developer propio; máximo propuesto5MiB, no confirmado |400/401/403/413| Sin compromiso |
| POST /users/me/photo para CLIENT | photo=JPG/PNG/WebP | {photoUrl:"<referencia>"} | Ruta existente pero Cliente actualmente rechazado400; requiere soporte adicional |400/401/413| Sin compromiso |

## No requieren endpoint nuevo para empezar

- Dashboard Developer básico: componer /workspace/projects, /users/me/profile y /reports/projects. No mostrar tareas/reuniones como cero confirmado: son datos no disponibles.
- Listados Cliente de proyectos, cotizaciones y reuniones: extraer de /client/overview. Endpoints paginados dedicados quedan pendientes si el volumen lo exige.
- Pestañas equipo, entregables, contribuciones y reportes: contratos ya disponibles, no esperar nuevas rutas.
- Estado de kickoff Developer: /projects/{id}/operations.kickoff. No es su agenda completa.
- Progreso automático: /reports/projects. No existe POST de reporte manual de avance ni edición arbitraria del porcentaje; si la pantalla necesita ambos, requiere historia nueva.

## Decisiones por cerrar con backend

1. Fecha y responsable de tareas/recursos/dashboard agregado/agenda Developer.
2. Paginación única futura y filtro de alcance por rol.
3. Identificador inequívoco para contribuciones e hitos, eliminando la resolución OR por id/orden.
4. DTO estricto de revisión y etiquetas correctas de pago parcial/versión vigente.
5. Almacenamiento real, descargas protegidas, política de archivo/video y publicación de fotos de Cliente.
6. URL/versionado de staging, textos legales, política horaria y credenciales sandbox. Las incidencias anteriores de migración/dependencias figuran en el informe del Sprint15; no se consideran resueltas por documentar contratos.

Hasta acordar esas fechas, prometer un día concreto sería inventar una disponibilidad. Los tipos Proposed de contracts.ts son una base para el mock y deben revisarse antes de sustituirlo por red.

# Cierre de integración Frontend A — 30/09/2026

## Evidencia de entorno

- GitHub develop del backend estaba en 7af3ed8 antes de estas correcciones. Ese commit no prueba un despliegue.
- Consulta pública de deployments del backend: HTTP 200, cero registros. Frontend: HTTP 404 (no demuestra ausencia de despliegue privado).
- Configuración local encontrada: FRONTEND_URL=http://localhost:5173 y VITE_API_URL=http://localhost:3000/api/v1. No son staging.
- El workflow CI valida, compila y ejecuta pruebas; no contiene un paso de publicación.
- No se ha identificado host/proveedor accesible de staging. No hay cuentas ni IDs reales de ese entorno verificados. No se crearon usuarios en una base de datos desconocida.

## Respuesta a los 12 requisitos

| Requisito | Entrega / estado |
| --- | --- |
| Host real | PENDIENTE: no encontrado en configuración ni deployments públicos |
| Commit desplegado | PENDIENTE: 7af3ed8 está en Git; estas correcciones requieren un commit posterior y despliegue verificable |
| Swagger funcional | Snapshot actualizado en swagger.backend.json y swagger.frontend-a.json; URLs remotas /api/docs y /api/docs-json sin verificar |
| Cuentas DEVELOPER/PRODUCT_OWNER/CLIENT/SUPER_ADMIN | PENDIENTE: sin entorno identificado; fixtures no son cuentas |
| IDs reales | PENDIENTE: no confundir IDs de fixtures con registros en staging |
| CORS dominio exacto | PENDIENTE remoto; FRONTEND_URL admite lista de orígenes, sin comodines añadidos |
| Preflight OPTIONS | LOCAL 204 verificado para http://localhost:5173; staging PENDIENTE |
| Content-Disposition | Configurado exposedHeaders en backend y comprobado localmente; requiere despliegue |
| ID contribuciones | Decisión aplicada: rutas /deliverables/{deliverableId}/contributions usan exclusivamente ProjectDeliverable.id dentro del projectId. Sin fallback; no encontrado devuelve 404. No usar milestoneOrder. Rutas /milestones/ permanecen legacy y no deben usarse en nuevas integraciones |
| Revisión | decision obligatorio APPROVE/OBSERVE; status eliminado del DTO, cuerpo antiguo devuelve 400. OBSERVE requiere feedbackNotes/comments no vacío en servicio |
| ETA tareas/recursos/horas/CV | PENDIENTE, sin estimación comprometida. No se implementan mediante esta corrección de contratos |
| Evidencia por endpoint | Catálogo de 48 contratos disponible; evidencia real de staging PENDIENTE. evidence-local.json contiene método, URL local, request, response y HTTP de las comprobaciones aisladas |

## Validación

- Backend: build correcto; 81 archivos y 639 pruebas unitarias pasan.
- Regresiones: no aprobar sin decision; no leer ni borrar contribuciones cuando un ID exacto no existe aunque pueda colisionar con un hito/orden.
- HTTP aislado: OPTIONS 204, cabecera expuesta y cinco cuerpos inválidos con 400; aprobación explícita con 200 usando servicio simulado.
- El script scripts/verify-integration-contracts.cjs usa controladores, DTO, filtro y configuración CORS reales; sustituye autenticación/servicio y no accede a base de datos. No certifica autenticación, autorización ni persistencia remotas.
- Swagger regenerado desde aplicación compilada. Tipos y fichas actualizados.
- Los mocks quedan disponibles. No configurar un host supuesto ni retirar el respaldo mock antes de verificar despliegue, roles, datos y CORS.

## Contratos de uso

POST/GET /api/v1/projects/{projectId}/deliverables/{deliverableId}/contributions:
identificador de entregable obtenido del listado real del proyecto. POST conserva contributions:[{userId,percentage,description}], suma 100, escritura PO/Admin. No representa horas.

PATCH /api/v1/projects/{projectId}/deliverables/{deliverableId}/review:
{decision:"APPROVE"} o {decision:"OBSERVE",feedbackNotes:"Detalle de corrección"}.
No enviar status. El frontend de este workspace se actualizó para emitir decision.

Los endpoints nuevos siguen sin fecha hasta definir alcance, responsable y entorno de despliegue. No hay evidencia para declarar integración completa ni disponibilidad pública.

Frontend: 13 pruebas del formulario y build pasaron antes de incorporar los últimos cambios remotos. Lint backend: sin errores, 12 advertencias existentes. No se ejecutó E2E con base de datos en esta entrega.

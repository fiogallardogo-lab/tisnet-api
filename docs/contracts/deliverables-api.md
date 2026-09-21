# API de membresías y entregables de proyecto

Estado: Sprint 5 implementado  
Base: `/api/v1`  
Autenticación: Bearer JWT en todos los endpoints

Todas las respuestas exitosas usan `{ "success": true, "message": string, "data": T }`. Los errores conservan el filtro HTTP global.

## Modelos

`ProjectMember` relaciona un usuario con un proyecto. La pareja `projectId + userId` es única, `isActive` controla el acceso y `memberRole` admite `CLIENT`, `DEVELOPER` o `PRODUCT_OWNER`.

`ProjectDeliverable` contiene `id`, `projectId`, `title`, `description`, `milestoneOrder`, `dueDate`, `status`, `fileUrl`, `externalLink`, `feedbackNotes`, `submittedAt`, `reviewedAt`, `reviewedById`, `createdAt` y `updatedAt`. `projectId + milestoneOrder` es único.

## Permisos

| Acción           | Developer      | Product Owner  | Cliente        | Admin | Super Admin |
| ---------------- | -------------- | -------------- | -------------- | ----- | ----------- |
| Listar           | Miembro activo | Miembro activo | Miembro activo | Todos | Todos       |
| Crear hito       | No             | Miembro activo | No             | Sí    | Sí          |
| Enviar evidencia | Miembro activo | Miembro activo | No             | Sí    | Sí          |
| Aprobar/observar | No             | Miembro activo | Miembro activo | Sí    | Sí          |

Para roles de proyecto, la membresía debe estar activa y `memberRole` debe coincidir con el rol actual del usuario. El identificador de usuario siempre se toma del JWT.

## GET `/projects/:projectId/deliverables`

Lista los entregables por `milestoneOrder` ascendente. Devuelve `404` si el proyecto no existe y `403` si falta membresía.

## POST `/projects/:projectId/deliverables`

```json
{
  "title": "Prototipo navegable",
  "description": "Primera versión para validación.",
  "milestoneOrder": 1,
  "dueDate": "2026-10-15"
}
```

Devuelve `201` con estado `DRAFT`. Un orden repetido dentro del proyecto devuelve `409`.

## PATCH `/projects/:projectId/deliverables/:deliverableId/submit`

```json
{
  "fileUrl": "https://files.example.com/prototype-v2.pdf",
  "externalLink": "https://www.figma.com/proto/example"
}
```

Al menos una evidencia HTTP/HTTPS debe existir en el payload o estar guardada previamente. Cambia `DRAFT` u `OBSERVED` a `IN_REVIEW`, registra `submittedAt` y limpia la revisión previa. Otros estados devuelven `409`.

## PATCH `/projects/:projectId/deliverables/:deliverableId/review`

Aprobación:

```json
{ "decision": "APPROVE" }
```

Observación:

```json
{
  "decision": "OBSERVE",
  "feedbackNotes": "Adjuntar evidencia para móviles."
}
```

Solo acepta entregables `IN_REVIEW`. `OBSERVE` exige notas no vacías. Persiste `reviewedAt` y `reviewedById`. `APPROVED` es terminal durante este Sprint y cualquier nueva transición devuelve `409`.

## Códigos HTTP

- `200`: listado, envío o revisión correctos.
- `201`: hito creado.
- `400`: parámetros, payload, URL o evidencia inválidos.
- `401`: JWT ausente, inválido o expirado.
- `403`: rol o membresía insuficiente.
- `404`: proyecto o entregable inexistente.
- `409`: orden duplicado o transición inválida.

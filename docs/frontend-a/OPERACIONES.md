# Operaciones confirmadas — Frontend A

Base /api/v1. Verificado en código 2026-09-30, base 7af3ed8 + correcciones de cierre. No se confirma despliegue. Datos sintéticos; fechas futuras deben ajustarse al ejecutar. Errores comunes incluyen 401/403, 429 y 500 genérico; permisos específicos prevalecen. Todas las listas de este catálogo carecen de paginación del servidor.

## authMe — GET /auth/me

- Disponibilidad: implementado, verificado 30/09/2026; staging sin confirmar.
- Permisos: Sesión activa: CLIENT/DEVELOPER y demás roles.
- Estados: Usuario activo.
- HTTP éxito: 200. Paginación: ninguna.
- Request: sin body.
- Response: ApiSuccess<AuthMe>.

### Request de ejemplo

~~~json
null
~~~

### Response de ejemplo

~~~json
{
  "success": true,
  "message": "Operación realizada correctamente",
  "data": {
    "id": 7,
    "email": "cliente@example.test",
    "role": "CLIENT"
  }
}
~~~

### Errores

- 401: JWT ausente, vencido, revocado o cuenta inactiva
- 403: Rol/propiedad/membresía no autorizados
- 429: Límite de solicitudes excedido
- 500: Error interno genérico

## login — POST /auth/login

- Disponibilidad: implementado, verificado 30/09/2026; staging sin confirmar.
- Permisos: Público.
- Estados: Usuario activo y credenciales válidas.
- HTTP éxito: 200. Paginación: ninguna.
- Request: LoginRequest.
- Response: ApiSuccess<LoginResponse>.

### Request de ejemplo

~~~json
{
  "email": "cliente@example.test",
  "password": "Example-only123!"
}
~~~

### Response de ejemplo

~~~json
{
  "success": true,
  "message": "Operación realizada correctamente",
  "data": {
    "accessToken": "MOCK_ACCESS_TOKEN",
    "refreshToken": "MOCK_REFRESH_TOKEN",
    "user": {
      "id": 7,
      "email": "cliente@example.test",
      "role": "CLIENT"
    }
  }
}
~~~

### Errores

- 400: DTO inválido
- 401: Credenciales inválidas
- 403: Rol/propiedad/membresía no autorizados
- 429: Límite de solicitudes excedido
- 500: Error interno genérico

## refresh — POST /auth/refresh

- Disponibilidad: implementado, verificado 30/09/2026; staging sin confirmar.
- Permisos: Refresh token válido.
- Estados: Token no revocado.
- HTTP éxito: 200. Paginación: ninguna.
- Request: RefreshRequest.
- Response: ApiSuccess<RefreshResponse>.

### Request de ejemplo

~~~json
{
  "refreshToken": "MOCK_REFRESH_TOKEN"
}
~~~

### Response de ejemplo

~~~json
{
  "success": true,
  "message": "Operación realizada correctamente",
  "data": {
    "accessToken": "MOCK_NEW_ACCESS_TOKEN"
  }
}
~~~

### Errores

- 400: DTO inválido
- 401: JWT ausente, vencido, revocado o cuenta inactiva
- 403: Rol/propiedad/membresía no autorizados
- 429: Límite de solicitudes excedido
- 500: Error interno genérico

## logout — POST /auth/logout

- Disponibilidad: implementado, verificado 30/09/2026; staging sin confirmar.
- Permisos: Sesión activa.
- Estados: Revoca todas las sesiones mediante tokenVersion.
- HTTP éxito: 200. Paginación: ninguna.
- Request: sin body.
- Response: ApiSuccess<null>.

### Request de ejemplo

~~~json
null
~~~

### Response de ejemplo

~~~json
{
  "success": true,
  "message": "Sesión cerrada correctamente",
  "data": null
}
~~~

### Errores

- 401: JWT ausente, vencido, revocado o cuenta inactiva
- 403: Rol/propiedad/membresía no autorizados
- 429: Límite de solicitudes excedido
- 500: Error interno genérico

## clientOverview — GET /client/overview

- Disponibilidad: implementado, verificado 30/09/2026; staging sin confirmar.
- Permisos: CLIENT.
- Estados: Cuenta activa; proyectos no ARCHIVED, membresía CLIENT activa.
- HTTP éxito: 200. Paginación: ninguna.
- Request: sin body.
- Response: ApiSuccess<ClientOverview>.

### Request de ejemplo

~~~json
null
~~~

### Response de ejemplo

~~~json
{
  "success": true,
  "message": "Operación realizada correctamente",
  "data": {
    "user": {
      "name": "Cliente Demo",
      "email": "cliente@example.test"
    },
    "projects": [
      {
        "id": 11,
        "name": "Proyecto Demo",
        "summary": "Resumen del proyecto",
        "description": "Detalle del proyecto",
        "status": "IN_DEVELOPMENT",
        "progress": 0,
        "startedAt": null,
        "estimatedDeliveryAt": "2026-10-01",
        "teamSize": 1,
        "totalDeliverables": 1,
        "pendingDeliverables": 1,
        "milestones": [
          {
            "id": 101,
            "title": "Entrega 1",
            "status": "IN_REVIEW",
            "date": "2026-10-01"
          }
        ],
        "locked": false
      }
    ],
    "quotes": [
      {
        "id": "quote-41",
        "publicCode": "Q-ABCDEFGH",
        "code": "Q-ABCDEFGH",
        "solutionType": "WEB",
        "status": "RECEIVED",
        "amountMinor": "10000",
        "currency": "PEN",
        "notes": null,
        "createdAt": "2026-10-01T15:00:00.000Z"
      }
    ],
    "meetings": [
      {
        "id": 81,
        "status": "PENDING",
        "scheduledAt": "2026-10-01T15:00:00.000Z",
        "timezone": "America/Lima",
        "notes": null,
        "createdAt": "2026-10-01T15:00:00.000Z",
        "updatedAt": "2026-10-01T15:00:00.000Z",
        "advisorName": null
      }
    ],
    "advisor": null,
    "activity": []
  }
}
~~~

### Errores

- 401: JWT ausente, vencido, revocado o cuenta inactiva
- 403: Rol/propiedad/membresía no autorizados
- 429: Límite de solicitudes excedido
- 500: Error interno genérico

## workspaceProjects — GET /workspace/projects

- Disponibilidad: implementado, verificado 30/09/2026; staging sin confirmar.
- Permisos: DEVELOPER/PRODUCT_OWNER.
- Estados: Membresía activa del mismo rol; no ARCHIVED.
- HTTP éxito: 200. Paginación: ninguna.
- Request: sin body.
- Response: ApiSuccess<WorkspaceProjects>.

### Request de ejemplo

~~~json
null
~~~

### Response de ejemplo

~~~json
{
  "success": true,
  "message": "Operación realizada correctamente",
  "data": [
    {
      "id": 11,
      "name": "Proyecto Demo",
      "summary": "Resumen del proyecto",
      "description": "Detalle del proyecto",
      "status": "IN_DEVELOPMENT",
      "progress": 0,
      "startedAt": null,
      "estimatedDeliveryAt": "2026-10-01T15:00:00.000Z",
      "teamSize": 1,
      "totalDeliverables": 1,
      "pendingDeliverables": 1,
      "milestones": [
        {
          "id": 21,
          "title": "Entrega 1",
          "status": "IN_REVIEW",
          "date": "2026-10-01T15:00:00.000Z"
        }
      ]
    }
  ]
}
~~~

### Errores

- 401: JWT ausente, vencido, revocado o cuenta inactiva
- 403: Rol/propiedad/membresía no autorizados
- 429: Límite de solicitudes excedido
- 500: Error interno genérico

## agreement — GET /client/quotes/{id}/agreement

- Disponibilidad: implementado, verificado 30/09/2026; staging sin confirmar.
- Permisos: CLIENT propietario vinculado mediante prospect.userId.
- Estados: Debe existir al menos una versión oficial.
- HTTP éxito: 200. Paginación: ninguna.
- Request: sin body.
- Response: ApiSuccess<Agreement>.

### Request de ejemplo

~~~json
null
~~~

### Response de ejemplo

~~~json
{
  "success": true,
  "message": "Operación realizada correctamente",
  "data": {
    "quoteId": 41,
    "code": "Q-ABCDEFGH",
    "activeVersion": 2,
    "amountMinor": 10000,
    "currency": "PEN",
    "officialAt": "2026-10-01T15:00:00.000Z",
    "acceptedAt": null,
    "acceptedVersionId": null,
    "versions": [
      {
        "id": 52,
        "version": 2,
        "code": "Q-ABCDEFGH",
        "kind": "OFFICIAL",
        "status": "SENT",
        "amountMinor": 10000,
        "currency": "PEN",
        "createdAt": "2026-10-01T15:00:00.000Z",
        "notes": "Alcance acordado",
        "canAccept": true,
        "installments": [
          {
            "id": 61,
            "label": "Entrega 1",
            "percentage": 100,
            "amountMinor": 10000,
            "currency": "PEN",
            "dueDate": "2026-10-01",
            "status": "PENDING"
          }
        ]
      }
    ],
    "installments": [
      {
        "id": 61,
        "sequence": 1,
        "milestone": "Entrega 1",
        "dueDate": "2026-10-01T15:00:00.000Z",
        "amountMinor": 10000,
        "paidMinor": 0,
        "status": "PENDING"
      }
    ]
  }
}
~~~

### Errores

- 401: JWT ausente, vencido, revocado o cuenta inactiva
- 403: Rol/propiedad/membresía no autorizados
- 404: Sin cotización oficial o no pertenece al cliente
- 429: Límite de solicitudes excedido
- 500: Error interno genérico

## acceptQuote — POST /client/quotes/{id}/accept

- Disponibilidad: implementado, verificado 30/09/2026; staging sin confirmar.
- Permisos: CLIENT propietario.
- Estados: Solo versión activa; idempotente si ya aceptada.
- HTTP éxito: 201. Paginación: ninguna.
- Request: AcceptQuote.
- Response: ApiSuccess<Acceptance>.

### Request de ejemplo

~~~json
{
  "versionId": 52,
  "accepted": true
}
~~~

### Response de ejemplo

~~~json
{
  "success": true,
  "message": "Operación realizada correctamente",
  "data": {
    "accepted": true,
    "acceptedAt": "2026-10-01T15:00:00.000Z"
  }
}
~~~

### Errores

- 400: accepted distinto de true o versionId inválido
- 401: JWT ausente, vencido, revocado o cuenta inactiva
- 403: Rol/propiedad/membresía no autorizados
- 404: Cotización/versión inaccesible
- 409: Versión reemplazada
- 429: Límite de solicitudes excedido
- 500: Error interno genérico

## quoteObservations — GET /client/quotes/{id}/observations

- Disponibilidad: implementado, verificado 30/09/2026; staging sin confirmar.
- Permisos: CLIENT propietario.
- Estados: Cotización propia.
- HTTP éxito: 200. Paginación: ninguna.
- Request: sin body.
- Response: ApiSuccess<QuoteObservations>.

### Request de ejemplo

~~~json
null
~~~

### Response de ejemplo

~~~json
{
  "success": true,
  "message": "Operación realizada correctamente",
  "data": {
    "items": [
      {
        "id": 1,
        "quoteId": 41,
        "versionId": 52,
        "authorId": 7,
        "text": "Solicito aclarar el alcance",
        "createdAt": "2026-10-01T15:00:00.000Z"
      }
    ]
  }
}
~~~

### Errores

- 401: JWT ausente, vencido, revocado o cuenta inactiva
- 403: Rol/propiedad/membresía no autorizados
- 404: Cotización inexistente
- 429: Límite de solicitudes excedido
- 500: Error interno genérico

## observeQuote — POST /client/quotes/{id}/observations

- Disponibilidad: implementado, verificado 30/09/2026; staging sin confirmar.
- Permisos: CLIENT propietario.
- Estados: Versión activa no aceptada.
- HTTP éxito: 201. Paginación: ninguna.
- Request: QuoteObservationRequest.
- Response: ApiSuccess<QuoteObservation>.

### Request de ejemplo

~~~json
{
  "versionId": 52,
  "text": "Solicito aclarar el alcance"
}
~~~

### Response de ejemplo

~~~json
{
  "success": true,
  "message": "Operación realizada correctamente",
  "data": {
    "id": 1,
    "quoteId": 41,
    "versionId": 52,
    "authorId": 7,
    "text": "Solicito aclarar el alcance",
    "createdAt": "2026-10-01T15:00:00.000Z"
  }
}
~~~

### Errores

- 400: Texto vacío o >2000; versionId inválido
- 401: JWT ausente, vencido, revocado o cuenta inactiva
- 403: Rol/propiedad/membresía no autorizados
- 404: Versión inexistente
- 409: Versión reemplazada/aceptada
- 429: Límite de solicitudes excedido
- 500: Error interno genérico

## quotePdf — GET /quotes/{code}/pdf

- Disponibilidad: implementado, verificado 30/09/2026; staging sin confirmar.
- Permisos: JWT; ADMIN/SUPER_ADMIN o email de sesión igual al contacto (el guard no restringe a CLIENT).
- Estados: Última versión oficial; si no existe, cotización inicial.
- HTTP éxito: 200. Paginación: ninguna.
- Request: sin body.
- Response: Blob application/pdf.

### Request de ejemplo

~~~json
null
~~~

### Response de ejemplo

~~~text
%PDF-... (Blob binario, sin envelope)
~~~

### Errores

- 401: JWT ausente, vencido, revocado o cuenta inactiva
- 403: Rol/propiedad/membresía no autorizados
- 404: Código inexistente
- 429: Límite de solicitudes excedido
- 500: Error interno genérico

## financialStatus — GET /quotes/{id}/financial-status

- Disponibilidad: implementado, verificado 30/09/2026; staging sin confirmar.
- Permisos: CLIENT propietario, ADMIN/SUPER_ADMIN. Developer 403.
- Estados: Solo versión oficial vigente.
- HTTP éxito: 200. Paginación: ninguna.
- Request: sin body.
- Response: ApiSuccess<FinancialStatus>.

### Request de ejemplo

~~~json
null
~~~

### Response de ejemplo

~~~json
{
  "success": true,
  "message": "Operación realizada correctamente",
  "data": {
    "quoteId": 41,
    "versionId": 52,
    "version": 2,
    "currency": "PEN",
    "state": "OPEN",
    "complete": false,
    "totalMinor": 10000,
    "paidMinor": 0,
    "outstandingMinor": 10000,
    "installments": [
      {
        "id": 61,
        "sequence": 1,
        "amountMinor": 10000,
        "paidMinor": 0,
        "outstandingMinor": 10000,
        "valid": true,
        "complete": false
      }
    ]
  }
}
~~~

### Errores

- 401: JWT ausente, vencido, revocado o cuenta inactiva
- 403: Rol/propiedad/membresía no autorizados
- 404: Cotización no encontrada
- 429: Límite de solicitudes excedido
- 500: Error interno genérico

## projectOperations — GET /projects/{id}/operations

- Disponibilidad: implementado, verificado 30/09/2026; staging sin confirmar.
- Permisos: CLIENT/DEVELOPER/PO miembros activos con memberRole coincidente; ADMIN/SUPER_ADMIN.
- Estados: No restringe estado del proyecto.
- HTTP éxito: 200. Paginación: ninguna.
- Request: sin body.
- Response: ApiSuccess<ProjectOperations>.

### Request de ejemplo

~~~json
null
~~~

### Response de ejemplo

~~~json
{
  "success": true,
  "message": "Operación realizada correctamente",
  "data": {
    "projectId": 11,
    "name": "Proyecto Demo",
    "slug": "proyecto-demo",
    "shortDescription": "Resumen del proyecto",
    "status": "IN_DEVELOPMENT",
    "developmentDate": null,
    "productOwnerId": 9,
    "kickoff": {
      "status": "PENDING",
      "scheduledAt": null,
      "notes": "",
      "canStart": false,
      "blockingReason": "Se requiere adelanto confirmado."
    },
    "members": [
      {
        "id": 31,
        "userId": 8,
        "name": "Developer Demo",
        "role": "DEVELOPER",
        "memberRole": "DEVELOPER",
        "technicalRole": "Backend",
        "participation": 100,
        "participationBasisPoints": 10000,
        "isActive": true
      }
    ],
    "milestones": [
      {
        "id": 21,
        "title": "Entrega 1",
        "dueDate": "2026-10-01T15:00:00.000Z",
        "sequence": 1,
        "deliverables": [
          {
            "id": 101,
            "projectId": 11,
            "milestoneId": 21,
            "title": "Entrega 1",
            "description": "Informe y demostración",
            "milestoneOrder": 1,
            "dueDate": "2026-10-01T15:00:00.000Z",
            "status": "IN_REVIEW",
            "fileUrl": "https://files.example.test/report.pdf",
            "externalLink": "https://video.example.test/demo",
            "feedbackNotes": null,
            "submittedAt": "2026-10-01T15:00:00.000Z",
            "reviewedAt": null,
            "reviewedById": null,
            "createdAt": "2026-10-01T15:00:00.000Z",
            "updatedAt": "2026-10-01T15:00:00.000Z"
          }
        ]
      }
    ],
    "candidates": [],
    "canManageTeam": false,
    "canManageKickoff": false,
    "canViewFinance": false
  }
}
~~~

### Errores

- 401: JWT ausente, vencido, revocado o cuenta inactiva
- 403: Rol/propiedad/membresía no autorizados
- 404: Proyecto inexistente
- 429: Límite de solicitudes excedido
- 500: Error interno genérico

## projectMembers — GET /projects/{id}/members

- Disponibilidad: implementado, verificado 30/09/2026; staging sin confirmar.
- Permisos: Igual que operations.
- Estados: Incluye miembros activos e inactivos; filtrar isActive en UI.
- HTTP éxito: 200. Paginación: ninguna.
- Request: sin body.
- Response: ApiSuccess<Members>.

### Request de ejemplo

~~~json
null
~~~

### Response de ejemplo

~~~json
{
  "success": true,
  "message": "Operación realizada correctamente",
  "data": [
    {
      "id": 31,
      "projectId": 11,
      "userId": 8,
      "memberRole": "DEVELOPER",
      "technicalRole": "Backend",
      "participationBasisPoints": 10000,
      "isActive": true,
      "user": {
        "name": "Developer Demo"
      },
      "createdAt": "2026-10-01T15:00:00.000Z"
    }
  ]
}
~~~

### Errores

- 401: JWT ausente, vencido, revocado o cuenta inactiva
- 403: Rol/propiedad/membresía no autorizados
- 404: Proyecto inexistente
- 429: Límite de solicitudes excedido
- 500: Error interno genérico

## deliverables — GET /projects/{projectId}/deliverables

- Disponibilidad: implementado, verificado 30/09/2026; staging sin confirmar.
- Permisos: CLIENT/DEVELOPER/PO con membresía activa y rol coincidente; ADMIN/SUPER_ADMIN.
- Estados: Todos los estados; orden milestoneOrder,id.
- HTTP éxito: 200. Paginación: ninguna.
- Request: sin body.
- Response: ApiSuccess<Deliverables>.

### Request de ejemplo

~~~json
null
~~~

### Response de ejemplo

~~~json
{
  "success": true,
  "message": "Operación realizada correctamente",
  "data": [
    {
      "id": 101,
      "projectId": 11,
      "milestoneId": 21,
      "title": "Entrega 1",
      "description": "Informe y demostración",
      "milestoneOrder": 1,
      "dueDate": "2026-10-01T15:00:00.000Z",
      "status": "IN_REVIEW",
      "fileUrl": "https://files.example.test/report.pdf",
      "externalLink": "https://video.example.test/demo",
      "feedbackNotes": null,
      "submittedAt": "2026-10-01T15:00:00.000Z",
      "reviewedAt": null,
      "reviewedById": null,
      "createdAt": "2026-10-01T15:00:00.000Z",
      "updatedAt": "2026-10-01T15:00:00.000Z",
      "reviewedBy": null
    }
  ]
}
~~~

### Errores

- 401: JWT ausente, vencido, revocado o cuenta inactiva
- 403: Rol/propiedad/membresía no autorizados
- 404: Proyecto inexistente
- 429: Límite de solicitudes excedido
- 500: Error interno genérico

## createDeliverable — POST /projects/{projectId}/deliverables

- Disponibilidad: implementado, verificado 30/09/2026; staging sin confirmar.
- Permisos: PO miembro activo o ADMIN/SUPER_ADMIN. Cliente y Developer 403.
- Estados: En comercial: orden, título y fecha del hito oficial.
- HTTP éxito: 201. Paginación: ninguna.
- Request: CreateDeliverable.
- Response: ApiSuccess<Deliverable>.

### Request de ejemplo

~~~json
{
  "title": "Entrega 1",
  "description": "Informe y demostración",
  "milestoneOrder": 1,
  "dueDate": "2026-10-01"
}
~~~

### Response de ejemplo

~~~json
{
  "success": true,
  "message": "Operación realizada correctamente",
  "data": {
    "id": 101,
    "projectId": 11,
    "milestoneId": 21,
    "title": "Entrega 1",
    "description": "Informe y demostración",
    "milestoneOrder": 1,
    "dueDate": "2026-10-01T15:00:00.000Z",
    "status": "DRAFT",
    "fileUrl": null,
    "externalLink": null,
    "feedbackNotes": null,
    "submittedAt": null,
    "reviewedAt": null,
    "reviewedById": null,
    "createdAt": "2026-10-01T15:00:00.000Z",
    "updatedAt": "2026-10-01T15:00:00.000Z",
    "reviewedBy": null
  }
}
~~~

### Errores

- 400: Hito no oficial o título/fecha discordantes
- 401: JWT ausente, vencido, revocado o cuenta inactiva
- 403: Rol/propiedad/membresía no autorizados
- 409: Orden duplicado
- 429: Límite de solicitudes excedido
- 500: Error interno genérico

## submitEvidence — POST /projects/{projectId}/deliverables/{deliverableId}/evidence

- Disponibilidad: implementado, verificado 30/09/2026; staging sin confirmar.
- Permisos: DEVELOPER/PO miembros activos; ADMIN/SUPER_ADMIN. Cliente 403.
- Estados: DRAFT/OBSERVED → IN_REVIEW; exige PDF y video.
- HTTP éxito: 201. Paginación: ninguna.
- Request: SubmitEvidence.
- Response: ApiSuccess<EvidenceResponse>.
- Archivo máximo: 52428800 bytes.

### Request de ejemplo

~~~json
{
  "pdfUrl": "https://files.example.test/report.pdf",
  "videoUrl": "https://video.example.test/demo"
}
~~~

### Response de ejemplo

~~~json
{
  "success": true,
  "message": "Operación realizada correctamente",
  "data": {
    "id": 101,
    "milestoneId": 21,
    "projectId": 11,
    "title": "Entrega 1",
    "status": "IN_REVIEW",
    "pdfUrl": "https://files.example.test/report.pdf",
    "videoUrl": "https://video.example.test/demo",
    "notes": null,
    "submittedAt": "2026-10-01T15:00:00.000Z"
  }
}
~~~

### Errores

- 400: Falta PDF/video o URL/MIME inválido
- 401: JWT ausente, vencido, revocado o cuenta inactiva
- 403: Rol/propiedad/membresía no autorizados
- 404: Proyecto/entregable inexistente
- 409: Estado incompatible
- 413: Archivo >50 MiB
- 429: Límite de solicitudes excedido
- 500: Error interno genérico
- 503: Política de recordatorio si trigger=SUBMITTED no configurada

## reviewDeliverable — PATCH /projects/{projectId}/deliverables/{deliverableId}/review

- Disponibilidad: implementado, verificado 30/09/2026; staging sin confirmar.
- Permisos: CLIENT/PO miembros activos; ADMIN/SUPER_ADMIN. Developer 403.
- Estados: IN_REVIEW → APPROVED/OBSERVED; OBSERVE exige feedbackNotes.
- HTTP éxito: 200. Paginación: ninguna.
- Request: ReviewDeliverable.
- Response: ApiSuccess<Deliverable>.
- decision obligatorio: APPROVE u OBSERVE. status no se admite. OBSERVE exige feedbackNotes o comments no vacíos.

### Request de ejemplo

~~~json
{
  "decision": "APPROVE"
}
~~~

### Response de ejemplo

~~~json
{
  "success": true,
  "message": "Operación realizada correctamente",
  "data": {
    "id": 101,
    "projectId": 11,
    "milestoneId": 21,
    "title": "Entrega 1",
    "description": "Informe y demostración",
    "milestoneOrder": 1,
    "dueDate": "2026-10-01T15:00:00.000Z",
    "status": "APPROVED",
    "fileUrl": "https://files.example.test/report.pdf",
    "externalLink": "https://video.example.test/demo",
    "feedbackNotes": null,
    "submittedAt": "2026-10-01T15:00:00.000Z",
    "reviewedAt": "2026-10-01T15:00:00.000Z",
    "reviewedById": 7,
    "createdAt": "2026-10-01T15:00:00.000Z",
    "updatedAt": "2026-10-01T15:00:00.000Z",
    "reviewedBy": {
      "id": 7,
      "name": "Cliente Demo"
    }
  }
}
~~~

### Errores

- 400: decision ausente/inválido, status no admitido u observación sin notas
- 401: JWT ausente, vencido, revocado o cuenta inactiva
- 403: Rol/propiedad/membresía no autorizados
- 404: Entregable inexistente
- 409: Estado diferente de IN_REVIEW
- 429: Límite de solicitudes excedido
- 500: Error interno genérico
- 503: Política/destinatarios de recordatorio no configurados

## history — GET /projects/{projectId}/deliverables/{deliverableId}/history

- Disponibilidad: implementado, verificado 30/09/2026; staging sin confirmar.
- Permisos: Mismos permisos de lectura de entregables.
- Estados: Todos los estados; orden cronológico.
- HTTP éxito: 200. Paginación: ninguna.
- Request: sin body.
- Response: ApiSuccess<History>.

### Request de ejemplo

~~~json
null
~~~

### Response de ejemplo

~~~json
{
  "success": true,
  "message": "Operación realizada correctamente",
  "data": [
    {
      "id": 1,
      "action": "SUBMITTED",
      "actorId": 8,
      "actorName": "Developer Demo",
      "actorRole": "DEVELOPER",
      "fileUrl": "https://files.example.test/report.pdf",
      "videoUrl": "https://video.example.test/demo",
      "comments": null,
      "timestamp": "2026-10-01T15:00:00.000Z"
    }
  ]
}
~~~

### Errores

- 401: JWT ausente, vencido, revocado o cuenta inactiva
- 403: Rol/propiedad/membresía no autorizados
- 404: Entregable inexistente
- 429: Límite de solicitudes excedido
- 500: Error interno genérico

## uploadFile — POST /projects/{projectId}/deliverables/{id}/files

- Disponibilidad: implementado, verificado 30/09/2026; staging sin confirmar.
- Permisos: DEVELOPER/PO activos; ADMIN/SUPER_ADMIN.
- Estados: Sin restricción explícita por estado. Subir no envía a revisión.
- HTTP éxito: 201. Paginación: ninguna.
- Request: UploadRequest.
- Response: ApiSuccess<UploadedFile>.
- Archivo máximo: 104857600 bytes.

### Request de ejemplo

~~~json
{
  "file": "<archivo PDF/MP4/WebM>"
}
~~~

### Response de ejemplo

~~~json
{
  "success": true,
  "message": "Operación realizada correctamente",
  "data": {
    "url": "https://files.example.test/report.pdf",
    "storageKey": "example.pdf",
    "filename": "informe.pdf",
    "sizeBytes": 1024,
    "mimeType": "application/pdf"
  }
}
~~~

### Errores

- 400: Archivo ausente/MIME no permitido
- 401: JWT ausente, vencido, revocado o cuenta inactiva
- 403: Rol/propiedad/membresía no autorizados
- 404: Entregable inexistente
- 413: >100 MiB
- 429: Límite de solicitudes excedido
- 500: Error interno genérico

## requestMeeting — POST /client/meetings

- Disponibilidad: implementado, verificado 30/09/2026; staging sin confirmar.
- Permisos: CLIENT.
- Estados: Fecha futura y asesor público activo; PENDING no equivale a reserva confirmada.
- HTTP éxito: 201. Paginación: ninguna.
- Request: RequestMeeting.
- Response: ApiSuccess<MeetingRequested>.

### Request de ejemplo

~~~json
{
  "advisorId": 5,
  "scheduledAt": "2026-10-01T15:00:00.000Z",
  "notes": "Consulta inicial"
}
~~~

### Response de ejemplo

~~~json
{
  "success": true,
  "message": "Operación realizada correctamente",
  "data": {
    "id": 81,
    "status": "PENDING",
    "scheduledAt": "2026-10-01T15:00:00.000Z"
  }
}
~~~

### Errores

- 400: Fecha no futura/DTO inválido
- 401: JWT ausente, vencido, revocado o cuenta inactiva
- 403: Rol/propiedad/membresía no autorizados
- 404: Asesor no disponible
- 409: Solapamiento de horario o contacto vinculado a otro usuario
- 429: Límite de solicitudes excedido
- 500: Error interno genérico

## cancelMeeting — PATCH /client/meetings/{id}/cancel

- Disponibilidad: implementado, verificado 30/09/2026; staging sin confirmar.
- Permisos: CLIENT propietario.
- Estados: PENDING/SCHEDULED → CANCELLED.
- HTTP éxito: 200. Paginación: ninguna.
- Request: sin body.
- Response: ApiSuccess<MeetingCancelled>.

### Request de ejemplo

~~~json
null
~~~

### Response de ejemplo

~~~json
{
  "success": true,
  "message": "Operación realizada correctamente",
  "data": {
    "id": 81,
    "status": "CANCELLED"
  }
}
~~~

### Errores

- 401: JWT ausente, vencido, revocado o cuenta inactiva
- 403: Rol/propiedad/membresía no autorizados
- 404: No existe, no pertenece al cliente o ya no está activa
- 429: Límite de solicitudes excedido
- 500: Error interno genérico

## getKickoff — GET /client/projects/{id}/kickoff

- Disponibilidad: implementado, verificado 30/09/2026; staging sin confirmar.
- Permisos: CLIENT miembro activo.
- Estados: Devuelve operations, no un objeto kickoff aislado.
- HTTP éxito: 200. Paginación: ninguna.
- Request: sin body.
- Response: ApiSuccess<ProjectOperations>.

### Request de ejemplo

~~~json
null
~~~

### Response de ejemplo

~~~json
{
  "success": true,
  "message": "Operación realizada correctamente",
  "data": {
    "projectId": 11,
    "name": "Proyecto Demo",
    "slug": "proyecto-demo",
    "shortDescription": "Resumen del proyecto",
    "status": "IN_DEVELOPMENT",
    "developmentDate": null,
    "productOwnerId": 9,
    "kickoff": {
      "status": "PENDING",
      "scheduledAt": null,
      "notes": "",
      "canStart": false,
      "blockingReason": "Se requiere adelanto confirmado."
    },
    "members": [
      {
        "id": 31,
        "userId": 8,
        "name": "Developer Demo",
        "role": "DEVELOPER",
        "memberRole": "DEVELOPER",
        "technicalRole": "Backend",
        "participation": 100,
        "participationBasisPoints": 10000,
        "isActive": true
      }
    ],
    "milestones": [
      {
        "id": 21,
        "title": "Entrega 1",
        "dueDate": "2026-10-01T15:00:00.000Z",
        "sequence": 1,
        "deliverables": [
          {
            "id": 101,
            "projectId": 11,
            "milestoneId": 21,
            "title": "Entrega 1",
            "description": "Informe y demostración",
            "milestoneOrder": 1,
            "dueDate": "2026-10-01T15:00:00.000Z",
            "status": "IN_REVIEW",
            "fileUrl": "https://files.example.test/report.pdf",
            "externalLink": "https://video.example.test/demo",
            "feedbackNotes": null,
            "submittedAt": "2026-10-01T15:00:00.000Z",
            "reviewedAt": null,
            "reviewedById": null,
            "createdAt": "2026-10-01T15:00:00.000Z",
            "updatedAt": "2026-10-01T15:00:00.000Z"
          }
        ],
        "amountMinor": "10000",
        "percentageBasisPoints": 10000,
        "paymentScheduleId": 61
      }
    ],
    "candidates": [],
    "canManageTeam": false,
    "canManageKickoff": false,
    "canViewFinance": true,
    "quoteId": 41,
    "clientUserId": 7
  }
}
~~~

### Errores

- 401: JWT ausente, vencido, revocado o cuenta inactiva
- 403: Rol/propiedad/membresía no autorizados
- 404: Proyecto inexistente
- 429: Límite de solicitudes excedido
- 500: Error interno genérico

## scheduleKickoff — POST /client/projects/{id}/kickoff

- Disponibilidad: implementado, verificado 30/09/2026; staging sin confirmar.
- Permisos: CLIENT miembro activo.
- Estados: Cotización y adelanto confirmado; asesor obligatorio para cliente. Puede reprogramar; solicitar no confirma la reunión.
- HTTP éxito: 201. Paginación: ninguna.
- Request: ScheduleKickoff.
- Response: ApiSuccess<DbKickoff>.

### Request de ejemplo

~~~json
{
  "advisorId": 5,
  "scheduledAt": "2026-10-01T15:00:00.000Z",
  "notes": "Solicitud"
}
~~~

### Response de ejemplo

~~~json
{
  "success": true,
  "message": "Operación realizada correctamente",
  "data": {
    "id": 91,
    "projectId": 11,
    "meetingId": 81,
    "actorId": 7,
    "heldAt": "2026-10-01T15:00:00.000Z",
    "notes": "",
    "createdAt": "2026-10-01T15:00:00.000Z"
  }
}
~~~

### Errores

- 400: Fecha inválida/falta asesor
- 401: JWT ausente, vencido, revocado o cuenta inactiva
- 403: Rol/propiedad/membresía no autorizados
- 404: Asesor/proyecto inexistente
- 409: Adelanto pendiente, sin acuerdo o solapamiento
- 429: Límite de solicitudes excedido
- 500: Error interno genérico

## getContributions — GET /projects/{projectId}/deliverables/{deliverableId}/contributions

- Disponibilidad: implementado, verificado 30/09/2026; staging sin confirmar.
- Permisos: Miembro activo o cliente/PO titular; ADMIN/SUPER_ADMIN.
- Estados: Sin restricción por estado del entregable.
- HTTP éxito: 200. Paginación: ninguna.
- Request: sin body.
- Response: ApiSuccess<Contributions>.
- deliverableId es exclusivamente ProjectDeliverable.id dentro del proyecto. Sin fallback a milestoneId ni milestoneOrder. ID ajeno/inexistente devuelve 404.

### Request de ejemplo

~~~json
null
~~~

### Response de ejemplo

~~~json
{
  "success": true,
  "message": "Operación realizada correctamente",
  "data": [
    {
      "id": 71,
      "projectId": 11,
      "deliverableId": 101,
      "milestoneId": 21,
      "userId": 8,
      "percentage": 100,
      "description": "Implementación de API",
      "createdAt": "2026-10-01T15:00:00.000Z",
      "updatedAt": "2026-10-01T15:00:00.000Z",
      "user": {
        "id": 8,
        "name": "Developer Demo",
        "email": "dev@example.test",
        "role": {
          "name": "DEVELOPER"
        }
      }
    }
  ]
}
~~~

### Errores

- 401: JWT ausente, vencido, revocado o cuenta inactiva
- 403: Rol/propiedad/membresía no autorizados
- 404: Hito/proyecto inexistente
- 429: Límite de solicitudes excedido
- 500: Error interno genérico

## saveContributions — POST /projects/{projectId}/deliverables/{deliverableId}/contributions

- Disponibilidad: implementado, verificado 30/09/2026; staging sin confirmar.
- Permisos: PO/ADMIN/SUPER_ADMIN. Cliente y Developer: lectura.
- Estados: Reemplaza el reparto previo; no exige APPROVED.
- HTTP éxito: 201. Paginación: ninguna.
- Request: SaveContributions.
- Response: ApiSuccess<Contributions>.
- deliverableId es exclusivamente ProjectDeliverable.id dentro del proyecto. Sin fallback a milestoneId ni milestoneOrder. ID ajeno/inexistente devuelve 404.

### Request de ejemplo

~~~json
{
  "contributions": [
    {
      "userId": 8,
      "percentage": 100,
      "description": "Implementación de API"
    }
  ]
}
~~~

### Response de ejemplo

~~~json
{
  "success": true,
  "message": "Operación realizada correctamente",
  "data": [
    {
      "id": 71,
      "projectId": 11,
      "deliverableId": 101,
      "milestoneId": 21,
      "userId": 8,
      "percentage": 100,
      "description": "Implementación de API",
      "createdAt": "2026-10-01T15:00:00.000Z",
      "updatedAt": "2026-10-01T15:00:00.000Z",
      "user": {
        "id": 8,
        "name": "Developer Demo",
        "email": "dev@example.test",
        "role": {
          "name": "DEVELOPER"
        }
      }
    }
  ]
}
~~~

### Errores

- 400: Suma distinta de100, duplicados, integrante inválido o porcentaje no entero1–100
- 401: JWT ausente, vencido, revocado o cuenta inactiva
- 403: Rol/propiedad/membresía no autorizados
- 404: Hito inexistente
- 429: Límite de solicitudes excedido
- 500: Error interno genérico

## projectContributions — GET /projects/{projectId}/contributions

- Disponibilidad: implementado, verificado 30/09/2026; staging sin confirmar.
- Permisos: Miembro activo o cliente/PO titular; ADMIN/SUPER_ADMIN.
- Estados: Media sobre total de entregables, no horas trabajadas.
- HTTP éxito: 200. Paginación: ninguna.
- Request: sin body.
- Response: ApiSuccess<ProjectContributions>.

### Request de ejemplo

~~~json
null
~~~

### Response de ejemplo

~~~json
{
  "success": true,
  "message": "Operación realizada correctamente",
  "data": {
    "projectId": 11,
    "totalMilestones": 1,
    "deliverables": [
      {
        "id": 101,
        "title": "Entrega 1",
        "milestoneOrder": 1,
        "status": "IN_REVIEW",
        "dueDate": "2026-10-01T15:00:00.000Z",
        "contributions": [
          {
            "id": 71,
            "userId": 8,
            "userName": "Developer Demo",
            "userRole": "DEVELOPER",
            "percentage": 100,
            "description": "Implementación de API"
          }
        ]
      }
    ],
    "teamSummary": [
      {
        "user": {
          "id": 8,
          "name": "Developer Demo",
          "email": "dev@example.test",
          "role": "DEVELOPER"
        },
        "averagePercentage": 100,
        "milestonesContributed": 1,
        "tasks": [
          "Implementación de API"
        ]
      }
    ]
  }
}
~~~

### Errores

- 401: JWT ausente, vencido, revocado o cuenta inactiva
- 403: Rol/propiedad/membresía no autorizados
- 404: Proyecto inexistente
- 429: Límite de solicitudes excedido
- 500: Error interno genérico

## progress — GET /reports/projects

- Disponibilidad: implementado, verificado 30/09/2026; staging sin confirmar.
- Permisos: CLIENT/DEVELOPER/PO con membresía activa; ADMIN/SUPER_ADMIN.
- Estados: Excluye DRAFT/ARCHIVED; progreso = aprobados/total, cero si no hay entregables.
- HTTP éxito: 200. Paginación: ninguna.
- Request: sin body · query [{"name":"projectId","type":"integer","required":false,"example":11}].
- Response: ApiSuccess<ProgressReport>.

### Request de ejemplo

~~~json
null
~~~

### Response de ejemplo

~~~json
{
  "success": true,
  "message": "Operación realizada correctamente",
  "data": {
    "canViewFinance": false,
    "projects": [
      {
        "projectId": 11,
        "name": "Proyecto Demo",
        "progress": 0,
        "approvedDeliverables": 0,
        "pendingDeliverables": 1
      }
    ],
    "generatedAt": "2026-10-01T15:00:00.000Z"
  }
}
~~~

### Errores

- 401: JWT ausente, vencido, revocado o cuenta inactiva
- 403: Rol/propiedad/membresía no autorizados
- 429: Límite de solicitudes excedido
- 500: Error interno genérico

## traceability — GET /reports/projects/{projectId}/report

- Disponibilidad: implementado, verificado 30/09/2026; staging sin confirmar.
- Permisos: Miembro activo o cliente/PO titular; ADMIN/SUPER_ADMIN.
- Estados: Cualquier estado; commercial=null para PO/Developer.
- HTTP éxito: 200. Paginación: ninguna.
- Request: sin body · query [{"name":"format","type":"string","enum":["json","pdf"],"example":"json","required":false}].
- Response: ApiSuccess<TraceabilityReport>.
- Sin format: CLIENT recibe PDF, otros JSON. Para JSON enviar siempre format=json.

### Request de ejemplo

~~~json
null
~~~

### Response de ejemplo

~~~json
{
  "success": true,
  "message": "Operación realizada correctamente",
  "data": {
    "project": {
      "id": 11,
      "name": "Proyecto Demo",
      "slug": "proyecto-demo",
      "status": "IN_DEVELOPMENT",
      "progress": 0,
      "createdAt": "2026-10-01T15:00:00.000Z",
      "client": {
        "name": "Cliente Demo"
      },
      "productOwner": {
        "name": "PO Demo"
      }
    },
    "commercial": null,
    "team": [
      {
        "id": 8,
        "name": "Developer Demo",
        "memberRole": "DEVELOPER",
        "technicalRole": "Backend",
        "participationBasisPoints": 10000
      }
    ],
    "milestones": [
      {
        "id": 101,
        "milestoneOrder": 1,
        "title": "Entrega 1",
        "description": "Informe y demostración",
        "status": "IN_REVIEW",
        "dueDate": "2026-10-01T15:00:00.000Z",
        "pdfUrl": "https://files.example.test/report.pdf",
        "videoUrl": "https://video.example.test/demo",
        "feedbackNotes": null,
        "submittedAt": "2026-10-01T15:00:00.000Z",
        "reviewedAt": null,
        "reviewedBy": null,
        "contributions": [],
        "history": [
          {
            "action": "SUBMITTED",
            "actorName": "Developer Demo",
            "actorRole": "DEVELOPER",
            "fileUrl": "https://files.example.test/report.pdf",
            "videoUrl": "https://video.example.test/demo",
            "comments": null,
            "timestamp": "2026-10-01T15:00:00.000Z"
          }
        ]
      }
    ],
    "teamContributions": [],
    "generatedAt": "2026-10-01T15:00:00.000Z"
  }
}
~~~

### Errores

- 401: JWT ausente, vencido, revocado o cuenta inactiva
- 403: Rol/propiedad/membresía no autorizados
- 404: Proyecto inexistente
- 429: Límite de solicitudes excedido
- 500: Error interno genérico

## profile — GET /users/me/profile

- Disponibilidad: implementado, verificado 30/09/2026; staging sin confirmar.
- Permisos: Sesión activa; perfil propio.
- Estados: Puede ser profile=null.
- HTTP éxito: 200. Paginación: ninguna.
- Request: sin body.
- Response: ApiSuccess<OwnProfile>.

### Request de ejemplo

~~~json
null
~~~

### Response de ejemplo

~~~json
{
  "success": true,
  "message": "Operación realizada correctamente",
  "data": {
    "user": {
      "id": 7,
      "email": "cliente@example.test",
      "role": "CLIENT",
      "name": "Cliente Demo",
      "isActive": true
    },
    "profile": {
      "id": 17,
      "type": "CLIENT",
      "dni": null,
      "age": null,
      "phone": null,
      "district": null,
      "businessName": null,
      "ruc": null,
      "commercialName": null,
      "businessDistrict": null,
      "createdAt": "2026-10-01T15:00:00.000Z",
      "updatedAt": "2026-10-01T15:00:00.000Z"
    }
  }
}
~~~

### Errores

- 401: JWT ausente, vencido, revocado o cuenta inactiva
- 403: Rol/propiedad/membresía no autorizados
- 429: Límite de solicitudes excedido
- 500: Error interno genérico

## editOwnUser — PATCH /users/me

- Disponibilidad: implementado, verificado 30/09/2026; staging sin confirmar.
- Permisos: Sesión activa, propio.
- Estados: Nombre y/o consentimiento; no cambia email/rol.
- HTTP éxito: 200. Paginación: ninguna.
- Request: UpdateOwnUser.
- Response: ApiSuccess<UpdatedUser>.

### Request de ejemplo

~~~json
{
  "name": "Cliente Demo"
}
~~~

### Response de ejemplo

~~~json
{
  "success": true,
  "message": "Operación realizada correctamente",
  "data": {
    "id": 7,
    "email": "cliente@example.test",
    "role": "CLIENT",
    "name": "Cliente Demo",
    "isActive": true,
    "acceptedTermsAt": "2026-10-01T15:00:00.000Z",
    "termsVersion": "test-v1",
    "privacyVersion": "test-v1"
  }
}
~~~

### Errores

- 400: Sin campos válidos o consentimiento/versiones inválidas
- 401: JWT ausente, vencido, revocado o cuenta inactiva
- 403: Rol/propiedad/membresía no autorizados
- 429: Límite de solicitudes excedido
- 500: Error interno genérico
- 503: Legal vigente no publicado/configurado

## editClientProfile — PATCH /users/me/client-profile

- Disponibilidad: implementado, verificado 30/09/2026; staging sin confirmar.
- Permisos: CLIENT propio.
- Estados: Upsert; campos opcionales nullable.
- HTTP éxito: 200. Paginación: ninguna.
- Request: UpdateClientProfile.
- Response: ApiSuccess<ClientProfile>.

### Request de ejemplo

~~~json
{
  "phone": "+51 999999999",
  "district": "Lima"
}
~~~

### Response de ejemplo

~~~json
{
  "success": true,
  "message": "Operación realizada correctamente",
  "data": {
    "id": 17,
    "type": "CLIENT",
    "dni": null,
    "age": null,
    "phone": "+51 999999999",
    "district": "Lima",
    "businessName": null,
    "ruc": null,
    "commercialName": null,
    "businessDistrict": null,
    "createdAt": "2026-10-01T15:00:00.000Z",
    "updatedAt": "2026-10-01T15:00:00.000Z"
  }
}
~~~

### Errores

- 400: DNI/RUC/formato/rangos inválidos
- 401: JWT ausente, vencido, revocado o cuenta inactiva
- 403: Rol/propiedad/membresía no autorizados
- 409: DNI/RUC ya registrados
- 429: Límite de solicitudes excedido
- 500: Error interno genérico

## editDeveloperProfile — PATCH /users/me/developer-profile

- Disponibilidad: implementado, verificado 30/09/2026; staging sin confirmar.
- Permisos: DEVELOPER propio.
- Estados: Upsert; technologyIds ausente conserva, [] borra asociaciones.
- HTTP éxito: 200. Paginación: ninguna.
- Request: UpdateDeveloperProfile.
- Response: ApiSuccess<DeveloperProfile>.

### Request de ejemplo

~~~json
{
  "specialty": "Backend",
  "experienceYears": 2,
  "technologyIds": []
}
~~~

### Response de ejemplo

~~~json
{
  "success": true,
  "message": "Operación realizada correctamente",
  "data": {
    "id": 18,
    "type": "DEVELOPER",
    "career": null,
    "university": null,
    "academicStatus": null,
    "experienceYears": 2,
    "specialty": "Backend",
    "cvUrl": null,
    "photoUrl": null,
    "linkedinUrl": null,
    "githubUrl": null,
    "createdAt": "2026-10-01T15:00:00.000Z",
    "updatedAt": "2026-10-01T15:00:00.000Z",
    "technologies": []
  }
}
~~~

### Errores

- 400: Tecnología inactiva/inexistente o DTO inválido
- 401: JWT ausente, vencido, revocado o cuenta inactiva
- 403: Rol/propiedad/membresía no autorizados
- 409: Conflicto de datos únicos
- 429: Límite de solicitudes excedido
- 500: Error interno genérico

## profilePhoto — POST /users/me/photo

- Disponibilidad: implementado, verificado 30/09/2026; staging sin confirmar.
- Permisos: DEVELOPER/PO/ADMIN/SUPER_ADMIN; CLIENT recibe400.
- Estados: Cuenta activa; reemplaza URL de perfil.
- HTTP éxito: 201. Paginación: ninguna.
- Request: PhotoRequest.
- Response: ApiSuccess<PhotoResponse>.
- Archivo máximo: 5242880 bytes.

### Request de ejemplo

~~~json
{
  "photo": "<archivo JPG/PNG/WebP>"
}
~~~

### Response de ejemplo

~~~json
{
  "success": true,
  "message": "Operación realizada correctamente",
  "data": {
    "photoUrl": "https://files.example.test/avatar.png"
  }
}
~~~

### Errores

- 400: Foto ausente/MIME inválido, almacenamiento no disponible o rol CLIENT
- 401: JWT ausente, vencido, revocado o cuenta inactiva
- 403: Rol/propiedad/membresía no autorizados
- 413: >5 MiB
- 429: Límite de solicitudes excedido
- 500: Error interno genérico

## charge — POST /client/payments/{installmentId}/charge

- Disponibilidad: implementado, verificado 30/09/2026; staging sin confirmar.
- Permisos: CLIENT propietario.
- Estados: Cuota vigente aceptada con saldo; Culqi habilitado.
- HTTP éxito: 201. Paginación: ninguna.
- Request: ChargeRequest.
- Response: ApiSuccess<ChargeResponse>.

### Request de ejemplo

~~~json
{
  "tokenId": "tkn_test_example"
}
~~~

### Response de ejemplo

~~~json
{
  "success": true,
  "message": "Operación realizada correctamente",
  "data": {
    "chargeId": "chr_test_mock",
    "status": "PENDING_CONFIRMATION"
  }
}
~~~

### Errores

- 400: Token/moneda inválidos
- 401: JWT ausente, vencido, revocado o cuenta inactiva
- 403: Rol/propiedad/membresía no autorizados
- 404: Cuota inexistente
- 409: Pagada/no aceptada/reemplazada
- 429: Límite de solicitudes excedido
- 500: Error interno genérico
- 503: Culqi no configurado

## checkout — POST /client/payments/{installmentId}/checkout

- Disponibilidad: implementado, verificado 30/09/2026; staging sin confirmar.
- Permisos: CLIENT propietario.
- Estados: Igual que cargo; orden no confirma pago.
- HTTP éxito: 201. Paginación: ninguna.
- Request: sin body.
- Response: ApiSuccess<CheckoutResponse>.

### Request de ejemplo

~~~json
null
~~~

### Response de ejemplo

~~~json
{
  "success": true,
  "message": "Operación realizada correctamente",
  "data": {
    "orderId": "ord_test_mock",
    "amountMinor": 10000,
    "currency": "PEN",
    "expirationDate": "2026-10-01T15:00:00.000Z",
    "checkoutUrl": "https://portal.example.test/client/quotes/41/agreement?checkoutOrder=ord_test_mock"
  }
}
~~~

### Errores

- 401: JWT ausente, vencido, revocado o cuenta inactiva
- 403: Rol/propiedad/membresía no autorizados
- 404: Cuota inexistente
- 409: Pagada/no aceptada/reemplazada
- 429: Límite de solicitudes excedido
- 500: Error interno genérico
- 503: Culqi no configurado

## milestoneEvidence — POST /projects/{projectId}/milestones/{milestoneId}/evidence

- Disponibilidad: implementado, verificado 30/09/2026; staging sin confirmar.
- Permisos: DEVELOPER/PO miembros activos; ADMIN/SUPER_ADMIN. Cliente 403.
- Estados: DRAFT/OBSERVED → IN_REVIEW; exige PDF y video.
- HTTP éxito: 201. Paginación: ninguna.
- Request: SubmitEvidence.
- Response: ApiSuccess<EvidenceResponse>.
- Archivo máximo: 52428800 bytes.
- Alias funcional de submitEvidence.

### Request de ejemplo

~~~json
{
  "pdfUrl": "https://files.example.test/report.pdf",
  "videoUrl": "https://video.example.test/demo"
}
~~~

### Response de ejemplo

~~~json
{
  "success": true,
  "message": "Operación realizada correctamente",
  "data": {
    "id": 101,
    "milestoneId": 21,
    "projectId": 11,
    "title": "Entrega 1",
    "status": "IN_REVIEW",
    "pdfUrl": "https://files.example.test/report.pdf",
    "videoUrl": "https://video.example.test/demo",
    "notes": null,
    "submittedAt": "2026-10-01T15:00:00.000Z"
  }
}
~~~

### Errores

- 400: Falta PDF/video o URL/MIME inválido
- 401: JWT ausente, vencido, revocado o cuenta inactiva
- 403: Rol/propiedad/membresía no autorizados
- 404: Proyecto/entregable inexistente
- 409: Estado incompatible
- 413: Archivo >50 MiB
- 429: Límite de solicitudes excedido
- 500: Error interno genérico
- 503: Política de recordatorio si trigger=SUBMITTED no configurada

## milestoneEvidencePdf — POST /projects/{projectId}/milestones/{milestoneId}/evidence/pdf

- Disponibilidad: implementado, verificado 30/09/2026; staging sin confirmar.
- Permisos: DEVELOPER/PO miembros activos; ADMIN/SUPER_ADMIN. Cliente 403.
- Estados: DRAFT/OBSERVED → IN_REVIEW; exige PDF y video.
- HTTP éxito: 201. Paginación: ninguna.
- Request: SubmitEvidence.
- Response: ApiSuccess<EvidenceResponse>.
- Archivo máximo: 52428800 bytes.
- Alias funcional de submitEvidence.

### Request de ejemplo

~~~json
{
  "pdfUrl": "https://files.example.test/report.pdf",
  "videoUrl": "https://video.example.test/demo"
}
~~~

### Response de ejemplo

~~~json
{
  "success": true,
  "message": "Operación realizada correctamente",
  "data": {
    "id": 101,
    "milestoneId": 21,
    "projectId": 11,
    "title": "Entrega 1",
    "status": "IN_REVIEW",
    "pdfUrl": "https://files.example.test/report.pdf",
    "videoUrl": "https://video.example.test/demo",
    "notes": null,
    "submittedAt": "2026-10-01T15:00:00.000Z"
  }
}
~~~

### Errores

- 400: Falta PDF/video o URL/MIME inválido
- 401: JWT ausente, vencido, revocado o cuenta inactiva
- 403: Rol/propiedad/membresía no autorizados
- 404: Proyecto/entregable inexistente
- 409: Estado incompatible
- 413: Archivo >50 MiB
- 429: Límite de solicitudes excedido
- 500: Error interno genérico
- 503: Política de recordatorio si trigger=SUBMITTED no configurada

## reviewPost — POST /projects/{projectId}/deliverables/{deliverableId}/review

- Disponibilidad: implementado, verificado 30/09/2026; staging sin confirmar.
- Permisos: CLIENT/PO miembros activos; ADMIN/SUPER_ADMIN. Developer 403.
- Estados: IN_REVIEW → APPROVED/OBSERVED; OBSERVE exige feedbackNotes.
- HTTP éxito: 201. Paginación: ninguna.
- Request: ReviewDeliverable.
- Response: ApiSuccess<Deliverable>.
- Alias funcional de reviewDeliverable.
- decision obligatorio: APPROVE u OBSERVE. status no se admite. OBSERVE exige feedbackNotes o comments no vacíos.

### Request de ejemplo

~~~json
{
  "decision": "APPROVE"
}
~~~

### Response de ejemplo

~~~json
{
  "success": true,
  "message": "Operación realizada correctamente",
  "data": {
    "id": 101,
    "projectId": 11,
    "milestoneId": 21,
    "title": "Entrega 1",
    "description": "Informe y demostración",
    "milestoneOrder": 1,
    "dueDate": "2026-10-01T15:00:00.000Z",
    "status": "APPROVED",
    "fileUrl": "https://files.example.test/report.pdf",
    "externalLink": "https://video.example.test/demo",
    "feedbackNotes": null,
    "submittedAt": "2026-10-01T15:00:00.000Z",
    "reviewedAt": "2026-10-01T15:00:00.000Z",
    "reviewedById": 7,
    "createdAt": "2026-10-01T15:00:00.000Z",
    "updatedAt": "2026-10-01T15:00:00.000Z",
    "reviewedBy": {
      "id": 7,
      "name": "Cliente Demo"
    }
  }
}
~~~

### Errores

- 400: decision ausente/inválido, status no admitido u observación sin notas
- 401: JWT ausente, vencido, revocado o cuenta inactiva
- 403: Rol/propiedad/membresía no autorizados
- 404: Entregable inexistente
- 409: Estado diferente de IN_REVIEW
- 429: Límite de solicitudes excedido
- 500: Error interno genérico
- 503: Política/destinatarios de recordatorio no configurados

## milestoneReview — POST /projects/{projectId}/milestones/{milestoneId}/review

- Disponibilidad: implementado, verificado 30/09/2026; staging sin confirmar.
- Permisos: CLIENT/PO miembros activos; ADMIN/SUPER_ADMIN. Developer 403.
- Estados: IN_REVIEW → APPROVED/OBSERVED; OBSERVE exige feedbackNotes.
- HTTP éxito: 201. Paginación: ninguna.
- Request: ReviewDeliverable.
- Response: ApiSuccess<Deliverable>.
- Alias funcional de reviewDeliverable.
- decision obligatorio: APPROVE u OBSERVE. status no se admite. OBSERVE exige feedbackNotes o comments no vacíos.

### Request de ejemplo

~~~json
{
  "decision": "APPROVE"
}
~~~

### Response de ejemplo

~~~json
{
  "success": true,
  "message": "Operación realizada correctamente",
  "data": {
    "id": 101,
    "projectId": 11,
    "milestoneId": 21,
    "title": "Entrega 1",
    "description": "Informe y demostración",
    "milestoneOrder": 1,
    "dueDate": "2026-10-01T15:00:00.000Z",
    "status": "APPROVED",
    "fileUrl": "https://files.example.test/report.pdf",
    "externalLink": "https://video.example.test/demo",
    "feedbackNotes": null,
    "submittedAt": "2026-10-01T15:00:00.000Z",
    "reviewedAt": "2026-10-01T15:00:00.000Z",
    "reviewedById": 7,
    "createdAt": "2026-10-01T15:00:00.000Z",
    "updatedAt": "2026-10-01T15:00:00.000Z",
    "reviewedBy": {
      "id": 7,
      "name": "Cliente Demo"
    }
  }
}
~~~

### Errores

- 400: decision ausente/inválido, status no admitido u observación sin notas
- 401: JWT ausente, vencido, revocado o cuenta inactiva
- 403: Rol/propiedad/membresía no autorizados
- 404: Entregable inexistente
- 409: Estado diferente de IN_REVIEW
- 429: Límite de solicitudes excedido
- 500: Error interno genérico
- 503: Política/destinatarios de recordatorio no configurados

## milestoneHistory — GET /projects/{projectId}/milestones/{milestoneId}/history

- Disponibilidad: implementado, verificado 30/09/2026; staging sin confirmar.
- Permisos: Mismos permisos de lectura de entregables.
- Estados: Todos los estados; orden cronológico.
- HTTP éxito: 200. Paginación: ninguna.
- Request: sin body.
- Response: ApiSuccess<History>.
- Alias funcional de history.

### Request de ejemplo

~~~json
null
~~~

### Response de ejemplo

~~~json
{
  "success": true,
  "message": "Operación realizada correctamente",
  "data": [
    {
      "id": 1,
      "action": "SUBMITTED",
      "actorId": 8,
      "actorName": "Developer Demo",
      "actorRole": "DEVELOPER",
      "fileUrl": "https://files.example.test/report.pdf",
      "videoUrl": "https://video.example.test/demo",
      "comments": null,
      "timestamp": "2026-10-01T15:00:00.000Z"
    }
  ]
}
~~~

### Errores

- 401: JWT ausente, vencido, revocado o cuenta inactiva
- 403: Rol/propiedad/membresía no autorizados
- 404: Entregable inexistente
- 429: Límite de solicitudes excedido
- 500: Error interno genérico

## milestoneContributions — GET /projects/{projectId}/milestones/{milestoneId}/contributions

- Disponibilidad: implementado, verificado 30/09/2026; staging sin confirmar.
- Permisos: Miembro activo o cliente/PO titular; ADMIN/SUPER_ADMIN.
- Estados: Sin restricción por estado del entregable.
- HTTP éxito: 200. Paginación: ninguna.
- Request: sin body.
- Response: ApiSuccess<Contributions>.
- Alias funcional de getContributions.
- Ruta legacy ambigua. Para nuevas integraciones usar /deliverables/{deliverableId}/contributions con ID exacto.

### Request de ejemplo

~~~json
null
~~~

### Response de ejemplo

~~~json
{
  "success": true,
  "message": "Operación realizada correctamente",
  "data": [
    {
      "id": 71,
      "projectId": 11,
      "deliverableId": 101,
      "milestoneId": 21,
      "userId": 8,
      "percentage": 100,
      "description": "Implementación de API",
      "createdAt": "2026-10-01T15:00:00.000Z",
      "updatedAt": "2026-10-01T15:00:00.000Z",
      "user": {
        "id": 8,
        "name": "Developer Demo",
        "email": "dev@example.test",
        "role": {
          "name": "DEVELOPER"
        }
      }
    }
  ]
}
~~~

### Errores

- 401: JWT ausente, vencido, revocado o cuenta inactiva
- 403: Rol/propiedad/membresía no autorizados
- 404: Hito/proyecto inexistente
- 429: Límite de solicitudes excedido
- 500: Error interno genérico

## saveMilestoneContributions — POST /projects/{projectId}/milestones/{milestoneId}/contributions

- Disponibilidad: implementado, verificado 30/09/2026; staging sin confirmar.
- Permisos: PO/ADMIN/SUPER_ADMIN. Cliente y Developer: lectura.
- Estados: Reemplaza el reparto previo; no exige APPROVED.
- HTTP éxito: 201. Paginación: ninguna.
- Request: SaveContributions.
- Response: ApiSuccess<Contributions>.
- Alias funcional de saveContributions.
- Ruta legacy ambigua. Para nuevas integraciones usar /deliverables/{deliverableId}/contributions con ID exacto.

### Request de ejemplo

~~~json
{
  "contributions": [
    {
      "userId": 8,
      "percentage": 100,
      "description": "Implementación de API"
    }
  ]
}
~~~

### Response de ejemplo

~~~json
{
  "success": true,
  "message": "Operación realizada correctamente",
  "data": [
    {
      "id": 71,
      "projectId": 11,
      "deliverableId": 101,
      "milestoneId": 21,
      "userId": 8,
      "percentage": 100,
      "description": "Implementación de API",
      "createdAt": "2026-10-01T15:00:00.000Z",
      "updatedAt": "2026-10-01T15:00:00.000Z",
      "user": {
        "id": 8,
        "name": "Developer Demo",
        "email": "dev@example.test",
        "role": {
          "name": "DEVELOPER"
        }
      }
    }
  ]
}
~~~

### Errores

- 400: Suma distinta de100, duplicados, integrante inválido o porcentaje no entero1–100
- 401: JWT ausente, vencido, revocado o cuenta inactiva
- 403: Rol/propiedad/membresía no autorizados
- 404: Hito inexistente
- 429: Límite de solicitudes excedido
- 500: Error interno genérico

## projectReport — GET /projects/{id}/report

- Disponibilidad: implementado, verificado 30/09/2026; staging sin confirmar.
- Permisos: Miembro activo o cliente/PO titular; ADMIN/SUPER_ADMIN.
- Estados: Cualquier estado; commercial=null para PO/Developer.
- HTTP éxito: 200. Paginación: ninguna.
- Request: sin body · query [{"name":"format","type":"string","enum":["json","pdf"],"example":"json","required":false}].
- Response: ApiSuccess<TraceabilityReport>.
- Alias funcional de traceability.
- Sin format: CLIENT recibe PDF, otros JSON. Para JSON enviar siempre format=json.

### Request de ejemplo

~~~json
null
~~~

### Response de ejemplo

~~~json
{
  "success": true,
  "message": "Operación realizada correctamente",
  "data": {
    "project": {
      "id": 11,
      "name": "Proyecto Demo",
      "slug": "proyecto-demo",
      "status": "IN_DEVELOPMENT",
      "progress": 0,
      "createdAt": "2026-10-01T15:00:00.000Z",
      "client": {
        "name": "Cliente Demo"
      },
      "productOwner": {
        "name": "PO Demo"
      }
    },
    "commercial": null,
    "team": [
      {
        "id": 8,
        "name": "Developer Demo",
        "memberRole": "DEVELOPER",
        "technicalRole": "Backend",
        "participationBasisPoints": 10000
      }
    ],
    "milestones": [
      {
        "id": 101,
        "milestoneOrder": 1,
        "title": "Entrega 1",
        "description": "Informe y demostración",
        "status": "IN_REVIEW",
        "dueDate": "2026-10-01T15:00:00.000Z",
        "pdfUrl": "https://files.example.test/report.pdf",
        "videoUrl": "https://video.example.test/demo",
        "feedbackNotes": null,
        "submittedAt": "2026-10-01T15:00:00.000Z",
        "reviewedAt": null,
        "reviewedBy": null,
        "contributions": [],
        "history": [
          {
            "action": "SUBMITTED",
            "actorName": "Developer Demo",
            "actorRole": "DEVELOPER",
            "fileUrl": "https://files.example.test/report.pdf",
            "videoUrl": "https://video.example.test/demo",
            "comments": null,
            "timestamp": "2026-10-01T15:00:00.000Z"
          }
        ]
      }
    ],
    "teamContributions": [],
    "generatedAt": "2026-10-01T15:00:00.000Z"
  }
}
~~~

### Errores

- 401: JWT ausente, vencido, revocado o cuenta inactiva
- 403: Rol/propiedad/membresía no autorizados
- 404: Proyecto inexistente
- 429: Límite de solicitudes excedido
- 500: Error interno genérico

## createPublicQuote — POST /public/quotes

- Disponibilidad: implementado, verificado 30/09/2026; staging sin confirmar.
- Permisos: Público.
- Estados: Registro inicial; status=RECEIVED.
- HTTP éxito: 201. Paginación: ninguna.
- Request: PublicQuoteRequest.
- Response: ApiSuccess<PublicQuoteResponse>.
- Máximo20 opciones; códigos2–64. No acepta catalogVersion en esta ruta.

### Request de ejemplo

~~~json
{
  "solutionType": "ECOMMERCE",
  "options": [],
  "deliveryMode": "NORMAL",
  "contact": {
    "fullName": "Cliente Demo",
    "email": "cliente@example.test",
    "phone": "+51 999999999"
  }
}
~~~

### Response de ejemplo

~~~json
{
  "success": true,
  "message": "Cotización registrada correctamente",
  "data": {
    "code": "Q-ABCDEFGH",
    "status": "RECEIVED",
    "pricingStatus": "CALCULATED",
    "amountMinor": 10000,
    "currency": "PEN",
    "pricingVersion": "SP-01-v2",
    "createdAt": "2026-10-01T15:00:00.000Z"
  }
}
~~~

### Errores

- 400: DTO/campos desconocidos inválidos
- 422: Solución/opción inactiva, inexistente o incompatible
- 429: Límite de solicitudes
- 503: No se pudo registrar

## createPortalQuote — POST /public/project-quotes

- Disponibilidad: implementado, verificado 30/09/2026; staging sin confirmar.
- Permisos: Público.
- Estados: Registro inicial; status=RECEIVED.
- HTTP éxito: 201. Paginación: ninguna.
- Request: PortalQuoteRequest.
- Response: ApiSuccess<PublicQuoteResponse>.
- Máximo8 opciones; catalogVersion opcional debe ser SP-01-v2; catálogo de solución cerrado. No es DTO idéntico a /public/quotes.

### Request de ejemplo

~~~json
{
  "solutionType": "ECOMMERCE",
  "options": [],
  "deliveryMode": "NORMAL",
  "contact": {
    "fullName": "Cliente Demo",
    "email": "cliente@example.test",
    "phone": "+51 999999999"
  },
  "catalogVersion": "SP-01-v2"
}
~~~

### Response de ejemplo

~~~json
{
  "success": true,
  "message": "Operación realizada correctamente",
  "data": {
    "code": "Q-ABCDEFGH",
    "status": "RECEIVED",
    "pricingStatus": "CALCULATED",
    "amountMinor": 10000,
    "currency": "PEN",
    "pricingVersion": "SP-01-v2",
    "createdAt": "2026-10-01T15:00:00.000Z"
  }
}
~~~

### Errores

- 400: DTO/campos desconocidos inválidos
- 422: Solución/opción inactiva, inexistente o incompatible
- 429: Límite de solicitudes
- 503: No se pudo registrar

## publicQuoteLookup — GET /public/quotes/{code}

- Disponibilidad: implementado, verificado 30/09/2026; staging sin confirmar.
- Permisos: Público.
- Estados: Cotización registrada; no expone contacto/versiones/documentos.
- HTTP éxito: 200. Paginación: ninguna.
- Request: sin body.
- Response: ApiSuccess<PublicQuoteResponse>.

### Request de ejemplo

~~~json
null
~~~

### Response de ejemplo

~~~json
{
  "success": true,
  "message": "Operación realizada correctamente",
  "data": {
    "code": "Q-ABCDEFGH",
    "status": "RECEIVED",
    "pricingStatus": "CALCULATED",
    "amountMinor": 10000,
    "currency": "PEN",
    "pricingVersion": "SP-01-v2",
    "createdAt": "2026-10-01T15:00:00.000Z"
  }
}
~~~

### Errores

- 404: Código inexistente
- 429: Límite de solicitudes

## legacySubmit — PATCH /projects/{projectId}/deliverables/{deliverableId}/submit

- Disponibilidad: implementado, verificado 30/09/2026; staging sin confirmar.
- Permisos: DEVELOPER/PO miembros activos o ADMIN/SUPER_ADMIN.
- Estados: DRAFT/OBSERVED → IN_REVIEW. Ruta legacy acepta al menos un enlace; preferir evidence para exigir PDF+video..
- HTTP éxito: 200. Paginación: ninguna.
- Request: LegacySubmit.
- Response: ApiSuccess<Deliverable>.

### Request de ejemplo

~~~json
{
  "fileUrl": "https://files.example.test/report.pdf",
  "externalLink": "https://video.example.test/demo"
}
~~~

### Response de ejemplo

~~~json
{
  "success": true,
  "message": "Operación realizada correctamente",
  "data": {
    "id": 101,
    "projectId": 11,
    "milestoneId": 21,
    "title": "Entrega 1",
    "description": "Informe y demostración",
    "milestoneOrder": 1,
    "dueDate": "2026-10-01T15:00:00.000Z",
    "status": "IN_REVIEW",
    "fileUrl": "https://files.example.test/report.pdf",
    "externalLink": "https://video.example.test/demo",
    "feedbackNotes": null,
    "submittedAt": "2026-10-01T15:00:00.000Z",
    "reviewedAt": null,
    "reviewedById": null,
    "createdAt": "2026-10-01T15:00:00.000Z",
    "updatedAt": "2026-10-01T15:00:00.000Z",
    "reviewedBy": null
  }
}
~~~

### Errores

- 400: Falta enlace o URL inválida (máximo 500 caracteres)
- 401: JWT ausente, vencido, revocado o cuenta inactiva
- 403: Rol/propiedad/membresía no autorizados
- 404: Entregable inexistente
- 409: Estado distinto de DRAFT/OBSERVED
- 429: Límite de solicitudes excedido
- 500: Error interno genérico
- 503: Política/destinatarios de notificación de envío no configurados

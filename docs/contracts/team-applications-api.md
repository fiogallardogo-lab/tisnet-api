# Contrato API de gestión de postulaciones

## Objetivo

Este contrato define el flujo administrativo que permite al `SUPER_ADMIN` revisar las postulaciones enviadas desde `POST /api/v1/public/team-applications`, asignar un administrador para la entrevista o comunicar un rechazo motivado.

La postulación no crea una cuenta, no asigna permisos y no convierte automáticamente al candidato en integrante de TISNET.

## Seguridad y envoltorio

Todas las rutas requieren un JWT válido. La bandeja general, el detalle administrativo, la asignación y el rechazo directo son exclusivos de `SUPER_ADMIN`. Las rutas bajo `/my-interviews` son exclusivas de `ADMIN` y siempre filtran por el perfil administrativo del usuario autenticado.

Un `ADMIN` no puede consultar el detalle, CV, fotografía ni registrar la decisión de una entrevista asignada a otro administrador. Para no revelar la existencia de una postulación ajena, ese acceso responde HTTP `404`.

Las respuestas JSON utilizan el envoltorio global:

```json
{
  "success": true,
  "message": "Operación realizada correctamente",
  "data": {}
}
```

El CV y la fotografía son recursos privados. Nunca se incluyen como Base64 en el listado ni se publican mediante rutas anónimas.

## Estados y transiciones

| Estado               | Descripción                       | Acciones admitidas                        |
| -------------------- | --------------------------------- | ----------------------------------------- |
| `PENDING_REVIEW`     | Postulación pendiente de decisión | Asignar entrevista o rechazar             |
| `INTERVIEW_ASSIGNED` | Un administrador fue asignado     | Aceptar o rechazar después de entrevistar |
| `ACCEPTED`           | Entrevista aprobada               | Ninguna                                   |
| `REJECTED`           | Postulación rechazada con motivo  | Ninguna                                   |

Solo `PENDING_REVIEW` puede cambiar de estado. Una repetición o transición incompatible responde HTTP `409`.

## GET /api/v1/team-applications

Lista postulaciones sin exponer los archivos binarios ni el motivo de rechazo.

### Query params

| Campo    | Tipo    | Regla                                               |
| -------- | ------- | --------------------------------------------------- |
| `page`   | integer | Opcional, mínimo 1, por defecto 1                   |
| `limit`  | integer | Opcional, 1 a 100, por defecto 10                   |
| `status` | string  | `PENDING_REVIEW`, `INTERVIEW_ASSIGNED` o `REJECTED` |
| `role`   | string  | `DEVELOPER` o `PRODUCT_OWNER`                       |
| `search` | string  | Código, correo, DNI o nombre; máximo 100 caracteres |

### Respuesta data

```json
{
  "items": [
    {
      "id": 1,
      "code": "TEAM-12345678",
      "fullName": "Andrea Mendoza",
      "email": "andrea@example.com",
      "requestedRole": "DEVELOPER",
      "specialty": "FULL_STACK",
      "status": "PENDING_REVIEW",
      "createdAt": "2026-09-23T15:00:00.000Z",
      "updatedAt": "2026-09-23T15:00:00.000Z",
      "assignedAdmin": null
    }
  ],
  "meta": {
    "page": 1,
    "limit": 10,
    "totalItems": 1,
    "totalPages": 1
  }
}
```

## GET /api/v1/team-applications/interviewers

Lista únicamente usuarios activos con rol `ADMIN` y perfil administrativo.

```json
[
  {
    "adminProfileId": 4,
    "userId": 8,
    "name": "Administrador TISNET",
    "email": "admin@tisnet.com",
    "executiveTitle": "Asesor técnico",
    "specialty": "Soluciones web",
    "calendlyUrl": "https://calendly.com/tisnet/entrevista"
  }
]
```

## GET /api/v1/team-applications/:id

Devuelve el perfil completo sin incluir bytes de archivos.

```json
{
  "id": 1,
  "code": "TEAM-12345678",
  "email": "andrea@example.com",
  "dni": "12345678",
  "requestedRole": "DEVELOPER",
  "status": "PENDING_REVIEW",
  "profile": {
    "fullName": "Andrea Mendoza",
    "age": 24,
    "district": "Miraflores",
    "phone": "999999999",
    "career": "Ingeniería de Sistemas",
    "university": "Universidad de ejemplo",
    "experienceYears": 2,
    "programmingLanguages": "TypeScript, React, Node.js",
    "specialty": "FULL_STACK"
  },
  "files": {
    "cvName": "cv-andrea.pdf",
    "cvUrl": "/api/v1/team-applications/1/cv",
    "photoUrl": "/api/v1/team-applications/1/photo"
  },
  "assignedAdmin": null,
  "reviewedBy": null,
  "interviewAssignedAt": null,
  "rejectionReason": null,
  "rejectedAt": null,
  "createdAt": "2026-09-23T15:00:00.000Z",
  "updatedAt": "2026-09-23T15:00:00.000Z"
}
```

Un identificador inexistente responde HTTP `404`.

## GET /api/v1/team-applications/:id/photo

Devuelve la fotografía con su `Content-Type` original (`image/jpeg`, `image/png` o `image/webp`) y `Cache-Control: private, no-store`.

## GET /api/v1/team-applications/:id/cv

Devuelve el PDF como archivo adjunto con nombre seguro y `Cache-Control: private, no-store`.

## PATCH /api/v1/team-applications/:id/assign-interview

```json
{
  "adminProfileId": 4
}
```

### Reglas

- La postulación debe estar en `PENDING_REVIEW`.
- El perfil indicado debe pertenecer a un usuario activo con rol `ADMIN`.
- La operación guarda `reviewedByUserId` e `interviewAssignedAt` con valores del servidor.
- La notificación utiliza el correo del postulante y agrega el enlace de Calendly si el administrador lo tiene configurado.
- La decisión persiste aunque falle el proveedor de notificación; la respuesta informa `notificationStatus: "FAILED"` sin devolver secretos técnicos.

Respuestas: `200`, `400`, `404` o `409` según la validación y el estado de la postulación. Si la decisión se guarda pero el correo no puede enviarse, la operación conserva HTTP `200` y devuelve `notificationStatus: "FAILED"`.

## PATCH /api/v1/team-applications/:id/reject

```json
{
  "reason": "Actualmente buscamos un perfil con mayor experiencia en proyectos productivos."
}
```

### Reglas

- La postulación debe estar en `PENDING_REVIEW`.
- El motivo se recorta y debe tener entre 20 y 1000 caracteres.
- Se guarda el motivo, `reviewedByUserId` y `rejectedAt`.
- El motivo se envía al correo del postulante, pero no aparece en el listado general.
- La decisión persiste aunque falle la notificación.

## Rutas del administrador entrevistador

Estas rutas requieren el rol `ADMIN`:

| Método  | Ruta                                                   | Uso                                                                      |
| ------- | ------------------------------------------------------ | ------------------------------------------------------------------------ |
| `GET`   | `/api/v1/team-applications/my-interviews`              | Lista únicamente las entrevistas asignadas al administrador autenticado. |
| `GET`   | `/api/v1/team-applications/my-interviews/:id`          | Consulta una entrevista propia.                                          |
| `GET`   | `/api/v1/team-applications/my-interviews/:id/photo`    | Consulta la fotografía privada de una entrevista propia.                 |
| `GET`   | `/api/v1/team-applications/my-interviews/:id/cv`       | Descarga el CV privado de una entrevista propia.                         |
| `PATCH` | `/api/v1/team-applications/my-interviews/:id/decision` | Registra la decisión final.                                              |

El cuerpo de la decisión es:

```json
{
  "decision": "REJECTED",
  "reason": "El perfil todavía no acredita la experiencia mínima requerida."
}
```

`reason` es obligatorio para `REJECTED`, se recorta y debe contener entre 20 y 1000 caracteres. Para `ACCEPTED` puede omitirse. La decisión se persiste aunque falle el proveedor de correo y la respuesta devuelve `notificationStatus: "FAILED"` sin exponer el error del proveedor.

## Códigos de error

| HTTP  | Uso                                                             |
| ----- | --------------------------------------------------------------- |
| `400` | DTO, filtro, ID o motivo inválido                               |
| `401` | JWT ausente o inválido                                          |
| `403` | El actor no posee el rol exigido por la ruta                    |
| `404` | Postulación, administrador o entrevista propia no encontrados   |
| `409` | Estado incompatible, decisión repetida o administrador inactivo |

## Fuera del alcance

- Crear automáticamente un usuario.
- Convertir el consentimiento de postulación en aceptación de términos de una cuenta.
- Reprogramar o cancelar entrevistas.
- Mostrar postulaciones al público.

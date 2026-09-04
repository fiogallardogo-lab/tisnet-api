# Contrato API del módulo Project

## Propósito

Este documento fija el contrato que utilizarán el backend, el panel administrativo y el portafolio público durante el Sprint 2. Los responsables frontend pueden desarrollar con mocks basados en estas estructuras mientras se implementan los endpoints reales.

El contrato no incluye Workspace, integrantes, actualizaciones internas ni carga binaria de imágenes.

## Convenciones generales

- Base URL local: `http://localhost:3000/api/v1`.
- Los endpoints privados requieren `Authorization: Bearer <accessToken>`.
- Roles autorizados en administración: `ADMIN` y `SUPER_ADMIN`.
- Las fechas se devuelven como texto ISO 8601.
- Los identificadores son números enteros positivos.
- Las imágenes se representan mediante URL. No se acepta Base64.
- `isPublished` no se modifica desde el DTO general; se utilizan endpoints dedicados.
- No existe eliminación física de proyectos en este Sprint. El archivado es lógico.

## Envoltura de respuestas

Respuesta exitosa:

```json
{
  "success": true,
  "message": "Operación realizada correctamente",
  "data": {}
}
```

Respuesta de error:

```json
{
  "success": false,
  "message": "Descripción segura del error",
  "error": "BadRequestException"
}
```

En errores de validación, `message` puede ser una lista de textos.

## Estados internos

`ProjectStatus` admite exclusivamente:

```text
DRAFT
IN_DEVELOPMENT
IN_REVIEW
COMPLETED
ARCHIVED
```

- Todo proyecto nuevo utiliza `DRAFT` si el request no indica otro estado.
- `status` e `isPublished` son independientes.
- Archivar establece `status = ARCHIVED` e `isPublished = false`.
- Un proyecto archivado no puede publicarse hasta que vuelva a un estado permitido mediante edición.

## Recurso administrativo Project

```json
{
  "id": 1,
  "name": "Sistema de inventario",
  "slug": "sistema-de-inventario",
  "shortDescription": "Control centralizado de productos y existencias.",
  "description": "Descripción pública completa del proyecto.",
  "problem": "Información distribuida en archivos separados.",
  "solution": "Aplicación web con trazabilidad de movimientos.",
  "objective": "Reducir errores en el control de existencias.",
  "features": [
    "Control de productos",
    "Registro de movimientos"
  ],
  "category": {
    "id": 1,
    "name": "Logística"
  },
  "technologies": [
    {
      "id": 1,
      "name": "React",
      "icon": "https://cdn.example.com/react.svg"
    }
  ],
  "status": "DRAFT",
  "developmentDate": "2026-09-04",
  "clientName": null,
  "demoUrl": "https://demo.example.com",
  "externalUrl": null,
  "coverImageUrl": "https://cdn.example.com/project-cover.webp",
  "isFeatured": false,
  "isPublished": false,
  "displayOrder": 0,
  "createdAt": "2026-09-04T17:00:00.000Z",
  "updatedAt": "2026-09-04T17:00:00.000Z"
}
```

## Crear proyecto

### Endpoint

```http
POST /api/v1/projects
```

### Autorización

`ADMIN`, `SUPER_ADMIN`

### Request

```json
{
  "name": "Sistema de inventario",
  "slug": "sistema-de-inventario",
  "shortDescription": "Control centralizado de productos y existencias.",
  "description": "Descripción pública completa del proyecto.",
  "problem": "Información distribuida en archivos separados.",
  "solution": "Aplicación web con trazabilidad de movimientos.",
  "objective": "Reducir errores en el control de existencias.",
  "features": [
    "Control de productos",
    "Registro de movimientos"
  ],
  "categoryId": 1,
  "technologyIds": [1, 2],
  "status": "DRAFT",
  "developmentDate": "2026-09-04",
  "clientName": null,
  "demoUrl": "https://demo.example.com",
  "externalUrl": null,
  "coverImageUrl": "https://cdn.example.com/project-cover.webp",
  "isFeatured": false,
  "displayOrder": 0
}
```

### Campos obligatorios

- `name`: texto entre 3 y 150 caracteres.
- `slug`: texto único entre 3 y 180 caracteres; minúsculas, números y guiones.
- `shortDescription`: texto entre 10 y 300 caracteres.
- `description`: texto de al menos 20 caracteres.
- `categoryId`: categoría existente y activa.

### Campos opcionales y valores por defecto

- `technologyIds`: lista sin duplicados; por defecto `[]`.
- `status`: por defecto `DRAFT`.
- `features`: por defecto `[]`.
- `isFeatured`: por defecto `false`.
- `displayOrder`: entero mayor o igual a cero; por defecto `0`.
- `problem`, `solution`, `objective`, `developmentDate`, `clientName`, `demoUrl`, `externalUrl` y `coverImageUrl`: por defecto `null`.
- `isPublished`: siempre se crea como `false` y no se recibe en este request.

### Respuesta

- Estado: `201 Created`.
- `data`: recurso administrativo Project.

### Errores

- `400 Bad Request`: DTO inválido, categoría inactiva o tecnología inexistente/inactiva.
- `401 Unauthorized`: token ausente o inválido.
- `403 Forbidden`: rol no autorizado.
- `409 Conflict`: `slug` duplicado.

## Listar proyectos administrativos

### Endpoint

```http
GET /api/v1/projects?page=1&limit=10&search=&status=&categoryId=&isPublished=
```

### Autorización

`ADMIN`, `SUPER_ADMIN`

### Query params

| Parámetro | Tipo | Regla |
|---|---|---|
| `page` | number | Entero desde 1; por defecto 1 |
| `limit` | number | Entre 1 y 100; por defecto 10 |
| `search` | string | Busca por `name`, `slug` o `shortDescription` |
| `status` | ProjectStatus | Filtro opcional |
| `categoryId` | number | Filtro opcional |
| `isPublished` | boolean | Filtro opcional |

### Respuesta

```json
{
  "success": true,
  "message": "Operación realizada correctamente",
  "data": {
    "items": [],
    "meta": {
      "page": 1,
      "limit": 10,
      "totalItems": 0,
      "totalPages": 0
    }
  }
}
```

- Estado: `200 OK`.
- Orden predeterminado: `displayOrder ASC`, luego `createdAt DESC`.

## Consultar proyecto administrativo

### Endpoint

```http
GET /api/v1/projects/:id
```

### Autorización

`ADMIN`, `SUPER_ADMIN`

### Respuesta

- Estado: `200 OK`.
- `data`: recurso administrativo Project.

### Errores

- `400 Bad Request`: identificador no numérico.
- `401 Unauthorized`: token ausente o inválido.
- `403 Forbidden`: rol no autorizado.
- `404 Not Found`: proyecto inexistente.

## Editar proyecto

### Endpoint

```http
PATCH /api/v1/projects/:id
```

### Autorización

`ADMIN`, `SUPER_ADMIN`

### Request

Acepta cualquier subconjunto de los campos de creación, excepto `isPublished`. Una lista `technologyIds` reemplaza el conjunto completo de relaciones existentes.

```json
{
  "name": "Nuevo nombre",
  "categoryId": 2,
  "technologyIds": [2, 3],
  "status": "IN_DEVELOPMENT"
}
```

### Respuesta

- Estado: `200 OK`.
- `data`: recurso administrativo Project actualizado.

### Errores

- `400 Bad Request`: DTO o relaciones inválidas.
- `401 Unauthorized`: token ausente o inválido.
- `403 Forbidden`: rol no autorizado.
- `404 Not Found`: proyecto inexistente.
- `409 Conflict`: el nuevo `slug` ya está registrado.

## Publicar proyecto

### Endpoint

```http
PATCH /api/v1/projects/:id/publish
```

### Autorización

`ADMIN`, `SUPER_ADMIN`

### Request

Sin body.

### Reglas

- El proyecto debe existir.
- No puede estar archivado.
- Debe contener `name`, `slug`, `shortDescription`, `description` y una categoría activa.
- Publicar establece `isPublished = true` sin borrar ni alterar su estado interno.
- Repetir la operación sobre un proyecto publicado es idempotente y devuelve el recurso actual.

### Respuesta

- Estado: `200 OK`.
- `data`: recurso administrativo Project con `isPublished = true`.

### Errores

- `400 Bad Request`: información mínima incompleta, categoría inactiva o proyecto archivado.
- `401 Unauthorized`: token ausente o inválido.
- `403 Forbidden`: rol no autorizado.
- `404 Not Found`: proyecto inexistente.

## Despublicar proyecto

### Endpoint

```http
PATCH /api/v1/projects/:id/unpublish
```

### Autorización

`ADMIN`, `SUPER_ADMIN`

### Request

Sin body.

### Reglas

- Establece `isPublished = false`.
- Conserva toda la información y el estado interno.
- Repetir la operación sobre un proyecto no publicado es idempotente.

### Respuesta

- Estado: `200 OK`.
- `data`: recurso administrativo Project con `isPublished = false`.

## Archivar proyecto

### Endpoint

```http
PATCH /api/v1/projects/:id/archive
```

### Autorización

`ADMIN`, `SUPER_ADMIN`

### Request

Sin body.

### Reglas

- Establece `status = ARCHIVED`.
- Establece `isPublished = false`.
- No elimina físicamente el registro ni sus relaciones.

### Respuesta

- Estado: `200 OK`.
- `data`: recurso administrativo Project archivado.

## Listar portafolio público

### Endpoint

```http
GET /api/v1/public/projects?page=1&limit=12&search=&categoryId=&technologyId=&isFeatured=
```

### Autorización

Público, sin token.

### Reglas

- El backend filtra siempre `isPublished = true`.
- Nunca se devuelven proyectos archivados.
- El frontend no debe aplicar el control de seguridad por sí solo.

### Query params

| Parámetro | Tipo | Regla |
|---|---|---|
| `page` | number | Entero desde 1; por defecto 1 |
| `limit` | number | Entre 1 y 50; por defecto 12 |
| `search` | string | Busca por nombre o descripción breve |
| `categoryId` | number | Filtro opcional |
| `technologyId` | number | Filtro opcional |
| `isFeatured` | boolean | Filtro opcional |

### Item público

```json
{
  "id": 1,
  "name": "Sistema de inventario",
  "slug": "sistema-de-inventario",
  "shortDescription": "Control centralizado de productos y existencias.",
  "coverImageUrl": "https://cdn.example.com/project-cover.webp",
  "category": {
    "id": 1,
    "name": "Logística"
  },
  "technologies": [
    {
      "id": 1,
      "name": "React",
      "icon": "https://cdn.example.com/react.svg"
    }
  ],
  "isFeatured": false,
  "displayOrder": 0
}
```

### Respuesta

- Estado: `200 OK`.
- `data.items`: lista de items públicos.
- `data.meta`: misma estructura de paginación del listado administrativo.

## Consultar detalle público

### Endpoint

```http
GET /api/v1/public/projects/:slug
```

### Autorización

Público, sin token.

### Respuesta pública

```json
{
  "success": true,
  "message": "Operación realizada correctamente",
  "data": {
    "id": 1,
    "name": "Sistema de inventario",
    "slug": "sistema-de-inventario",
    "shortDescription": "Control centralizado de productos y existencias.",
    "description": "Descripción pública completa del proyecto.",
    "problem": "Información distribuida en archivos separados.",
    "solution": "Aplicación web con trazabilidad de movimientos.",
    "objective": "Reducir errores en el control de existencias.",
    "features": ["Control de productos"],
    "category": {
      "id": 1,
      "name": "Logística"
    },
    "technologies": [
      {
        "id": 1,
        "name": "React",
        "icon": "https://cdn.example.com/react.svg"
      }
    ],
    "developmentDate": "2026-09-04",
    "demoUrl": "https://demo.example.com",
    "externalUrl": null,
    "coverImageUrl": "https://cdn.example.com/project-cover.webp",
    "isFeatured": false
  }
}
```

No se devuelven `status`, `isPublished`, `clientName`, campos de auditoría ni datos internos.

### Errores

- `404 Not Found`: slug inexistente, proyecto no publicado o proyecto archivado. La respuesta no revela cuál de esas condiciones ocurrió.

## Matriz de estados HTTP

| Estado | Uso |
|---|---|
| `200 OK` | Consultas y modificaciones exitosas |
| `201 Created` | Proyecto creado |
| `400 Bad Request` | Validación, relación o regla de publicación inválida |
| `401 Unauthorized` | Falta token o es inválido |
| `403 Forbidden` | El usuario autenticado no tiene el rol requerido |
| `404 Not Found` | Proyecto o recurso relacionado inexistente |
| `409 Conflict` | Slug duplicado |
| `500 Internal Server Error` | Error no controlado; no debe exponer detalles internos |

## Entregable para el frontend administrativo

Responsable de `src/features/projects/**`:

1. Crear `types/project.types.ts` con `Project`, `ProjectStatus`, `CreateProjectInput`, `UpdateProjectInput` y tipos paginados.
2. Crear `services/projects.service.ts` con funciones para listar, consultar, crear, editar, publicar, despublicar y archivar.
3. Crear mocks internos que respeten exactamente este contrato mientras el API no esté listo.
4. Implementar listado con paginación, búsqueda y filtros.
5. Implementar formulario con categoría y tecnologías.
6. No enviar `isPublished` desde el formulario general.
7. Manejar mensajes cuando `message` sea texto o lista.
8. No editar `src/routes/index.tsx`, `src/lib/axios.ts` ni estilos globales.

## Entregable para el frontend público

Responsable del portafolio público:

1. Crear tipos públicos separados; no reutilizar el modelo administrativo completo.
2. Crear un servicio para `GET /public/projects` y `GET /public/projects/:slug`.
3. Crear mocks internos que incluyan solamente los campos públicos.
4. Implementar tarjetas, paginación, búsqueda y filtros por categoría o tecnología.
5. Implementar detalle por slug y estado de no encontrado.
6. No mostrar proyectos archivados o no publicados aunque un mock contenga esos datos.
7. Ser la única persona que agrega `/portfolio/:slug` en `src/routes/index.tsx`.
8. Documentar la prueba final en `docs/sprint-2-test-evidence.md`.

## Condición para cambiar el contrato

Después de que frontend confirme este documento, cualquier cambio de nombre, tipo, endpoint o respuesta requiere:

1. Acuerdo de los tres integrantes.
2. Actualización de este archivo en un commit separado.
3. Aviso explícito a ambos responsables frontend antes de implementar el cambio.

# Contrato API del módulo Projects — Ciclo de Vida y Portafolio

**Versión del contrato:** Sprint 3 — Fase 1 (Definitivo)  
**Fecha de actualización:** 8 de septiembre de 2026  
**Ámbito:** Backend (`tisnet-api`), Panel Administrativo (`tisnet-web/admin`) y Portafolio Público (`tisnet-web/public`)  
**Estado:** Auditado y aprobado para integración  

---

## 1. URL Base y Entorno de la API

- **Base URL local:** `http://localhost:3000/api/v1`
- **Documentación Swagger / OpenAPI:** `http://localhost:3000/api/docs`
- **Prefijo global:** `/api/v1`
- **Protocolo de comunicación:** REST / JSON (encabezado `Content-Type: application/json` requerido en mutaciones con payload).

---

## 2. Envoltorio Estándar de Respuestas (Response Wrapper)

Todas las respuestas de la API son estandarizadas mediante interceptores (`TransformInterceptor`) y filtros de excepciones (`HttpExceptionFilter`) globales.

### 2.1 Respuesta Exitosa Estándar (200 OK / 201 Created)

```json
{
  "success": true,
  "message": "Operación realizada correctamente",
  "data": {}
}
```

*Nota:* `data` puede ser un objeto único, un arreglo o un objeto paginado (`{ items: [], meta: {} }`).

### 2.2 Respuesta de Error Estándar (400, 401, 403, 404, 409, 500)

```json
{
  "success": false,
  "message": "Descripción legible del error o lista de fallos de validación",
  "error": "NombreDeLaExcepcion"
}
```

*Nota:* En errores de validación de DTO (`400 Bad Request`), el campo `message` contiene un arreglo de strings detallando cada infracción de validación.

---

## 3. Matriz de Estados y Ciclo de Vida de Proyectos

El ciclo de vida de un proyecto se gestiona combinando el estado interno (`status: ProjectStatus`) y la bandera de visibilidad pública (`isPublished: boolean`).

### 3.1 Estados Internos (`ProjectStatus` Enum)

| Estado | Significado | ¿Editable? | ¿Publicable? |
|---|---|:---:|:---:|
| `DRAFT` | Borrador inicial en confección | Sí | Sí (si cumple campos mínimos) |
| `IN_DEVELOPMENT` | Proyecto en fase de desarrollo activo | Sí | Sí (si cumple campos mínimos) |
| `IN_REVIEW` | Proyecto en revisión interna o control de calidad | Sí | Sí (si cumple campos mínimos) |
| `COMPLETED` | Proyecto finalizado y aprobado | Sí | Sí (si cumple campos mínimos) |
| `ARCHIVED` | Proyecto archivado lógicamente (retirado del catálogo) | Sí | **No** (debe cambiarse de estado antes) |

### 3.2 Diagrama de Transición de Estados y Publicación

```
 [ Crear Proyecto ]
         │
         ▼
     [ DRAFT ] ◄────────────┬────────────────────────────┐
         │                  │                            │
         ▼                  ▼                            │
  [ IN_DEVELOPMENT ] ──► [ IN_REVIEW ] ──► [ COMPLETED ] │ (Desarchivar vía PATCH /projects/:id)
         │                  │                     │      │
         └─────────┬────────┴─────────────────────┘      │
                   │                                     │
                   ▼ (PATCH /projects/:id/publish)       │
           ┌──────────────┐                              │
           │ isPublished: │                              │
           │    true      │                              │
           └──────┬───────┘                              │
                  │                                      │
                  ├────────► PATCH /projects/:id/unpublish ──► isPublished: false
                  │
                  ▼ (PATCH /projects/:id/archive)
           ┌──────────────┐
           │   ARCHIVED   │ ─────────────────────────────┘
           │ isPublished: │
           │    false     │
           └──────────────┘
```

### 3.3 Reglas de Negocio del Ciclo de Vida

1. **Requisitos Mínimos para Publicar:**
   - Para ejecutar `PATCH /api/v1/projects/:id/publish`, el proyecto debe contar obligatoriamente con:
     - `name` (no vacío)
     - `slug` (no vacío y formato válido)
     - `shortDescription` (no vacío)
     - `description` (no vacío)
     - `categoryId` correspondiente a una categoría existente y con `isActive: true`.
   - Si falta alguno de estos requisitos o la categoría está inactiva, la API responde `400 Bad Request`.
2. **Restricción de Proyectos Archivados:**
   - Un proyecto en estado `ARCHIVED` **no puede publicarse**. El endpoint `/publish` retornará `400 Bad Request` indicando: *"Un proyecto archivado no puede publicarse"*.
   - Para publicar un proyecto previamente archivado, primero debe actualizarse su `status` a `DRAFT`, `IN_DEVELOPMENT`, `IN_REVIEW` o `COMPLETED` mediante `PATCH /api/v1/projects/:id`.
3. **Comportamiento del Archivado:**
   - Archivar un proyecto mediante `PATCH /api/v1/projects/:id/archive` es una operación de **archivado lógico**. No se eliminan registros ni relaciones en la base de datos.
   - La acción establece automáticamente `status = 'ARCHIVED'` e `isPublished = false`.
4. **Visibilidad Pública Estricta (Portal Público):**
   - Los endpoints públicos (`/api/v1/public/projects` y `/api/v1/public/projects/:slug`) aplican siempre en base de datos la condición:
     `where: { isPublished: true, status: { not: 'ARCHIVED' } }`
   - Los proyectos con `isPublished: false` o `status: 'ARCHIVED'` son inaccesibles públicamente y responden `404 Not Found`.
5. **Idempotencia:**
   - Publicar un proyecto ya publicado devuelve `200 OK` con el recurso sin cambios.
   - Despublicar un proyecto ya despublicado devuelve `200 OK` con el recurso sin cambios.
6. **Protección de `isPublished` en Formularios Generales:**
   - Ni `POST /api/v1/projects` ni `PATCH /api/v1/projects/:id` admiten `isPublished` en su DTO. Cualquier intento de enviarlo es ignorado por el whitelist de validación. La publicación solo se efectúa a través de sus endpoints dedicados.

---

## 4. Diferencias de Nombres (Backend vs Frontend) y Recomendación de Mapeo

Para evitar discrepancias entre los modelos TypeScript del Frontend y los DTOs/Esquema del Backend, se establece la siguiente tabla de equivalencias oficial:

| Concepto / Intención | Nombre en Backend (`tisnet-api`) | Alias Común en Frontend | Tipo / Formato | Regla / Observación |
|---|---|---|---|---|
| Título / Nombre | `name` | `title` | `string` (3–150 car.) | **Obligatorio.** El backend utiliza `name`. |
| Identificador URL | `slug` | `slug` | `string` (3–180 car.) | **Obligatorio.** Minúsculas, números y guiones (`^[a-z0-9]+(?:-[a-z0-9]+)*$`). Único. |
| Resumen / Bajada | `shortDescription` | `summary` | `string` (10–300 car.) | **Obligatorio.** El backend utiliza `shortDescription`. |
| Descripción Completa | `description` | `description` / `content` | `string` (min. 20 car.) | **Obligatorio.** Texto detallado o Markdown. |
| Categoría (Envío) | `categoryId` | `category_id` | `number` (entero $\ge 1$) | **Obligatorio.** Debe pertenecer a una categoría activa. |
| Tecnologías (Envío) | `technologyIds` | `technologies` | `number[]` (enteros $\ge 1$) | **Opcional.** Arreglo de IDs activos. En PATCH, reemplaza la lista completa. |
| Imagen Principal | `coverImageUrl` | `imageUrl` / `image` | `string` (URL, max 500) | **Opcional.** URL externa/CDN. El backend utiliza `coverImageUrl`. |
| URL de Demostración | `demoUrl` | `demoUrl` / `liveUrl` | `string` (URL, max 500) | **Opcional.** Enlace al sistema en producción o demo. |
| Repositorio / Enlace Externo | `externalUrl` | `githubUrl` / `repoUrl` | `string` (URL, max 500) | **Opcional.** Almacena URLs de GitHub, GitLab o páginas externas. |
| Estado Interno | `status` | `status` | `ProjectStatus` enum | **Opcional en creación** (por defecto `DRAFT`). |
| Publicado | `isPublished` | `published` | `boolean` | **Controlado por endpoints dedicados.** No editable vía DTO general. |
| Archivado | `status === 'ARCHIVED'` | `isArchived` / `archived` | `ProjectStatus` | **No existe columna booleana `isArchived`.** Se gestiona mediante `status: 'ARCHIVED'`. |
| Destacado | `isFeatured` | `featured` | `boolean` | **Opcional** (por defecto `false`). El backend utiliza `isFeatured`. |
| Orden de Presentación | `displayOrder` | `order` | `number` (entero $\ge 0$) | **Opcional** (por defecto `0`). Utilizado para ordenamiento preferente. |
| Problema Abordado | `problem` | `problem` | `string` (nullable) | **Opcional.** Contexto del problema resuelto. |
| Solución Implementada | `solution` | `solution` | `string` (nullable) | **Opcional.** Enfoque técnico y funcional adoptado. |
| Objetivo del Proyecto | `objective` | `objective` | `string` (nullable) | **Opcional.** Metas alcanzadas. |
| Lista de Características | `features` | `features` | `string[]` | **Opcional** (por defecto `[]`). Arreglo de bullets. |
| Fecha de Desarrollo | `developmentDate` | `date` | `string` (ISO `YYYY-MM-DD`) | **Opcional.** Fecha aproximada de ejecución. |
| Nombre del Cliente | `clientName` | `client` | `string` (max 150) | **Opcional.** Campo de uso exclusivamente interno (no expuesto en API pública). |

---

## 5. Reglas para Catálogos Relacionados (Categorías y Tecnologías)

1. **Categoría (`categoryId`):**
   - Debe existir en la tabla `Category`.
   - Debe tener `isActive: true`.
   - Si no existe o está inactiva (`isActive: false`), la API rechaza la solicitud con `400 Bad Request`: `"La categoría no existe o está inactiva"`.
2. **Tecnologías (`technologyIds`):**
   - Cada uno de los IDs proporcionados en el arreglo debe existir en la tabla `Technology`.
   - Todas las tecnologías indicadas deben tener `isActive: true`.
   - Si una o más tecnologías no existen o están inactivas, la API rechaza la solicitud con `400 Bad Request`: `"Una o más tecnologías no existen o están inactivas"`.
   - No se permiten identificadores duplicados dentro del arreglo (`@ArrayUnique()`).

---

## 6. Endpoints Administrativos (Panel Privado)

Todos los endpoints administrativos requieren autenticación JWT mediante encabezado `Authorization: Bearer <accessToken>` y roles autorizados: `ADMIN` o `SUPER_ADMIN`.

> **Nota sobre el Rol DEVELOPER:**  
> Actualmente el rol `DEVELOPER` recibe `403 Forbidden` en todos los endpoints administrativos de Projects. La autorización granular por proyecto se incorporará en el módulo Workspace en sprints futuros una vez modelada la asignación de miembros.

---

### 6.1 `POST /api/v1/projects` — Crear Proyecto

Crea un nuevo proyecto en estado borrador o en el estado indicado. `isPublished` se inicializa siempre en `false`.

- **Método HTTP:** `POST`
- **Autenticación:** Requerida (`ADMIN`, `SUPER_ADMIN`)
- **Códigos de respuesta:** `201 Created`, `400 Bad Request`, `401 Unauthorized`, `403 Forbidden`, `409 Conflict`

#### Request Payload (JSON)

```json
{
  "name": "Sistema de Inventario TISNET",
  "slug": "sistema-de-inventario-tisnet",
  "shortDescription": "Plataforma centralizada para la gestión de almacenes y trazabilidad de existencias en tiempo real.",
  "description": "Solución integral desarrollada con arquitectura limpia, control de stock automatizado y reportes avanzados.",
  "problem": "Descontrol en inventarios físicos y dispersión de datos en planillas manuales.",
  "solution": "Aplicación web modular con base de datos transaccional y control de accesos por roles.",
  "objective": "Optimizar el tiempo de registro y reducir discrepancias de stock a menos del 1%.",
  "features": [
    "Control de stock multialmacén",
    "Alertas de reposición automática",
    "Exportación de reportes a PDF y Excel"
  ],
  "categoryId": 1,
  "technologyIds": [1, 2],
  "status": "DRAFT",
  "developmentDate": "2026-09-08",
  "clientName": "Logística Global S.A.",
  "demoUrl": "https://demo.inventario.tisnet.test",
  "externalUrl": "https://github.com/tisnet-lab/inventario",
  "coverImageUrl": "https://cdn.tisnet.test/projects/inventario-cover.webp",
  "isFeatured": true,
  "displayOrder": 1
}
```

#### Response (201 Created)

```json
{
  "success": true,
  "message": "Operación realizada correctamente",
  "data": {
    "id": 10,
    "name": "Sistema de Inventario TISNET",
    "slug": "sistema-de-inventario-tisnet",
    "shortDescription": "Plataforma centralizada para la gestión de almacenes y trazabilidad de existencias en tiempo real.",
    "description": "Solución integral desarrollada con arquitectura limpia, control de stock automatizado y reportes avanzados.",
    "problem": "Descontrol en inventarios físicos y dispersión de datos en planillas manuales.",
    "solution": "Aplicación web modular con base de datos transaccional y control de accesos por roles.",
    "objective": "Optimizar el tiempo de registro y reducir discrepancias de stock a menos del 1%.",
    "features": [
      "Control de stock multialmacén",
      "Alertas de reposición automática",
      "Exportación de reportes a PDF y Excel"
    ],
    "category": {
      "id": 1,
      "name": "Logística"
    },
    "technologies": [
      {
        "id": 1,
        "name": "React",
        "icon": "https://cdn.tisnet.test/tech/react.svg"
      },
      {
        "id": 2,
        "name": "NestJS",
        "icon": "https://cdn.tisnet.test/tech/nestjs.svg"
      }
    ],
    "status": "DRAFT",
    "developmentDate": "2026-09-08",
    "clientName": "Logística Global S.A.",
    "demoUrl": "https://demo.inventario.tisnet.test",
    "externalUrl": "https://github.com/tisnet-lab/inventario",
    "coverImageUrl": "https://cdn.tisnet.test/projects/inventario-cover.webp",
    "isFeatured": true,
    "isPublished": false,
    "displayOrder": 1,
    "createdAt": "2026-09-08T14:30:00.000Z",
    "updatedAt": "2026-09-08T14:30:00.000Z"
  }
}
```

---

### 6.2 `GET /api/v1/projects` — Listar Proyectos Administrativos

Permite consultar, paginar, buscar y filtrar el catálogo completo de proyectos (incluyendo borradores y archivados).

- **Método HTTP:** `GET`
- **Autenticación:** Requerida (`ADMIN`, `SUPER_ADMIN`)
- **Ordenamiento predeterminado:** `displayOrder ASC`, `createdAt DESC`
- **Códigos de respuesta:** `200 OK`, `401 Unauthorized`, `403 Forbidden`

#### Query Parameters

| Parámetro | Tipo | Requerido | Por Defecto | Descripción |
|---|---|:---:|:---:|---|
| `page` | `number` | No | `1` | Número de página (mínimo 1). |
| `limit` | `number` | No | `10` | Cantidad de elementos por página (mínimo 1, máximo 100). |
| `search` | `string` | No | — | Búsqueda por coincidencia parcial en `name`, `slug` o `shortDescription`. |
| `status` | `string` | No | — | Filtro exacto por `ProjectStatus` (`DRAFT`, `IN_DEVELOPMENT`, `IN_REVIEW`, `COMPLETED`, `ARCHIVED`). |
| `categoryId` | `number` | No | — | Filtro por ID de categoría. |
| `isPublished`| `boolean`| No | — | Filtro por estado de publicación (`true` o `false`). |

#### Response (200 OK)

```json
{
  "success": true,
  "message": "Operación realizada correctamente",
  "data": {
    "items": [
      {
        "id": 10,
        "name": "Sistema de Inventario TISNET",
        "slug": "sistema-de-inventario-tisnet",
        "shortDescription": "Plataforma centralizada para la gestión de almacenes.",
        "description": "Solución integral desarrollada con arquitectura limpia.",
        "problem": "Descontrol en inventarios físicos.",
        "solution": "Aplicación web modular.",
        "objective": "Optimizar el tiempo de registro.",
        "features": ["Control de stock multialmacén"],
        "category": {
          "id": 1,
          "name": "Logística"
        },
        "technologies": [
          {
            "id": 1,
            "name": "React",
            "icon": "https://cdn.tisnet.test/tech/react.svg"
          }
        ],
        "status": "DRAFT",
        "developmentDate": "2026-09-08",
        "clientName": "Logística Global S.A.",
        "demoUrl": "https://demo.inventario.tisnet.test",
        "externalUrl": "https://github.com/tisnet-lab/inventario",
        "coverImageUrl": "https://cdn.tisnet.test/projects/inventario-cover.webp",
        "isFeatured": true,
        "isPublished": false,
        "displayOrder": 1,
        "createdAt": "2026-09-08T14:30:00.000Z",
        "updatedAt": "2026-09-08T14:30:00.000Z"
      }
    ],
    "meta": {
      "page": 1,
      "limit": 10,
      "totalItems": 1,
      "totalPages": 1
    }
  }
}
```

---

### 6.3 `GET /api/v1/projects/:id` — Consultar Detalle Administrativo

Obtiene la ficha técnica completa del proyecto por su identificador numérico.

- **Método HTTP:** `GET`
- **Autenticación:** Requerida (`ADMIN`, `SUPER_ADMIN`)
- **Códigos de respuesta:** `200 OK`, `400 Bad Request` (id no numérico), `401 Unauthorized`, `403 Forbidden`, `404 Not Found`

#### Response (200 OK)

Devuelve el objeto administrativo completo (misma estructura que `data` en `POST /api/v1/projects`).

---

### 6.4 `PATCH /api/v1/projects/:id` — Editar Proyecto

Actualiza parcialmente los campos del proyecto. Si se envía `technologyIds`, reemplaza completamente el conjunto de tecnologías asociadas. No permite modificar `isPublished`.

- **Método HTTP:** `PATCH`
- **Autenticación:** Requerida (`ADMIN`, `SUPER_ADMIN`)
- **Códigos de respuesta:** `200 OK`, `400 Bad Request`, `401 Unauthorized`, `403 Forbidden`, `404 Not Found`, `409 Conflict`

#### Request Payload Parcial (JSON)

```json
{
  "name": "Sistema de Inventario y Despachos TISNET",
  "status": "IN_DEVELOPMENT",
  "technologyIds": [1, 2, 3],
  "isFeatured": false
}
```

#### Response (200 OK)

Devuelve el recurso administrativo actualizado con sus relaciones refrescadas.

---

### 6.5 `PATCH /api/v1/projects/:id/publish` — Publicar Proyecto

Publica el proyecto haciéndolo visible en el portal público.

- **Método HTTP:** `PATCH`
- **Autenticación:** Requerida (`ADMIN`, `SUPER_ADMIN`)
- **Request Body:** Vacío (sin payload).
- **Reglas:**
  - El proyecto debe existir (`404 Not Found` si no existe).
  - El proyecto no puede tener `status: 'ARCHIVED'` (`400 Bad Request`).
  - Debe poseer información mínima: `name`, `slug`, `shortDescription`, `description` (`400 Bad Request`).
  - La categoría asociada debe estar activa (`400 Bad Request`).
- **Efecto:** Establece `isPublished = true`.
- **Códigos de respuesta:** `200 OK`, `400 Bad Request`, `401 Unauthorized`, `403 Forbidden`, `404 Not Found`

#### Response (200 OK)

```json
{
  "success": true,
  "message": "Operación realizada correctamente",
  "data": {
    "id": 10,
    "name": "Sistema de Inventario TISNET",
    "slug": "sistema-de-inventario-tisnet",
    "isPublished": true,
    "status": "DRAFT"
  }
}
```

---

### 6.6 `PATCH /api/v1/projects/:id/unpublish` — Despublicar Proyecto

Oculta el proyecto del portal público sin modificar su información ni su estado interno.

- **Método HTTP:** `PATCH`
- **Autenticación:** Requerida (`ADMIN`, `SUPER_ADMIN`)
- **Request Body:** Vacío (sin payload).
- **Efecto:** Establece `isPublished = false`.
- **Códigos de respuesta:** `200 OK`, `401 Unauthorized`, `403 Forbidden`, `404 Not Found`

#### Response (200 OK)

Devuelve el recurso administrativo con `isPublished: false`.

---

### 6.7 `PATCH /api/v1/projects/:id/archive` — Archivar Proyecto

Archiva lógicamente el proyecto, retirándolo del catálogo activo y de la vista pública.

- **Método HTTP:** `PATCH`
- **Autenticación:** Requerida (`ADMIN`, `SUPER_ADMIN`)
- **Request Body:** Vacío (sin payload).
- **Efecto:** Establece `status = 'ARCHIVED'` e `isPublished = false`. No borra datos ni relaciones.
- **Códigos de respuesta:** `200 OK`, `401 Unauthorized`, `403 Forbidden`, `404 Not Found`

#### Response (200 OK)

Devuelve el recurso administrativo con `status: 'ARCHIVED'` e `isPublished: false`.

---

## 7. Endpoints Públicos (Portafolio Web)

Los endpoints públicos no requieren encabezado `Authorization`. Retornan exclusivamente proyectos con `isPublished: true` y `status !== 'ARCHIVED'`, omitiendo datos de auditoría, cliente y campos de gestión interna.

---

### 7.1 `GET /api/v1/public/projects` — Listar Portafolio Público

- **Método HTTP:** `GET`
- **Autenticación:** Pública (sin token).
- **Ordenamiento:** `displayOrder ASC`, `createdAt DESC`.
- **Códigos de respuesta:** `200 OK`

#### Query Parameters

| Parámetro | Tipo | Requerido | Por Defecto | Descripción |
|---|---|:---:|:---:|---|
| `page` | `number` | No | `1` | Número de página (mínimo 1). |
| `limit` | `number` | No | `12` | Cantidad de tarjetas por página (mínimo 1, máximo 50). |
| `search` | `string` | No | — | Búsqueda por texto en `name` o `shortDescription`. |
| `categoryId` | `number` | No | — | Filtrar por categoría. |
| `technologyId`| `number` | No | — | Filtrar por tecnología asociada. |
| `isFeatured` | `boolean`| No | — | Filtrar proyectos destacados (`true` o `false`). |

#### Response (200 OK)

```json
{
  "success": true,
  "message": "Operación realizada correctamente",
  "data": {
    "items": [
      {
        "id": 10,
        "name": "Sistema de Inventario TISNET",
        "slug": "sistema-de-inventario-tisnet",
        "shortDescription": "Plataforma centralizada para la gestión de almacenes y trazabilidad de existencias en tiempo real.",
        "coverImageUrl": "https://cdn.tisnet.test/projects/inventario-cover.webp",
        "category": {
          "id": 1,
          "name": "Logística"
        },
        "technologies": [
          {
            "id": 1,
            "name": "React",
            "icon": "https://cdn.tisnet.test/tech/react.svg"
          },
          {
            "id": 2,
            "name": "NestJS",
            "icon": "https://cdn.tisnet.test/tech/nestjs.svg"
          }
        ],
        "isFeatured": true,
        "displayOrder": 1
      }
    ],
    "meta": {
      "page": 1,
      "limit": 12,
      "totalItems": 1,
      "totalPages": 1
    }
  }
}
```

*Nota:* Los elementos del listado público **no** incluyen `description`, `problem`, `solution`, `objective`, `clientName`, `status`, `isPublished` ni fechas de auditoría.

---

### 7.2 `GET /api/v1/public/projects/:slug` — Detalle Público del Proyecto

- **Método HTTP:** `GET`
- **Autenticación:** Pública (sin token).
- **Parámetro de ruta:** `:slug` (texto único del proyecto).
- **Comportamiento ante proyectos no públicos:** Si el proyecto no existe, está despublicado (`isPublished: false`) o está archivado (`status: 'ARCHIVED'`), responde `404 Not Found` con mensaje estándar sin revelar la causa interna.
- **Códigos de respuesta:** `200 OK`, `404 Not Found`

#### Response (200 OK)

```json
{
  "success": true,
  "message": "Operación realizada correctamente",
  "data": {
    "id": 10,
    "name": "Sistema de Inventario TISNET",
    "slug": "sistema-de-inventario-tisnet",
    "shortDescription": "Plataforma centralizada para la gestión de almacenes y trazabilidad de existencias en tiempo real.",
    "description": "Solución integral desarrollada con arquitectura limpia, control de stock automatizado y reportes avanzados.",
    "problem": "Descontrol en inventarios físicos y dispersión de datos en planillas manuales.",
    "solution": "Aplicación web modular con base de datos transaccional y control de accesos por roles.",
    "objective": "Optimizar el tiempo de registro y reducir discrepancias de stock a menos del 1%.",
    "features": [
      "Control de stock multialmacén",
      "Alertas de reposición automática",
      "Exportación de reportes a PDF y Excel"
    ],
    "category": {
      "id": 1,
      "name": "Logística"
    },
    "technologies": [
      {
        "id": 1,
        "name": "React",
        "icon": "https://cdn.tisnet.test/tech/react.svg"
      },
      {
        "id": 2,
        "name": "NestJS",
        "icon": "https://cdn.tisnet.test/tech/nestjs.svg"
      }
    ],
    "developmentDate": "2026-09-08",
    "demoUrl": "https://demo.inventario.tisnet.test",
    "externalUrl": "https://github.com/tisnet-lab/inventario",
    "coverImageUrl": "https://cdn.tisnet.test/projects/inventario-cover.webp",
    "isFeatured": true
  }
}
```

#### Response de Error (404 Not Found)

```json
{
  "success": false,
  "message": "Proyecto no encontrado",
  "error": "NotFoundException"
}
```

---

## 8. Catálogo Completo de Respuestas y Códigos HTTP de Error

| Código HTTP | Nombre | Escenario de Activación | Ejemplo de `message` |
|---|---|---|---|
| `400` | `BadRequestException` | DTO inválido, tipos incorrectos, ID no numérico, categoría inactiva, tecnología inactiva o intento de publicar proyecto archivado/incompleto. | `"La categoría no existe o está inactiva"` / `["El slug solo puede contener minúsculas, números y guiones"]` |
| `401` | `UnauthorizedException` | Ausencia de token JWT, token expirado o firma inválida en rutas privadas. | `"Unauthorized"` |
| `403` | `ForbiddenException` | Usuario autenticado cuyo rol no es `ADMIN` ni `SUPER_ADMIN` (por ejemplo, rol `DEVELOPER`). | `"No tienes permisos suficientes"` |
| `404` | `NotFoundException` | Proyecto o ID inexistente, o consulta pública de proyecto no publicado o archivado. | `"Proyecto no encontrado"` |
| `409` | `ConflictException` | Intento de registrar o actualizar un `slug` que ya se encuentra en uso por otro proyecto. | `"El slug ya está registrado"` |
| `500` | `InternalServerError` | Error inesperado no controlado en el servidor. | `"Error interno del servidor"` |

---

## 9. Guía de Integración para Frontend

### 9.1 Módulo Administrativo (`tisnet-web/admin`)
1. **Modelado de Tipos:** Usar `Project`, `ProjectStatus`, `CreateProjectDto`, `UpdateProjectDto`.
2. **Selectores:** Consumir `/api/v1/categories?isActive=true` y `/api/v1/technologies?isActive=true` para garantizar que solo se envíen IDs activos.
3. **Flujo de Publicación:** Presentar botones de acción dedicados:
   - "Publicar" $\rightarrow$ `PATCH /api/v1/projects/:id/publish`
   - "Despublicar" $\rightarrow$ `PATCH /api/v1/projects/:id/unpublish`
   - "Archivar" $\rightarrow$ `PATCH /api/v1/projects/:id/archive`
4. **Validación de Formularios:** Impedir el envío de `isPublished` en formularios de creación y edición general.

### 9.2 Módulo Público (`tisnet-web/public`)
1. **Tipado Estricto:** Definir `PublicProjectListItem` y `PublicProjectDetail`. No utilizar el tipo administrativo `Project` para evitar acoplamientos innecesarios.
2. **Navegación:** Enlazar cada tarjeta a `/portfolio/${item.slug}` consumiendo `/api/v1/public/projects/${slug}`.
3. **Manejo de 404:** Redireccionar o renderizar componente visual de "Proyecto no disponible" cuando la API retorne 404.

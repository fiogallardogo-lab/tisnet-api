# Contrato API del módulo Services — Catálogo y Administración

**Versión del contrato:** Sprint 4 — Fase 1 (Propuesta Oficial)  
**Fecha de actualización:** 10 de septiembre de 2026  
**Ámbito:** Backend (`tisnet-api`), Panel Administrativo (`tisnet-web/admin`) y Portal Público (`tisnet-web/public`)  
**Estado:** Propuesto — Sujeto a revisión y aprobación del equipo  

---

## 1. Objetivo del Módulo Services

El módulo **Services** tiene como objetivo centralizar, estructurar y gestionar el catálogo oficial de servicios tecnológicos y soluciones que ofrece TISNET.

Este módulo cumple una doble función:
1. **Gestión Administrativa:** Permitir al equipo administrativo registrar, modificar, priorizar, activar y desactivar los servicios ofrecidos mediante un panel de control seguro.
2. **Exposición Pública:** Proveer una API optimizada, rápida y desacoplada para que el portal web corporativo consulte y presente los servicios activos a clientes y visitantes.

---

## 2. Alcance del Sprint 4

Durante el Sprint 4, el trabajo en el módulo Services comprende de forma exclusiva:

- **Administración completa de servicios:** Creación, consulta paginada, detalle administrativo, actualización parcial y cambio de estado.
- **Catálogo público de servicios:** Listado filtrable y ordenado de servicios activos para el portal web, junto con el endpoint propuesto de detalle individual por `slug`.
- **Persistencia en MySQL con Prisma ORM:** Definición de la entidad `Service`, índices de rendimiento y migraciones correspondientes.
- **Control de visibilidad y estado:** Activación (`activate`) y desactivación (`deactivate`) lógica de servicios sin borrado físico.
- **Integración frontend-backend:** Conexión con las interfaces del panel administrativo y las vistas del portal público.
- **Manejo de imágenes e iconos mediante URL:** Uso estricto de URLs directas/externas para `imageUrl` e identificadores para `icon` (no se incluye subida binaria de archivos).

---

## 3. Funcionalidades Fuera del Alcance (Out of Scope)

Las siguientes funcionalidades **NO** forman parte del Sprint 4 y se implementarán en sprints posteriores:

- **Formulario pendiente de cotizaciones y estimaciones de costo:** Cálculo de presupuestos automáticos o formularios complejos de estimación.
- **Agendamiento de reuniones y gestión de calendarios:** Integración con agendas o selección de horarios.
- **Integración con Google Meet o videollamadas:** Creación automática de salas o enlaces virtuales.
- **Envío de correos transaccionales o notificaciones:** Integración SMTP o servicios como SendGrid/Resend.
- **Subida de archivos multimedia al backend:** Almacenamiento local o en buckets (S3 / Cloudinary). Las imágenes e iconos se gestionan únicamente mediante cadenas URL.
- **Eliminación física (Hard Delete) en base de datos:** Ningún servicio será eliminado de la base de datos para preservar trazabilidad.
- **Acceso para el rol DEVELOPER:** Los desarrolladores no gestionarán servicios en este sprint.

---

## 4. URL Base y Entorno de la API

- **Base URL local:** `http://localhost:3000/api/v1`
- **Documentación Swagger / OpenAPI:** `http://localhost:3000/api/docs`
- **Prefijo global:** `/api/v1`
- **Protocolo de comunicación:** REST / JSON (encabezado `Content-Type: application/json` requerido en mutaciones con payload).

---

## 5. Envoltorio Estándar de Respuestas (Response Wrapper)

Todas las respuestas de la API mantienen el estándar unificado del proyecto `tisnet-api` mediante interceptores (`TransformInterceptor`) y filtros de excepciones (`HttpExceptionFilter`).

### 5.1 Respuesta Exitosa Estándar (200 OK / 201 Created)

```json
{
  "success": true,
  "message": "Operación realizada correctamente",
  "data": {}
}
```

> [!NOTE]
> `data` puede ser un objeto individual, un arreglo o una estructura paginada (`{ items: [], meta: {} }`).

### 5.2 Respuesta de Error Estándar (400, 401, 403, 404, 409, 500)

```json
{
  "success": false,
  "message": "Descripción legible del error o lista de fallos de validación",
  "error": "NombreDeLaExcepcion"
}
```

> [!NOTE]
> En errores de validación de DTO (`400 Bad Request`), el campo `message` contiene un arreglo de strings detallando cada infracción de validación reportada por `class-validator`.

---

## 6. Modelo de Datos Propuesto

### 6.1 Definición de la Entidad `Service`

| Campo | Tipo Prisma | Tipo MySQL | Nullable | Default | Descripción |
|---|---|---|:---:|:---:|---|
| `id` | `Int` | `INT` | No | Autoincrement | Identificador numérico único del servicio (PK). |
| `name` | `String` | `VARCHAR(150)` | No | — | Nombre comercial o título del servicio. |
| `slug` | `String` | `VARCHAR(180)` | No | — | Identificador legible único para rutas amigables en URL. |
| `shortDescription` | `String` | `VARCHAR(300)` | No | — | Resumen breve o bajada informativa para tarjetas. |
| `description` | `String` | `TEXT` | No | — | Descripción detallada, alcance y especificaciones del servicio. |
| `icon` | `String?` | `VARCHAR(100)` | Sí | `null` | Nombre del icono (ej. Lucide React: `Code`, `Server`) o URL de icono SVG. |
| `imageUrl` | `String?` | `VARCHAR(500)` | Sí | `null` | URL de la imagen ilustrativa o cover del servicio. |
| `isActive` | `Boolean` | `TINYINT(1)` | No | `true` | Bandera de estado y visibilidad pública. |
| `displayOrder` | `Int` | `INT` | No | `0` | Orden de prioridad para la presentación en el portal. |
| `isFeatured` | `Boolean` | `TINYINT(1)` | No | `false` | Indica si el servicio se destaca en la página de inicio. |
| `createdAt` | `DateTime` | `DATETIME(3)` | No | `now()` | Fecha y hora de registro inicial. |
| `updatedAt` | `DateTime` | `DATETIME(3)` | No | `@updatedAt` | Fecha y hora de última modificación. |

### 6.2 Representación en Prisma Schema (`prisma/schema.prisma`)

```prisma
model Service {
  id               Int      @id @default(autoincrement())
  name             String   @db.VarChar(150)
  slug             String   @unique @db.VarChar(180)
  shortDescription String   @db.VarChar(300)
  description      String   @db.Text
  icon             String?  @db.VarChar(100)
  imageUrl         String?  @db.VarChar(500)
  isActive         Boolean  @default(true)
  displayOrder     Int      @default(0)
  isFeatured       Boolean  @default(false)
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt

  @@index([isActive, displayOrder])
  @@index([isFeatured])
}
```

### 6.3 Comportamiento y Justificación de `isActive` en Creación

- **Campo Opcional:** El atributo `isActive` es **opcional** en el payload de creación (`POST /api/v1/services`).
- **Valor por Defecto (`true`):** Si el cliente no envía la propiedad `isActive`, el backend asigna y persiste automáticamente `true`.
- **Comportamiento ante `false`:** Si el cliente envía explícitamente `"isActive": false`, el servicio se guarda y persiste de forma normal en la base de datos MySQL, pero **no aparece públicamente** en ningún endpoint del catálogo (`/api/v1/public/services` ni `/api/v1/public/services/:slug`).
- **Activación Posterior:** El servicio inactivo registrado puede ser activado en cualquier momento posterior por un administrador mediante el endpoint `PATCH /api/v1/services/:id/activate`.

---

## 7. Reglas de Negocio

1. **Obligatoriedad de campos esenciales:** `name`, `slug`, `shortDescription` y `description` son estrictamente obligatorios tanto en base de datos como en validación de DTO.
2. **Unicidad de `slug`:** El `slug` debe ser único en toda la base de datos. Si se intenta registrar o actualizar con un `slug` existente, el backend responde `409 Conflict`.
3. **Formato estricto de `slug`:** Solo se permiten caracteres en minúsculas, números y guiones medios (formato kebab-case: `^[a-z0-9]+(?:-[a-z0-9]+)*$`).
4. **Campos visuales opcionales:** `icon` e `imageUrl` son opcionales y admiten valores nulos (`null`).
5. **Formato de imágenes e iconos:** `imageUrl` debe ser una URL sintácticamente válida (máx. 500 caracteres). `icon` almacena el nombre del identificador de icono (máx. 100 caracteres). No se acepta subida de binarios.
6. **Prioridad y ordenamiento (`displayOrder`):** Debe ser un número entero mayor o igual a 0. Permite a los administradores fijar el orden de aparición de los servicios en la interfaz pública.
7. **Servicios destacados (`isFeatured`):** Booleano que permite filtrar servicios clave para la sección principal de la Home corporativa.
8. **Comportamiento y visibilidad de `isActive`:**
   - `isActive` es opcional en la creación.
   - Si no se envía, el backend asigna `true` por defecto.
   - Si se envía `false`, el servicio se guarda y persiste normalmente en MySQL, pero **no aparece públicamente** en el portal.
   - Los servicios inactivos (`isActive: false`) quedan excluidos del listado público y devuelven `404 Not Found` en el detalle público por slug.
   - Los servicios inactivos sí aparecen en el listado administrativo `GET /api/v1/services`.
9. **Ausencia de borrado físico:** No existe endpoint `DELETE /api/v1/services/:id`. El retiro de un servicio se gestiona exclusivamente mediante `PATCH /api/v1/services/:id/deactivate`.
10. **Idempotencia de activación/desactivación:**
    - Activar un servicio ya activo retorna `200 OK` sin error.
    - Desactivar un servicio ya inactivo retorna `200 OK` sin error.

---

## 8. Roles y Matriz de Permisos

| Rol | Consultar Catálogo Público | Listar Servicios (Admin) | Ver Detalle (Admin) | Crear Servicio | Editar Servicio | Activar / Desactivar |
|---|:---:|:---:|:---:|:---:|:---:|:---:|
| **VISITANTE** (Público) | ✓ | ✗ (`401`) | ✗ (`401`) | ✗ (`401`) | ✗ (`401`) | ✗ (`401`) |
| **DEVELOPER** | ✓ | ✗ (`403`) | ✗ (`403`) | ✗ (`403`) | ✗ (`403`) | ✗ (`403`) |
| **ADMIN** | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| **SUPER_ADMIN** | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |

- **VISITANTE:** Solo consume endpoints bajo el prefijo `/api/v1/public/services`. No requiere token JWT.
- **DEVELOPER:** Recibe `403 Forbidden` en todos los endpoints administrativos del módulo Services.
- **ADMIN / SUPER_ADMIN:** Acceso total a la gestión del módulo mediante token Bearer JWT.

---

## 9. Endpoints Administrativos (Panel Privado)

Todos los endpoints administrativos requieren autenticación JWT (`Authorization: Bearer <token>`) y rol `ADMIN` o `SUPER_ADMIN`.

### 9.1 Resumen de Endpoints Administrativos

| Método | Ruta | Descripción | Códigos HTTP |
|---|---|---|---|
| `POST` | `/api/v1/services` | Crear un nuevo servicio | `201`, `400`, `401`, `403`, `409` |
| `GET` | `/api/v1/services` | Listar servicios con paginación, filtros y búsqueda | `200`, `401`, `403` |
| `GET` | `/api/v1/services/:id` | Consultar detalle administrativo de un servicio por ID | `200`, `400`, `401`, `403`, `404` |
| `PATCH` | `/api/v1/services/:id` | Editar información general de un servicio | `200`, `400`, `401`, `403`, `404`, `409` |
| `PATCH` | `/api/v1/services/:id/activate` | Activar un servicio (hacerlo visible públicamente) | `200`, `400`, `401`, `403`, `404` |
| `PATCH` | `/api/v1/services/:id/deactivate` | Desactivar un servicio (ocultarlo del portal público) | `200`, `400`, `401`, `403`, `404` |

---

### 9.2 `POST /api/v1/services` — Crear Servicio

- **Método HTTP:** `POST`
- **Autenticación:** Requerida (`ADMIN`, `SUPER_ADMIN`)
- **Headers:** `Authorization: Bearer <accessToken>`, `Content-Type: application/json`

#### Request Payload (`CreateServiceDto`)

```json
{
  "name": "Desarrollo de software a medida",
  "slug": "desarrollo-de-software-a-medida",
  "shortDescription": "Creamos soluciones digitales adaptadas a las necesidades de cada organización.",
  "description": "Servicio orientado al análisis, diseño, desarrollo e implementación de sistemas empresariales personalizados, escalables y seguros.",
  "icon": "Code",
  "imageUrl": "https://images.unsplash.com/photo-1555066931-4365d14bab8c?auto=format&fit=crop&w=800&q=80",
  "displayOrder": 1,
  "isFeatured": true,
  "isActive": true
}
```

#### Validación de Campos en Creación

| Campo | Tipo | Requerido | Validaciones `class-validator` |
|---|---|:---:|---|
| `name` | `string` | **Sí** | `@IsString()`, `@IsNotEmpty()`, `@MinLength(3)`, `@MaxLength(150)` |
| `slug` | `string` | **Sí** | `@IsString()`, `@IsNotEmpty()`, `@MinLength(3)`, `@MaxLength(180)`, `@Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)` |
| `shortDescription` | `string` | **Sí** | `@IsString()`, `@IsNotEmpty()`, `@MinLength(10)`, `@MaxLength(300)` |
| `description` | `string` | **Sí** | `@IsString()`, `@IsNotEmpty()`, `@MinLength(20)` |
| `icon` | `string` | No | `@IsOptional()`, `@IsString()`, `@MaxLength(100)` |
| `imageUrl` | `string` | No | `@IsOptional()`, `@IsUrl()`, `@MaxLength(500)` |
| `displayOrder` | `number` | No | `@IsOptional()`, `@IsInt()`, `@Min(0)` (default: `0`) |
| `isFeatured` | `boolean` | No | `@IsOptional()`, `@IsBoolean()` (default: `false`) |
| `isActive` | `boolean` | No | `@IsOptional()`, `@IsBoolean()` (opcional, default: `true`. Si se envía `false`, se guarda pero no aparece públicamente) |

#### Response Exitosa (`201 Created`)

```json
{
  "success": true,
  "message": "Servicio creado correctamente",
  "data": {
    "id": 1,
    "name": "Desarrollo de software a medida",
    "slug": "desarrollo-de-software-a-medida",
    "shortDescription": "Creamos soluciones digitales adaptadas a las necesidades de cada organización.",
    "description": "Servicio orientado al análisis, diseño, desarrollo e implementación de sistemas empresariales personalizados, escalables y seguros.",
    "icon": "Code",
    "imageUrl": "https://images.unsplash.com/photo-1555066931-4365d14bab8c?auto=format&fit=crop&w=800&q=80",
    "isActive": true,
    "displayOrder": 1,
    "isFeatured": true,
    "createdAt": "2026-09-10T15:30:00.000Z",
    "updatedAt": "2026-09-10T15:30:00.000Z"
  }
}
```

---

### 9.3 `GET /api/v1/services` — Listar Servicios Administrativos

- **Método HTTP:** `GET`
- **Autenticación:** Requerida (`ADMIN`, `SUPER_ADMIN`)
- **Ordenamiento predeterminado:** `displayOrder ASC`, `createdAt DESC`

#### Query Parameters

| Parámetro | Tipo | Requerido | Por Defecto | Descripción |
|---|---|:---:|:---:|---|
| `page` | `number` | No | `1` | Número de página a consultar (mínimo 1). |
| `limit` | `number` | No | `10` | Cantidad de registros por página (mínimo 1, máximo 100). |
| `search` | `string` | No | — | Búsqueda por coincidencia parcial en `name`, `slug` o `shortDescription`. |
| `isActive` | `boolean` | No | — | Filtro por estado activo (`true`) o inactivo (`false`). |
| `isFeatured` | `boolean` | No | — | Filtro por servicios destacados (`true`) o no destacados (`false`). |

#### Response Exitosa (`200 OK`)

```json
{
  "success": true,
  "message": "Operación realizada correctamente",
  "data": {
    "items": [
      {
        "id": 1,
        "name": "Desarrollo de software a medida",
        "slug": "desarrollo-de-software-a-medida",
        "shortDescription": "Creamos soluciones digitales adaptadas a las necesidades de cada organización.",
        "description": "Servicio orientado al análisis, diseño, desarrollo e implementación de sistemas empresariales personalizados.",
        "icon": "Code",
        "imageUrl": "https://images.unsplash.com/photo-1555066931-4365d14bab8c?auto=format&fit=crop&w=800&q=80",
        "isActive": true,
        "displayOrder": 1,
        "isFeatured": true,
        "createdAt": "2026-09-10T15:30:00.000Z",
        "updatedAt": "2026-09-10T15:30:00.000Z"
      },
      {
        "id": 2,
        "name": "Consultoría Cloud y DevOps",
        "slug": "consultoria-cloud-devops",
        "shortDescription": "Optimización de infraestructura y automatización de despliegues.",
        "description": "Diseño de arquitecturas en la nube, migración de cargas de trabajo e implementación de pipelines CI/CD.",
        "icon": "Cloud",
        "imageUrl": null,
        "isActive": false,
        "displayOrder": 2,
        "isFeatured": false,
        "createdAt": "2026-09-10T16:00:00.000Z",
        "updatedAt": "2026-09-10T16:15:00.000Z"
      }
    ],
    "meta": {
      "page": 1,
      "limit": 10,
      "totalItems": 2,
      "totalPages": 1
    }
  }
}
```

---

### 9.4 `GET /api/v1/services/:id` — Consultar Detalle Administrativo

- **Método HTTP:** `GET`
- **Autenticación:** Requerida (`ADMIN`, `SUPER_ADMIN`)
- **Parámetro de ruta:** `:id` (entero $\ge 1$)

#### Response Exitosa (`200 OK`)

```json
{
  "success": true,
  "message": "Operación realizada correctamente",
  "data": {
    "id": 1,
    "name": "Desarrollo de software a medida",
    "slug": "desarrollo-de-software-a-medida",
    "shortDescription": "Creamos soluciones digitales adaptadas a las necesidades de cada organización.",
    "description": "Servicio orientado al análisis, diseño, desarrollo e implementación de sistemas empresariales personalizados, escalables y seguros.",
    "icon": "Code",
    "imageUrl": "https://images.unsplash.com/photo-1555066931-4365d14bab8c?auto=format&fit=crop&w=800&q=80",
    "isActive": true,
    "displayOrder": 1,
    "isFeatured": true,
    "createdAt": "2026-09-10T15:30:00.000Z",
    "updatedAt": "2026-09-10T15:30:00.000Z"
  }
}
```

---

### 9.5 `PATCH /api/v1/services/:id` — Editar Servicio

- **Método HTTP:** `PATCH`
- **Autenticación:** Requerida (`ADMIN`, `SUPER_ADMIN`)
- **Parámetro de ruta:** `:id` (entero $\ge 1$)
- **Headers:** `Authorization: Bearer <accessToken>`, `Content-Type: application/json`

#### Request Payload Parcial (`UpdateServiceDto`)

Todos los campos son opcionales. Se aplican las mismas reglas de validación que en la creación.

```json
{
  "shortDescription": "Diseñamos y construimos plataformas web y móviles escalables de alto impacto.",
  "displayOrder": 2,
  "isFeatured": false
}
```

#### Response Exitosa (`200 OK`)

```json
{
  "success": true,
  "message": "Servicio actualizado correctamente",
  "data": {
    "id": 1,
    "name": "Desarrollo de software a medida",
    "slug": "desarrollo-de-software-a-medida",
    "shortDescription": "Diseñamos y construimos plataformas web y móviles escalables de alto impacto.",
    "description": "Servicio orientado al análisis, diseño, desarrollo e implementación de sistemas empresariales personalizados, escalables y seguros.",
    "icon": "Code",
    "imageUrl": "https://images.unsplash.com/photo-1555066931-4365d14bab8c?auto=format&fit=crop&w=800&q=80",
    "isActive": true,
    "displayOrder": 2,
    "isFeatured": false,
    "createdAt": "2026-09-10T15:30:00.000Z",
    "updatedAt": "2026-09-10T16:45:00.000Z"
  }
}
```

---

### 9.6 `PATCH /api/v1/services/:id/activate` — Activar Servicio

- **Método HTTP:** `PATCH`
- **Autenticación:** Requerida (`ADMIN`, `SUPER_ADMIN`)
- **Parámetro de ruta:** `:id` (entero $\ge 1$)
- **Request Body:** Vacío (sin payload).
- **Efecto:** Establece `isActive = true`.

#### Response Exitosa (`200 OK`)

```json
{
  "success": true,
  "message": "Servicio activado correctamente",
  "data": {
    "id": 2,
    "name": "Consultoría Cloud y DevOps",
    "slug": "consultoria-cloud-devops",
    "isActive": true,
    "updatedAt": "2026-09-10T17:00:00.000Z"
  }
}
```

---

### 9.7 `PATCH /api/v1/services/:id/deactivate` — Desactivar Servicio

- **Método HTTP:** `PATCH`
- **Autenticación:** Requerida (`ADMIN`, `SUPER_ADMIN`)
- **Parámetro de ruta:** `:id` (entero $\ge 1$)
- **Request Body:** Vacío (sin payload).
- **Efecto:** Establece `isActive = false`.

#### Response Exitosa (`200 OK`)

```json
{
  "success": true,
  "message": "Servicio desactivado correctamente",
  "data": {
    "id": 2,
    "name": "Consultoría Cloud y DevOps",
    "slug": "consultoria-cloud-devops",
    "isActive": false,
    "updatedAt": "2026-09-10T17:05:00.000Z"
  }
}
```

---

## 10. Endpoints Públicos (Portal Web Corporativo)

Los endpoints públicos no requieren autenticación JWT ni credenciales. Retornan de forma estricta registros con `isActive: true`.

### 10.1 Resumen de Endpoints Públicos

| Método | Ruta | Estado en Sprint 4 | Descripción | Códigos HTTP |
|---|---|:---:|---|---|
| `GET` | `/api/v1/public/services` | **Confirmado** | Listar servicios activos para el portal público | `200` |
| `GET` | `/api/v1/public/services/:slug` | **Propuesto** *(sujeto a aprobación)* | Consultar detalle público de un servicio activo por slug | `200`, `404` |

---

### 10.2 `GET /api/v1/public/services` — Listar Catálogo Público de Servicios

- **Método HTTP:** `GET`
- **Autenticación:** Pública (sin token).
- **Filtro base en BD:** `where: { isActive: true }`
- **Ordenamiento predeterminado:** `displayOrder ASC`, `createdAt ASC`

#### Query Parameters

| Parámetro | Tipo | Requerido | Por Defecto | Descripción |
|---|---|:---:|:---:|---|
| `page` | `number` | No | `1` | Número de página (mínimo 1). |
| `limit` | `number` | No | `12` | Cantidad de tarjetas por página (mínimo 1, máximo 50). |
| `search` | `string` | No | — | Búsqueda por texto en `name` o `shortDescription`. |
| `isFeatured` | `boolean` | No | — | Filtrar únicamente servicios destacados (`true` o `false`). |

#### Response Exitosa (`200 OK`)

```json
{
  "success": true,
  "message": "Operación realizada correctamente",
  "data": {
    "items": [
      {
        "id": 1,
        "name": "Desarrollo de software a medida",
        "slug": "desarrollo-de-software-a-medida",
        "shortDescription": "Creamos soluciones digitales adaptadas a las necesidades de cada organización.",
        "icon": "Code",
        "imageUrl": "https://images.unsplash.com/photo-1555066931-4365d14bab8c?auto=format&fit=crop&w=800&q=80",
        "displayOrder": 1,
        "isFeatured": true
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

> [!NOTE]
> Los elementos del listado público omiten intencionalmente el campo `description` extenso, `isActive` (siempre es `true`) y las fechas de auditoría para optimizar el peso de la respuesta.

---

### 10.3 `GET /api/v1/public/services/:slug` — Detalle Público de Servicio (Propuesto)

> [!IMPORTANT]
> **Estado:** Este endpoint queda formalmente **propuesto y sujeto a aprobación** del equipo técnico. Si se aprueba, será implementado en backend (`tisnet-api`) y consumido en la página de detalle del frontend público (`tisnet-web/public/pages/ServiceDetailPage`).

- **Método HTTP:** `GET`
- **Autenticación:** Pública (sin token).
- **Parámetro de ruta:** `:slug` (string único en formato kebab-case).
- **Filtro base en BD:** `where: { slug: slug, isActive: true }`
- **Comportamiento ante inactivos o inexistentes:** Si el servicio no existe o tiene `isActive: false`, responde inmediatamente `404 Not Found`.

#### Response Exitosa (`200 OK`)

```json
{
  "success": true,
  "message": "Operación realizada correctamente",
  "data": {
    "id": 1,
    "name": "Desarrollo de software a medida",
    "slug": "desarrollo-de-software-a-medida",
    "shortDescription": "Creamos soluciones digitales adaptadas a las necesidades de cada organización.",
    "description": "Servicio orientado al análisis, diseño, desarrollo e implementación de sistemas empresariales personalizados, escalables y seguros. Abarcamos desde la arquitectura inicial hasta el despliegue en entornos de alta disponibilidad.",
    "icon": "Code",
    "imageUrl": "https://images.unsplash.com/photo-1555066931-4365d14bab8c?auto=format&fit=crop&w=800&q=80",
    "displayOrder": 1,
    "isFeatured": true
  }
}
```

#### Response de Error (`404 Not Found`)

```json
{
  "success": false,
  "message": "Servicio no encontrado",
  "error": "NotFoundException"
}
```

---

## 11. Catálogo Completo de Errores y Códigos HTTP

| Código HTTP | Excepción NestJS | Causa / Escenario | Ejemplo de `message` |
|---|---|---|---|
| `400` | `BadRequestException` | Fallo de validación en DTO, tipos de datos erróneos o ID no numérico. | `["El nombre debe tener al menos 3 caracteres", "El slug solo puede contener minúsculas, números y guiones"]` |
| `401` | `UnauthorizedException` | Token JWT ausente, expirado o con firma inválida en endpoints administrativos. | `"Unauthorized"` |
| `403` | `ForbiddenException` | Usuario autenticado cuyo rol no es `ADMIN` ni `SUPER_ADMIN` (ej. rol `DEVELOPER`). | `"No tienes permisos suficientes"` |
| `404` | `NotFoundException` | Servicio no encontrado por ID o consulta pública de servicio inexistente/inactivo. | `"Servicio no encontrado"` |
| `409` | `ConflictException` | Intento de crear o actualizar un servicio con un `slug` que ya pertenece a otro registro. | `"El slug ya está registrado"` |
| `500` | `InternalServerError` | Error imprevisto o no controlado en el servidor o base de datos. | `"Error interno del servidor"` |

---

## 12. Reglas de Activación y Desactivación

1. **Endpoints de mutación directa:**
   - La activación se realiza exclusivamente vía `PATCH /api/v1/services/:id/activate`.
   - La desactivación se realiza exclusivamente vía `PATCH /api/v1/services/:id/deactivate`.
2. **Efecto inmediato en portal público:**
   - Desactivar un servicio (`isActive = false`) hace que desaparezca de inmediato del listado público `/api/v1/public/services`.
   - Si un usuario intenta consultar directamente `/api/v1/public/services/:slug` de un servicio desactivado, el servidor responderá `404 Not Found`.
3. **Visibilidad en panel administrativo:**
   - Los servicios desactivados continúan visibles en el listado administrativo `GET /api/v1/services`, identificados con un badge visual "Inactivo".
   - El administrador puede filtrar específicamente inactivos usando `GET /api/v1/services?isActive=false`.
4. **Idempotencia:**
   - Ejecutar activación sobre un servicio ya activo devuelve `200 OK` con su estado actual sin alterar otras propiedades.
   - Ejecutar desactivación sobre un servicio ya inactivo devuelve `200 OK` con su estado actual sin alterar otras propiedades.

---

## 13. Reglas para el Catálogo Público

1. **Aislamiento de estado:** La cláusula de consulta en base de datos para todas las rutas públicas debe forzar siempre `isActive: true`.
2. **Criterio de ordenamiento oficial:**
   - Primario: `displayOrder ASC` (los números menores aparecen primero; 0, 1, 2...).
   - Secundario: `createdAt ASC` (o `name ASC`, asegurando un orden determinístico cuando coincida el `displayOrder`).
3. **Optimización de payload:** En el listado público de tarjetas, no se incluye el campo `description` extenso ni fechas de auditoría (`createdAt`, `updatedAt`).

---

## 14. Consideraciones para Frontend Administrativo (`tisnet-web/admin`)

1. **Gestión en tabla de servicios:**
   - Columnas recomendadas: Icono/Imagen, Nombre, Slug, Orden (`displayOrder`), Destacado (`isFeatured`), Estado (`isActive`), Acciones.
   - Acciones rápidas: Switch o botón para Activar/Desactivar con confirmación visual rápida (toast).
2. **Formulario de Creación / Edición:**
   - Generación automática opcional de `slug` en tiempo real a partir del `name` mediante función `slugify`, manteniendo la posibilidad de edición manual.
   - Selector o campo de texto para `icon` (nombres de iconos del set oficial de Lucide Icons, con renderizado previo en tiempo real).
   - Campo `imageUrl` con vista previa inmediata si la URL es válida.
   - Validación del lado del cliente coincidente con las reglas del backend antes del envío.
3. **Manejo de errores:**
   - Si el backend responde `409 Conflict`, resaltar el campo `slug` indicando que el slug ya está en uso.
   - Notificaciones toast para operaciones exitosas y fallidas.

---

## 15. Consideraciones para Portal Público (`tisnet-web/public`)

1. **Sección Servicios en Landing / Home (`/`):**
   - Consumir `GET /api/v1/public/services?isFeatured=true&limit=6` para mostrar únicamente los servicios más relevantes.
2. **Página de Catálogo de Servicios (`/services`):**
   - Consumir `GET /api/v1/public/services` con buscador por texto y paginación.
   - Renderizado de tarjetas con icono, imagen ilustrativa, título y `shortDescription`.
3. **Página de Detalle de Servicio (`/services/:slug`) (Sujeta a aprobación):**
   - Consumir `GET /api/v1/public/services/:slug`.
   - Renderizar descripción completa, llamada a la acción hacia formulario de contacto general y navegación de retorno.
   - Mostrar estado 404 amigable si el servicio fue desactivado o no existe.

---

## 16. Criterios de Aceptación del Contrato

Para dar por aprobado este contrato y proceder con la implementación técnica en el Sprint 4, se deben verificar los siguientes puntos:

- [x] El archivo `docs/contracts/services-api.md` se encuentra formalizado en el repositorio.
- [x] Se diferencian claramente los endpoints administrativos (`/api/v1/services`) de los públicos (`/api/v1/public/services`).
- [x] Se define la matriz de roles y permisos (`ADMIN`, `SUPER_ADMIN`, `DEVELOPER`, `VISITANTE`).
- [x] Se definen los endpoints dedicados y reglas de negocio para activación y desactivación.
- [x] Se especifican los payloads de creación (`CreateServiceDto`), actualización (`UpdateServiceDto`) y respuestas JSON estructuradas.
- [x] Se mantiene el wrapper global `{ success, message, data }` y `{ success, message, error }`.
- [x] Se explicita que no habrá subida de archivos binarios en este Sprint, utilizando únicamente URLs (`imageUrl`, `icon`).
- [x] Se declara formalmente fuera del alcance del Sprint 4: cotizaciones, reuniones, correos transaccionales y Google Meet.
- [x] El endpoint de detalle público por slug (`GET /api/v1/public/services/:slug`) queda explícitamente propuesto para aprobación del equipo.

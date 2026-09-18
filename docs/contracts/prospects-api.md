# Contrato API - Prospectos y base de reuniones

Estado: borrador implementable del Sprint 4  
Responsable: A - Backend y datos  
Fecha: 18/09/2026

## 1. Alcance

Este contrato cubre exclusivamente el núcleo de datos del Responsable A:

- entidad `Prospect`;
- relación de un prospecto con múltiples cotizaciones;
- vinculación segura de una cotización anterior mediante `publicCode`;
- consulta del prospecto propio;
- listado administrativo de prospectos;
- directorio público de asesores;
- entidad persistente `Meeting` preparada para el módulo del Responsable B.

No incluye generación de PDF, envío de correos, consulta de disponibilidad ni integración con Calendly.

Todas las respuestas usan el envoltorio global:

```json
{
  "success": true,
  "message": "Operación realizada correctamente",
  "data": {}
}
```

## 2. Modelo de negocio

### Prospect

| Campo | Tipo | Regla |
| --- | --- | --- |
| `id` | integer | Identificador interno |
| `userId` | integer o null | Cuenta CLIENT vinculada; único |
| `name` | string | Máximo 100 caracteres |
| `email` | string | Normalizado en minúsculas; único |
| `phone` | string o null | Máximo 30 caracteres |
| `company` | string o null | Máximo 150 caracteres |
| `status` | enum | `NEW`, `CONTACTED`, `QUALIFIED`, `CONVERTED`, `LOST` |
| `source` | enum | `QUOTE`, `MEETING`, `MANUAL` |

Un prospecto puede tener varias cotizaciones. Una cotización pertenece, como máximo, a un prospecto.

### Meeting

La entidad se crea en la migración para estabilizar nombres y relaciones, pero su servicio corresponde al Responsable B.

| Campo | Tipo | Regla |
| --- | --- | --- |
| `prospectId` | integer | Obligatorio |
| `quoteId` | integer o null | Cotización relacionada opcional |
| `advisorProfileId` | integer o null | `AdminProfile` que actúa como asesor |
| `status` | enum | `REQUESTED`, `CONFIRMED`, `CANCELED`, `COMPLETED` |
| `scheduledAt` | datetime o null | Se define al confirmar disponibilidad |
| `timezone` | string | Por defecto `America/Lima` |
| `externalProvider` | string o null | Ejemplo futuro: `calendly` |
| `externalEventUri` | string o null | Identificador externo único |

## 3. Endpoints

### POST `/api/v1/prospects/link-quote`

Autenticación: Bearer JWT  
Rol: `CLIENT`

```json
{
  "publicCode": "Q-ABCDEFGH"
}
```

Reglas:

1. El código se normaliza a mayúsculas.
2. La cotización debe existir.
3. El correo de la cotización debe coincidir con el correo del usuario autenticado.
4. Una cotización vinculada a otra persona no puede reclamarse.
5. Repetir la operación por el mismo usuario es idempotente.
6. Los datos de contacto se toman de la cotización persistida, no del navegador.

Errores:

- `400`: formato de código inválido;
- `401`: sesión ausente o inválida;
- `403`: el correo no corresponde al usuario;
- `404`: código inexistente;
- `409`: cotización o correo ya vinculados a otro prospecto.

### GET `/api/v1/prospects/me`

Autenticación: Bearer JWT  
Rol: `CLIENT`

Devuelve el prospecto propio y sus cotizaciones. Responde `404` cuando todavía no existe vínculo.

### GET `/api/v1/prospects`

Autenticación: Bearer JWT  
Roles: `ADMIN`, `SUPER_ADMIN`

Query params:

- `page`: entero mayor o igual a 1; valor inicial 1;
- `limit`: 1 a 100; valor inicial 10;
- `search`: busca por nombre, correo o empresa;
- `status`: uno de los estados de `Prospect`.

### GET `/api/v1/public/advisors`

Público, sin JWT.

Devuelve únicamente perfiles con `isPublicAdvisor = true` cuyo usuario esté activo.

```json
{
  "success": true,
  "message": "Operación realizada correctamente",
  "data": [
    {
      "id": 3,
      "name": "Asesora TISNET",
      "executiveTitle": "Asesora comercial",
      "specialty": "Productos digitales",
      "photoUrl": null,
      "calendlyUrl": null
    }
  ]
}
```

`calendlyUrl` puede permanecer en `null` hasta que Producto entregue la configuración aprobada.

## 4. Decisiones de seguridad

- Conocer un `publicCode` no basta para apropiarse de una cotización.
- La coincidencia de correo se realiza después de normalizar ambos valores.
- Los endpoints administrativos requieren `JwtAuthGuard` y `RolesGuard`.
- El directorio público no expone correo, identificadores de usuario ni datos internos.
- Tokens de Calendly y claves externas no pertenecen a este contrato ni a la base de datos.

## 5. Responsabilidad del módulo siguiente

El Responsable B puede construir `MeetingsModule` sobre `Meeting`, pero no debe modificar la migración histórica. Si necesita un campo adicional, debe proponerlo antes de que esta migración se fusione o crear una migración nueva después.

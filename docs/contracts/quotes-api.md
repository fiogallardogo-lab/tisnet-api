# Contrato API del módulo Quotes - Cotización pública

**Versión del contrato:** Sprint 3 - Borrador 1

**Fecha de actualización:** 16 de septiembre de 2026

**Ámbito:** Backend (`tisnet-api`) y formulario público (`tisnet-web`)

**Estado:** Modelo aprobado por A con ajustes menores; catálogo y SP-01 pendientes

**Iteración técnica del repositorio:** 5 (`feature/s5-quotes-api`)

---

## 1. Objetivo

Permitir que un visitante solicite una cotización sin crear una cuenta. La API valida los datos de contacto y la selección, registra la cotización de forma transaccional y devuelve un código público único con el estado del cálculo.

Este contrato separa dos resultados:

- **Cotización registrada:** puede completarse durante el Sprint 3.
- **Monto aproximado calculado:** solo puede completarse cuando SP-01 defina y apruebe la fórmula, precios, moneda y reglas de redondeo.

No se inventarán precios ni se ejecutarán reglas de cálculo no aprobadas.

## 2. Alcance

### Incluido

- Endpoint público para registrar una cotización.
- Tipo de solución y características seleccionadas mediante códigos estables.
- Datos básicos de contacto.
- Normalización y validación del payload.
- Código público único y no predecible.
- Persistencia transaccional de la cotización y sus selecciones.
- Estado explícito del cálculo.
- Respuesta pública sin identificadores internos ni campos administrativos.

### Fuera de alcance

- Crear un usuario o un prospecto.
- Enviar correos o notificaciones.
- Generar PDF.
- Vincular posteriormente una cotización a una cuenta.
- Gestión comercial o cambio de estados desde un panel administrativo.
- Cotización oficial, planes de pago, pagos o contratos.

## 3. URL y convenciones

- **Base URL local:** `http://localhost:3000/api/v1`
- **Endpoint:** `POST /api/v1/public/quotes`
- **Autenticación:** no requerida.
- **Content-Type:** `application/json`.
- **Fechas:** ISO 8601 en UTC.
- **Importes:** enteros en la unidad mínima de la moneda (`amountMinor`), nunca números de punto flotante.
- **Respuestas:** usan `TransformInterceptor` y `HttpExceptionFilter` del proyecto.

## 4. Catálogos del contrato

### 4.1 Tipo de solución

`solutionType` es un código de catálogo, no una etiqueta visible ni texto libre. El conjunto definitivo de valores debe ser confirmado por el equipo antes de cerrar el contrato.

Mientras esté pendiente esa decisión, el backend validará la forma del código (`UPPER_SNAKE_CASE`) y el servicio lo comprobará contra una lista versionada. No se documentarán valores ficticios como si fueran definitivos.

### 4.2 Características

Cada elemento de `options` contiene el código estable de una característica aplicable al tipo de solución. Los códigos deben:

- existir en el catálogo versionado;
- estar activos;
- ser compatibles con `solutionType`;
- no repetirse dentro de una misma solicitud.

El catálogo definitivo y su versión son una decisión pendiente del equipo. El cliente no envía nombres ni precios.

## 5. Estados

### 5.1 Estado de la cotización (`status`)

| Valor | Significado |
|---|---|
| `RECEIVED` | La solicitud fue validada y persistida correctamente. |

El Sprint 3 no incorpora estados de seguimiento comercial. Cualquier ampliación exige versionar este contrato.

### 5.2 Estado del cálculo (`pricingStatus`)

| Valor | Significado |
|---|---|
| `PENDING_RULES` | SP-01 todavía no está aprobado; no existe un monto válido. |
| `CALCULATED` | El monto fue calculado con una versión aprobada de las reglas. |

No se devuelve `0` para representar un cálculo pendiente. Cuando `pricingStatus` es `PENDING_RULES`, todos los campos monetarios y `pricingVersion` son `null`.

## 6. Endpoint público

### `POST /api/v1/public/quotes`

Registra una nueva cotización. No requiere token JWT.

#### Request (`CreatePublicQuoteDto`)

```json
{
  "solutionType": "CODIGO_DE_SOLUCION",
  "options": [
    { "code": "CODIGO_DE_CARACTERISTICA" }
  ],
  "contact": {
    "fullName": "Ana Torres",
    "email": "ana.torres@example.com",
    "phone": "+51 987 654 321",
    "company": "Empresa Ejemplo SAC"
  },
  "notes": "Necesitamos una primera versión para el cuarto trimestre."
}
```

#### Validación del payload

| Campo | Tipo | Requerido | Reglas |
|---|---|:---:|---|
| `solutionType` | `string` | Sí | Trim, 2-64 caracteres, patrón `^[A-Z][A-Z0-9_]*$`, código activo del catálogo. |
| `options` | `object[]` | Sí | Entre 1 y 20 elementos; códigos únicos y compatibles con la solución. |
| `options[].code` | `string` | Sí | Trim, 2-64 caracteres, patrón `^[A-Z][A-Z0-9_]*$`. |
| `contact.fullName` | `string` | Sí | Trim, espacios internos normalizados, 2-100 caracteres. |
| `contact.email` | `string` | Sí | Email válido, trim, minúsculas, máximo 150 caracteres. |
| `contact.phone` | `string` | Sí | Trim, 7-30 caracteres; admite dígitos, espacios y `+()-`; debe contener entre 7 y 15 dígitos. |
| `contact.company` | `string` | No | Trim, espacios internos normalizados, 2-150 caracteres. Cadena vacía se convierte en ausencia. |
| `notes` | `string` | No | Trim, máximo 1000 caracteres. Cadena vacía se convierte en ausencia. |

El objeto raíz, `contact` y cada elemento de `options` son DTOs con whitelist. No forman parte del contrato y nunca deben persistirse desde este endpoint campos como:

- `id`, `publicCode`, `status` o `pricingStatus`;
- `amountMinor`, `currency` o `pricingVersion`;
- precios, subtotales o nombres enviados dentro de una opción;
- fechas, observaciones administrativas o identificadores de usuario.

#### Respuesta `201 Created` con SP-01 pendiente

```json
{
  "success": true,
  "message": "Cotización registrada correctamente",
  "data": {
    "code": "Q-7K4M9X2P",
    "status": "RECEIVED",
    "pricingStatus": "PENDING_RULES",
    "amountMinor": null,
    "currency": null,
    "pricingVersion": null,
    "createdAt": "2026-09-16T18:30:00.000Z"
  }
}
```

#### Respuesta `201 Created` con reglas aprobadas

```json
{
  "success": true,
  "message": "Cotización registrada correctamente",
  "data": {
    "code": "Q-7K4M9X2P",
    "status": "RECEIVED",
    "pricingStatus": "CALCULATED",
    "amountMinor": 125000,
    "currency": "PEN",
    "pricingVersion": "SP-01-v1",
    "createdAt": "2026-09-16T18:30:00.000Z"
  }
}
```

Los valores monetarios del segundo ejemplo son únicamente ilustrativos de la representación técnica; no constituyen precios aprobados ni deben copiarse al motor de cálculo.

## 7. Reglas de negocio

1. El endpoint es público y no depende de una sesión.
2. Una solicitud válida crea una sola cotización y todas sus selecciones en una única transacción.
3. `code` es generado exclusivamente por el backend con entropía criptográfica; no deriva del ID, fecha, email o teléfono.
4. El formato inicial del código es `Q-` seguido de 8 caracteres aleatorios del alfabeto `ABCDEFGHJKLMNPQRSTUVWXYZ23456789`, evitando caracteres ambiguos.
5. La base de datos debe imponer unicidad sobre el código. Ante una colisión, el servicio reintenta como máximo 3 veces; si todas fallan responde `503` sin persistencia parcial.
6. La selección debe incluir al menos una característica válida y no puede contener códigos duplicados.
7. El frontend envía códigos, nunca precios. El backend resuelve nombres, compatibilidad y precios desde sus catálogos versionados.
8. El cálculo es determinista: el mismo payload normalizado y la misma versión de reglas producen el mismo resultado.
9. Si SP-01 no está aprobado, se persiste la cotización con `pricingStatus: PENDING_RULES`; no se genera un precio provisional.
10. La respuesta pública no contiene IDs internos, datos de contacto completos, reglas, costos unitarios, observaciones administrativas ni metadatos internos.
11. La implementación debe aplicar limitación de solicitudes al endpoint público. El límite concreto se definirá con la configuración de seguridad del entorno.
12. Los logs no deben registrar el cuerpo completo, email ni teléfono en texto plano.

## 8. Respuestas de error

Todas mantienen el envoltorio estándar:

```json
{
  "success": false,
  "message": ["El correo electrónico no es válido"],
  "error": "BadRequestException"
}
```

| HTTP | Error | Escenario |
|---:|---|---|
| `400` | `BadRequestException` | Forma, tipo, longitud o formato inválido; opciones vacías o duplicadas. |
| `422` | `UnprocessableEntityException` | Código de solución/opción inexistente, inactivo o incompatible con la solución. |
| `429` | `TooManyRequestsException` | Se supera el límite configurado para el endpoint. |
| `503` | `ServiceUnavailableException` | No se pudo reservar un código único después de los reintentos o la persistencia no está disponible. |
| `500` | `InternalServerError` | Error inesperado no controlado. |

No se utilizan `401` ni `403` porque el endpoint es público. Un error nunca devuelve `200` ni incluye detalles de Prisma, SQL, stack traces o datos personales.

## 9. Contrato lógico para persistencia

Esta sección es la entrega de B para que A proponga el detalle físico en Prisma. No autoriza a B a modificar `schema.prisma` ni migraciones.

La propuesta concreta de campos, tipos, relaciones, índices e invariantes para revisión de A se encuentra en [`quotes-data-model-proposal.md`](./quotes-data-model-proposal.md).

### Quote

Debe poder almacenar, como mínimo:

- identificador interno;
- código público único;
- estado de la cotización;
- tipo de solución seleccionado;
- nombre, email, teléfono y empresa opcional normalizados;
- notas opcionales;
- estado del cálculo;
- monto en unidad mínima, moneda y versión de precios, todos opcionales mientras SP-01 esté pendiente;
- fechas de creación y actualización.

### QuoteOption

Debe representar cada característica seleccionada y conservar una fotografía estable de lo cotizado:

- relación con `Quote`;
- código de opción;
- nombre visible resuelto por backend;
- orden estable;
- componentes monetarios solo cuando existan reglas aprobadas.

Debe existir una restricción única equivalente a `(quoteId, optionCode)`.

### QuoteItem

Se mantiene como entidad reservada para el desglose versionado del cálculo. Su estructura definitiva depende de SP-01. No debe crearse con semántica ficticia; A y B decidirán si la primera migración la incluye después de aprobar la fórmula.

## 10. Casos de aceptación

- Un visitante sin token envía datos válidos y recibe `201`, código único y `RECEIVED`.
- La cotización y todas las opciones quedan persistidas o ninguna queda persistida.
- Dos cotizaciones reciben códigos diferentes.
- Una colisión simulada genera un nuevo código dentro del máximo de reintentos.
- Un campo administrativo enviado por el cliente no altera el estado, código ni monto calculado por el servidor.
- Emails y teléfonos se guardan normalizados.
- Opciones repetidas, inexistentes o incompatibles son rechazadas.
- Con SP-01 pendiente se devuelve `PENDING_RULES` y valores monetarios `null`.
- Con SP-01 aprobado se guarda y devuelve `amountMinor`, `currency` y `pricingVersion` coherentes.
- La respuesta nunca expone ID interno, email, teléfono, detalles de cálculo ni metadatos administrativos.

## 11. Decisiones pendientes para aprobar el contrato

| Decisión | Responsable | Impacto |
|---|---|---|
| Catálogo definitivo de `solutionType` | Equipo/producto | Cierra validación y ejemplos reales. |
| Catálogo de opciones y compatibilidad | Equipo/producto | Cierra DTOs y persistencia de selecciones. |
| Fórmula, tabla de precios y moneda de SP-01 | Producto/Diego | Desbloquea `CALCULATED`. |
| Regla de redondeo e impuestos | Producto | Cierra resultados monetarios. |
| Límite de solicitudes por IP/ventana | Backend/infraestructura | Cierra protección antiabuso. |
| Inclusión de `QuoteItem` en la primera migración | A y B | Define el desglose físico del cálculo. |

Hasta resolver estas decisiones, el contrato de registro y persistencia puede implementarse; el catálogo real y el cálculo no deben declararse terminados.

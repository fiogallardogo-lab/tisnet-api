# Propuesta de modelo de datos para Quotes

**Sprint aprobado:** 3

**Iteración técnica del repositorio:** 5

**Responsable de la propuesta:** B - Backend de cotizaciones

**Destinatario:** A - Backend de identidad y propietario de Prisma

**Fecha:** 16 de septiembre de 2026

**Estado:** Aprobado por A con ajustes menores

**Contrato relacionado:** [`quotes-api.md`](./quotes-api.md)

---

## 1. Propósito

Esta propuesta traduce el contrato público de cotizaciones a un modelo persistente para MySQL y Prisma.

El Responsable A conserva la propiedad exclusiva de:

- `prisma/schema.prisma`;
- `prisma/migrations/**`;
- generación de Prisma Client;
- revisión e integración de este bloque dentro de la migración consolidada del Sprint 3.

El Responsable B no debe copiar esta propuesta al schema hasta que A la revise e integre.

## 2. Decisiones de diseño

1. **Código público separado del ID.** El código visible no revela el identificador incremental.
2. **Datos de contacto como snapshot.** Quote conserva los datos proporcionados al cotizar y no depende de `User` ni de un futuro `Prospect`.
3. **Opciones seleccionadas como snapshot.** `QuoteOption` guarda código y nombre resueltos por el backend. Una modificación futura del catálogo no cambia cotizaciones históricas.
4. **Desglose separado.** `QuoteItem` representa líneas producidas por el motor de precios, no características seleccionadas.
5. **Dinero exacto.** Los importes se almacenan como enteros en unidad mínima mediante `Decimal(15, 0)`. No se usa `Float`.
6. **Cálculo opcional.** Los campos monetarios permanecen en `null` mientras SP-01 no esté aprobado.
7. **Sin relación con User.** El endpoint es público y el Sprint 3 no contempla vinculación posterior con cuentas.
8. **Sin eliminación pública.** No se propone endpoint de borrado. `onDelete: Cascade` solo garantiza integridad si una operación administrativa futura elimina una Quote de forma controlada.

## 3. Bloque Prisma propuesto

> Este bloque es una propuesta para revisión. A debe incorporarlo a la única migración consolidada del Sprint.

```prisma
enum QuoteStatus {
  RECEIVED
}

enum QuotePricingStatus {
  PENDING_RULES
  CALCULATED
}

model Quote {
  id              Int                @id @default(autoincrement())
  publicCode      String             @unique @db.VarChar(20)
  status          QuoteStatus        @default(RECEIVED)
  solutionType    String             @db.VarChar(64)
  contactName     String             @db.VarChar(100)
  contactEmail    String             @db.VarChar(150)
  contactPhone    String             @db.VarChar(30)
  contactCompany  String?            @db.VarChar(150)
  notes           String?            @db.Text
  pricingStatus   QuotePricingStatus @default(PENDING_RULES)
  amountMinor     Decimal?           @db.Decimal(15, 0)
  currency        String?            @db.Char(3)
  pricingVersion  String?            @db.VarChar(50)
  createdAt       DateTime           @default(now())
  updatedAt       DateTime           @updatedAt
  options         QuoteOption[]
  items           QuoteItem[]

  @@index([status, createdAt])
  @@index([pricingStatus, createdAt])
  @@index([solutionType, createdAt])
}

model QuoteOption {
  id           Int      @id @default(autoincrement())
  quoteId      Int
  optionCode   String   @db.VarChar(64)
  optionName   String   @db.VarChar(150)
  displayOrder Int      @default(0)
  createdAt    DateTime @default(now())
  quote        Quote    @relation(fields: [quoteId], references: [id], onDelete: Cascade)

  @@unique([quoteId, optionCode])
  @@index([quoteId, displayOrder])
}

model QuoteItem {
  id           Int      @id @default(autoincrement())
  quoteId      Int
  itemCode     String   @db.VarChar(64)
  label        String   @db.VarChar(150)
  amountMinor  Decimal  @db.Decimal(15, 0)
  displayOrder Int      @default(0)
  createdAt    DateTime @default(now())
  quote        Quote    @relation(fields: [quoteId], references: [id], onDelete: Cascade)

  @@unique([quoteId, itemCode])
  @@index([quoteId, displayOrder])
}
```

## 4. Diccionario de datos

### 4.1 Quote

| Campo | Nulo | Origen | Regla |
|---|:---:|---|---|
| `id` | No | Base de datos | Identificador interno; nunca aparece en la respuesta pública. |
| `publicCode` | No | Backend | `Q-` más 8 caracteres aleatorios; único y no predecible. |
| `status` | No | Backend | Inicia en `RECEIVED`; el cliente no puede enviarlo. |
| `solutionType` | No | Request normalizado | Código estable de catálogo, máximo 64 caracteres. |
| `contactName` | No | Request normalizado | Nombre del solicitante, máximo 100 caracteres. |
| `contactEmail` | No | Request normalizado | Email en minúsculas, máximo 150 caracteres. |
| `contactPhone` | No | Request normalizado | Teléfono validado, máximo 30 caracteres. |
| `contactCompany` | Sí | Request normalizado | Empresa opcional, máximo 150 caracteres. |
| `notes` | Sí | Request normalizado | Observación del visitante, máximo 1000 caracteres validado en DTO. |
| `pricingStatus` | No | Backend | `PENDING_RULES` o `CALCULATED`. |
| `amountMinor` | Sí | PricingEngine | Total en unidad mínima de la moneda. |
| `currency` | Sí | PricingEngine | Código ISO 4217 de tres letras. |
| `pricingVersion` | Sí | PricingEngine | Versión inmutable de las reglas aplicadas. |
| `createdAt` | No | Base de datos | Fecha de recepción. |
| `updatedAt` | No | Base de datos | Fecha de la última modificación. |

### 4.2 QuoteOption

| Campo | Nulo | Origen | Regla |
|---|:---:|---|---|
| `id` | No | Base de datos | Identificador interno. |
| `quoteId` | No | Relación | Quote propietaria. |
| `optionCode` | No | Catálogo backend | Código estable, único dentro de la Quote. |
| `optionName` | No | Catálogo backend | Snapshot del nombre visible al cotizar. |
| `displayOrder` | No | Backend | Orden determinista de la selección. |
| `createdAt` | No | Base de datos | Fecha de creación. |

### 4.3 QuoteItem

| Campo | Nulo | Origen | Regla |
|---|:---:|---|---|
| `id` | No | Base de datos | Identificador interno. |
| `quoteId` | No | Relación | Quote propietaria. |
| `itemCode` | No | PricingEngine | Identificador estable de una línea de cálculo. |
| `label` | No | PricingEngine | Snapshot de la descripción de la línea. |
| `amountMinor` | No | PricingEngine | Importe firmado en unidad mínima; permite descuentos como valores negativos si SP-01 los aprueba. |
| `displayOrder` | No | PricingEngine | Orden determinista del desglose. |
| `createdAt` | No | Base de datos | Fecha de creación. |

## 5. Invariantes que debe aplicar el servicio

Prisma y MySQL no expresan por sí solos todas las reglas. B debe garantizar en la capa de servicio:

### Cuando `pricingStatus = PENDING_RULES`

- `amountMinor`, `currency` y `pricingVersion` son `null`.
- No existen registros `QuoteItem` para la cotización.

### Cuando `pricingStatus = CALCULATED`

- `amountMinor`, `currency` y `pricingVersion` son obligatorios.
- `currency` cumple `^[A-Z]{3}$`.
- Existe al menos un `QuoteItem`.
- La suma de `QuoteItem.amountMinor` coincide con `Quote.amountMinor`.
- La Quote y todo su desglose se escriben dentro de la misma transacción.

### Para toda cotización

- Existe al menos un `QuoteOption`.
- No se repite `optionCode` dentro de la misma Quote.
- Todas las opciones pertenecen al `solutionType` seleccionado.
- `publicCode` solo se expone después de confirmar la transacción.

## 6. Consideraciones técnicas para A

### Longitud de `publicCode`

El formato público aprobado `Q-XXXXXXXX` ocupa exactamente 10 caracteres. Por decisión de A, la persistencia reserva `VarChar(20)` para permitir una evolución futura sin cambiar ahora el contrato público.

### Tipo monetario

Se propone `Decimal(15, 0)` porque:

- evita errores binarios de `Float`;
- representa valores enteros en unidad mínima;
- evita los problemas de serialización JSON directa de `BigInt`;
- admite importes muy superiores a los esperados sin superar el rango seguro de enteros de JavaScript.

B convertirá `Prisma.Decimal` a `number` únicamente después de verificar que sea un entero seguro.

### Índices

- `publicCode` ya genera un índice único.
- Los índices compuestos con `createdAt` soportan listados administrativos futuros sin sobredimensionar el Sprint.
- No se propone índice sobre email o teléfono hasta que exista un caso de consulta aprobado; evita indexar datos personales sin necesidad.

### QuoteItem y SP-01

A aprobó incluir `QuoteItem` desde la primera migración para estabilizar el esquema. Mientras SP-01 esté pendiente, la tabla permanece vacía y no condiciona el registro público.

## 7. Operación transaccional esperada

La implementación de B debe efectuar conceptualmente:

1. Validar y normalizar el request.
2. Resolver `solutionType` y `options` contra el catálogo backend.
3. Ejecutar PricingEngine si existe una versión aprobada.
4. Generar un candidato para `publicCode`.
5. Crear `Quote`, `QuoteOption[]` y, si corresponde, `QuoteItem[]` en una transacción.
6. Ante una violación única exclusivamente de `publicCode`, generar otro código y reintentar hasta 3 veces.
7. No reintentar automáticamente otros errores de integridad.
8. Mapear la entidad persistida a la respuesta pública sin datos personales ni IDs internos.

## 8. Validación solicitada a A

Antes de integrar, A debe confirmar:

- que los nombres no colisionan con cambios de identidad y perfiles;
- que MySQL admite los tipos y longitudes propuestos;
- que la migración crea las FK e índices esperados;
- que `prisma validate` y `prisma generate` finalizan correctamente;
- que la migración parte de `develop` actualizado y no modifica migraciones históricas;
- que `QuoteItem` se incluya desde la primera migración y permanezca vacío hasta resolver SP-01.

## 9. Criterio de aceptación de B2

B2 queda lista para revisión cuando A recibe este documento y confirma una de estas decisiones:

1. **Aprobado:** integra el bloque sin cambios funcionales.
2. **Aprobado con ajustes:** devuelve cambios de nombres, tipos o índices y B actualiza el contrato.
3. **Bloqueado:** identifica una decisión de producto necesaria antes de crear la migración.

La tarea B2 fue aprobada con ajustes menores. No se considera integrada en código hasta que A genere el Prisma Client que B utilizará en el repositorio de Quotes.

## 10. Convención de planificación y rama

Este trabajo corresponde al Sprint 3 de la planificación SCRUM aprobada. En el historial técnico del repositorio se identifica como iteración 5, por lo que la rama acordada para B es `feature/s5-quotes-api`. Esta equivalencia debe constar en el PR y en las evidencias.

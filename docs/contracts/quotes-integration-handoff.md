# Entrega e integración del módulo Quotes

**Sprint aprobado:** 3

**Iteración técnica:** 5

**Rama de B:** `feature/s5-quotes-api`

**Estado:** módulo integrado y verificado; cálculo monetario condicionado por SP-01

## 1. Entregables disponibles

- Contrato público en `docs/contracts/quotes-api.md`.
- Propuesta de persistencia aprobada en `docs/contracts/quotes-data-model-proposal.md`.
- DTOs anidados y validaciones en `src/quotes/dto`.
- Normalización, estados y generación de códigos en `src/quotes/domain`.
- Puerto del catálogo en `src/quotes/catalog/quote-catalog.ts`.
- Catálogo aprobado v1 en `src/quotes/catalog/quotes-catalog-v1.ts`.
- Puerto de persistencia en `src/quotes/repositories/quote.repository.ts`.
- Interfaz del motor de precios en `src/quotes/pricing/pricing-engine.ts`.
- Mapper seguro de respuesta en `src/quotes/mappers/public-quote.mapper.ts`.
- Servicio, controlador Swagger y pruebas unitarias en `src/quotes`.

## 2. Integración completada con A

La integración con el bloque Prisma entregado por A quedó completada:

1. Prisma Client expone `quote`, `quoteOption`, `quoteItem`, `QuoteStatus` y `QuotePricingStatus` con los nombres acordados.
2. `PrismaQuoteRepository` implementa `QuoteRepository` y crea `Quote`, `QuoteOption[]` y `QuoteItem[]` mediante una única transacción.
3. La conversión de `Prisma.Decimal` a `number` exige un entero seguro.
4. Solo la colisión única de `publicCode` se convierte en `QuoteCodeCollisionError`; los demás errores conservan su naturaleza.
5. `QuotesModule` proporciona `QUOTE_REPOSITORY`, `QUOTE_CATALOG` y `QUOTE_CODE_GENERATOR`.
6. `AppModule` registra `QuotesModule` con `quotesCatalogV1`.
7. La migración consolidada se aplicó correctamente en la base aislada `tisnet_test`.
8. Lint, pruebas unitarias, build y pruebas E2E finalizaron correctamente el 17 de septiembre de 2026.

## 3. Contrato de la transacción

La implementación de `QuoteRepository.create()` debe cumplir:

- Commit completo de Quote y todas sus selecciones, o rollback completo.
- Con `PENDING_RULES`, campos monetarios `null` y cero `QuoteItem`.
- Con `CALCULATED`, moneda, versión, total e items obligatorios.
- Restricción única `(quoteId, optionCode)`.
- Restricción única `(quoteId, itemCode)`.
- El código público solo se devuelve después de confirmar la transacción.

## 4. Matriz E2E preparada

| Caso | HTTP esperado | Persistencia esperada |
|---|---:|---|
| Payload válido sin token | `201` | Quote y opciones completas. |
| Campos administrativos o desconocidos | `400` | Sin escritura. |
| DTO o teléfono inválido | `400` | Sin escritura. |
| Opciones vacías o duplicadas | `400` | Sin escritura. |
| Solución u opción desconocida | `422` | Sin escritura. |
| Opción incompatible | `422` | Sin escritura. |
| Dos colisiones y tercer código libre | `201` | Una sola Quote con el tercer código. |
| Tres colisiones | `503` | Sin escritura parcial. |
| Fallo al crear una opción | `500` controlado | Rollback de Quote y opciones. |
| SP-01 pendiente | `201` | `PENDING_RULES`, monetarios `null`, items vacíos. |

La cobertura se reparte entre pruebas unitarias del servicio, repositorio, DTOs, interceptor, generador y mapper, más pruebas E2E contra una base aislada. La ejecución verificada obtuvo 115 pruebas unitarias y 106 pruebas E2E aprobadas.

## 5. Integración para C

### Request

```ts
export interface CreatePublicQuoteRequest {
  solutionType: string;
  options: Array<{ code: string }>;
  contact: {
    fullName: string;
    email: string;
    phone: string;
    company?: string;
  };
  notes?: string;
}
```

### Response

```ts
export interface CreatePublicQuoteResponse {
  success: true;
  message: string;
  data: {
    code: string;
    status: 'RECEIVED';
    pricingStatus: 'PENDING_RULES' | 'CALCULATED';
    amountMinor: number | null;
    currency: string | null;
    pricingVersion: string | null;
    createdAt: string;
  };
}
```

### Reglas para frontend

- Consumir `POST /api/v1/public/quotes` sin token.
- Enviar códigos del catálogo; nunca enviar precios, estados ni campos administrativos.
- No recalcular precios en frontend.
- Con `PENDING_RULES`, mostrar el código y un mensaje de cálculo pendiente; no mostrar cero ni un monto ficticio.
- Tratar `400` como error de formulario, `429` como exceso de solicitudes y `503` como indisponibilidad temporal.
- Tratar `422` como selección de catálogo desconocida, inactiva o incompatible.

### Mock permitido mientras SP-01 está pendiente

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

El mock debe permanecer detrás de una bandera explícita y retirarse cuando la API real esté integrada.

## 6. Seguridad y decisiones de infraestructura pendientes

- Definir el límite por IP y ventana con backend/infraestructura.
- Aplicar límite de tamaño del body en la configuración global.
- Evitar cuerpo completo, email y teléfono en logs.
- El mapper público ya es la única salida del servicio y tiene pruebas que impiden exponer IDs o datos de contacto.
- No agregar CAPTCHA ni verificación de correo sin una decisión de alcance.

## 7. Decisión bloqueante restante

- SP-01 debe aprobar fórmula, tabla de precios, moneda y redondeo antes de registrar una implementación productiva de `PricingEngine` y habilitar `CALCULATED`.

El catálogo versionado, sus compatibilidades y la integración Prisma ya están resueltos. Mientras SP-01 continúe pendiente, el comportamiento aprobado es persistir la cotización con `PENDING_RULES`, campos monetarios en `null` y sin `QuoteItem`.

## 8. Estado de actividades del Responsable B

| Actividad | Estado | Evidencia |
|---|---|---|
| B1. Contrato de Quote | Completada | `docs/contracts/quotes-api.md` |
| B2. Propuesta de datos | Completada e integrada por A | `docs/contracts/quotes-data-model-proposal.md` y migración consolidada |
| B3. POST público | Completada | `POST /api/v1/public/quotes` |
| B4. Validación y normalización | Completada | DTOs, normalizador, catálogo e interceptor de campos desconocidos |
| B5. Código único | Completada | Generador criptográfico, índice único y hasta tres intentos ante colisión |
| B6. Persistencia transaccional | Completada | `PrismaQuoteRepository` |
| B7. Motor de precios | Completada hasta el límite aprobado | Interfaz pura y versionable lista; implementación productiva condicionada por SP-01 |
| B8. Pruebas | Completada para el alcance no bloqueado | Unitarias y E2E aprobadas |
| B9. Swagger y ejemplos para C | Completada | Decoradores Swagger, contrato y sección de integración frontend |

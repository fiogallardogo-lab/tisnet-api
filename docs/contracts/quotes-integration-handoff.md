# Entrega e integración del módulo Quotes

**Sprint aprobado:** 3

**Iteración técnica:** 5

**Rama de B:** `feature/s5-quotes-api`

**Estado:** lógica independiente terminada; persistencia y catálogo pendientes

## 1. Entregables disponibles

- Contrato público en `docs/contracts/quotes-api.md`.
- Propuesta de persistencia aprobada en `docs/contracts/quotes-data-model-proposal.md`.
- DTOs anidados y validaciones en `src/quotes/dto`.
- Normalización, estados y generación de códigos en `src/quotes/domain`.
- Puerto del catálogo en `src/quotes/catalog/quote-catalog.ts`.
- Puerto de persistencia en `src/quotes/repositories/quote.repository.ts`.
- Interfaz del motor de precios en `src/quotes/pricing/pricing-engine.ts`.
- Mapper seguro de respuesta en `src/quotes/mappers/public-quote.mapper.ts`.
- Servicio, controlador Swagger y pruebas unitarias en `src/quotes`.

## 2. Integración pendiente con A

Cuando A entregue su commit, B debe:

1. Actualizar la rama desde el commit habilitante de A.
2. Confirmar que Prisma Client expone `quote`, `quoteOption`, `quoteItem`, `QuoteStatus` y `QuotePricingStatus` con los nombres acordados.
3. Implementar `PrismaQuoteRepository` detrás de `QuoteRepository`.
4. Crear `Quote`, `QuoteOption[]` y `QuoteItem[]` mediante una única transacción.
5. Convertir `Prisma.Decimal` a `number` solo después de comprobar `Number.isSafeInteger`.
6. Mapear exclusivamente la colisión única de `publicCode` a `QuoteCodeCollisionError`.
7. No convertir otras restricciones, errores de conexión o fallos transaccionales en colisiones.
8. Proporcionar `QUOTE_REPOSITORY`, `QUOTE_CATALOG` y `QUOTE_CODE_GENERATOR` desde `QuotesModule`.
9. Solicitar a A el registro de `QuotesModule` en `AppModule`.
10. Ejecutar migración, pruebas HTTP y E2E contra una base aislada.

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

Estas pruebas se implementarán cuando exista Prisma Client y una base aislada. No se agregan pruebas omitidas artificialmente a la suite actual.

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

## 6. Seguridad pendiente

- Definir el límite por IP y ventana con backend/infraestructura.
- Aplicar límite de tamaño del body en la configuración global.
- Evitar cuerpo completo, email y teléfono en logs.
- Mantener el mapper público como única salida del servicio.
- No agregar CAPTCHA ni verificación de correo sin una decisión de alcance.

## 7. Decisiones bloqueantes

- Catálogo versionado real de `solutionType` y `optionCode`.
- Compatibilidad entre soluciones y opciones.
- Commit de Prisma, migración y cliente generado por A.
- SP-01 para habilitar `CALCULATED`.

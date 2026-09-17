# Contrato API del módulo Quotes - Cotización pública

**Versión del contrato:** Sprint 3 - SP-01-v2 Aprobado

**Fecha de actualización:** 17 de septiembre de 2026

**Ámbito:** Backend (`tisnet-api`) y formulario público (`tisnet-web`)

**Estado:** SP-01-v2 aprobado con cálculo determinista de precios en céntimos PEN.

**Iteración técnica del repositorio:** 5 (`feature/s5-quotes-api`)

---

## 1. Objetivo

Permitir que un visitante solicite una cotización sin crear una cuenta. La API valida los datos de contacto y la selección, registra la cotización de forma transaccional y devuelve un código público único (`Q-XXXXXXXX`) con el estado del cálculo y el desglose de precios cuando aplique.

Este contrato define:

- **Cotización con regla aprobada (`pricingStatus: CALCULATED`):** Cuando la solución y las opciones seleccionadas pertenecen al catálogo tarifado SP-01-v2, se calcula el precio en céntimos PEN y se persiste el total junto a su desglose (`QuoteItem`).
- **Cotización reconocida sin regla (`pricingStatus: PENDING_RULES`):** Cuando la categoría está reconocida en el contrato pero carece de tarifa aprobada (ej. `MOBILE_APP`, `CUSTOM_SOFTWARE`) o no existe motor de precios, se persiste con `amountMinor: null`, `currency: null` y `pricingVersion: null`.

No se asignan precios por equivalencia ni se inventan importes no aprobados.

## 2. Alcance

### Incluido

- Endpoint público para registrar una cotización.
- Catálogo SP-01-v2 de soluciones y características adicionales (extras).
- Modalidad de entrega del proyecto (`deliveryMode`).
- Datos básicos de contacto y validación estricta de teléfono.
- Normalización y validación del payload (rechazo de campos desconocidos).
- Código público único y no predecible (`Q-XXXXXXXX`).
- Motor determinista `Sp01V2PricingEngine` en céntimos PEN con redondeo simétrico (`roundHalfAwayFromZero`).
- Desglose estructurado persistido en `QuoteItem`:
  - `BASE`: Solución base.
  - `EXTRA`: Adicionales seleccionados.
  - `DELIVERY_ADJUSTMENT`: Ajuste por modalidad.
- Respuesta pública sin identificadores internos ni datos sensibles.

### Fuera de alcance (Responsable B)

- Modificación de `prisma/schema.prisma`, migraciones de Prisma o seeds (propiedad exclusiva de Responsable A).
- Creación de usuarios o cuentas vinculadas.
- Envío de correos o notificaciones automáticas.

## 3. URL y convenciones

- **Base URL local:** `http://localhost:3000/api/v1`
- **Endpoint:** `POST /api/v1/public/quotes`
- **Autenticación:** no requerida (público).
- **Content-Type:** `application/json`.
- **Fechas:** ISO 8601 en UTC.
- **Moneda:** `PEN` (Soles peruanos).
- **Importes:** enteros en céntimos (`amountMinor`), nunca números de punto flotante.

---

## 4. Catálogos del contrato SP-01-v2

### 4.1 Tipos de solución (`solutionType`)

| Código | Nombre visible | Precio base (`amountMinor`) | Equivalente S/ | Estado SP-01-v2 |
|---|---|:---:|:---:|:---:|
| `LANDING_PAGE` | Landing page | 85000 | S/ 850.00 | Aprobado |
| `CORPORATE_SITE` | Sitio web corporativo | 180000 | S/ 1,800.00 | Aprobado |
| `ECOMMERCE` | Tienda virtual (E-commerce) | 320000 | S/ 3,200.00 | Aprobado |
| `PERSONAL_PORTFOLIO` | Portafolio profesional | 140000 | S/ 1,400.00 | Aprobado |
| `WEB_APP` | Aplicación web | 580000 | S/ 5,800.00 | Aprobado |
| `SAAS_PLATFORM` | Plataforma SaaS | 760000 | S/ 7,600.00 | Aprobado |
| `MOBILE_APP` | Aplicación móvil | *Sin precio* | — | Reconocida (`PENDING_RULES`) |
| `CUSTOM_SOFTWARE` | Software a medida | *Sin precio* | — | Reconocida (`PENDING_RULES`) |

Cualquier código fuera de los reconocidos responderá con `422 UnprocessableEntityException`.

### 4.2 Características adicionales / Extras (`options`)

| Código | Descripción | Precio (`amountMinor`) | Equivalente S/ | Compatibilidad |
|---|---|:---:|:---:|---|
| `SEO_ADVANCED` | SEO avanzado y posicionamiento | 45000 | S/ 450.00 | Todos los tipos |
| `CUSTOM_CMS` | Panel autoadministrable a medida (CMS) | 70000 | S/ 700.00 | Todos los tipos |
| `ADVANCED_ANALYTICS` | Analítica avanzada y eventos | 35000 | S/ 350.00 | Todos los tipos |
| `HOSTING_1Y` | Alojamiento cloud y dominio por 1 año | 28000 | S/ 280.00 | Todos los tipos |
| `MULTILINGUAL` | Soporte multiidioma | 95000 | S/ 950.00 | Todos los tipos |
| `MAINTENANCE_6M` | Mantenimiento y soporte técnico por 6 meses | 65000 | S/ 650.00 | Todos los tipos |
| `LEAD_AUTOMATION` | Automatización de captación de leads | 78000 | S/ 780.00 | Todos los tipos |
| `COMMERCIAL_CRM` | Integración con CRM comercial | 92000 | S/ 920.00 | Todos los tipos |

### 4.3 Modalidades de entrega (`deliveryMode`)

| Código | Nombre visible | Factor de ajuste | Efecto económico |
|---|---|:---:|---|
| `NORMAL` | Entrega estándar | `0%` | Sin variación de precio (por defecto si se omite) |
| `URGENT` | Entrega urgente | `+30%` | Recargo del 30% sobre el subtotal |
| `FLEXIBLE` | Entrega flexible | `-10%` | Descuento del 10% sobre el subtotal |

---

## 5. Fórmula y Reglas de Cálculo SP-01-v2

```
subtotalMinor = baseMinor + suma(extrasMinor)
adjustmentMinor = roundHalfAwayFromZero((subtotalMinor * tasaPorcentaje) / 100)
totalMinor = subtotalMinor + adjustmentMinor
```

### Redondeo Simétrico (`roundHalfAwayFromZero`)
Para garantizar consistencia matemática tanto en recargos positivos (`+30%`) como en descuentos negativos (`-10%`), cualquier mitad fraccionaria (`.5`) se redondea alejándose de cero:
- `+2.5 => +3`
- `-2.5 => -3`

### Desglose de Ítems (`QuoteItem`)
1. **Línea `BASE`:** Precio base de la solución (`amountMinor = baseMinor`).
2. **Línea `EXTRA`:** Suma agregada de los adicionales seleccionados (`amountMinor = suma(extrasMinor)`).
3. **Línea `DELIVERY_ADJUSTMENT`:** Ajuste según modalidad (`amountMinor = adjustmentMinor`, firmado: positivo, negativo o cero).

Invariante obligatoria: `BASE.amountMinor + EXTRA.amountMinor + DELIVERY_ADJUSTMENT.amountMinor === totalMinor`.

---

## 6. Endpoint público

### `POST /api/v1/public/quotes`

#### Request (`CreatePublicQuoteDto`)

```json
{
  "solutionType": "ECOMMERCE",
  "options": [
    { "code": "SEO_ADVANCED" },
    { "code": "ADVANCED_ANALYTICS" }
  ],
  "deliveryMode": "URGENT",
  "contact": {
    "fullName": "Beatriz Echevarría",
    "email": "beatriz@example.com",
    "phone": "+51 987 654 321",
    "company": "Comercial Ejemplo SAC"
  },
  "notes": "Requerimos entrega prioritaria antes de fin de mes."
}
```

#### Validación del payload

| Campo | Tipo | Requerido | Reglas |
|---|---|:---:|---|
| `solutionType` | `string` | Sí | Trim, mayúsculas, código activo del catálogo. |
| `options` | `object[]` | Sí | Entre 1 y 20 elementos; códigos únicos y compatibles sin repetición. |
| `options[].code` | `string` | Sí | Trim, mayúsculas, código activo del catálogo. |
| `deliveryMode` | `string` | No | `NORMAL`, `URGENT`, `FLEXIBLE`. Por defecto `NORMAL` si se omite. |
| `contact.fullName` | `string` | Sí | 2-100 caracteres, espacios colapsados. |
| `contact.email` | `string` | Sí | Email RFC 5322 válido, normalizado a minúsculas, máx 150 caracteres. |
| `contact.phone` | `string` | Sí | 7-30 caracteres, entre 7 y 15 dígitos numéricos obligatorios. |
| `contact.company` | `string` | No | 2-150 caracteres. |
| `notes` | `string` | No | Máximo 1000 caracteres. |

Cualquier campo desconocido (ej. `status`, `amountMinor`, etc.) es rechazado inmediatamente con `400 Bad Request`.

#### Respuesta `201 Created` - Cálculo SP-01-v2 exitoso

```json
{
  "success": true,
  "message": "Cotización registrada correctamente",
  "data": {
    "code": "Q-7K4M9X2P",
    "status": "RECEIVED",
    "pricingStatus": "CALCULATED",
    "amountMinor": 520000,
    "currency": "PEN",
    "pricingVersion": "SP-01-v2",
    "createdAt": "2026-09-17T17:30:00.000Z"
  }
}
```

#### Respuesta `201 Created` - Categoría reconocida sin regla (`PENDING_RULES`)

```json
{
  "success": true,
  "message": "Cotización registrada correctamente",
  "data": {
    "code": "Q-9M2K8P3X",
    "status": "RECEIVED",
    "pricingStatus": "PENDING_RULES",
    "amountMinor": null,
    "currency": null,
    "pricingVersion": null,
    "createdAt": "2026-09-17T17:30:00.000Z"
  }
}
```

---

## 7. Dependencia Técnica con el Responsable A

| Campo | Modelo | Tipo Prisma | Nulabilidad / Default | Justificación técnica |
|---|---|---|---|---|
| `deliveryMode` | `Quote` | `String @db.VarChar(20)` | `String?` o `@default("NORMAL")` | Persistir la modalidad directamente en la entidad raíz `Quote` para facilitar consultas administrativas, reportes y dashboards sin necesidad de consultar el desglose de `QuoteItem`. |

*Nota de implementación:* Mientras el Responsable A integra la columna en Prisma, la modalidad queda registrada y respaldada financieramente en la tabla `QuoteItem` bajo el código `DELIVERY_ADJUSTMENT`.

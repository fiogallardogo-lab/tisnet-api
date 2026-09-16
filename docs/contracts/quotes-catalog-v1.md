# Catálogo de Quotes v1

**Versión:** `quotes-catalog-v1`  
**Alcance:** Sprint 3 / iteración técnica 5  
**Estado:** Aprobado por el Product Owner para el flujo inicial  
**Fecha:** 16 de septiembre de 2026

Este catálogo define únicamente soluciones, características, compatibilidades y orden de presentación. No define precios, impuestos ni descuentos; esas reglas siguen bloqueadas por SP-01.

## Soluciones

| Código | Nombre visible | Activa |
|---|---|:---:|
| `WEB_APP` | Aplicación web | Sí |
| `MOBILE_APP` | Aplicación móvil | Sí |
| `CUSTOM_SOFTWARE` | Software a medida | Sí |

## Opciones y compatibilidad

| Código | Nombre visible | Compatibles | Orden | Activa |
|---|---|---|---:|:---:|
| `AUTHENTICATION` | Autenticación y roles | `WEB_APP`, `MOBILE_APP`, `CUSTOM_SOFTWARE` | 1 | Sí |
| `ADMIN_PANEL` | Panel administrativo | `WEB_APP`, `CUSTOM_SOFTWARE` | 2 | Sí |
| `REPORTS` | Reportes y exportaciones | `WEB_APP`, `MOBILE_APP`, `CUSTOM_SOFTWARE` | 3 | Sí |
| `INTEGRATIONS` | Integraciones con servicios externos | `WEB_APP`, `MOBILE_APP`, `CUSTOM_SOFTWARE` | 4 | Sí |
| `DEPLOYMENT` | Despliegue y puesta en producción | `WEB_APP`, `MOBILE_APP`, `CUSTOM_SOFTWARE` | 5 | Sí |

## Reglas aprobadas

- El visitante debe seleccionar una solución activa.
- Debe seleccionar al menos una opción activa.
- Una opción no puede repetirse.
- La opción debe ser compatible con la solución elegida.
- El backend recibe y persiste códigos; resuelve los nombres desde esta versión del catálogo.
- El catálogo no contiene precios y no habilita `CALCULATED`.
- Las solicitudes con códigos que no existan, estén inactivos o sean incompatibles responden `422`.

## Aprobación del Product Owner

El Product Owner del proyecto aprueba `quotes-catalog-v1` para el flujo inicial de cotización pública. Esta aprobación cubre exclusivamente los códigos, nombres, estados, compatibilidades y orden indicados arriba; no constituye aprobación de precios ni de SP-01.

La implementación correspondiente está en `src/quotes/catalog/quotes-catalog-v1.ts` y debe inyectarse mediante `QuotesModule.register({ catalog: quotesCatalogV1 })`.

# Registro de equipo y cotización SP-01-v2

El frontend ofrece `/team/join` para Developer y Product Owner. La postulación no crea una cuenta ni concede permisos automáticamente.

## API de postulaciones

`POST /api/v1/public/team-applications`, multipart/form-data:

- `requestedRole`: DEVELOPER o PRODUCT_OWNER.
- `fullName`, `age`, `district`, `email`, `phone`, `dni`, `career`, `university`, `experienceYears`, `programmingLanguages`.
- `specialty`: BACKEND, FRONTEND o FULL_STACK.
- `cv`: PDF no vacío, hasta 5 MB.
- `photo`: JPG, PNG o WebP no vacío, hasta 5 MB.
- `consent`: true.

Respuesta: `{ "success": true, "data": { "code": "TEAM-12345678" } }`.

Implementado en `C:/Users/hp/tisnet-api/src/public-intake`. El servidor valida los campos y firmas de archivos, guarda CV y foto como blobs privados en MySQL, persiste la postulación y rechaza duplicados de correo o DNI con HTTP 409. La selección pública del rol expresa una postulación; asignar permisos queda a cargo del proceso interno. Estado inicial: PENDING_REVIEW. No se publican enlaces a los archivos ni se crean usuarios automáticamente.

## API de cotizaciones

El POST existente `/public/project-quotes` incorpora `catalogVersion: SP-01-v2` y `deliveryMode: NORMAL | URGENT | FLEXIBLE`. Tipos web: LANDING_PAGE, CORPORATE_SITE, ECOMMERCE, PERSONAL_PORTFOLIO, WEB_APP, SAAS_PLATFORM. `options` contiene cero a ocho extras únicos del catálogo en `src/features/quotes/catalog.ts`. MOBILE_APP y CUSTOM_SOFTWARE requieren evaluación comercial y no tienen precio automático.

El navegador muestra una estimación referencial en céntimos. La respuesta y el comprobante siguen usando exclusivamente el precio confirmado por API. El backend valida compatibilidad, recalcula y persiste base, extras, ajuste, total, moneda PEN, versión y alcance incluido en la tabla PublicQuote. No confía en montos proporcionados por un cliente.

Casos de referencia: e-commerce + SEO + analytics = S/ 4,000 normal; S/ 5,200 urgente; S/ 3,600 flexible. Landing + SEO + analytics = S/ 1,650 normal. No se añade IGV ni se inventan multiplicadores de plazos. Impuestos y fecha final requieren confirmación comercial.

La demostración se habilita exclusivamente en desarrollo con VITE_SPRINT3_MOCKS=true. No sustituye la persistencia de producción.

## Verificación local

Con la API en localhost:3000 y MySQL accesible según .env:

```powershell
node --env-file=.env scripts/verify-public-intake.cjs
```

Comprueba endpoints HTTP, montos recalculados, registros y bytes de CV/foto en MySQL, duplicados y entradas inválidas. Elimina únicamente los registros sintéticos creados por esa ejecución. La migración es aditiva y no modifica las tablas existentes.

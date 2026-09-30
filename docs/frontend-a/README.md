# Frontend A — Contratos Cliente y Developer

**Corte verificado: 30/09/2026 · backend 0ef120d · base /api/v1.**

Entrega utilizable para mocks. Se revisaron controladores, DTO, servicios, permisos y serialización; no se cambió comportamiento del backend. Las operaciones implementadas están disponibles en código en develop en esta fecha. No se proporcionó URL/versionado de staging: su disponibilidad desplegada no está confirmada. Ningún endpoint faltante tiene fecha comprometida.

## Archivos

| Archivo | Uso |
| --- | --- |
| swagger.backend.json | Snapshot del Swagger generado por Nest: 124 rutas. Conserva limitaciones de las anotaciones originales. |
| swagger.frontend-a.json | OpenAPI 3.0.3 revisado: 48 operaciones existentes, esquemas de request/response, binarios, ejemplos, permisos/estados y errores. Importable en Swagger Editor/Postman. |
| contracts.ts | Tipos autónomos sin Nest/Prisma para Cliente, Developer y funcionalidades auditadas. Namespace Proposed separado para lo que aún no existe. |
| operations.json / OPERACIONES.md | Ficha de cada operación: método/ruta, request/response completos de ejemplo, roles, estados, errores y disponibilidad. |
| fixtures.ts | Ejemplos comprobados con satisfies y compilación TypeScript estricta. |
| mock-data.json / mock-fetch.ts | Respuestas por operationId y transporte local con escenarios configurables. Nunca hace fallback a red. |
| mock-document.pdf | PDF sintético válido, claramente marcado como mock. |
| PENDIENTES.md | Funcionalidades ausentes, contratos propuestos y decisiones sin fecha confirmada. |

Swagger de una API iniciada: **{API_ORIGIN}/api/docs**, JSON **{API_ORIGIN}/api/docs-json**. API_ORIGIN debe venir del entorno; no se afirma que localhost o un staging estén en ejecución. Para mocks usar el OpenAPI revisado; el snapshot original por sí solo no documenta todos los cuerpos de respuesta.

## Mapa de pantallas

| Pantalla/pestaña | Fuente actual | Cliente | Developer |
| --- | --- | --- | --- |
| Sesión | GET /auth/me | Sí | Sí |
| Datos completos del usuario | GET /users/me/profile | Sí | Sí |
| Dashboard | GET /client/overview | Agregado disponible | No permitido |
| Dashboard Developer | GET /workspace/projects + profile + /reports/projects | No permitido | Composición local disponible; dashboard agregado de tareas/reuniones no existe |
| Mis cotizaciones | overview.quotes | Sí, propias | Sin acceso al portal Cliente |
| Acuerdo/aceptación | /client/quotes/{id}/agreement y /accept | Sí, propietario vinculado | 403 |
| PDF cotización | GET /quotes/{code}/pdf | Email de contacto coincidente | El guard actual permite cualquier rol con email coincidente; no es un permiso general de Developer |
| Mis proyectos | overview.projects / workspace/projects | Primer origen | Segundo origen |
| Resumen de proyecto / kickoff / hitos | GET /projects/{id}/operations | Miembro activo | Miembro activo; sin finanzas |
| Equipo | GET /projects/{id}/members | Lectura | Lectura |
| Entregables / historial | /projects/{projectId}/deliverables | Lee/revisa | Lee/envía; no revisa |
| Contribuciones | /projects/{projectId}/contributions y por entregable | Lectura | Lectura; escritura reservada a PO/Admin |
| Reporte de avance | GET /reports/projects?projectId=11 | Finanzas propias | Sin finanzas |
| Informe de trazabilidad | /reports/projects/{projectId}/report?format=json o pdf | Sí | Sí |
| Reuniones | overview.meetings; POST /client/meetings; PATCH cancel | Propias | Solo estado de kickoff dentro de operations; agenda general ausente |
| Tareas / recursos | Sin endpoint específico | Mock propuesto | Mock propuesto |
| Perfil | PATCH /users/me + perfil del rol | CLIENT | DEVELOPER |
| Foto de perfil | POST /users/me/photo | Actualmente 400, no soportada | JPG/PNG/WebP hasta5MiB |

**No usar GET /projects ni GET /projects/{id} como endpoints del portal:** son administrativos. PATCH /projects/{id} permite Developer miembro activo editar ciertos datos descriptivos, pero impide status/isFeatured; es una operación distinta del detalle operativo. El snapshot general documenta su DTO administrativo completo; no se recomienda usarla para implementar tareas o reporte de avance.

## Convenciones confirmadas y acuerdo propuesto para frontend

### Autenticación

Bearer JWT en Authorization: Bearer <accessToken>. Login devuelve accessToken, refreshToken y user{id,email,role}. /auth/me devuelve solo id,email,role: **no name, profile ni permisos de proyecto**. Buscar nombre/foto en /users/me/profile.

Access token: JWT_EXPIRATION, predeterminado15m; refresh: JWT_REFRESH_EXPIRATION, predeterminado7d. Usar exp del token/configuración efectiva, no hardcodear duraciones. POST /auth/refresh lleva {refreshToken} y devuelve solo nuevo accessToken; no rota refresh. Logout incrementa tokenVersion y revoca todas las sesiones de la cuenta. Cuenta inactiva/revocada produce401. Reintentar una vez tras refresh y cerrar sesión si vuelve a fallar; no refrescar en403.

El backend actual no usa cookie de sesión HttpOnly ni exige credentials:include; CORS permite Authorization/Content-Type y orígenes configurados en FRONTEND_URL. Propuesta para frontend: mantener tokens en memoria; cualquier persistencia de refresh debe acordarse por separado. No incluir tokens en logs/URLs. Autorización real: servidor, no claims/menu únicamente.

### Respuestas, errores y estados HTTP

JSON normal: {success:true,message:string,data:T}. Error: {success:false,message:string|string[],error:string}. Un 500 usa INTERNAL_SERVER_ERROR y mensaje genérico. message puede ser arreglo de validaciones. Los mocks tienen valores sintéticos y no contienen claves reales.

GET/PATCH responden normalmente200; POST201 salvo login/refresh/logout200. Las rutas POST de revisión responden **201**, aunque la anotación de milestones anuncie200. PDF de cotización y reportes: **application/pdf**, Blob binario sin envelope. Descargar usando fetch autenticado, comprobar response.ok y content-type antes de blob(); revocar objectURL después. CORS no expone Content-Disposition actualmente: usar nombre local de respaldo. Sin format, informe de Cliente devuelve PDF y el de Developer devuelve JSON; enviar format explícito.

Base de errores por operación en OPERACIONES.md; 429 puede aparecer por throttling. Los mocks permiten probar400/401/403/404/409/413/422/429/503. No convertir automáticamente404 en lista vacía: algunas rutas lo usan para recurso ajeno o estado no cancelable.

### Paginación y filtros

Los agregados Cliente, proyectos asignados, operaciones, entregables, historial, observaciones, contribuciones e informes **no tienen paginación backend**. No enviar page/limit suponiendo que funcionen; no existe meta global. /client/overview.activity está limitado a los últimos30 eventos. /workspace/projects excluye ARCHIVED y /reports/projects excluye DRAFT/ARCHIVED.

Acuerdo propuesto: mientras se consume lo existente, filtro/paginación visual local sobre el arreglo, identificado como tal. Para tareas/recursos futuros se propone {items,page,limit,totalItems,totalPages}; es una propuesta, no contrato implementado. No mezclarla con las listas actuales.

### Identificadores, montos y fechas

- IDs de recursos: números. overview.quotes[].id es la excepción: texto quote-41. Extraer41 con validación; no enviar quote-41 a ParseIntPipe.
- PDF usa publicCode/code, p.ej.Q-ABCDEFGH. La aceptación usa versionId=ID persistido, **no** version=ordinal. Buscar la versión cuyo version===activeVersion.
- Rutas de entregables admiten fallback por milestoneId/orden; las contribuciones hacen OR entre identificadores. Para reducir ambigüedad, usar entregable.id y las rutas /deliverables/. Existe riesgo de colisión en resolución de contribuciones; queda documentado para backend.
- amountMinor es número en agreement/publicQuote/financialStatus, texto o null en overview.quotes y en importes Prisma de operations. Tipos separados preservan esto. Moneda acompaña importe; no concatenar ni sumar textos. Un sol=PEN100 unidades menores. percentage=0..100; participationBasisPoints=0..10000.
- Instantes JSON: ISO8601. Enviar reuniones con offset explícito, p.ej.2026-10-01T10:00:00-05:00; renderizar America/Lima. PENDING es solicitud, no confirmación de Calendly.
- Fechas civiles YYYY-MM-DD: no convertir a hora local que pueda mover el día. Cliente usa fechas civiles en tarjetas; workspace/projects devuelve ISO completo; agreement mezcla installments[].dueDate ISO y versions[].installments[].dueDate civil. Normalizar solo en el adaptador visual.
- Recordatorio: tres días hábiles siguientes al evento en Lima, feriados nacionales y corte aprobado. No inventar una hora productiva. Su vencimiento no sustituye la fecha contractual de cuota.

### Archivos

| Operación | Campo multipart | MIME | Máximo real |
| --- | --- | --- | --- |
| POST /users/me/photo | photo | image/jpeg, image/png, image/webp | 5×1024×1024 bytes |
| POST .../deliverables/{id}/files | file | application/pdf, video/mp4, video/webm | 100×1024×1024 bytes |
| POST .../evidence y .../evidence/pdf | file (o pdfUrl JSON) + videoUrl | application/pdf si archivo | 50×1024×1024 bytes |

No fijar Content-Type al enviar FormData; el navegador aporta boundary. videoUrl/fileUrl/pdfUrl máximo500 caracteres; notes/comments máximo2000. La subida genérica devuelve URL/key y **no cambia el estado**; después enviar evidence. La subida de foto no está soportada para Cliente. No existe subida de CV de Developer autenticado: el perfil acepta cvUrl, la carga de CV de postulación pública pertenece a otro flujo.

No hay endpoint general de descarga protegida de evidencias en el router auditado. Una URL devuelta por el storage memory/disk no prueba que esté publicada o protegida en el entorno. No dar por validado streaming, autorización de descarga, validación de firma de archivo ni proveedor de video: requieren cierre con B.

## Reglas y discrepancias que los mocks deben conservar

1. Revisar: Cliente/PO/Admin; enviar: Developer/PO/Admin; crear entregable: PO/Admin. Un Developer no puede aprobar su entrega.
2. DRAFT/OBSERVED → IN_REVIEW → APPROVED u OBSERVED. Reenviar una observación es válido; no aprobar desde DRAFT. El DTO legacy permite omitir decision/status y el servicio termina aprobando: **no usar ese comportamiento**. El tipo revisado exige decision explícito; endurecer el DTO sigue pendiente.
3. /submit es legacy y acepta una sola evidencia; /evidence exige PDF+video. Usar la segunda en frontend nuevo.
4. Contrato actual agreement toma la versión más reciente para su cabecera; versions[].installments marca PAID si existe algún pago, incluso parcial. Para cierre/saldo exacto usar /financial-status. No deducir pago completo a partir de esa etiqueta legacy.
5. Contribuciones actuales devuelven correos de integrantes a los usuarios autorizados del proyecto; informes de trazabilidad los omiten. El paquete refleja ambas respuestas; no hacer públicos esos correos ni guardarlos en analytics.
6. No existe NO_SHOW en MeetingStatus de Prisma. No inventarlo como enum de la agenda Cliente; evento externo/auditoría es distinto.
7. Presentación legal real, hora aprobada de recordatorios y SMTP/Culqi siguen condicionados a configuración externa. En approval/submit puede aparecer503 cuando corresponde programar recordatorio: no simular siempre éxito.

## Usar los mocks

Copiar contracts.ts, fixtures.ts, operations.json, mock-fetch.ts y mock-document.pdf a la carpeta de integración del frontend. Importar JSON requiere resolveJsonModule (normal en Vite). Todos los imports de contratos son type-only.

~~~ts
import operations from './operations.json';
import { createMockFetch } from './mock-fetch';
const transport = createMockFetch(operations);
const response = await transport.fetch('/api/v1/client/overview');
const payload = await response.json();
transport.setResponse('acceptQuote',409,{
  success:false, message:'La versión ha sido sustituida', error:'ConflictException'
});
~~~

Para PDF, cargar la fixture local con fetch('/mocks/mock-document.pdf').then(r=>r.blob()) y pasar ese Blob como segundo argumento a createMockFetch. El transporte no valida JWT ni guarda mutaciones: configurar setResponse para escenarios de estados/roles y reset entre casos. No sustituye pruebas E2E.

Validación de este paquete: rutas contrastadas automáticamente contra Swagger registrado; ejemplos compilados con TypeScript estricto. No se verificó un servidor remoto ni se ejecutó aceptación de negocio con textos/credenciales reales.

Regenerar dentro de tisnet-api: node docs/frontend-a/generate.cjs. Esto actualiza Swagger revisado, fixtures, mocks y fichas desde operations.json/contracts.ts. El snapshot Swagger original debe reexportarse al cambiar controladores; no regenerarlo a partir de propuestas.

Informe y evidencia de validación: [INFORME_AUDITORIA.md](INFORME_AUDITORIA.md).

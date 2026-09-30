# Informe de auditoría técnica y entregables — contratos Frontend A

Fecha: 30/09/2026. Código auditado: 0ef120d. Alcance: contratos Cliente y Developer del backend TISNET, sin cambios de ejecución.

## Entrega

- Snapshot Swagger de Nest: 124 rutas.
- OpenAPI revisado para Frontend A: 48 operaciones, 83 esquemas y ejemplos sintéticos.
- Tipos TypeScript autónomos, fixtures tipados, transporte de mocks y PDF de prueba.
- Catálogo por operación con método, ruta, request, response, permisos, estados, errores y disponibilidad.
- Convenciones de autenticación, fechas, importes, paginación y archivos en README.md.
- Contratos propuestos y fechas no comprometidas en PENDIENTES.md.

## Verificación realizada

1. Generación: las 48 combinaciones de método/ruta existen en el Swagger del backend.
2. TypeScript estricto: contracts.ts, fixtures.ts y mock-fetch.ts compilan sin errores.
3. Mocks: comprobadas respuesta JSON, sustitución por 401, reset, PDF válido y 404 para tareas sin implementar.
4. OpenAPI: comprobadas 348 referencias a esquemas y unicidad de operationId. No se ejecutó un validador externo de OpenAPI.
5. origin/develop coincide con el código auditado antes de publicar estos documentos.

La validación es de código, tipos y transporte local. No se ejecutaron pruebas de integración contra un despliegue, base de datos ni proveedores externos en esta entrega. Los ejemplos no son registros reales. Los mocks no validan autorización ni persisten mutaciones.

## Hallazgos que afectan a Frontend

- Dashboard Cliente disponible; Developer puede componer proyectos, perfil y avance, pero carece de dashboard agregado y agenda completa.
- Tareas y recursos carecen de API específica. Sus contratos son propuestas, con fecha por acordar.
- Listas sin paginación uniforme; importes y fechas con formatos distintos según operación.
- Revisión de entregables: enviar siempre decision explícita; el backend admite omitirla y puede aprobar por defecto.
- Identificadores de hitos/contribuciones requieren atención por resolución alternativa de id/orden.
- Foto Cliente y subida autenticada de CV requieren trabajo adicional. Los límites de archivo varían por endpoint.
- Staging, fechas de nuevos endpoints y acuerdos de política horaria no confirmados.

Ver README.md y OPERACIONES.md para los detalles por ruta. Las incidencias de producción, migraciones y dependencias del informe de Sprint 15 continúan fuera del alcance de esta entrega documental.

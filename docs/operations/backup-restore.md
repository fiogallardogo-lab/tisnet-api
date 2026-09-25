# Respaldo y restauración de TISNET

## Infraestructura observada

MySQL 8 en docker-compose.yml, contenedor tisnet-mysql, puerto local 3307, volumen mysql_data. Desarrollo usa tisnet; pruebas usan tisnet_test. No se ha identificado un servidor productivo, bucket remoto, job de backup ni servicio de cifrado administrado. Un volumen Docker NO es un respaldo.

## Política propuesta para activar antes de producción

- Base: la indicada por DATABASE_URL del entorno productivo confirmado por el operador; no asumir que tisnet local sea producción.
- Dump lógico consistente diario y antes de cada migración de datos. RPO objetivo 24 horas.
- Retención: 7 diarios, 4 semanales, 3 mensuales. Rotar solo después de verificar el respaldo nuevo.
- MySQL InnoDB: mysqldump --single-transaction --routines --triggers --events --hex-blob --no-tablespaces. Incluir esquema, datos, historial _prisma_migrations y BLOBs actuales de postulaciones.
- El operador guarda las credenciales en un archivo de opciones de MySQL con permisos restringidos (defaults-extra-file), nunca en Git, nombre del archivo de salida, línea de comandos pública o logs. Guardar el dump fuera del volumen y del repositorio. Cifrar con la solución operativa elegida; no se ha configurado ninguna.
- Almacenamiento externo real de B, cuando exista, requiere respaldo independiente y consistencia de referencias. El proveedor fake no equivale a almacenamiento productivo.

## Procedimiento de restauración

1. Verificar checksum SHA-256, fecha, versión de MySQL y tamaño del archivo. Registrar esos datos, sin secretos.
2. Crear una base NUEVA aislada (p.ej. tisnet_restore_test) con mismas collation/charset, en MySQL compatible. Nunca importar encima de la base compartida para una prueba.
3. Restaurar usando cliente mysql y credenciales restringidas del operador. Ejemplo conceptual: mysql --defaults-extra-file=<archivo-seguro> tisnet_restore_test < <dump.sql>. La redirección se ejecuta con una shell que conserve bytes; no pasar binarios por pipelines de texto de PowerShell.
4. Apuntar una configuración aislada de la API a la restaurada. Ejecutar prisma migrate status primero; no aplicar cambios automáticamente sin revisar versión del código.
5. Comparar conteos y sumas por moneda de Quote/QuoteVersion/Payment, relación cuotas-hitos-entregables, integridad de usuarios y BLOBs, y migraciones aplicadas. Validar login de prueba, consulta por código, PDF y permisos sin enviar notificaciones reales.
6. Medir duración de restauración y registrar evidencia. RTO se fijará con esa medición; no hay un valor verificado hoy.
7. La promoción o sustitución productiva requiere una ventana operativa explícita y aprobación del responsable; no forma parte de estas migraciones locales.

Hacer un simulacro mensual y después de cambios importantes de esquema. El backup automático, su almacenamiento externo y un simulacro completo de restauración quedan como tareas operativas: este cambio documenta la política y no afirma que esos servicios estén desplegados.

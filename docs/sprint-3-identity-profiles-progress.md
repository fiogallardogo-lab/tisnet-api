# Sprint 3 - Avance de identidad y perfiles

Fecha: 16/09/2026  
Responsable: A - Backend de identidad, perfiles y Prisma  
Estado: implementación local y migración consolidada validadas; comprobación HTTP pendiente.

## Alcance implementado

- Contrato de usuarios y perfiles actualizado con la línea base SCRUM aprobada.
- Roles canónicos: CLIENT, DEVELOPER, PRODUCT_OWNER, ADMIN y SUPER_ADMIN.
- Registro público limitado al rol CLIENT y condicionado a términos vigentes.
- Consulta y edición segura del usuario autenticado.
- Perfiles independientes para Cliente, Developer, Product Owner y Admin.
- Tecnologías activas asociadas al perfil Developer mediante una tabla intermedia.
- DTO, validación global estricta, JWT y autorización por rol.
- Seed idempotente que preserva contraseñas de usuarios existentes.
- Modelos Quote, QuoteOption y QuoteItem integrados con sus enums e índices.
- QuoteItem incluido desde la primera migración; SP-01 continúa pendiente.

## Verificaciones ejecutadas

| Comprobación | Resultado |
| --- | --- |
| `npx prisma format` | Correcto |
| `npx prisma validate` | Correcto |
| `npx prisma generate` | Correcto |
| `npx prisma migrate deploy` | Migración consolidada aplicada correctamente |
| `npx prisma migrate status` | Base de datos actualizada, 8 migraciones |
| `npm test` | 16 archivos, 102 pruebas aprobadas |
| `npm run lint` | Sin errores |
| `npm run build` | Correcto |

## Controles de seguridad comprobados

- El propietario se obtiene del JWT y no de parámetros enviados por el cliente.
- Cada endpoint de perfil exige el rol correspondiente.
- Registro no acepta roles privilegiados.
- `passwordHash`, `tokenVersion` y `userId` interno no se serializan en perfiles.
- Tecnologías inexistentes o inactivas se rechazan antes de actualizar Developer.
- Campos desconocidos se rechazan mediante ValidationPipe.

## Trabajo pendiente antes de evidencia HTTP

1. Configurar `TERMS_VERSION` y `PRIVACY_VERSION` en `.env` sin versionar secretos.
2. Ejecutar el seed cuando se requieran los cinco roles en la base local.
3. Probar registro, perfiles y regresión en Swagger/E2E con datos de prueba.
4. Publicar el commit de Prisma para que el Responsable B conecte QuoteRepository.
5. Integrar QuotesModule en AppModule cuando B entregue su commit revisable.

Se creó y aplicó localmente `20260916155021_add_identity_profiles_quotes`. No se ejecutó el seed y todavía no se realizó commit o push.

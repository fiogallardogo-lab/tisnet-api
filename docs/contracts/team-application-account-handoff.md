# Sprint 11 — datos preparados y límite de propiedad

## Implementado por A

- TeamApplicationStatus enum: PENDING_REVIEW, INTERVIEW_ASSIGNED, ACCEPTED, REJECTED.
- TeamApplicationRole enum: DEVELOPER, PRODUCT_OWNER.
- Relaciones resultingUserId → User y decidedByUserId → User.
- Campos decidedAt, interviewCompletedAt, decisionReason.
- Se mantiene el criterio existente más estricto: email único global y DNI único global. No se habilitan postulaciones duplicadas por distinto rol sin un cambio de contrato acordado.
- El alta pública continúa creando únicamente TeamApplication, nunca User.
- Migración preserva CV/fotografía y todos los registros. Backfill de rechazo usa solo fecha/actor/motivo ya registrados; no inventa datos de aceptación. Aceptaciones históricas se vinculan a una cuenta existente únicamente si email y rol coinciden.

## Pendiente por contradicción de propiedad

La Parte 1 prohíbe a A modificar src/team-applications/**. La Parte 2 requiere completar en ese flujo aceptación y cuenta. Se pidió aclaración antes de modificar ese módulo. Hasta recibir autorización, la implementación de sus servicios/controladores y las notificaciones de B permanecen intactas; NO se declara cerrado el Sprint 11.

## Integración requerida en el servicio existente

1. Decisión dentro de transacción, bloqueando TeamApplication y exigiendo INTERVIEW_ASSIGNED + entrevistador autenticado asignado.
2. Al aceptar, vincular User existente con mismo email y rol, o crear User/perfil según el contrato de incorporación. Nunca cambiar el rol de una cuenta ajena ni elevar una cuenta de cliente/admin por coincidencia de email.
3. Guardar resultingUserId, decidedByUserId, decidedAt, interviewCompletedAt y motivo junto con la transición.
4. Rechazo inicial y resultado de entrevista deben conservar actor/fecha/motivo; no permitir decisiones repetidas.
5. Registrar AuditEvent dentro de la transacción. La notificación existente de B se invoca después del commit; fallo de envío no revierte la decisión.
6. B mantiene invitación/activación, CV/foto, notificaciones y seguridad de enlaces. No inventar un password compartido ni enviarlo en respuesta API.
7. Añadir E2E de aceptación → User, rechazo, repetición/concurrencia, identidad/rol, auditoría y RBAC. Esas pruebas no se sustituyen por los tests existentes de revisión/asignación.

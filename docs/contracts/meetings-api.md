```md
# Meetings and Scheduling API Contract

## Objetivo

Definir la separación entre la lógica de negocio de reuniones y los proveedores externos de agenda dentro del Sprint 4.

La integración debe permanecer desacoplada de Calendly u otros servicios externos.

## Arquitectura prevista

```text
MeetingsService
      ↓
SchedulingProvider
      ↓
FakeSchedulingProvider
      ↓
CalendlySchedulingProvider
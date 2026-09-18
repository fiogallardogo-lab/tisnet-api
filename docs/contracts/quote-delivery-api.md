# Quote Delivery API Contract

## Objetivo

Definir el flujo desacoplado para la generación, almacenamiento y entrega de cotizaciones dentro del Sprint 4.

Este contrato no crea endpoints nuevos. Su objetivo es establecer las responsabilidades de los componentes involucrados.

---

## Flujo general

```text
Quote persistida
      ↓
DocumentRenderer
      ↓
StorageProvider
      ↓
NotificationProvider
      ↓
Cliente
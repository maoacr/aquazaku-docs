---
title: Ciclo de vida de una venta
description: State machine REGISTRADA → PENDIENTE_PAGO → COMPLETADA, con terminales ANULADA y FALLO_AUDITORIA.
sidebar:
  order: 3
---

# Ciclo de vida de una venta

El [ADR-0003](/decisiones/0003-roles-permisos-matriz/) introdujo este
state machine para reemplazar la regla "mismo día en curso" que fallaba en
bordes temporales.

[Ver diagrama en pantalla completa →](/diagramas/aquazaku-venta-lifecycle.html){target="\_blank"}

<iframe src="/diagramas/aquazaku-venta-lifecycle.html" width="100%" height="640" style="border: 0;"></iframe>

## Estados

| Estado | Significado | Stock |
| --- | --- | --- |
| `REGISTRADA` | El POS o el seller creó la venta | Descontado |
| `PENDIENTE_PAGO` | Falta pago total o parcial | Descontado |
| `PAGO_PARCIAL` | Abonó una parte | Descontado |
| `PAGO_TOTAL` | Pago completo, verificación pendiente | Descontado |
| `COMPLETADA` | Verificado, caja cerrada | Descontado, registrado en caja |
| `ANULADA` | Cancelada, con motivo | Devuelto a su lote |
| `FALLO_AUDITORIA` | Monto inconsistente | En disputa |

## Por qué un state machine y no "mismo día en curso"

La regla "mismo día en curso" falla en bordes temporales: un pago a las
23:59 contra una venta de ayer parece inválido aunque no lo sea. El
state machine es **forward-only** y se ata al estado, no al reloj:

- REGISTRADA → PENDIENTE_PAGO → PAGO_PARCIAL/TOTAL → COMPLETADA
- Los pagos parciales son un estado válido, no un error de redondeo
- Las anulaciones están atadas al estado, no al día

:::note[Quién anula, quién verifica]
- Anular antes de cobrar: cualquier rol con permiso `ventas:anular`
  (resuelto en ADR-0003 — un rol distinto al que cobró si se puede).
  Stock devuelto a su lote original.
- El auditor detecta `PAGO_TOTAL` con monto inconsistente y lo manda a
  `FALLO_AUDITORIA`. La reversión corre por el contador, no por el POS
  que cobró.
:::

## La huella de ANULADA

Toda anulación se registra en `audit_log` con el método, el
`rol_ejercido` y el motivo. `ANULADA` no es un delete — es un terminal
con datos.

El stock que se había descontado vuelve a su lote. Si el lote ya no
existe (caso de borde), el sistema lo manda a un lote de "recuperación"
para auditoría posterior. La idea: **nunca perder trazabilidad** aunque
se pierda la venta original.

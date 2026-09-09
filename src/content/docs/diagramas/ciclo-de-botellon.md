---
title: Ciclo de vida de un botellón
description: DISPONIBLE → ASIGNADO → CON CLIENTE → DEVUELTO, con terminales DAÑADO y DESCARTADO.
sidebar:
  order: 4
---

# Ciclo de vida de un botellón

Cada base tiene un consecutivo único (0001–9999) y queda asociada a un
`responsable_actual`. La asociación se rompe solo cuando vuelve al parque
o se descarta.

[Ver diagrama en pantalla completa →](/diagramas/aquazaku-botellon-lifecycle.html){target="\_blank"}

<iframe src="/diagramas/aquazaku-botellon-lifecycle.html" width="100%" height="640" style="border: 0;"></iframe>

## Estados

| Estado | Dónde está | Quién lo tiene |
| --- | --- | --- |
| `DISPONIBLE` | En el parque | Nadie |
| `ASIGNADO` | Asignado a un cliente, esperando confirmación de venta | Un cliente |
| `CON CLIENTE` | Confirmada la venta, esperando devolución | Un cliente |
| `DEVUELTO` | Volvió a la planta, en buen estado | Nadie (a punto de volver al parque) |
| `DAÑADO` | No se puede entregar más, pero existe físicamente | Nadie |
| `DESCARTADO` | Fuera del inventario (roto, robado, perdido) | Nadie |

## La diferencia entre DAÑADO y DESCARTADO

- **DAÑADO** es un estado donde la base todavía existe físicamente pero
  no se puede entregar. El POS registra el daño cuando lo detecta.
- **DESCARTADO** es terminal: la base se rompió, se robó, o se perdió.
  Ya no está en el inventario.

:::caution[Quién pasa de DAÑADO a DESCARTADO]
La decisión la toma un **admin**, no el POS. El POS registra el daño; el
admin decide el descarte. Esto evita que se descarten bases por accidente
o sin trazabilidad. Cada descarte es una entrada en `audit_log` con
motivo y responsable.
:::

## El botellón es trazable, no anónimo

Un botellón sin `responsable_actual` es un botellón **perdido en el
sistema**. Esto es importante porque:

- Si el cliente devuelve una base con un consecutivo distinto al que se
  llevó, el sistema detecta el mismatch con el sticker y avisa.
- La auditoría detecta clientes con bases asignadas hace más de N días
  y avisa para su seguimiento.
- La base queda siempre con un responsable mientras no vuelva al parque
  o se descarte — no hay "botellones en el limbo".

:::tip[Por qué sticker en lugar de RFID]
El sticker con consecutivo de 4 dígitos (0001–9999) es la opción más
barata que sigue siendo trazable. RFID costaría ~USD 5 por base ×
cientos de bases. El sticker es ~USD 0.01 y se pega en una sola
cara. La operación es manual (escaneo o tipeo), pero el sistema detecta
errores por mismatch.
:::

## La regla de "queda debiendo"

Si un cliente quiere **llevar más bases de las que entrega**, el sistema
lo obliga a registrar el cliente primero (con nombre, teléfono, dirección)
para poder entregarle o registrar la cantidad de botellones pendientes
por retornar. Ver [flujo de venta](./flujo-de-venta) para los detalles
del flujo.

---
title: "ADR-0012 — La corrección revierte los botellones originales; no compensa con deltas"
description: "Migrar `compensarBotellonesSiCambiaron` a una reversión con el mismo helper que la anulación, y eliminar la duplicación que duplicaba el saldo del cliente."
sidebar:
  order: 12
---

**Estado:** Aceptado
**Fecha:** 2026-09-21
**Deciden:** arquitectura

## Contexto

[RN-VEN-16](/dominio/ventas/#rn-ven-16--corregir-una-venta-es-reemplazarla-no-editarla)
define que corregir una venta es **reemplazarla**, no editarla. La implementación
hace tres cosas en una sola transacción: revierte los productos a los lotes,
registra una venta nueva con los datos corregidos, y pasa la vieja a
`estado='corregida'`.

Para los botellones, [RN-VEN-17](/dominio/ventas/#rn-ven-17--botellones-entregados-y-recibidos)
agrega dos campos a la venta (`botellonesEntregados`, `botellonesRecibidos`) y
dice que la corrección puede moverlos. El problema resuelto por este ADR es
**cómo se mueven esos campos sin romper el saldo del cliente**.

### El bug

La corrección hacía dos cosas distintas sobre los mismos envases:

1. `registrarVentaEn` insertaba los movimientos completos de la venta
   nueva — `entrega` y `retorno` con los valores nuevos.
2. `compensarBotellonesSiCambiaron` insertaba además movimientos
   `tipo='ajuste'` con el delta `(nuevo − viejo)` para reflejar el cambio.

Para una venta original con `botellonesEntregados=5` corregida a `7`, el
saldo del cliente quedaba así:

| Origen | Tipo | Cantidad | Saldo acumulado |
|---|---|---|---|
| Original entrega | `entrega` | +5 | +5 |
| Nueva venta entrega | `entrega` | +7 | +12 |
| Compensatorio delta | `ajuste` | +2 | **+14** |

El saldo correcto era `+7` (lo que dice la nueva venta). El sistema
sobre-contaba en **+7** sobre el resultado correcto. En la ficha del
cliente, eso es ver «el cliente debe 14 envases» cuando en realidad tomó 7.

Existía un test (`correccion.test.ts`) que documentaba ese saldo en
`4` para un caso menor (entregados de 3 a 2) y describía el comportamiento
como "la entrega de la nueva venta es independiente y sigue sumando". Esa
descripción era la inversa de la verdad: la entrega de la nueva venta es la
que **manda**; la original es la que se cancela.

## Alternativas evaluadas

### Opción A — Mantener el doble juego, ajustar el test

Comprometer el sistema con la descripción original y dejar que la nueva
venta aporte el grueso y el compensatorio aporte el delta. **No resuelve el
doble-conteo**, solo lo nombra. Descartada.

### Opción B — Quitar el compensatorio, dejar solo la nueva venta

Borrar `compensarBotellonesSiCambiaron`. La nueva venta ya inserta sus
movimientos completos, así que el saldo quedaría en `+12` (original +5,
nueva +7). Eso **corrige la mitad del bug** — el compensatorio deja de
sumar — pero deja al cliente con saldo que ya no representa la realidad:
tiene los movimientos de una venta que la corrección invalidó.

### Opción C — Revertir los originales con el mismo helper que la anulación

Reemplazar `compensarBotellonesSiCambiaron` por una llamada al helper de
reversión que ya usa `anularVenta` (`devolverBotellonesDeLaVenta`). La
anulación inserta movimientos opuestos a los originales: `entrega` → `retorno`
con `cantidad = -botellonesEntregados`, `retorno` → `entrega` con
`cantidad = +botellonesRecibidos`.

El saldo del cliente pasa a ser `original + reversión + nueva = -orig + new`,
que es la nueva venta.

| Movimiento | Cantidad cliente | Saldo |
|---|---|---|
| Original entrega | +5 | +5 |
| Reversión entrega | -5 | 0 |
| Nueva venta entrega | +7 | **+7** ✓ |

La anulación ya hacía esto bien; el bug fue haber copiado la lógica
equivocada al código de la corrección cuando esa se implementó.

## Decisión

Elegimos **Opción C** porque:

- **Respeta el dominio**: el cliente termina con el saldo que dice la
  nueva venta, no con la suma de las dos.
- **Reusa el camino que ya andaba**: la reversión ya estaba probada en la
  anulación. Usarla en la corrección elimina dos implementaciones de la
  misma idea, que es exactamente la condición que dejó entrar al bug.
- **Mantiene la auditoría**: las filas de la venta original siguen en
  `movimientos_botellon` con `documentoId = original.id`. Las filas de la
  reversión también apuntan a `original.id` (no a `nueva.id`) porque
  cancelan a la original. Las de la nueva venta apuntan a `nueva.id`.
  La auditoría reconstruye qué pasó mirando las tres.

### Cambios concretos

- Se extrajo `devolverBotellonesDeLaVenta` desde `anulacion.ts` como
  helper **exportado**, y `devolverActivosDeLaVenta` (interno a la
  anulación) ahora lo llama en vez de duplicar las inserciones.
- `corregirVenta` reemplaza la llamada a `compensarBotellonesSiCambiaron`
  por `devolverBotellonesDeLaVenta(tx, original, ...)`. El helper inserta
  exactamente las mismas filas que inserta la anulación, con
  `documentoId = original.id`.
- `compensarBotellonesSiCambiaron` y sus tests se borran.
- Los dos tests existentes que afirmaban el saldo en `4` (uno) y `±1`
  (otro) se reescriben para afirmar el saldo correcto (`+2` y `0`
  respectivamente) y para verificar la presencia de las filas de
  reversión con `tipo='retorno'` apuntando a `original.id`.

## Consecuencias

**Fácil:** la ficha del cliente refleja el saldo correcto después de una
corrección. La auditoría reconstruye el cambio mirando solo la fila
original + la fila de la nueva venta, sin sumar compensatorios.

**Fácil:** la corrección y la anulación comparten un único helper. Si
mañana cambia la semántica de «revertir una entrega de botellones», cambia
en un solo lugar.

**Costoso:** las **ventas creadas antes del fix** que ya tienen movimientos
`tipo='ajuste'` duplicados van a tener saldos de pendientes incorrectos
hasta que se reprocesen. No hay forma automática de saber si un saldo
erróneo viene del bug histórico o de una corrección legítima posterior.
La auditoría del cambio (los payloads `ventas:corregir` de la bitácora)
tiene los conteos antes/después — se puede usar para reconstruir, pero
es trabajo manual por venta.

**Decisión:** aceptamos ese costo porque el bug era silencioso y los
saldos equivocados iban a aparecer antes o después. Un script de
recomputo es viable pero no urgente: hacerlo bien requiere también
revisar las anulaciones que se hicieron sobre ventas ya corregidas, y
la prioridad es que el sistema no siga acumulando movimientos
incorrectos.

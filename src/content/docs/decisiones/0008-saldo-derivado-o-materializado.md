---
title: ADR-0008 — Materializar un saldo solo cuando hay que descontarlo atómicamente
description: "Cinco saldos, dos modelos. El criterio no es el volumen ni la velocidad: es si dos personas pueden pelearse por la última unidad."
---

**Estado:** Aceptado
**Fecha:** 26-ago-2026
**Deciden:** Mao

## Contexto

El sistema lleva **cinco saldos** y los resuelve de dos formas distintas:

| Saldo | Módulo | Cómo se guarda |
| --- | --- | :-: |
| Unidades de un lote | M2 · Stock | **Columna** |
| Unidades de un insumo | M3 · Insumos | **Columna** |
| Litros de un tanque | M4 · Producción | Derivado |
| Deuda de un cliente | M6 · Ventas | Derivado |
| Botellones de un cliente | M7 · Retornables | Derivado |

La decisión se tomó cinco veces, siempre igual, y **nunca se escribió**. Este
ADR la registra antes de que el sexto saldo la vuelva a tomar por intuición.

La pregunta que hay que contestar cada vez es: *¿la columna de saldo es una
optimización, o es lo único que hace correcta la operación?*

## Alternativas evaluadas

### Opción A — Derivar siempre

- ✅ Una sola fuente de verdad. El saldo **no puede** desincronizarse del libro,
  porque no existe como dato separado.
- ✅ Revertir es cambiar un estado: anular una venta baja la deuda sin tocar
  ninguna otra tabla, porque el filtro deja de contarla.
- ❌ **No se puede descontar atómicamente.** No hay forma de escribir
  `UPDATE … WHERE saldo >= :n` sobre algo que no es una columna.

### Opción B — Materializar siempre

- ✅ Una consulta más barata, y el `UPDATE` condicional disponible en todos lados.
- ❌ Dos representaciones del mismo número. El día que una se actualice y la otra
  no, el libro deja de explicar el saldo — **el descuadre más difícil de
  rastrear meses después**, porque las dos parecen correctas por separado.
- ❌ Un `CHECK (saldo >= 0)` protege contra un valor negativo, **no** contra una
  actualización perdida. Son dos problemas distintos.

### Opción C — Decidir por volumen esperado

- ❌ Descartada. El volumen cambia; el criterio quedaría desactualizado sin que
  nadie lo note, y la migración de un saldo materializado a uno derivado —o al
  revés— toca todas las consultas del módulo.

## Decisión

**Se materializa un saldo si y solo si hay que descontarlo atómicamente.**

Y eso ocurre exactamente cuando **dos operaciones simultáneas pueden pelearse
por la última unidad**:

```sql
UPDATE lotes SET cantidad_disponible = cantidad_disponible - :n
 WHERE id = :lote AND cantidad_disponible >= :n
```

Cero filas afectadas significa «no alcanzaba», y **no se escribe el movimiento**.
Entre comprobar y descontar no hay ventana. Eso no se puede hacer contra una
suma.

Aplicado a los cinco:

- **Stock e insumos** se materializan. Dos vendedores pueden ir por el último
  botellón, y el que pierde tiene que enterarse *antes* de que se escriba nada.
- **El agua** se deriva. La mueve el cierre de producción, que es **uno por día**
  (`RN-PRD-22`), y los ingresos y ajustes son manuales y esporádicos. No hay
  concurrencia que defender.
- **La deuda** se deriva. Dos cobros simultáneos **suman**; no compiten. Y hay un
  premio: anular una venta la saca de la cuenta sin tocar nada más, porque el
  filtro es por estado.
- **Los botellones** se derivan, y acá el premio es mayor: sin columna, la
  [ley de conservación](/dominio/botellones-y-bases/) se verifica con una sola
  suma sobre la misma tabla. Si el saldo viviera aparte, un descuadre podría ser
  una diferencia entre las dos fuentes en vez de un botellón perdido — y no
  habría forma de distinguirlos.

## Consecuencias

**Se vuelve fácil** revertir. Toda operación que se deshace cambiando un estado
—anular una venta, desactivar un movimiento— revierte el saldo sin escribir en
otra tabla, y por lo tanto **sin poder quedar a medias**.

**Se vuelve difícil** consultar en volumen. `cartera()` calcula la deuda de cada
cliente activo con tres consultas por cliente: con doscientos clientes son
seiscientas consultas para pintar la pantalla que el `contador` abre primero.
Hoy no duele; el día que duela, la salida no es materializar el saldo sino
**calcular la cartera entera con un `GROUP BY`** — una consulta, misma fuente de
verdad.

**El costo que aceptamos**: que alguien mire un saldo derivado, lo encuentre
lento, y agregue una columna «de caché» sin leer esto. Por eso el criterio está
escrito y no en la cabeza de nadie.

:::caution[La pregunta a hacerse ante un saldo nuevo]
No es «¿va a ser lento?». Es **«¿dos personas pueden pelearse por la última
unidad?»**. Si la respuesta es no, derivarlo es más simple *y* más correcto.
:::

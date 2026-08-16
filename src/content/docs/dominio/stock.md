---
title: Stock de producto
description: Control de inventario de producto por ubicación en Aquazaku.
sidebar:
  order: 3
---

Esta página cubre el **producto** — lo que se vende y no vuelve.

- El producto **entra** por la [producción diaria](/dominio/produccion/), no por
  compra. Aquazaku lo envasa.
- Los activos retornables tienen su propio ciclo:
  [Botellones y bases](/dominio/botellones-y-bases/).
- El agua a granel se mide en **litros** y vive en los tanques, no acá:
  [Producción y agua](/dominio/produccion/).

## Cuatro cosas que parecen una

El sistema controla cuatro tipos de existencia. Confundirlas es el error más caro
que se puede cometer en este dominio.

| | **Producto** | **Insumo** | **Botellón** | **Base** |
| --- | --- | --- | --- | --- |
| Ejemplo | Paca de agua | Tapa, sello | Envase de 20 L | Soporte |
| Se vende | Sí | No | **No** | **No** |
| Vuelve | No | No | Se espera que sí | Sí, es un préstamo |
| Se identifica | Por producto | Por tipo | **Solo cantidad** | **ID individual** |
| Al salir | Baja por venta | **Baja por producción** | Cambia de ubicación | Cambia de ubicación |

:::danger[El error que hay que evitar]
Un solo campo `stock` no modela esto. Una paca que sale es una baja; un botellón
y una base que salen siguen siendo activos de Aquazaku que están en poder de otro.

Si los mezclás, el día que falten 40 botellones el sistema no va a poder decirte
dónde estaban ni quién los tenía.
:::

---

## Reglas

### RN-STK-01 — El stock de producto se controla por ubicación

**Estado:** 🟡 Supuesto *(salvo el punto de venta, ver abajo)*

No existe "el stock" a secas. Existe stock **en una ubicación**:

| Ubicación | Qué es |
| --- | --- |
| `BODEGA` | Depósito central |
| `RUTA:{id}` | Carga en el vehículo de un `seller` |

**Por qué:** sin ubicación no podés saber si un faltante es un robo en bodega o
un `seller` que no rindió.

:::tip[Confirmado por Aquazaku]
**El `pos` vende contra el stock de `BODEGA`.** El punto de venta *no* tiene
ubicación de stock propia.

Consecuencia directa: `BODEGA` tiene dos consumidores simultáneos —el mostrador
y la carga de rutas— así que las bajas concurrentes sobre la misma ubicación son
un caso real, no teórico. Hay que resolverlo en el diseño de la API.
:::

---

### RN-STK-02 — Todo movimiento de stock queda registrado con motivo y responsable

**Estado:** 🟡 Supuesto

El stock nunca se edita directamente. Se mueve mediante documentos:

| Documento | Efecto |
| --- | --- |
| **Cierre de producción** | ➕ Producto en bodega · ➖ Tapas y sellos |
| Compra recibida | ➕ Bodega — insumos, no producto terminado |
| Carga de ruta | Bodega ➡️ Ruta |
| Venta en punto de venta (`pos`) | ➖ Bodega |
| Venta en ruta (`seller`) | ➖ Ruta |
| Devolución de ruta | Ruta ➡️ Bodega |
| Ajuste de inventario | ± con motivo obligatorio |

**Por qué:** un stock editable a mano es un stock que nadie cree. El ajuste
existe —el inventario físico siempre difiere— pero es un documento con nombre,
fecha y motivo, no un `UPDATE`.

---

### RN-STK-03 — No se puede vender lo que no está en la ubicación

**Estado:** 🟡 Supuesto

Una venta desde la ruta solo puede despachar producto cargado en esa ruta. Una
venta del `pos` solo puede despachar producto que esté en bodega. No hay venta
con stock negativo.

**Por qué:** permitir negativo convierte el inventario en una sugerencia.

:::caution[Impacta la app mobile]
El `seller` opera **sin señal**. Esta validación tiene que correr en el
dispositivo contra la carga local, no solo en el servidor. Es una de las razones
por las que el modo offline necesita su propio [ADR](/decisiones/).
:::

---

---

### RN-STK-04 — Los insumos de empaque son stock, y se consumen por producción

**Estado:** ✅ Confirmada

Tapas y sellos termoencogibles **forman parte del stock** y se controlan por
cantidad, igual que el producto.

| Insumo | Se consume cuando |
| --- | --- |
| Tapa para botellón | Se llena y sella un botellón |
| Sello termoencogible | Se llena y sella un botellón |

La diferencia con el producto: el insumo **no sale por venta, sale por
producción** ([RN-PRD-09](/dominio/produccion/)).

**Por qué:** una planta sin tapas no produce, por más agua que tenga en los
tanques. Si el insumo no está en el sistema, nadie se entera de que se está
acabando hasta que se acabó.

:::tip[La consecuencia útil]
Tener los insumos en stock es lo que permite responder la pregunta que importa:
**¿cuántos botellones más puedo llenar antes de quedarme sin tapas?**

Sin eso, el control de producción está incompleto.
:::

:::caution[A confirmar]
¿Se controlan también las **bolsas** de 600 ml y 300 ml como insumo? Siguen la
misma lógica —se consumen al envasar— pero no fueron mencionadas.

Si se controlan, la receta de consumo por paca es: `20 bolsas de 600 ml` para una
paca de 600, `50 bolsas de 300 ml` para una de 300.
:::

---

## Preguntas abiertas

- ¿Hay más de una bodega? ¿La planta de empaque y la bodega son el mismo lugar?
  Si los insumos viven en planta y el producto en bodega, son dos ubicaciones.
- ¿Se define un stock mínimo de tapas y sellos que dispare alerta de reposición?
- ¿Cada cuánto se hace inventario físico?
- ¿El producto envasado queda disponible para venta el mismo día, o hay un
  tiempo de reposo o control de calidad antes?

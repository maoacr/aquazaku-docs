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

## Lotes y vencimiento

:::caution[Esta regla se llamaba RN-STK-04, y era un error]
Nació el 18-ago-2026 con un número que **ya estaba tomado** por la regla de
insumos de empaque. Dos reglas distintas con el mismo identificador, las dos
marcadas como confirmadas.

No era cosmético: `proveedores.md` citaba `RN-STK-04` para hablar de insumos y
`produccion.md` lo citaba para hablar de vencimientos. Quien seguía cualquiera
de los dos links llegaba a una página con dos reglas del mismo nombre.

Conserva el número la que se escribió primero —la de insumos— y esta pasa a
**RN-STK-08**. Es la única vez que un número cambia, y pasa justamente porque
nunca debió haberse duplicado.
:::

### RN-STK-08 — Cada cierre de producción genera un lote, vencimiento automático a 30 días

**Estado:** ✅ Confirmada — cerrá la pregunta 🟢
"¿Hay control de lotes o vencimiento?" de
[Qué falta preguntar](/empezar/pendientes/).

```
cierre_produccion_diario = {
  ...,
  lote_generado: "YYYY-MM-DD-L1",      // generado por el sistema al cerrar
  fecha_empaque: date,
  ...
}

producto_unidad = {
  sku: ...,
  lote_id: lote_id,
  fecha_empaque: date,
  fecha_vencimiento: date,             // = fecha_empaque + 30 días
  ...
}
```

**Reglas**:

- **Vencimiento automático**: `vencimiento = empaque + 30 días`. No se tipea a mano — lo calcula el sistema.
- **Lote generado al cerrar la producción**: el formato `YYYY-MM-DD-L1` (fecha + secuencia) sale del sistema y se imprime en la bolsa física por el `pos`.
- **Trazabilidad**: cada venta registra el `lote_id` vendido. Si hay recall o producto defectuoso, se identifica a qué clientes se les vendió.
- **FIFO en bodega**: las ventas sacan primero el producto con vencimiento más próximo (lote más viejo).
- **Vencidos se bloquean automáticamente**: el stock con `fecha_vencimiento < hoy` no se ofrece para la venta.

**Por qué importa**: anticipar la trazabilidad desde el MVP. Si en el futuro hay un recall, poder decir "esta venta se hizo con el lote X, esos clientes son los afectados" es invaluable.

---

## Devoluciones y descarte

### RN-STK-05 — Devoluciones vuelven al stock si están sanas; vencidas o dañadas se descartan

**Estado:** ✅ Confirmada — cerrá la pregunta 🟢
"¿Se aceptan devoluciones de producto, o solo anulación de la venta completa?"
de [Qué falta preguntar](/empezar/pendientes/).

Ver [RN-VEN-10](/dominio/ventas/) para el flujo de la venta con devolución. Esta regla cubre el lado del stock:

| Estado del producto devuelto | Acción de stock |
| --- | --- |
| `sano` | Vuelve al mismo lote en `BODEGA`. Sigue su vida normal. |
| `vencido` | Descarte directo sin clasificar causa (vencimiento es objetivo). |
| `danado` | Dispara el flujo de descarte con clasificación de causa (RN-STK-06). |

---

### RN-STK-06 — Descarte de producto: selectivo por unidad, causa obligatoria, sin castigo automático

**Estado:** ✅ Confirmada — cerrá la pregunta 🟢
"¿Puede descartarse producto ya envasado por calidad?" de
[Qué falta preguntar](/empezar/pendientes/).

Una unidad dañada o vencida se puede descartar **sin destruir el lote entero**.
Solo las unidades afectadas.

```
descarte = {
  id: uuid,
  unidades: [{ sku, lote_id, fecha_vencimiento, ... }, ...],
  causa: "falla_produccion" | "mal_manejo_cliente" | "otro" | "vencido",
  registrado_por: user_id,                  // pos o admin
  registrado_en: timestamp,
  observaciones: string,
  reemplazo_generado_id: venta_id | null,   // si causa == falla_produccion
  cliente_afectado_id: cliente_id | null,   // si aplica
}
```

**Política por causa**:

| Causa | ¿Reemplazo al cliente? | ¿Quién paga? | Sistema registra |
| --- | :-: | --- | --- |
| `falla_produccion` | ✅ sí | Aquazaku | Descarte + reposición |
| `mal_manejo_cliente` | ❌ no | Cliente asume | Descarte + entrada al historial del cliente |
| `vencido` | ❌ no | Nadie | Descarte (sin clasificar) |
| `otro` | depende de revisión admin | depende | Descarte + flag para revisión |

**El `pos` o `admin` debe clasificar la causa obligatoriamente** al registrar. Sin clasificar, no se descarta.

**Patrón compartido con [RN-BAS-08](/dominio/botellones-y-bases/)** (recargo por daño de base):

- El sistema hace **visible** el historial de descarte por `mal_manejo_cliente` per cliente.
- **El admin decide** si inactiva al cliente. NO es castigo automático.
- Visibilidad sin automatización: el poder de decisión queda en el humano.

---

## Una sola bodega

### RN-STK-07 — La planta de Campo de la Cruz es la única bodega y el único punto de venta

**Estado:** ✅ Confirmada — cerrá las preguntas 🟢
"¿Hay más de un punto de venta?" y "¿Hay más de una bodega?" de
[Qué falta preguntar](/empezar/pendientes/).

```
stock_locations = ["BODEGA"]   // una sola
```

**Implicaciones**:

- No hay modelo multi-bodega. No hay transferencias entre bodegas.
- No hay stock itinerante (porque no hay `seller` con carga de camión — el `seller` solo contacta, ver [modelo operativo](/empezar/pendientes/)).
- `pos` vende directo desde `BODEGA` ([RN-STK-01](#rn-stk-01--el-stock-de-producto-se-controla-por-ubicación)).
- Si en algún momento Aquazaku abre una segunda planta o vende en otra ciudad, esta regla se reabre como decisión explícita — no es un toggle.

---

## Preguntas abiertas

- ¿Se controlan las **bolsas** como insumo, además de tapas y sellos?
- ¿Se define stock mínimo de tapas y sellos que dispare alerta de reposición?
- ¿Se compran insumos de tratamiento de agua? ¿Se controlan o son gasto?
- ¿Se lleva cuenta corriente con proveedores o se paga contra entrega?
- ¿Cada cuánto se hace inventario físico?

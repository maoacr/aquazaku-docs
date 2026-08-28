---
title: Proveedores y compras
description: Reposición de insumos y su impacto en el stock de Aquazaku.
sidebar:
  order: 7
---

Del lado de entrada del negocio: qué se compra, a quién, y cómo impacta el
inventario.

:::caution[Aquazaku produce, no revende]
El producto vendible **no entra por compra**: se envasa en planta
([Producción y agua](/dominio/produccion/)).

Lo que sí se compra:

| Qué | Categoría |
| --- | --- |
| **Tapas** y **sellos termoencogibles** | Insumo de empaque ([RN-STK-04](/dominio/stock/)) |
| **Botellones** | Activo retornable ([RN-ENV-06](/dominio/botellones-y-bases/)) |
| **Bases** | Activo retornable identificado |
| Bolsas de 600 ml y 300 ml | Insumo — se controlan, **por kilo al comprar** ([RN-INS-02](/dominio/insumos/)) |

Una compra que suma producto terminado al stock de bodega es, casi seguro, un
error de registro.
:::

### RN-PRO-01 — Un proveedor no se borra, se desactiva

**Estado:** ✅ Confirmada (27-ago-2026).

Mismo criterio que clientes ([RN-CLI-02](/dominio/clientes/)): un proveedor con
historial de compras se desactiva, no se elimina.

---

### RN-PRO-02 — La compra impacta el stock al recibirse, no al pedirse

**Estado:** ✅ Confirmada (27-ago-2026).

Una orden de compra no mueve inventario. El stock de bodega aumenta cuando la
mercadería **se recibe** y alguien la registra como recibida.

**Por qué:** si el pedido sumara stock, el sistema mostraría producto que todavía
está en el camión del proveedor, y las ventas se harían contra existencias que
no están.

---

### RN-PRO-03 — La recepción registra qué llegó realmente

**Estado:** ✅ Confirmada (27-ago-2026).

Lo recibido puede diferir de lo pedido. La recepción registra las cantidades
reales, y la diferencia queda visible.

**Por qué:** cerrar la recepción con las cantidades del pedido en vez de las
reales mete el faltante del proveedor en tu propio inventario.

---

### RN-PRO-04 — El costo de compra se congela en el documento

**Estado:** ✅ Confirmada (27-ago-2026).

Igual que el precio de venta ([RN-VEN-04](/dominio/ventas/)): el costo queda
guardado en la recepción y no se reescribe con compras posteriores.

**Por qué:** sin costo histórico no se puede calcular margen real de un período.

---

### RN-PRO-05 — La compra no crea inventario nuevo: le pone nombre al que ya entra

**Estado:** ✅ Confirmada (27-ago-2026).

Botellones, bases e insumos **ya tienen su camino de entrada** al parque y al
stock. Lo que la compra agrega es **de quién vino, cuánto costó y cómo se
paga** — no un segundo inventario.

Por eso una compra escribe el documento **y** el movimiento de inventario en la
misma transacción, igual que una venta escribe la venta y el descuento de stock.
Registrar la compra sin mover el inventario dejaría mercadería pagada que el
sistema no ve; mover el inventario sin la compra deja stock que apareció de la
nada.

:::note[Los caminos sueltos siguen existiendo, y no son un duplicado]
`POST /botellones/compra` y `POST /bases/compra` se quedan para lo que entra
**sin documento de compra**: la carga inicial del parque, o una corrección.

Es la misma convivencia que ya tienen `compra` y `ajuste` en botellones — dos
formas legítimas de que cambie el total, con distinto respaldo. Lo que las
distingue no es el efecto sino **qué se puede reconstruir después**.
:::

---

### RN-PRO-06 — Hoy se paga de contado; el crédito se modela igual

**Estado:** ✅ Confirmada (27-ago-2026).

La operación actual paga **todo de contado o por transferencia**. Ningún
proveedor fía.

Aun así la compra lleva `medio_de_pago` con los tres valores —`efectivo`,
`transferencia`, `credito`— igual que la venta. **El campo existe desde el
primer día; la operación decide cuándo usarlo.**

**Por qué modelarlo sin usarlo:** agregarlo después obligaría a migrar las
compras ya registradas y a decidir qué significan retroactivamente. Modelarlo
ahora cuesta una columna.

**Y por qué NO se construye la cuenta corriente completa:** no existe una sola
compra a crédito. Diseñar plazos, autorizaciones y qué pasa con un atraso sería
inventar reglas que el negocio nunca ejerció — el mismo error que se evitó con
el valor de reposición de [RN-BAS-08](/dominio/botellones-y-bases/).

---

### RN-PRO-07 — Una compra a crédito lleva fecha de vencimiento, y lo vencido avisa

**Estado:** ✅ Confirmada (27-ago-2026).

Cuando el medio de pago es `credito`, la fecha de vencimiento es **obligatoria**.
No se estima ni se calcula con un plazo por defecto: la dice el proveedor.

El aviso es **lo vencido**, y por eso no necesita ningún umbral: o pasó la fecha
o no pasó. Es más simple que
[RN-BAS-13](/dominio/botellones-y-bases/) —donde el umbral había que
derivarlo— porque acá el dato ya es una fecha.

:::caution[Qué NO hay todavía]
No hay saldo por proveedor, ni registro de pagos parciales, ni cartera por
antigüedad. Una compra a crédito está **pendiente o pagada**, y nada más.

Cuando existan compras a crédito de verdad y el negocio sepa cómo las maneja,
eso crece — y arrastra a [M11](/arquitectura/roadmap/), que hoy es cartera de
clientes y pasaría a ser de los dos lados.
:::

---

## Preguntas abiertas

- ~~¿Se compran también insumos de tratamiento de agua (cloro, filtros)? ¿Se
  controlan en stock o se consideran gasto?~~ ✅ **Respondida el 22-ago-2026**:
  son **gasto**, no inventario — [RN-INS-04](/dominio/insumos/).
- ¿Se compra el agua a granel, o viene de pozo propio? Es la misma pregunta que
  [RN-PRD-03](/dominio/produccion/) — y sigue sin respuesta.
- ~~¿Se controla stock de insumos de empaque (bolsas, tapas), o solo del producto
  terminado?~~ ✅ **Respondida el 22-ago-2026**: se controlan tapas, sellos **y
  bolsas** — [insumos](/dominio/insumos/). Las bolsas se compran por kilo y se
  guardan por unidad ([RN-INS-02](/dominio/insumos/)).
- ~~¿Se lleva cuenta corriente con proveedores, o se paga contra entrega?~~ ✅
  **Respondida el 27-ago-2026**: hoy **todo de contado o transferencia**. El
  crédito se modela pero no se ejerce — [RN-PRO-06](#rn-pro-06--hoy-se-paga-de-contado-el-crédito-se-modela-igual).
- ¿Hay control de lotes o vencimiento?

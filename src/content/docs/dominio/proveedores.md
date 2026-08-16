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
| Bolsas de 600 ml y 300 ml | Insumo — *a confirmar si se controlan* |

Una compra que suma producto terminado al stock de bodega es, casi seguro, un
error de registro.
:::

### RN-PRO-01 — Un proveedor no se borra, se desactiva

**Estado:** 🟡 Supuesto

Mismo criterio que clientes ([RN-CLI-02](/dominio/clientes/)): un proveedor con
historial de compras se desactiva, no se elimina.

---

### RN-PRO-02 — La compra impacta el stock al recibirse, no al pedirse

**Estado:** 🟡 Supuesto

Una orden de compra no mueve inventario. El stock de bodega aumenta cuando la
mercadería **se recibe** y alguien la registra como recibida.

**Por qué:** si el pedido sumara stock, el sistema mostraría producto que todavía
está en el camión del proveedor, y las ventas se harían contra existencias que
no están.

---

### RN-PRO-03 — La recepción registra qué llegó realmente

**Estado:** 🟡 Supuesto

Lo recibido puede diferir de lo pedido. La recepción registra las cantidades
reales, y la diferencia queda visible.

**Por qué:** cerrar la recepción con las cantidades del pedido en vez de las
reales mete el faltante del proveedor en tu propio inventario.

---

### RN-PRO-04 — El costo de compra se congela en el documento

**Estado:** 🟡 Supuesto

Igual que el precio de venta ([RN-VEN-04](/dominio/ventas/)): el costo queda
guardado en la recepción y no se reescribe con compras posteriores.

**Por qué:** sin costo histórico no se puede calcular margen real de un período.

---

## Preguntas abiertas

- ¿Se compran también insumos de tratamiento de agua (cloro, filtros)? ¿Se
  controlan en stock o se consideran gasto?
- ¿Se compra el agua a granel, o viene de pozo propio? Es la misma pregunta que
  [RN-PRD-03](/dominio/produccion/) — y sigue sin respuesta.
- ¿Se controla stock de insumos de empaque (bolsas, tapas), o solo del producto
  terminado? Si se controla, la producción también los consume.
- ¿Se lleva cuenta corriente con proveedores, o se paga contra entrega?
- ¿Hay control de lotes o vencimiento?

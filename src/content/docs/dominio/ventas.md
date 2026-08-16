---
title: Ventas
description: Reglas de negocio de ventas, anulación, precios y crédito en Aquazaku.
sidebar:
  order: 5
---

Reglas que gobiernan el registro, cobro y anulación de una venta.

## Qué es una venta

Una venta es el registro de que un producto salió del control de Aquazaku hacia
un cliente, a cambio de un pago inmediato o de una deuda.

Puede ocurrir en dos contextos, y esa diferencia define los roles del sistema:

| Contexto | Rol | Cómo opera |
| --- | --- | --- |
| **Punto de venta** — el cliente viene | `pos` | Con conexión, contra stock de bodega |
| **En ruta** — el vendedor va | `seller` | Sin señal, contra la carga de su vehículo. Ver [Rutas](/dominio/rutas/) |

---

### RN-VEN-01 — Toda venta registra qué, a quién, cuándo, quién y cómo se pagó

**Estado:** 🟡 Supuesto

Una venta sin responsable identificado no se puede registrar. El medio de pago
es parte de la venta, no un dato posterior.

**Por qué:** sin responsable no hay a quién preguntarle cuando la rendición no
cuadra. Es la base de toda la trazabilidad del sistema.

---

### RN-VEN-02 — Una venta confirmada no se edita

**Estado:** 🟡 Supuesto

Una vez confirmada, una venta es inmutable. Si está mal, se **anula** y se
registra una nueva. No existe "editar venta".

**Por qué:** una venta editable destruye la auditoría. Si el monto de ayer puede
cambiar hoy, ningún reporte, arqueo ni rendición es confiable. Esta es la regla
que más se pide romper por comodidad y la que más caro sale romper.

:::danger[No negociable]
Si el cliente pide "poder corregir la venta", la respuesta es anular y rehacer.
El costo de un campo editable es que nunca más vas a poder responder
"¿qué pasó realmente ese día?".
:::

---

### RN-VEN-03 — Anular una venta revierte todos sus efectos

**Estado:** 🟡 Supuesto

Anular devuelve el producto al stock de la ubicación de origen, revierte el
movimiento de envases y ajusta el saldo del cliente si fue a crédito.

La anulación exige **motivo** y queda registrada con su responsable y fecha.
La venta anulada no desaparece: cambia de estado.

**Por qué:** una anulación que no revierte el inventario genera faltantes
fantasma que después nadie puede explicar.

---

### RN-VEN-04 — El precio se congela en el comprobante

**Estado:** 🟡 Supuesto

La venta guarda el precio unitario aplicado al momento de registrarse. Un cambio
posterior en la lista de precios **no** modifica ventas ya hechas.

**Por qué:** si el precio se lee por referencia, subir la lista reescribe el
historial y los reportes de meses cerrados cambian solos.

---

### RN-VEN-05 — Solo se vende a crédito a clientes habilitados

**Estado:** 🟡 Supuesto

Una venta a crédito requiere que el cliente tenga crédito habilitado y saldo
disponible dentro de su límite. Si no, la venta es de contado o no procede.

**Por qué:** es el control que evita que la cobranza se vuelva incobrable.
Ver [RN-CLI-03](/dominio/clientes/).

---

### RN-VEN-06 — Una venta en ruta pertenece a la ruta del día

**Estado:** 🟡 Supuesto

Toda venta registrada por un `seller` desde la app mobile queda asociada a él y a
su ruta abierta. No se puede registrar una venta en ruta sin ruta abierta.

**Por qué:** es lo que hace posible que la rendición cuadre al cierre.
Ver [RN-RUT-03](/dominio/rutas/).

---

### RN-VEN-07 — El cobro es un hecho separado de la venta

**Estado:** 🟡 Supuesto

Una venta a crédito genera deuda. El cobro es un documento distinto, con su
propia fecha y responsable, que reduce el saldo del cliente.

**Por qué:** modelar el cobro como un campo de la venta hace imposible registrar
pagos parciales o un pago que cubre varias ventas.

---

## Preguntas abiertas

Estas hay que responderlas con Aquazaku antes de implementar:

- ¿Existe venta a crédito, o todo es de contado?
- ¿Se emite comprobante fiscal? ¿Qué tipo?
- ¿Hay descuentos o listas de precio distintas por tipo de cliente?
- ¿Quién puede anular una venta y hasta cuándo? Hoy la matriz solo se lo permite
  a `admin` — ¿es viable en la operación diaria del punto de venta?
- ¿Se aceptan devoluciones de producto, o solo anulación de la venta completa?
- ¿Una venta puede incluir el préstamo de una base, o el préstamo es una
  operación aparte? Ver [RN-BAS-02](/dominio/botellones-y-bases/).

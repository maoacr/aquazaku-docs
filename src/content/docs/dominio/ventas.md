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

**Estado:** ✅ Confirmada — regla consolidada.

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

**Estado:** ✅ Confirmada — base consolidada, reglas complementarias abajo.

Anular devuelve el producto al stock de la ubicación de origen, revierte el
movimiento de envases y ajusta el saldo del cliente si fue a crédito.

La anulación exige **motivo obligatorio** y queda registrada con su responsable
y fecha. La venta anulada no desaparece: cambia de estado.

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

**Estado:** ✅ Confirmada — modelo cerrado en [RN-CLI-12](/dominio/clientes/).

Una venta a crédito requiere que el cliente tenga crédito habilitado **y** esté
verificado ([RN-CLI-15](/dominio/clientes/)). Si cualquiera de las dos
condiciones falla, la venta es de contado o no procede.

La verificación compuesta que el backend tiene que chequear es:

```
cliente.credito.habilitado == true
  AND
cliente.verificacion.estado == "verificado"
  AND (
    cliente.credito.limite_monto == null
    OR  saldo_deuda + monto_venta <= cliente.credito.limite_monto
  )
```

**Por qué:** es el control que evita que la cobranza se vuelva incobrable. Ver
[RN-CLI-12](/dominio/clientes/) y [RN-CLI-15](/dominio/clientes/).

:::note[Sobre el bloqueo en ruta — pregunta #21]
La pregunta original de "¿qué pasa si el cliente supera el límite de crédito en
plena ruta?" está ahora RESPONDIDA por construcción: el chequeo es contra
`limite_monto` (que puede ser `null` = sin tope). Si `limite_monto == null`,
no hay forma de bloquear — el sistema no tiene un número con el cual bloquear.

Hoy, con la operación chica y los pocos clientes con crédito, se arranca con
`null` en todos. Cuando un admin configure un tope para alguien específico,
ese cliente sí queda sujeto al chequeo.
:::

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

### RN-VEN-08 — Anulación de venta: solo el autor, comentario obligatorio

**Estado:** ✅ Confirmada — cerrá la pregunta #9 de
[Qué falta preguntar](/empezar/pendientes/).

La anulación tiene **dos invariantes** además del comentario obligatorio que
ya estaba en [RN-VEN-03](#rn-ven-03--anular-una-venta-revierte-todos-sus-efectos):

1. **Solo el autor de la venta puede anularla** (entre `seller` y `pos`).
   - `pos` **no** anula ventas hechas por `seller`.
   - `seller` **no** anula ventas hechas por `pos`.
   - El chequeo va sobre el `user_id` del autor original, sin importar bajo qué
     rol se hizo la venta (los usuarios pueden tener más de un rol —
     [RN-ACC-01](/dominio/roles-y-permisos/)).
2. **`admin` puede anular cualquier venta**, sin importar el autor ni la fecha.

**Matriz efectiva:**

| Caso | Quién puede anular | Comentario obligatorio |
| --- | --- | :-: |
| Venta del día en curso, autor = `pos` | `pos` (autor) | ✅ |
| Venta del día en curso, autor = `seller` | `seller` (autor) | ✅ |
| Venta del día en curso, autor = `admin` | `admin` | ✅ |
| Venta de día anterior, autor = `pos` | `admin` | ✅ |
| Venta de día anterior, autor = `seller` | `admin` | ✅ |
| Cualquier día, cualquier autor | `admin` | ✅ |

**El comentario NO es un campo opcional.** Sin texto, la anulación no se puede
guardar. Esto aplica igual para `admin` — quien tiene más permisos, también deja
más rastro.

**Por qué:** el comentario obligatorio es lo que hace que cualquier reversión
quede en el log con motivo legible. Si en tres meses hay que responder
"¿por qué desapareció esta venta del día?", la respuesta está en una fila del
log, no en la memoria de alguien.

---

## Preguntas abiertas

Estas hay que responderlas con Aquazaku antes de implementar:

- ¿Se emite comprobante fiscal? ¿Qué tipo?
- ¿Hay descuentos o listas de precio distintas por tipo de cliente?
- ¿Se aceptan devoluciones de producto, o solo anulación de la venta completa?
- ¿Una venta puede incluir el préstamo de una base, o el préstamo es una
  operación aparte? Ver [RN-BAS-02](/dominio/botellones-y-bases/).

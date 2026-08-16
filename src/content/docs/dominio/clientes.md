---
title: Clientes
description: Identidad, saldo, crédito y asignación a ruta de los clientes de Aquazaku.
sidebar:
  order: 6
---

### RN-CLI-01 — Un cliente se identifica de forma única

**Estado:** 🟡 Supuesto

Cada cliente tiene un identificador único y estable. Dos registros del mismo
cliente son un problema de datos, no una opción.

**Por qué:** el saldo de deuda y el saldo de envases se acumulan por cliente.
Duplicar el cliente parte el saldo en dos y ninguno de los dos es real.

:::caution[A definir]
Falta decidir cuál es la clave natural: ¿documento de identidad, teléfono,
razón social? En venta de ruta a hogares, muchas veces no hay documento y la
dirección es la identidad real. Hay que confirmarlo con Aquazaku.
:::

---

### RN-CLI-02 — Un cliente no se borra, se desactiva

**Estado:** 🟡 Supuesto

Un cliente con historial nunca se elimina. Se marca como inactivo y deja de
aparecer en las operaciones nuevas.

**Por qué:** borrarlo rompe el historial de ventas y deja envases sin dueño.

---

### RN-CLI-03 — El saldo del cliente es derivado, no editable

**Estado:** 🟡 Supuesto

```
saldo de deuda = ventas a crédito − cobros registrados
```

No existe "editar el saldo". Se corrige con un documento: un cobro, una
anulación o un ajuste con motivo.

**Por qué:** un saldo editable a mano hace que la cobranza deje de ser auditable.
Es el mismo principio que [RN-STK-02](/dominio/stock/).

---

### RN-CLI-04 — El crédito es una habilitación explícita con límite

**Estado:** 🟡 Supuesto

Un cliente no tiene crédito por defecto. Se le habilita, con un límite, y alguien
queda registrado como responsable de esa habilitación.

**Por qué:** sin límite explícito la deuda crece hasta que alguien la nota, y
para entonces ya es incobrable. Ver [RN-VEN-05](/dominio/ventas/).

---

### RN-CLI-05 — Un cliente puede pertenecer a una ruta

**Estado:** 🟡 Supuesto

La asignación a una ruta define a quién visita cada vendedor. Un cliente sin ruta
sigue pudiendo comprar en bodega.

:::caution[Supuesto fuerte]
Asumimos **una sola ruta por cliente**. Si en la práctica un cliente puede ser
visitado por más de un vendedor o por rutas distintas según el día, el modelo
cambia. Confirmar antes de implementar.
:::

---

### RN-CLI-06 — Un cliente tiene tres saldos distintos

**Estado:** 🟡 Supuesto

La ficha del cliente lleva tres cuentas que **no se mezclan**:

| Saldo | Unidad | Granularidad |
| --- | --- | --- |
| Deuda | Dinero | Cliente |
| Botellones en su poder | Cantidad | Cliente |
| Bases prestadas | Lista de IDs | **Por dirección** |

**Por qué:** son tres deudas distintas. Un cliente puede estar al día con la
plata, deberte quince botellones y tener dos bases sin devolver. Un solo campo
"estado de cuenta" no dice nada útil.

Ver [Botellones y bases](/dominio/botellones-y-bases/).

---

### RN-CLI-07 — La dirección es una entidad, no un campo de texto

**Estado:** ✅ Confirmada — se deriva de [RN-BAS-03](/dominio/botellones-y-bases/).

Un cliente tiene **una o varias direcciones**. Cada base prestada se asigna a una
dirección concreta, no al cliente.

```
Cliente
├── Dirección A  → base #A-0412
├── Dirección B  → base #A-0913
└── Dirección C  → base #B-0027
```

**Por qué:** si la dirección fuera un campo de texto en la ficha del cliente, no
podrías responder "¿a cuál de sus tres locales voy a buscar la base #A-0913?".
El préstamo deja de ser reclamable.

:::danger[Impacto en el modelo]
Esto es una relación `Cliente 1—N Dirección`, y `Dirección 1—N Base`.
No es un detalle de UI: cambia el esquema de la base de datos, el flujo de visita
del `seller` y la asignación de clientes a rutas.
:::

---

## Preguntas abiertas

- ¿Se distinguen tipos de cliente (hogar vs. comercio) con precios distintos?
- ¿La **ruta** se asigna al cliente o a la dirección? Si un cliente tiene locales
  en zonas distintas, podrían corresponder a rutas distintas —
  y [RN-CLI-05](#rn-cli-05--un-cliente-puede-pertenecer-a-una-ruta) se cae.
- ¿El saldo de botellones se lleva por cliente o por dirección?
  Hoy documentado a nivel cliente ([RN-ENV-04](/dominio/botellones-y-bases/)).
- ¿Qué pasa cuando un cliente supera su límite de crédito en plena ruta?
  ¿El `seller` puede vender igual, o el sistema lo bloquea?
- ¿Se cobra depósito o garantía por la base prestada?

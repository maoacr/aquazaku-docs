---
title: Gastos y tesorería
description: Dónde vive la plata de Aquazaku, cómo entra, cómo sale, y qué hace que las cuentas cuadren.
sidebar:
  order: 11
---

El lado del dinero que no es una venta ni una compra de mercadería: los recibos,
la nómina, el arriendo, los repuestos. Y las cuentas donde esa plata vive.

:::tip[La idea de la que sale todo lo demás]
**Todo peso que entra o sale pasa por un solo libro.**

No hay una tabla de gastos, otra de ingresos y otra de traslados: hay
`movimientos_de_dinero`, y el saldo de una cuenta es la suma de sus filas. La
única forma de mover plata es escribir ahí.

Con tablas separadas, el saldo sería la suma de N tablas — y el día que alguien
agregue la N+1 y se olvide de sumarla, la caja descuadra **y nada falla**: la
consulta sigue devolviendo un número, solo que el equivocado. Es la misma ley de
conservación de [los botellones](/dominio/botellones-y-bases/), aplicada al
dinero.
:::

## Dónde vive la plata

| Cuenta | Cuántas | Para qué |
| --- | :-: | --- |
| **Caja menor** | 1 | El efectivo del día a día |
| **Caja mayor** | 1 | El efectivo que no se toca para gastos chicos |
| **Cuenta bancaria** | N | Una fila por cuenta real, con su banco y su número |

Las dos cajas **nacen con el sistema** (las siembra la migración `0030`): no son
una preferencia, el negocio las tiene, y un módulo de tesorería sin ellas no
puede registrar nada. Nacen en cero — el saldo inicial lo carga quien cuenta la
plata, y queda como un movimiento con su fecha.

---

### RN-GAS-01 — El saldo no existe como dato: es la suma del libro

**Estado:** ✅ Confirmada (12-nov-2026).

No hay columna de saldo en ninguna cuenta. `saldo = SUM(efecto)` sobre
`movimientos_de_dinero`.

**Por qué:** el criterio de [ADR-0008](/decisiones/0008-saldo-derivado-o-materializado/)
pregunta si *dos personas pueden pelearse por la última unidad*. Acá no: los
movimientos de una cuenta los registra una persona, de a uno. Y el premio de
derivarlo es grande — **anular un gasto revierte el saldo sin escribir en
ninguna otra tabla**, así que la reversión no puede quedar a medias.

El sobregiro se frena igual, con un `FOR UPDATE` sobre la fila de la cuenta: dos
gastos simultáneos contra la misma caja se serializan y el segundo vuelve a
sumar el libro ya con el primero adentro.

---

### RN-GAS-02 — El signo lo pone el tipo del movimiento, no una columna

**Estado:** ✅ Confirmada (12-nov-2026).

`monto` va siempre positivo. `efecto` es una **columna generada** que le pone el
signo según el tipo: `egreso`, `traslado_salida` y `faltante_de_arqueo` restan;
el resto suma.

**Por qué:** es el mecanismo de [ADR-0006](/decisiones/0006-invariantes-en-la-base/)
para que un derivado no pueda desincronizarse. No hay forma de escribir una fila
donde el tipo diga «entra» y el número reste.

**Corolario:** por eso un faltante de arqueo es un *tipo distinto* de un
sobrante, en vez de un `ajuste` con monto negativo. Cada tipo tiene un signo y
no puede tener otro.

---

### RN-GAS-03 — Ninguna cuenta queda en negativo, por ninguna vía

**Estado:** ✅ Confirmada (12-nov-2026).

Un gasto que exceda el saldo se rechaza. Y **anular también**: anular un ingreso
de $500.000 del que ya se gastaron $400.000 dejaría la cuenta en −$400.000.

**Por qué:** una caja con saldo negativo no existe — no se puede sacar de un
cajón plata que no está. Si el sistema lo permite, el número deja de ser
conciliable contra lo que hay físicamente, y entonces el módulo no sirve para lo
único que tiene que servir.

Cuando «quedó en negativo» de verdad, lo que falta es un ingreso sin registrar.
El error lo dice así, para que se registre eso en vez de tapar el hueco.

---

### RN-GAS-04 — El saldo inicial se carga una sola vez por cuenta

**Estado:** ✅ Confirmada (12-nov-2026).

Un índice único parcial lo garantiza: una cuenta tiene como máximo un
`saldo_inicial` **vigente**.

**Por qué:** cargarlo dos veces no es un duplicado inofensivo, es la plata del
negocio contada dos veces. Y es el peor tipo de error, porque **las dos filas
son legítimas por separado**: nada en ninguna de las dos la delata.

Si se cargó mal, se anula y se vuelve a cargar — el índice excluye los anulados
justamente para eso.

---

### RN-GAS-05 — Un movimiento no se edita: se anula con motivo

**Estado:** ✅ Confirmada (12-nov-2026).

Mismo criterio que [RN-VEN-02](/dominio/ventas/). Un trigger permite **una sola**
transición —anularlo con motivo, y una sola vez— y el rol de la aplicación no
tiene permiso de `DELETE`.

**Por qué:** la fila dice que entró o salió plata. Corregirle el monto en
caliente reescribiría el saldo de un período ya conciliado. Y borrarla cambiaría
el saldo sin dejar rastro, que es el descuadre imposible de rastrear meses
después: el libro ya no tendría la fila que lo explica.

El motivo es obligatorio y de al menos 10 caracteres, porque es lo que va a
explicar el descuadre dentro de tres meses.

---

### RN-GAS-06 — El tipo de gasto es un HECHO, no una clasificación contable

**Estado:** ✅ Confirmada (12-nov-2026).

`tipo_de_egreso` contesta **qué se pagó**: `recibo_publico`, `arriendo`,
`nomina`, `software`, `servicio`, `repuesto`, `mantenimiento`, `litografia`,
`impuesto`, `equipo`, `mueble`, `transporte`, `comision_bancaria`, `otro`.

Si eso es **costo, gasto o activo fijo** vive aparte, en `clasificacion`, que
**nace en `NULL`**.

**Por qué:** la clasificación la da una contadora, depende del umbral de
capitalización, y grabarla en un `pg_enum` la congelaría —cambiar un enum en
Postgres es un lock de tabla y una reconstrucción de tipo—. El hecho operacional
no depende de nadie: es lo que sabe quien registra el gasto.

Separarlos es lo que permite que el módulo funcione **hoy**, sin inventarse una
respuesta contable. Registrar el hueco es lo correcto; llenarlo después es un
`UPDATE`, no una migración.

:::note[`comision_bancaria` tiene tipo propio a propósito]
No cae en `otro` porque es la razón número uno por la que una cuenta bancaria no
cuadra contra el extracto: cuotas de manejo y 4x1000 son débitos que el banco
hace solo y que nadie registra.
:::

:::note[`otro` existe porque la alternativa es peor]
Sin un lugar donde caiga lo que no encaja, el gasto **no se registra** — y
entonces la caja deja de cuadrar contra la plata física. Un gasto mal clasificado
se corrige; uno que falta no se descubre. Mismo criterio que
[`causa_descarte.otro`](/dominio/stock/).
:::

---

### RN-GAS-07 — Lo que mueve inventario es una compra; lo que no mueve nada es un gasto

**Estado:** ✅ Confirmada (12-nov-2026).

`tipo_de_egreso` **no tiene** `insumo`, ni `base`, ni `botellon`.

**Por qué:** esos tres ya tienen su camino. Una
[compra a proveedor](/dominio/proveedores/) escribe el documento **y** mueve el
inventario en la misma transacción. Si se pudieran registrar también como gasto,
el mes se contaría dos veces — y no por descuido: sería la forma natural de
hacerlo.

Es la regla de `lineas_compra_una_sola_cosa` generalizada. Y al no existir el
valor en el enum, **el doble conteo no se evita con disciplina: no hay dónde
escribirlo.**

**Pero eso dejaba un hueco al revés**, y lo cierra [RN-GAS-11](#rn-gas-11--la-compra-a-proveedor-descuenta-de-una-cuenta):
si la compra no se podía registrar como gasto y tampoco tocaba ninguna caja,
entonces la plata que se le paga al proveedor no salía de ningún lado.

:::tip[Esto es lo que desbloquea el módulo]
De los once tipos de gasto del negocio, dos ya se podían registrar (insumos y
bases/botellones, por M9) y **ocho no tenían dónde entrar**: no existía la
«línea de servicio». El cloro y los filtros son el caso más claro —
[RN-INS-04](/dominio/insumos/) dice que son gasto y no inventario, y hasta ahora
eso era cierto porque *no había dónde registrarlos*.
:::

---

### RN-GAS-08 — La fecha del movimiento es cuándo ocurrió, no cuándo se registró

**Estado:** ✅ Confirmada (12-nov-2026).

`ocurrido_el` es el día en que la plata se movió. `created_at` dice cuándo entró
al sistema.

**Por qué:** un recibo se paga el martes y se carga el viernes. Los reportes del
mes se leen por `ocurrido_el`; `created_at` sirve para auditar, no para contar.
Es la [convención de hechos y derivados](/convenciones/hechos-y-derivados/): el
valor depende de un momento que ya pasó, así que se guarda.

No puede ser futura —un gasto futuro no ocurrió— y se compara contra
[la fecha de la planta](/arquitectura/entornos/), no contra `CURRENT_DATE`: la
base corre en UTC en producción, así que después de las 19:00 de Colombia un
`CHECK` contra la fecha del servidor rechazaría un gasto de hoy por «futuro».

---

### RN-GAS-09 — Una cuenta con saldo no se desactiva

**Estado:** ✅ Confirmada (12-nov-2026).

Las cuentas bancarias se desactivan, no se borran. Pero solo si su saldo es cero.
Y las **cajas no se desactivan nunca**: existen siempre.

**Por qué:** esconder una cuenta con plata haría bajar el total del negocio sin
un movimiento que lo explique. Si la cuenta se cerró de verdad, primero se
traslada el saldo o se registra el egreso que la vació — las dos cosas dejan el
hecho escrito.

---

### RN-GAS-10 — El dinero que entra por ventas se registra como recaudo, y no toca M6

**Estado:** ✅ Confirmada (12-nov-2026).

El efectivo de las ventas entra al libro como un `ingreso` de tipo
`recaudo_de_ventas`, cuando alguien lo mete a la caja.

**Por qué:** la venta ya quedó escrita cuando ocurrió
([Ventas](/dominio/ventas/)). En qué cuenta aterrizó la plata es un hecho
**distinto y posterior** — en la vida real el vendedor entrega el efectivo del
día y recién ahí la plata está en la caja.

**Corolario importante:** el libro de dinero y
[el extracto del contador](/dominio/contador/) son **dos libros distintos**. Uno
cuenta documentos (base devengo), el otro cuenta plata (base caja). Ninguno es
el otro, y eso no es un defecto a corregir: son las dos preguntas que hay que
poder contestar por separado.

---

### RN-GAS-11 — La compra a proveedor descuenta de una cuenta

**Estado:** ✅ Confirmada (12-nov-2026).

Registrar una compra en [Proveedores](/dominio/proveedores/) escribe el
documento, mueve el inventario **y saca la plata de una cuenta**, todo en la
misma transacción. Lo de contado paga al registrarse; lo de crédito paga el día
que se marca pagada.

**Por qué:** hasta acá M9 movía el inventario y congelaba el costo, pero no
tocaba ninguna caja. La plata salía del cajón de verdad y el saldo del sistema
seguía igual, así que el módulo mostraba **más plata de la que hay**, por el
total de lo comprado a proveedores, y ningún movimiento lo explicaba.

Es el mismo argumento por el que la compra ya movía el inventario: separar el
documento del efecto deja que alguien registre uno y se olvide del otro.

:::caution[Si la cuenta no tiene saldo, la compra entera se cae]
Mercadería incluida. Registrar lo que entró sin poder pagarlo deja un inventario
que el dinero no explica — y el faltante aparecería después, en un arqueo, sin
nada que lo ate a esa compra.
:::

**El pago NO lleva categoría de gasto.** Un egreso tiene `tipo_de_egreso` **o**
`compra_relacionada`, exactamente uno, y lo garantiza un `CHECK`.

**Por qué:** qué se compró ya está escrito en las líneas, con cantidad y costo
unitario. Un tipo `pago_a_proveedor` sería una segunda clasificación del mismo
hecho, y las dos podrían decir cosas distintas. Además, como el desplegable de
gastos solo ofrece tipos, el pago de una compra **no se puede registrar
«suelto»**: RN-GAS-07 sigue valiendo y la única puerta es la compra misma.

**Una compra se paga una sola vez.** Un índice único parcial lo impide, y
excluye los anulados: si el pago se cargó en la cuenta equivocada, se anula y se
rehace.

---

## Lo que el tramo 1 todavía no trae

| Qué | Por qué espera |
| --- | --- |
| **Traslados entre cajas** | El libro ya tiene los dos tipos y los invariantes en la base; falta el servicio y la pantalla |
| **Arqueo de caja** | Contar la plata física y registrar la diferencia contra el libro |
| **Clasificación contable** | `clasificacion` existe y está en `NULL` — RN-GAS-06 |

Los cuatro tipos de movimiento que usan traslado y arqueo (`traslado_salida`,
`traslado_entrada`, `sobrante_de_arqueo`, `faltante_de_arqueo`) están declarados
en el enum **desde el primer día**, con sus `CHECK` y su índice único. No es
especulación: `efecto` es una columna generada cuya expresión enumera los tipos
negativos, y agregarle un valor después obliga a reconstruir la columna sobre una
tabla con historia. Cuatro renglones hoy dejan el tramo 2 puramente aditivo — el
mismo argumento por el que `medio_de_pago` nació con `credito`.

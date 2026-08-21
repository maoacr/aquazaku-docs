---
title: Productos y catálogo
description: "Qué vende Aquazaku: presentaciones, equivalencia en litros, precios por tipo de cliente y la frontera entre producto y envase retornable."
---

Este documento define **qué se vende**. No cuánto hay (eso es
[Stock](/dominio/stock/)), ni cómo se cobra (eso es [Ventas](/dominio/ventas/)),
ni qué envases están afuera (eso es
[Botellones y bases](/dominio/botellones-y-bases/)).

Es el catálogo: la lista de cosas que un `pos` puede elegir al registrar una
venta, con su precio y su equivalencia en litros.

:::note[Doc consolidado, no nuevo]
Buena parte de estas reglas ya estaban acordadas — vivían repartidas en
Producción, Ventas y Clientes. Este documento las reúne y agrega las que
faltaban. Las que vienen de otro lado **conservan su número original**: una
regla nunca se renumera.
:::

---

## Tres cosas que parecen una

El error más caro de este módulo es tratar estas tres como si fueran lo mismo.

| | **Producto** | **Presentación** | **Envase retornable** |
| --- | --- | --- | --- |
| Qué es | Lo que el cliente compra | Cómo viene empacado | El recipiente que vuelve |
| Ejemplo | Recarga de botellón | Paca de 20 bolsas de 600 ml | El botellón físico |
| Se vende | Sí | — es un atributo del producto | **No** |
| Tiene precio | Sí | — | No ([RN-ENV-06](/dominio/botellones-y-bases/)) |
| Sale y vuelve | No | — | Sí |
| Vive en | Este documento | Este documento | [Botellones y bases](/dominio/botellones-y-bases/) |

La paca sale y no vuelve. El botellón sale, se espera que vuelva, y a veces no
vuelve. **Son dos ciclos de vida distintos** y un solo campo `stock` no los
representa.

:::danger[Lo que se vende en una recarga es el agua, no el botellón]
Un cliente que recarga entrega un envase vacío y recibe uno lleno. Su saldo de
botellones **no cambia** — [RN-ENV-03](/dominio/botellones-y-bases/).

Si el catálogo modelara "botellón" como producto vendible, cada recarga
descontaría un envase del parque, y el inventario de envases se desangraría sin
que nadie lo note.
:::

---

## Presentaciones y equivalencia en litros

**Estado:** ✅ Confirmada — verificada con Aquazaku.

Esta tabla es el puente entre el agua y el catálogo. Todo el balance de
[producción](/dominio/produccion/) depende de ella.

| Presentación | Contenido unitario | Unidades | **Litros** |
| --- | --- | --- | --- |
| Paca de bolsas 600 ml | 600 ml | 20 | **12 L** |
| Paca de bolsas 300 ml | 300 ml | 50 | **15 L** |
| Botellón | 20 L | — | **20 L** |

Las equivalencias son **dato de configuración, no código** —
[RN-PRD-01](/dominio/produccion/). El día que salga una bolsa de 500 ml o una
paca de 24, el sistema tiene que absorberlo sin un despliegue.

---

## Reglas

### RN-CAT-01 — El catálogo es la única fuente de qué se puede vender

**Estado:** 🟡 Supuesto

Una venta solo puede referirse a un producto que existe en el catálogo y está
activo. No hay producto "suelto", ni línea de venta con descripción libre.

**Por qué:** una línea de venta con texto libre no se puede contar, ni costear,
ni descontar de stock. El primer producto fuera del catálogo rompe el balance de
litros de [Producción](/dominio/produccion/) sin dejar rastro.

---

### RN-CAT-02 — Un producto no se borra, se desactiva

**Estado:** 🟡 Supuesto

Un producto que deja de venderse se marca **inactivo**. Desaparece de la
pantalla de venta, pero sigue existiendo para las ventas históricas, los lotes
en stock y los reportes.

**Por qué:** una venta de marzo apunta a ese producto. Borrarlo deja
comprobantes que ya no se pueden leer y reportes que no cuadran. Es el mismo
principio que [RN-CLI-02](/dominio/clientes/) para clientes.

**Condición para desactivar:** que no queden unidades en stock. Un producto
inactivo con stock es inventario que nadie puede vender ni descartar.

---

### RN-CAT-03 — El precio vive en el producto

**Estado:** 🟡 Supuesto

Cada producto lleva sus tres precios encima: `precio_residencial`,
`precio_comercial` y `precio_minimo` — tal como los modela
[RN-VEN-12](/dominio/ventas/).

**Por qué:** no es una preferencia de diseño, se deriva del roadmap. **M6
(Ventas) depende de M0, M1, M2 y M5 — no de M10.** Si los precios vivieran en
M10, no se podría registrar una venta hasta tener M10 construido, y el orden de
módulos dejaría de cerrar.

M10 (Precios y promociones) no se lleva los precios: agrega **códigos de
descuento** encima ([RN-VEN-13](/dominio/ventas/)). El precio de lista sigue
siendo del producto.

---

### RN-CAT-04 — El precio mínimo es un piso, no un cuarto precio

**Estado:** ✅ Confirmada — se deriva de [RN-VEN-13](/dominio/ventas/).

`precio_minimo` no es una tercera lista de precios. Es el piso absoluto que
ningún descuento puede perforar:

```
precio_final = max(precio_lista − descuento, precio_minimo)
```

**Por qué:** un código de descuento mal cargado no puede dejar una venta en $0.
El piso es la red de seguridad, y por eso vive en el producto y no en el código
de descuento — el que se equivoca es el código, no el producto.

**Invariante:** `precio_minimo ≤ precio_comercial` y
`precio_minimo ≤ precio_residencial`. Un producto que no lo cumpla está mal
cargado y el sistema tiene que rechazarlo al guardarlo, no al vender.

---

### RN-CAT-05 — Comprar botellones no entra producto al catálogo

**Estado:** ✅ Confirmada — [RN-ENV-06](/dominio/botellones-y-bases/).

Cuando Aquazaku compra botellones para ampliar el parque, eso registra un
**activo retornable**, no una entrada de producto vendible. No toca el catálogo
ni el stock de producto terminado.

**Por qué:** es la frontera entre los dos ciclos de vida. Cruzarla hace que el
sistema crea que tiene producto para vender cuando lo que tiene son envases
vacíos.

---

### RN-CAT-06 — El catálogo lo edita solo `admin`

**Estado:** ✅ Confirmada — por Aquazaku, 21-ago-2026. El precio es un
parámetro del sistema y solo `admin` lo cambia.

`pos`, `seller` y `contador` **leen** el catálogo. Solo `admin` crea productos,
edita precios y desactiva.

**Por qué:** el precio es la variable más sensible del negocio. Un `pos` que
puede editar el precio de lista vuelve inútil todo el sistema de descuentos con
piso — bajaría el precio en vez de pedir un código.

Todo cambio de precio **se audita** ([RN-ACC-04](/dominio/roles-y-permisos/)):
quién lo cambió, cuándo, de cuánto a cuánto.

---

### RN-CAT-07 — Cambiar un precio no reescribe las ventas pasadas

**Estado:** ✅ Confirmada — [RN-VEN-04](/dominio/ventas/).

El precio se congela en el comprobante al momento de vender. Editar el catálogo
mañana no toca la venta de hoy.

**Por qué:** un comprobante es un hecho histórico. Si el reporte de marzo cambia
porque alguien tocó un precio en agosto, la contabilidad deja de ser
verificable.

---

### RN-CAT-08 — La primera entrega y la recarga son el mismo producto

**Estado:** ✅ Confirmada — por Aquazaku, 21-ago-2026.

Un cliente que nunca tuvo botellón paga **exactamente lo mismo** que uno que
recarga: el precio del agua. No se le cobra el envase, ni depósito, ni garantía.

Por lo tanto el catálogo tiene **un solo producto** de botellón —
`Recarga de botellón 20 L` — y no dos.

**Por qué:** el botellón no se vende, se intercambia
([RN-BAS-08](/dominio/botellones-y-bases/): *sin garantía nunca, sin depósito*).
Si el catálogo tuviera dos productos con precios distintos, estaría cobrando un
envase que el negocio no cobra.

**Dónde queda la diferencia entonces:** en el saldo de envases, no en la plata.
La primera entrega **aumenta en uno** el saldo de botellones del cliente
([RN-ENV-04](/dominio/botellones-y-bases/)); la recarga lo deja igual
([RN-ENV-03](/dominio/botellones-y-bases/)). Misma venta, distinto movimiento de
envase — y ese movimiento es de M7, no del catálogo.

:::tip[Precio vigente al 21-ago-2026: $10.000]
Es el valor **semilla**, no una constante. Vive en el producto como dato
editable ([RN-CAT-03](#rn-cat-03--el-precio-vive-en-el-producto)) y solo `admin`
lo cambia ([RN-CAT-06](#rn-cat-06--el-catálogo-lo-edita-solo-admin)).

Un precio escrito en el código es un despliegue cada vez que sube el agua.
:::

---

### RN-CAT-09 — El precio declara qué incluye, aunque hoy no haya IVA

**Estado:** 🟡 Supuesto — el hecho de negocio está confirmado; el mecanismo es
propuesta nuestra.

**Hoy Aquazaku no retiene IVA ni declara nada.** Pero va a llegar el momento de
conectar con facturación electrónica, retenciones y declaraciones según la ley
colombiana — es la misma expectativa que ya sostiene
[RN-VEN-11](/dominio/ventas/).

La respuesta **no** es construir el motor de impuestos ahora. Es no perder la
información que lo hace posible después.

```
producto = {
  ...,
  precio_residencial: number,
  precio_comercial: number,
  precio_minimo: number,
  precio_incluye_impuestos: bool,       // hoy: true (el precio es el que se cobra)
  tarifa_iva_porcentaje: number,        // hoy: 0
  ...
}

venta_linea = {
  ...,
  precio_aplicado: number,
  precio_incluia_impuestos: bool,       // snapshot, igual que el precio
  tarifa_iva_aplicada: number,          // snapshot
  ...
}
```

**Por qué el snapshot y no solo el producto:** el precio se congela en el
comprobante ([RN-VEN-04](/dominio/ventas/)), y la situación tributaria tiene que
congelarse con él. El día que Aquazaku empiece a discriminar IVA y actualice el
catálogo, las ventas viejas tienen que seguir diciendo qué representaban.

Sin eso, dentro de dos años nadie puede responder si aquellos $10.000 de 2026
eran base gravable o total con impuesto. Y no se puede reconstruir: es
información que solo existía en el momento de la venta.

:::caution[Lo que esta regla NO propone]
No hay motor de impuestos, ni retenciones (ReteIVA, ReteFuente, ReteICA), ni
códigos DIAN, ni cálculo de nada. **Dos campos y sus snapshots.**

Las retenciones y la declaración dependen del proveedor que se elija y de la
resolución de facturación — se diseñan cuando llegue esa integración, no antes.
Construirlas hoy sería adivinar los requisitos de una API que todavía no se
integró.
:::

**El costo de la alternativa:** guardar el precio como un número pelado sale
gratis hoy y carísimo después. Es exactamente el argumento de
[RN-VEN-11](/dominio/ventas/) — *"sin el campo, perdemos la información"* —
aplicado al precio en vez de a la intención de facturar.

---

### RN-CAT-10 — La paca es indivisible: no se venden bolsas sueltas

**Estado:** ✅ Confirmada — por Aquazaku, 21-ago-2026.

La paca es la **unidad atómica** del sistema. Se produce por paca, se stockea
por paca y se vende por paca. No hay media paca ni bolsas sueltas.

**Por qué importa más allá del catálogo:** si se vendieran bolsas sueltas, el
stock tendría que contar unidades **dentro** de cada paca, y una paca abierta
sería un estado nuevo que hoy no existe. Eso se propaga a
[Stock](/dominio/stock/) —los lotes dejarían de contarse en pacas— y a
[Producción](/dominio/produccion/), donde el cierre diario genera lote por paca.

Manteniendo la paca indivisible, **la misma unidad sirve para los tres módulos**
y no hace falta convertir en ninguna frontera.

:::note[La equivalencia en litros sigue siendo configuración]
Que la paca no se divida **no contradice** a
[RN-PRD-01](/dominio/produccion/). Las 20 bolsas de 600 ml siguen siendo un
parámetro editable: define cuántos litros representa la paca, no que se puedan
vender por separado.
:::

---

### RN-CAT-11 — El código lo genera el sistema; la identidad sigue siendo el UUID

**Estado:** ✅ Confirmada — por Aquazaku, 21-ago-2026. Hoy no usan códigos
propios.

Cada producto lleva un **código corto y legible** que genera el sistema:

```
PACA-600      Paca de bolsas de 600 ml
PACA-300      Paca de bolsas de 300 ml
BOT-20        Recarga de botellón 20 L
```

Pero el código **no es la identidad**. La identidad es el UUID interno — mismo
principio que [RN-CLI-01](/dominio/clientes/) para clientes: el documento sirve
para buscar, no para identificar.

**Por qué separarlos:** el día que un código se escriba mal, o que Aquazaku
quiera renombrar `BOT-20` a `RECARGA-20`, no puede arrastrar consigo las ventas
históricas, los lotes ni los movimientos de stock. Todo eso apunta al UUID.

**El código es único y no se reusa.** Si un producto se desactiva
([RN-CAT-02](#rn-cat-02--un-producto-no-se-borra-se-desactiva)), su código queda
tomado: reciclarlo haría que un comprobante viejo parezca referirse al producto
nuevo.

:::note[Por qué generarlo y no dejarlo libre]
Un código escrito a mano termina con variantes: `PACA600`, `paca-600`,
`Paca 600`. Después nadie puede buscar de forma confiable, y el día que haya
código de barras o facturación electrónica hay que limpiarlos todos.

Generarlo cuesta lo mismo hoy y evita esa limpieza.
:::

---

## Preguntas abiertas

**Ninguna.** Las cuatro que estaban abiertas se cerraron el 21-ago-2026:
RN-CAT-06 y 08 (precio y primera entrega), RN-CAT-09 (IVA), RN-CAT-10 (paca
indivisible) y RN-CAT-11 (código).

El dominio de M1 está completo y se puede escribir la spec.

:::caution[Las 🟡 de este documento son propuestas nuestras]
RN-CAT-01, 02, 03 y 09 las redactamos nosotros a partir de cómo encajan los
demás módulos. **No se implementan sin confirmar con Aquazaku.**

Las ✅ vienen de dos lados, y conviene distinguirlos:

- **Confirmadas por Aquazaku** el 21-ago-2026 — RN-CAT-06, 08, 10 y 11.
- **Derivadas** de reglas ya confirmadas en otros documentos — RN-CAT-04, 05 y
  07. Cada una linkea a su origen.
:::

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

**Estado:** ✅ Confirmada — se deriva de la
[matriz de permisos](/dominio/roles-y-permisos/).

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

## Preguntas abiertas

Ninguna de estas frena el modelo de datos, pero **sí** frenan la carga del
catálogo real. Hay que resolverlas antes de sembrar productos.

| # | Pregunta | Por qué importa |
| --- | --- | --- |
| 1 | **¿La primera entrega de botellón es un producto distinto de la recarga?** | Si el cliente nuevo paga más la primera vez (envase en depósito), son dos productos con precios distintos. Si paga lo mismo y el envase se maneja aparte, es uno solo. Afecta la pantalla del `pos` y el catálogo semilla. |
| 2 | **¿Los precios se cargan con IVA incluido o se calcula aparte?** | El agua envasada en Colombia tiene tratamiento específico. Si el IVA se discrimina, el producto necesita su tarifa y la venta dos totales. Bloquea M11 (Contador). |
| 3 | **¿El código de producto lo define Aquazaku o lo genera el sistema?** | Si Aquazaku ya usa códigos en su operación, el catálogo tiene que respetarlos. Si no, el sistema genera uno y listo. |
| 4 | **¿Se venden bolsas sueltas o solo pacas completas?** | Cambia la unidad de venta y el descuento de stock. Hoy el modelo asume paca completa. |

:::caution[Las 🟡 de este documento son propuestas nuestras]
RN-CAT-01, 02 y 03 las redactamos nosotros a partir de cómo encajan los demás
módulos. **No se implementan sin confirmar con Aquazaku.**

Las ✅ no son concesiones: se derivan de reglas ya confirmadas en otros
documentos, y cada una linkea a su origen.
:::

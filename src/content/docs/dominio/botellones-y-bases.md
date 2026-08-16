---
title: Botellones y bases
description: Los dos activos retornables de Aquazaku y por qué se rastrean con granularidad distinta.
sidebar:
  order: 4
---

Esta es **la sección más importante del dominio**, y la que hace que Aquazaku no
sea un punto de venta común.

Aquazaku tiene dos activos que salen pero no se venden. Se rastrean de forma
distinta **a propósito**.

## Dos activos, dos granularidades

**Estado:** ✅ Confirmada — definido por Aquazaku.

| | **Botellón** | **Base** |
| --- | --- | --- |
| Qué es | El envase de agua | El soporte donde se apoya |
| Identificación | **Solo cantidad** | **ID individual** |
| Se entrega | En intercambio | En préstamo |
| Se asigna a | El cliente (cantidad) | Una **dirección** del cliente |
| Fricción del intercambio | Baja, se cambia sin trámite | Alta, es un activo asignado |

### Por qué no todos los activos se rastrean igual

Esta es una decisión de modelado deliberada, y vale entenderla antes de escribir
una tabla.

**El botellón se intercambia sin fricción.** El cliente entrega uno vacío y
recibe uno lleno; a ninguna de las dos partes le importa cuál específicamente.
Ponerle ID a cada botellón obligaría al `seller` a escanear envases en la calle,
sin señal, en cada visita — y a cambio no responderías ninguna pregunta que la
cantidad no responda ya.

**La base se presta.** Es un activo asignado, va a una dirección concreta y
tiene que volver de esa dirección. Ahí sí necesitás saber *cuál*: qué base está
en qué lugar, desde cuándo, y a quién reclamársela.

:::tip[La regla general]
Se rastrea por ID lo que hay que **reclamar individualmente**.
Se rastrea por cantidad lo que se **intercambia**.

Poner ID donde no hace falta agrega fricción operativa que nadie va a sostener,
y un registro que se abandona es peor que no tenerlo.
:::

:::note[Merece un ADR]
Esta asimetría de trazabilidad es una decisión cara de revertir: define el modelo
de datos, el flujo de la app mobile y qué se puede reclamar. Cuando se implemente,
va registrada como [ADR](/decisiones/) con este razonamiento.
:::

---

## Botellones

Fungibles. Se controlan por cantidad, nunca por unidad.

### RN-ENV-01 — El botellón no tiene identificador individual

**Estado:** ✅ Confirmada

El sistema conoce **cantidades**, no unidades. No existe "el botellón número 4728".

Se conoce:

- La cantidad total en stock de la empresa, por ubicación.
- La cantidad que tiene cada cliente en su poder.

**Por qué:** el intercambio es de baja fricción para ambas partes y tiene que
seguir siéndolo. Identificar cada envase agregaría un paso a cada visita sin
responder ninguna pregunta nueva.

---

### RN-ENV-02 — La cantidad de botellones se conserva

**Estado:** 🟡 Supuesto

En todo momento:

```
botellones en bodega
+ botellones en rutas
+ botellones en poder de clientes
+ botellones dados de baja
= total de botellones dados de alta
```

Esta igualdad **siempre** se cumple. Si no cuadra, hay un bug o un movimiento sin
registrar.

**Por qué:** es el invariante del sistema — la ley de conservación del inventario
de botellones. Sin ID individual, esta igualdad es *lo único* que te avisa que
algo se perdió.

:::tip[Para quien implemente]
Este invariante es un test. Escribilo temprano, corrélo seguido, y hacelo fallar
ruidosamente. Si se rompe en producción, se rompió el control de activos.
:::

---

### RN-ENV-07 — Un botellón tiene ubicación **y** estado

**Estado:** 🔴 Sin definir — surge de la producción, falta confirmar

Desde que existe la planta, "10 botellones en bodega" es una respuesta incompleta.
¿Están llenos o vacíos? Son dos cosas muy distintas:

| Estado | Qué significa |
| --- | --- |
| **Vacío** | Volvió del cliente. Espera lavado y llenado. |
| **Lleno** | Sellado y listo para despachar. Ya consumió agua, tapa y sello. |

Un botellón vacío en bodega **no se puede vender**. Uno lleno sí. Si el sistema
solo cuenta unidades por ubicación, no puede responder la pregunta operativa más
básica: *¿cuántos botellones tengo listos para salir mañana?*

**Por qué importa:** el llenado es lo que consume agua, tapa y sello
([RN-PRD-09](/dominio/produccion/)). Sin el estado, no hay forma de saber si un
botellón ya pasó por producción o todavía no.

:::danger[Segunda dimensión del inventario]
Esto convierte el control de botellones en una matriz de **ubicación × estado**,
no en un solo contador:

```
              vacío    lleno
BODEGA          12       40
RUTA:3           5        8
CLIENTES         —       63     ← siempre llenos al entregar
```

El invariante de conservación ([RN-ENV-02](#rn-env-02--la-cantidad-de-botellones-se-conserva))
sigue valiendo sobre el **total**, sin importar el estado.

Confirmar con Aquazaku antes de modelar la tabla.
:::

---

### RN-ENV-03 — Una recarga intercambia un botellón, no lo vende

**Estado:** 🟡 Supuesto

Al recargar, el cliente entrega un envase vacío y recibe uno lleno. Su saldo de
botellones **no cambia**: sigue teniendo la misma cantidad.

Si el cliente **no** entrega el vacío, su saldo aumenta en uno y se aplica la
política de envase prestado o en depósito.

**Por qué:** confundir recarga con venta de botellón hace que el inventario de
envases se desangre sin que nadie lo note.

---

### RN-ENV-04 — Cada cliente tiene un saldo de botellones

**Estado:** 🟡 Supuesto

El sistema sabe cuántos botellones tiene cada cliente en su poder. Ese saldo se
mueve con cada entrega y cada retorno, nunca a mano.

**Por qué:** son botellones de Aquazaku que están afuera. Sin este saldo no se
puede reclamar, ni cobrar depósito, ni detectar al cliente que acumula envases.

:::caution[A confirmar]
El saldo se lleva **a nivel cliente**, no por dirección. Si un cliente tiene
bases en tres direcciones, el sistema sabe que tiene 8 botellones pero no en
cuál de las tres están.

¿Alcanza? Para reclamar, probablemente sí. Confirmar con Aquazaku.
:::

---

### RN-ENV-06 — Los botellones entran al parque por compra

**Estado:** ✅ Confirmada

Aquazaku compra botellones para ampliar o reponer su parque de envases. Esa
compra es un **alta de activo retornable**, no una entrada de producto vendible.

**Por qué:** un botellón comprado no se vende nunca — se suma al total que hay
que conservar ([RN-ENV-02](#rn-env-02--la-cantidad-de-botellones-se-conserva)).
Si entrara como producto al stock de bodega, el sistema creería que tiene
mercadería que en realidad es un envase.

:::note[Mismo criterio para las bases]
La compra de bases también es alta de activo, y cada unidad entra con su
[ID propio](#rn-bas-01--cada-base-tiene-un-identificador-único).
:::

---

### RN-ENV-05 — Dar de baja botellones requiere motivo

**Estado:** 🟡 Supuesto

Botellones rotos, perdidos o no recuperados se dan de baja indicando cantidad,
motivo, responsable y fecha. Queda registrado como pérdida.

**Por qué:** la baja silenciosa es la forma más fácil de tapar un faltante.

---

## Bases

Identificadas una por una. Se entregan en préstamo a una dirección.

### RN-BAS-01 — Cada base tiene un identificador único

**Estado:** ✅ Confirmada

Toda base es una unidad distinguible con ID propio y estable durante toda su vida.

**Por qué:** se entrega en préstamo a una dirección concreta y hay que poder
reclamar **esa** base a **ese** lugar.

---

### RN-BAS-02 — La base se presta, nunca se vende

**Estado:** ✅ Confirmada

La base sigue siendo propiedad de Aquazaku mientras está en poder del cliente.
No hay operación de venta de base.

---

### RN-BAS-03 — Una base se asigna a una dirección, no a un cliente

**Estado:** ✅ Confirmada

Un cliente puede tener **varias bases, cada una en una dirección distinta**. La
asignación apunta a la dirección, no al cliente.

```
Cliente "Panadería del Centro"
├── Dirección: Sucursal Norte   → base #A-0412
├── Dirección: Sucursal Sur     → base #A-0913
└── Dirección: Depósito         → base #B-0027
```

**Por qué:** si la base se asignara al cliente, no sabrías a cuál de sus tres
locales ir a buscarla. La dirección es lo que hace reclamable el préstamo.

:::danger[Consecuencia sobre el modelo]
Esto convierte a la **dirección** en una entidad de primer orden, no en un campo
de texto de la ficha del cliente.

`Cliente 1—N Dirección`, y la base se asigna a la dirección.
Ver [RN-CLI-07](/dominio/clientes/).
:::

---

### RN-BAS-04 — Una base está en exactamente un lugar

**Estado:** 🟡 Supuesto

En todo momento cada base está en una y solo una de estas situaciones:

```
┌──────────┐  carga de ruta  ┌──────────┐   préstamo   ┌───────────────────┐
│  BODEGA  │ ──────────────▶ │   RUTA   │ ───────────▶ │ DIRECCIÓN CLIENTE │
│          │ ◀────────────── │          │ ◀─────────── │                   │
└──────────┘   devolución    └──────────┘   retiro     └───────────────────┘
      │                                                          │
      └──────────────── baja (rota / perdida) ◀──────────────────┘
                           requiere motivo
```

Es el equivalente de [RN-ENV-02](#rn-env-02--la-cantidad-de-botellones-se-conserva)
para un activo identificado: en vez de cuadrar cantidades, cada unidad tiene
exactamente una ubicación.

**Por qué:** una base que figura en dos lugares —o en ninguno— es un bug de
inventario que se descubre cuando vas a reclamarla y no está.

---

### RN-BAS-05 — Toda base tiene historial completo

**Estado:** 🟡 Supuesto

Se puede reconstruir dónde estuvo cada base, desde cuándo y por orden de quién.

**Por qué:** es lo único que justifica el costo de darle un ID. Si no vas a poder
responder "¿dónde estuvo esta base?", el ID no está pagando su precio.

---

### RN-BAS-06 — Dar de baja una base requiere motivo

**Estado:** 🟡 Supuesto

Una base rota, perdida o no recuperada se da de baja con motivo, responsable y
fecha. No desaparece del historial: cambia de estado.

---

## Preguntas abiertas

- ¿Se cobra depósito o garantía por la base prestada? ¿Y por el botellón no devuelto?
- ¿Cómo se identifica físicamente una base — grabado, etiqueta, código de barras,
  QR? Define si el `seller` puede escanearla desde la app.
- ¿Hay tipos o modelos distintos de base?
- ¿Hay un límite de botellones que un cliente puede tener en su poder?
- ¿Puede haber una dirección con base pero sin botellones, o viceversa?
- ¿Quién autoriza el préstamo de una base — solo `admin`, o el `seller` puede
  dejar una base nueva en la calle?

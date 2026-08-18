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
+ botellones descartados
= total de botellones registrados
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

### RN-ENV-07 — El estado lleno/vacío queda fuera del alcance inicial

**Estado:** ✅ Confirmada — **no se modela por ahora**, a pedido de Aquazaku.

Hoy se **empaca bajo demanda**: no hay stock de botellones llenos esperando, se
llenan cuando hay venta. Con ese modo de operación, distinguir lleno de vacío no
responde ninguna pregunta que hoy alguien se haga.

Cuando el volumen crezca y se pase a envasar contra stock, la distinción sí va a
hacer falta:

| Estado | Qué significa |
| --- | --- |
| **Vacío** | Volvió del cliente. Espera lavado y llenado. |
| **Lleno** | Sellado y listo para despachar. Ya consumió agua, tapa y sello. |

La pregunta que hoy no existe y mañana sí: *¿cuántos botellones tengo listos para
salir mañana?*

:::tip[Por qué esta sí se puede postergar y la ruta no]
Las dos son decisiones "para más adelante", pero tienen costos de migración muy
distintos. Vale distinguirlas en vez de intentar adelantarse a todo:

| Decisión | Postergarla cuesta |
| --- | --- |
| Ruta por dirección ([RN-CLI-05](/dominio/clientes/)) | **Caro** — migrar rutas ya en uso y repartir clientes |
| Estado del botellón | **Barato** — agregar una columna y declarar todo el stock existente como un estado |

Agregar `estado` después es una migración de una línea: todo lo que hay pasa a
`lleno` o `vacío` según cómo se opere ese día. No se pierde información ni hay
que reconstruir historia.

Por eso una se adelanta y la otra no. **Anticiparse a todo también es un costo.**
:::

Cuando llegue el momento, el inventario pasa a ser una matriz de
**ubicación × estado**:

```
              vacío    lleno
BODEGA          12       40
RUTA:3           5        8
CLIENTES         —       63     ← siempre llenos al entregar
```

El invariante de conservación ([RN-ENV-02](#rn-env-02--la-cantidad-de-botellones-se-conserva))
sigue valiendo sobre el **total**, sin importar el estado.

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

### RN-ENV-04 — El saldo de botellones va por cliente

**Estado:** ✅ Confirmada

El sistema sabe cuántos botellones tiene cada cliente en su poder. El saldo es
**a nivel cliente**, no por dirección. Se mueve con cada entrega y cada retorno,
nunca a mano.

**Por qué:** son botellones de Aquazaku que están afuera. Sin este saldo no se
puede reclamar, ni cobrar depósito, ni detectar al cliente que acumula envases.

Y alcanza con el nivel cliente **porque el botellón es fungible**: para reclamar
ocho botellones no hace falta saber en cuál de sus tres locales están. Es la
misma lógica que hace que no tengan ID ([RN-ENV-01](#rn-env-01--el-botellón-no-tiene-identificador-individual)).

:::note[Contraste con la base]
La base sí se rastrea por dirección ([RN-BAS-03](#rn-bas-03--una-base-se-asigna-a-una-dirección-no-a-un-cliente)),
porque hay que ir a buscarla a un lugar concreto. Dos activos, dos granularidades
— y ahora también dos niveles de saldo.
:::

---

### RN-ENV-06 — Los botellones entran al parque por compra

**Estado:** ✅ Confirmada

Aquazaku compra botellones para ampliar o reponer su parque de envases. Esa
compra **registra un activo retornable nuevo**, no una entrada de producto vendible.

**Por qué:** un botellón comprado no se vende nunca — se suma al total que hay
que conservar ([RN-ENV-02](#rn-env-02--la-cantidad-de-botellones-se-conserva)).
Si entrara como producto al stock de bodega, el sistema creería que tiene
mercadería que en realidad es un envase.

:::note[Mismo criterio para las bases]
La compra de bases también registra activos nuevos, y cada unidad entra con su
[ID propio](#rn-bas-01--cada-base-tiene-un-identificador-único).
:::

---

### RN-ENV-05 — Descartar botellones requiere motivo

**Estado:** 🟡 Supuesto

Botellones rotos, perdidos o no recuperados se descartan indicando cantidad,
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

### RN-BAS-06 — Descartar una base requiere motivo

**Estado:** 🟡 Supuesto

Una base rota, perdida o no recuperada se descarta con motivo, responsable y
fecha. No desaparece del historial: cambia de estado.

---

### RN-BAS-07 — La entrega de bases es autónoma: `pos` decide, basta con cliente verificado

**Estado:** ✅ Confirmada — cerrá la pregunta #11 de
[Qué falta preguntar](/empezar/pendientes/).

Entregar una base **es un diferenciador competitivo** de Aquazaku, así que la
fricción tiene que ser mínima para clientes ya verificados.

**Reglas:**

| Estado del cliente | ¿Se entrega base? | Comentario |
| --- | --- | --- |
| `VERIFICADO` | ✅ sí, `pos` decide de forma autónoma | No hace falta pedir permiso a `admin` |
| `PENDIENTE` | ❌ no, hasta verificar | — |

**`pos` puede verificar Y entregar la base en una sola operación.** Si un cliente
nuevo llega a la planta con su documento, `pos` lo coteja (acto `pos_manual` en
[RN-CLI-14](/dominio/clientes/)), marca el cliente como `VERIFICADO` en el
mismo momento, y entrega la base. **Esta es la vía de menor fricción** y es
la que se va a ofrecer como onboarding por defecto.

**Por qué:** cualquier cliente nuevo que pida base ya está dando una señal de
intención seria. Frenar la entrega hasta que un `admin` valide (que vive en
otra ciudad) perdería la venta. La verificación por `pos` en el momento es
suficiente — `admin_oficial` puede llegar después si hace falta afinar algo.

:::danger[Invariante general — cliente no verificado no recibe activos]
Esta regla es la misma que ya teníamos para crédito
([RN-CLI-15](/dominio/clientes/)): ningún activo (crédito, base) se entrega a
un cliente no verificado. La verificación es el "desbloqueo" genérico que
habilita operaciones sensibles.
:::

:::note[Permisos derivados]
En la [matriz de roles](/dominio/roles-y-permisos/) esto queda como
`bases:prestar` con `pos` ✅ sin restricción de ruta, con la salvedad de que
el backend igual valida `cliente.verificacion.estado == "verificado"` antes de
ejecutar la operación. No es solo una regla de UI.
:::

---

## Preguntas abiertas

- ¿Se cobra depósito o garantía por la base prestada? ¿Y por el botellón no devuelto?
- ¿Cómo se identifica físicamente una base — grabado, etiqueta, código de barras,
  QR? Define si el `seller` puede escanearla desde la app.
- ¿Hay tipos o modelos distintos de base?
- ¿Hay un límite de botellones que un cliente puede tener en su poder?
- ¿Puede haber una dirección con base pero sin botellones, o viceversa?

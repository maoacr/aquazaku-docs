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

Si el cliente **no** entrega el vacío, su saldo aumenta en uno. **No se le cobra
nada por eso**: el envase queda registrado en su poder, no facturado
([RN-BAS-08](#rn-bas-08--daño-a-la-base--recargo-automático-al-cliente-en-cualquier-momento-del-ciclo)
— botellones sin garantía, sin depósito).

Es exactamente lo que pasa en una primera entrega: el cliente paga el agua y se
lleva un envase que ahora figura en su saldo
([RN-CAT-08](/dominio/productos/)).

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

### RN-ENV-09 — Ningún botellón sale del parque sin un responsable

**Estado:** ✅ Confirmada (27-ago-2026).

Un botellón es de la empresa y vuelve. Si sale sin quedar anotado a nombre de
alguien, no hay a quién reclamárselo.

**La venta escribe el movimiento**, en la misma transacción. Antes eran dos
actos separados —vender la recarga, y después acordarse de registrar la entrega
en otra pantalla— y ese olvido no dejaba ningún rastro.

:::danger[La ley de conservación NO detecta este fallo]
Es lo contraintuitivo, y la razón por la que esta regla hizo falta.

Si el movimiento no se escribe, no se escribe **nada**: `registrados` no cambia,
`enPoderDeAlguien` no cambia, y [RN-ENV-02](#rn-env-02--la-cantidad-de-botellones-se-conserva)
sigue diciendo `cuadra: true` mientras el envase está en la casa del cliente y
el sistema lo cree en la bodega.

La ley detecta filas que faltan **respecto de sí misma**. No detecta que la
realidad se fue por otro lado — eso solo aparece cuando alguien cuenta
físicamente, meses después, sin saber a quién reclamarle.

Por eso el invariante vive **en la base** (ADR-0006) y no solo en el servicio:
la fila del cliente no puede existir sin cliente.
:::

#### Qué se pregunta en el mostrador

**Cuántos se lleva sin devolver el vacío** — un número, no un sí/no. La
conversación real es *«vendí tres recargas, trajo dos vacíos»*, y eso es **un**
envase que sale.

El default es cero porque la recarga normal es un intercambio
([RN-ENV-03](#rn-env-03--una-recarga-intercambia-un-botellón-no-lo-vende)): el
caso común no cuesta ningún clic y no mueve el parque.

No se le cobra nada por llevárselo. El envase queda registrado en su poder, no
facturado.

#### El alcance exacto

| Caso | ¿Exige cliente? |
| --- | --- |
| Paca de bolsas al mostrador | **No** — no se lleva ningún retornable |
| Recarga con vacío de vuelta | **No** — el saldo no cambia, no sale nada |
| Recarga sin vacío de vuelta | **Sí** |

La regla es «ningún **botellón** sale sin responsable», **no** «toda venta
necesita cliente». Exigir documento en cada venta llevaría a inventar clientes
o —lo que pasa de verdad— a reusar el del anterior, que le cuelga el historial
a alguien que no compró nada.

Tampoco se pueden despachar más envases que recargas vendidas. Si hacen falta
envases sueltos, eso es una entrega y va por su propio camino, donde queda con
su motivo en vez de escondida en una venta.

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
├── Dirección: Sucursal Sur     → base #0913
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

### RN-BAS-08 — Daño a la base = recargo automático al cliente, en cualquier momento del ciclo

**Estado:** ✅ Confirmada — cerrá la pregunta #23 de
[Qué falta preguntar](/empezar/pendientes/).

**Botellones**: sin garantía nunca. Se intercambian, no se venden. El sistema
solo sabe cuántos tiene el cliente ([RN-ENV-04](#rn-env-04--el-saldo-de-botellones-va-por-cliente)).
Sin depósito, sin recargo por daño.

**Bases**: **sin garantía al prestar**, pero **SÍ recargo si se daña** la base
en cualquier momento del ciclo de vida del cliente. No solo al darlo de baja
— en cualquier visita que el operario lo evidencie.

#### Mecánica del recargo

```
base = {
  id_interno: uuid,
  id_sticker: string,                   // el ID impreso en el sticker físico
  estado: "sana" | "danada",            // (NUEVO — agregado en RN-BAS-08)
  danada_por: user_id | null,           // (NUEVO)
  danada_en: timestamp | null,          // (NUEVO)
  recargo_generado_id: venta_id | null, // (NUEVO)
  asignada_a: direccion_id | null,
  ...
}
```

**Cuando se evidencia daño**:

1. `pos` o `admin` registra el estado `danada` con motivo y timestamp.
2. El sistema crea automáticamente una **venta con `tipo = "DANO_BASE"`** y
   `motivo = "..."` por el valor de reposición de la base (configurable por
   SKU/tipo, hoy un solo valor único).
3. La venta se registra con el medio de pago que se acuerde con el cliente
   (contado o crédito si está habilitado y verificado).
4. El cargo va al `cliente.cargos_pendientes` (4° saldo de
   [RN-CLI-06](/dominio/clientes/)).

:::tip[Registrable como venta con motivo específico]
El recargo **es una venta**, no un ajuste manual. Eso preserva la auditoría
unificada del sistema de ventas. La única diferencia es el tipo (`DANO_BASE`)
y el motivo obligatorio — que ya es regla para todo el sistema.

Medio de pago:
- **Efectivo**: se cobra en el momento.
- **Transferencia**: se recibe manualmente.
- **Crédito**: si el cliente tiene crédito habilitado y verificado, se suma a
  su deuda — automáticamente.
:::

:::danger[Cuidado con daño frecuente]
Si un mismo cliente daña muchas bases, el sistema debe exponer al `admin` el
historial de cargos para que DECIDA si inactiva al cliente. **No es castigo
automático** — es visibilidad para una decisión manual.
:::

---

### RN-BAS-09 — Una sola clase de base, sin SKU

**Estado:** ✅ Confirmada — cerrá la pregunta #25 de
[Qué falta preguntar](/empezar/pendientes/).

Todas las bases de Aquazaku son **iguales**. No hay tipos, modelos, ni SKUs
distintos. Esto simplifica:

- **Schema**: la tabla `bases` no necesita atributo `tipo_base`.
- **Sticker**: el ID del sticker es puramente único, no codifica tipo.
- **Reportes**: no hay "base tipo X" vs. "tipo Y" — todas son iguales para
  análisis.
- **Evolución**: si en el futuro apareciera un segundo modelo, hay que volver a
  esta conversación — no es un toggle.

---

### RN-BAS-10 — Sticker pegado con ID es el método actual de identificación

**Estado:** ✅ Confirmada — cerrá la pregunta #24 de
[Qué falta preguntar](/empezar/pendientes/).

Las bases se identifican con un **sticker pegado**. La asignación base ↔
cliente + dirección se hace **manualmente** en el sistema cuando el `pos`
entrega o retira.

```
base.id_interno = uuid          // clave primaria del sistema
base.id_sticker = char(4)       // cuatro dígitos: 0001 a 9999
```

**El formato son cuatro dígitos con los ceros adelante** — `0001`, `0040`,
`0913`. Aceptar `913` junto a `0913` crearía dos códigos para la misma base
física, y la unicidad —que es lo único que garantiza saber cuál está dónde—
dejaría de proteger nada.

:::note[Por qué no se parece al código de producto]
`P20U_600ML` codifica **en qué se diferencia** ese producto: presentación,
unidades y contenido. Se lee sin conocer la convención.

Con las bases eso es imposible, y no por una limitación técnica:
[RN-BAS-09](#rn-bas-09--una-sola-clase-de-base-sin-sku) dice que hay una sola
clase de base. **Todas son idénticas.** No existe atributo que codificar, así
que el número no puede significar nada más que «la siguiente» — copiar el
patrón de productos habría generado el mismo string para las cuarenta.
:::

#### Comprar bases

Cuando entran varias de una vez, se registran con una **cantidad** y el sistema
las numera en orden — igual que la compra de botellones. Llegan sin rotular, y
los stickers se imprimen después con los números que el sistema asignó.

O entran todas o no entra ninguna. Una compra a medio registrar deja al operario
sin saber cuántas cargó ni desde qué número seguir, y con los stickers ya
impresos el hueco quedaría en la caja y no en la pantalla.

:::note[El consecutivo NO gobierna la entrega]
Solo gobierna el **alta**. Al prestar, el operario elige cualquier base que esté
en la bodega y sana — la que tenga en la mano. El sistema nunca exige orden al
entregar, y no tendría por qué: todas las bases son idénticas
([RN-BAS-09](#rn-bas-09--una-sola-clase-de-base-sin-sku)), así que cuál sale
primero no cambia nada.
:::

### Quién es dueño del número

**El sistema propone, el sticker manda.** Los dos caminos existen porque los dos
casos son reales:

| Caso | Quién decide |
| --- | --- |
| Las 40 bases que Aquazaku ya tiene, con el rótulo pegado | El **sticker**: el operario tipea lo que tiene en la mano |
| Una base nueva sin rotular | El **sistema**: propone el próximo consecutivo |
| Un sticker ilegible que hay que reemplazar | El **operario**: pisa la propuesta con el número nuevo |

El tercer caso es el que justifica que la propuesta sea pisable y no impuesta.
Está advertido más abajo en esta misma regla, y sin ese camino necesitaría un
parche especial.

:::caution[El próximo sale del MÁXIMO, no del conteo]
Y **un número no se recicla nunca**, ni siquiera el de una base descartada. Es
el mismo criterio que [RN-CAT-11](/dominio/productos/) para productos
desactivados, y acá pesa más: una base descartada puede tener un recargo por
daño ([RN-BAS-08](#rn-bas-08--daño-a-la-base--recargo-automático-al-cliente-en-cualquier-momento-del-ciclo))
apuntándole, y darle su número a una base nueva volvería ambiguo ese cobro.

Las dos cosas —pisar la propuesta y no reciclar— dejan huecos. Con `conteo + 1`
la propuesta chocaría contra un número ya tomado, y el alta fallaría con un
duplicado que el operario nunca pidió.

Con cuatro dígitos hay 9.999 códigos y hoy se usan 40: no reciclar nunca no
aprieta en ningún horizonte razonable.
:::

**Flujo del `pos`** al entregar una base:

1. Elige cliente + dirección en el sistema.
2. Tipea el `id_sticker` que está pegado a la base que va a entregar.
3. El sistema valida que ese `id_sticker` existe y no está ya asignado a otra
   dirección.
4. Se crea la asignación `dirección → base`.

:::tip[Recomendación operativa]
Que el `admin` use stickers durables (resistentes a sol/agua/rozamiento). Un
sticker ilegible es un riesgo de trazabilidad — si la base vuelve y no se puede
leer su ID, hay que abrirla como base nueva o documentar el reasignado.
:::

**Futuras mejoras (no MVP)**: integrar escaneo de QR/barcode desde la cámara
del celular para eliminar el tipeo manual.

---

### RN-BAS-11 — Sin tope duro de botellones por cliente; admin aprueba casos atípicos

**Estado:** ✅ Confirmada — cerrá la pregunta #26 de
[Qué falta preguntar](/empezar/pendientes/).

En la operación actual de Aquazaku, los clientes **no suelen acumular
botellones en exceso** — el intercambio natural lo previene. Si en algún caso
atípico un cliente acumula muchos, el `admin` evalúa y aprueba el caso.

```
cliente.botellones_en_su_poder = number   // siempre conocido
cliente.botellones_acumulacion_aprobada = {
  aprobado: bool,
  aprobado_por: user_id | null,
  aprobado_en: timestamp | null,
  motivo: string | null,
}
```

- **Default**: el cliente puede acumular sin límite (es raro que pase).
- **Casos atípicos**: el `admin` registra la aprobación (informational/auditable,
  no es un toggle funcional).
- El sistema continúa trackeando el saldo real; la aprobación es trazabilidad,
  no cap.

**Por qué no hace falta cap en MVP**: el modelo de stock se conserva
([RN-ENV-02](#rn-env-02--la-cantidad-de-botellones-se-conserva)). Si un cliente
acumula mucho, el sistema lo sabe — y el `pos` y `admin` lo ven. La prevención
es visibilidad, no bloqueo.

---

### RN-BAS-12 — Base y botellones son activos independientes

**Estado:** ✅ Confirmada — cerrá la pregunta #27 de
[Qué falta preguntar](/empezar/pendientes/).

La conjunción **base + botellones NO es obligatoria** en el sistema. El
default para onboarding es que aparezcan juntos (cliente nuevo → base +
primer pedido), pero los ciclos de vida son **independientes** y cualquier
combinación es válida después.

| Estado de una dirección | Válido |
| --- | --- |
| Tiene base + botellones | ✅ (típico post-onboarding) |
| Solo base (sin botellones aún) | ✅ (cliente nuevo) |
| Solo botellones (sin base) | ✅ (compró pacas, o devolvió base) |
| Ninguno | ✅ (no ha comprado nunca) |

**Implicaciones de UX**:

- **Onboarding de cliente nuevo**: ofrecer flujo combinado "verificar →
  entregar base → primer pedido" como atajo sugerido. NO obligatorio.
- **Gestión posterior**: el sistema trata cada activo por su cuenta. Se puede
  devolver/devolver base sin tocar botellones, y viceversa.
- **Reportes**: las direcciones se analizan individualmente — cuántas tienen
  base, cuántas tienen botellones, cuántas tienen ambos.

---

## Preguntas abiertas

(Las preguntas 🟡 de Retornables #23, #24, #25, #26, #27 quedaron todas
cerradas en la sesión del 18-ago-2026. Los nuevos RN son BAS-08, BAS-09,
BAS-10, BAS-11, BAS-12.)

---
title: Producción y agua
description: Balance de agua en tanques, envasado diario y conversión de litros a producto.
sidebar:
  order: 2
---

Aquazaku **no solo distribuye: produce**. Hay una planta de empaque en
**Campo de la Cruz** donde el agua a granel se convierte en producto vendible.

Eso mete en el sistema una unidad de medida que no existe en ninguna otra parte
del dominio: el **litro**.

## Las dos monedas del sistema

| | **Agua a granel** | **Producto** |
| --- | --- | --- |
| Unidad | Litros | Pacas / botellones |
| Dónde vive | Tanques de la planta | [Stock por ubicación](/dominio/stock/) |
| Cómo se mueve | Producción diaria | Ventas, cargas, ajustes |
| Se vende | No | Sí |

La **producción diaria** es el único punto donde una se convierte en la otra.
Es la frontera del sistema, y por eso tiene su propio conjunto de reglas.

```
     ENTRADA                  TRANSFORMACIÓN              SALIDA
  ┌────────────┐           ┌─────────────────┐       ┌────────────┐
  │  TANQUES   │  litros   │   PRODUCCIÓN    │ pacas │   STOCK    │
  │ 2 × 2000 L │ ─────────▶│     DIARIA      │ ─────▶│   BODEGA   │
  └────────────┘           └─────────────────┘       └────────────┘
        ▲                     │           │
        │                     │           │ tapas + sellos
   RED MUNICIPAL              │           ▼
   tarifa plana               │      (insumo consumido)
   sin medidor                │
                              │ litros de lavado
                              ▼
                     (consumo sin producto)
```

---

## Presentaciones y equivalencia en litros

**Estado:** ✅ Confirmada — son **dos tipos de paca distintos**, uno de bolsas de
600 ml y otro de bolsas de 300 ml.

Esta tabla es **el corazón del cálculo**. Todo el balance de agua depende de ella.

| Presentación | Contenido unitario | Unidades por paca | **Litros por paca** |
| --- | --- | --- | --- |
| Paca de bolsas 600 ml | 600 ml | 20 | **12 L** |
| Paca de bolsas 300 ml | 300 ml | 50 | **15 L** |
| Botellón | 20 L | — | **20 L** |

:::caution[Falta confirmar las unidades de la paca de 300 ml]
Que la paca de 300 ml lleva **50 bolsas** viene de una versión anterior del dato,
cuando esa presentación figuraba como de 200 ml. La presentación se corrigió;
**el conteo de unidades no se volvió a confirmar**.

Si son 50 bolsas → 15 L por paca. Si el conteo cambió con la presentación, este
número está mal y el balance de agua completo se desvía con él.
:::

### RN-PRD-01 — La equivalencia en litros es dato de configuración, no código

**Estado:** 🟡 Supuesto

Unidades por paca y volumen por unidad se configuran, no se escriben fijos en el
código. Un cambio de presentación no puede requerir un despliegue.

**Por qué:** el día que salga una bolsa de 500 ml o una paca de 24, el sistema
tiene que absorberlo sin tocar el cálculo.

---

## Los tanques

### RN-PRD-02 — El agua se controla en litros, por tanque

**Estado:** 🟡 Supuesto

La planta tiene **dos tanques de 2000 litros** (4000 L de capacidad total). El
sistema conoce cuántos litros hay disponibles.

:::caution[Pregunta que define el modelo]
¿Los tanques se controlan **por separado** o como un único pozo de 4000 L?

Si se alternan —uno en uso mientras el otro se llena o se trata— hacen falta dos
saldos independientes, y el sistema tiene que saber de cuál se está envasando.
Si siempre están conectados y se consumen juntos, alcanza un solo saldo.

Son dos modelos de datos distintos. Confirmar con Aquazaku.
:::

---

### RN-PRD-03 — El agua viene de la red municipal con tarifa plana

**Estado:** ✅ Confirmada — origen y costo. 🟡 Pendiente — cómo se mide.

La planta está en **Campo de la Cruz**. El agua viene de la red municipal y se
paga una **tarifa fija, sin importar cuánto se consuma**.

**Consecuencia inmediata:** el agua **no tiene costo marginal**. El litro número
mil cuesta lo mismo que el primero: cero. Producir más no encarece el agua.

---

### RN-PRD-10 — El agua es costo fijo, no costo variable

**Estado:** ✅ Confirmada

La tarifa de agua es un **gasto operativo mensual**, no un insumo que se imputa
por unidad producida.

**Por qué:** cuando se calcule el costo de una paca o de una recarga, el agua
aporta **cero** al costo variable. Lo que sí cuesta por unidad son las tapas, los
sellos y las bolsas.

:::danger[No confundir "gratis" con "ilimitado"]
Que el agua no cueste por litro **no elimina la necesidad de controlarla**. Y esta
distinción es la que más se malinterpreta.

| El agua es… | Consecuencia |
| --- | --- |
| Gratis al margen | No se imputa al costo del producto |
| **Finita** | Los tanques son 2×2000 L. No podés envasar lo que no tenés. |

El control de tanques deja de servir para **costear** y pasa a servir para
**planificar**: ¿alcanza el agua para la producción de mañana?

Ese sigue siendo el motivo por el que el balance de [RN-PRD-06](#rn-prd-06--el-balance-diario-de-agua)
tiene que existir.
:::

---

### RN-PRD-11 — Cómo se mide el agua que entra

**Estado:** 🔴 Sin definir — **es la pieza que falta**

Con tarifa plana casi seguro **no hay medidor**. Y sin medidor no se puede
registrar cuántos litros entraron: solo se puede **medir el nivel del tanque**.

Eso cambia la forma del cálculo. Hay dos maneras de resolverlo:

#### Opción A — Medir el nivel una vez al día

```
agua_ingresada = nivel_final − nivel_inicial + consumo_calculado
```

Simple, una sola lectura diaria. **El problema:** el ingreso y la merma quedan
mezclados en el mismo número. Si hay una pérdida, se disimula como "entró menos
agua" y nunca la ves.

#### Opción B — Medir antes y después de producir

```
consumo_real  = nivel_antes − nivel_después     (sin ingreso de por medio)
merma         = consumo_real − consumo_calculado
agua_ingresada = lo que suba el tanque fuera del horario de producción
```

Dos lecturas por día, pero **separa merma de ingreso**. Es la única forma de que
[RN-PRD-07](#rn-prd-07--la-diferencia-entre-lo-teórico-y-lo-real-es-merma-y-se-registra)
signifique algo.

:::tip[Recomendación]
**Opción B.** Una lectura extra al día es barato; perder la visibilidad de la
merma no lo es. Y si el suministro municipal no es continuo, el nivel del tanque
pasa a ser el dato más importante de la planta.
:::

**Falta confirmar:**

- ¿Hay medidor de agua, o solo se puede leer el nivel del tanque?
- ¿Cómo se lee el nivel — regla, flotador, marca visual, sensor?
- ¿El suministro municipal es continuo o por horarios? Si es intermitente, el
  tanque es el amortiguador y su nivel es crítico.
- ¿Hay tratamiento o filtrado que genere pérdida entre lo que entra y lo utilizable?

---

## La producción diaria

### RN-PRD-04 — Cada día se registra un cierre de producción

**Estado:** ✅ Confirmada

Al terminar la producción del día se registra:

- Cuántas **pacas se envasaron**, por presentación.
- Cuántos **botellones se llenaron** — tanto recargas como primeras entregas.

Ese registro produce tres efectos simultáneos:

| Efecto | Sobre qué |
| --- | --- |
| ➖ Descuenta litros | Tanques |
| ➖ Descuenta insumos | Tapas y sellos ([RN-PRD-09](#rn-prd-09--cada-botellón-llenado-consume-una-tapa-y-un-sello)) |
| ➕ Da de alta producto | Bodega |

**Por qué:** es el único evento que convierte litros en producto. Sin él, ni el
agua ni el stock ni los insumos reflejan la realidad.

:::note[Los tres efectos son uno solo]
El cierre de producción tiene que ser **atómico**: o impacta agua, insumos y
producto, o no impacta nada. Un cierre que descuenta agua pero falla al descontar
insumos deja el sistema mintiendo en dos lugares a la vez.
:::

---

### RN-PRD-05 — El lavado de botellón consume agua sin generar producto

**Estado:** ✅ Confirmada

Cada vez que se va a rellenar un botellón, primero se **lava y alista**. Esa agua
se gasta y no termina en ningún producto vendible.

El consumo de lavado se descuenta del tanque igual que el agua envasada.

**Por qué:** si no se contabiliza, el sistema va a creer que en los tanques hay
más agua de la que hay. Y la diferencia crece todos los días, en silencio.

:::caution[Falta el número]
El sistema necesita saber **cuántos litros consume lavar un botellón**. Ese valor
no lo tenemos.

Hay que medirlo en planta y cargarlo como parámetro configurable
([RN-PRD-01](#rn-prd-01--la-equivalencia-en-litros-es-dato-de-configuración-no-código)),
nunca fijo en el código — va a cambiar cuando cambie el proceso de lavado.
:::

---

### RN-PRD-06 — El balance diario de agua

**Estado:** 🟡 Supuesto

```
litros consumidos en el día =
      pacas_600ml           × 12 L
    + pacas_300ml           × 15 L
    + botellones_llenados   × 20 L
    + botellones_lavados    × L_lavado
```

Y el saldo del tanque:

```
saldo inicial
  + litros ingresados       ← de la red municipal, sin medidor (RN-PRD-11)
  − litros consumidos
= saldo final
```

:::caution[El término que falta no se puede medir directamente]
`litros ingresados` no es un dato que el sistema reciba: hay tarifa plana y por
lo tanto, casi seguro, no hay medidor. Se **deriva** de la lectura del tanque.

Cómo se deriva —y si la merma queda visible o escondida— depende de la opción que
se elija en [RN-PRD-11](#rn-prd-11--cómo-se-mide-el-agua-que-entra).
:::

**Por qué:** es el equivalente productivo de la
[rendición de ruta](/dominio/rutas/). Cuadrar lo que salió contra lo que se
produjo es lo que convierte al sistema en un control real.

:::note[¿Lavados = llenados?]
Asumimos que **todo botellón que se llena se lava primero**, o sea
`botellones_lavados = botellones_llenados`. En ese caso el cálculo se simplifica:

```
botellones_llenados × (20 + L_lavado)
```

Se deja como variable separada por si hay botellones que se lavan y se descartan
sin llenar. Confirmar.
:::

---

### RN-PRD-09 — Cada botellón llenado consume una tapa y un sello

**Estado:** ✅ Confirmada

Todo botellón que se llena y se sella consume **una tapa** y **un sello
termoencogible**. Aplica igual en los dos casos:

| Caso | Consume |
| --- | --- |
| Recarga de un botellón retornado | 1 tapa + 1 sello |
| Entrega de botellón por primera vez | 1 tapa + 1 sello |

```
tapas_consumidas = sellos_consumidos = botellones_llenados
```

**Por qué:** son insumos que se agotan y hay que reponer. Sin descontarlos, el
sistema no puede avisar que se están por acabar — y una planta sin tapas no
produce, por más agua que tenga en los tanques.

:::caution[Se consumen al llenar, no al entregar]
El insumo se gasta en planta, en el momento del sellado. Si un botellón lleno
queda dos días en bodega antes de salir, la tapa se consumió el día que se llenó,
no el día que se entregó.

Documentado así. Confirmar que coincide con cómo lo cuenta Aquazaku.
:::

:::tip[La relación es 1:1 — hoy]
Se documenta como una constante, pero conviene modelarla como una **receta de
consumo por presentación** ([RN-PRD-01](#rn-prd-01--la-equivalencia-en-litros-es-dato-de-configuración-no-código)).

El día que una presentación necesite dos insumos, o que aparezca una etiqueta,
el sistema lo absorbe sin tocar el cálculo. Si lo escribís como `-1` fijo en el
código, no.
:::

---

### RN-PRD-07 — La diferencia entre lo teórico y lo real es merma, y se registra

**Estado:** 🟡 Supuesto

El consumo calculado nunca va a coincidir exactamente con la medición física del
tanque. Esa diferencia es **merma** y se registra con su motivo, igual que un
faltante de ruta ([RN-RUT-03](/dominio/rutas/)).

**Por qué:** si el sistema ajusta el saldo en silencio para que cuadre, deja de
controlar nada. La merma normal existe —purgas, derrames, evaporación— pero una
merma que crece es la señal de una pérdida real.

---

### RN-PRD-08 — Un cierre de producción no se edita

**Estado:** 🟡 Supuesto

Igual que [RN-VEN-02](/dominio/ventas/) y [RN-RUT-04](/dominio/rutas/): cerrado
el día, el registro es inmutable. Una corrección es un ajuste posterior con
motivo y responsable.

---

## Preguntas abiertas

- **¿Hay medidor de agua o solo lectura de nivel de tanque?**
  ([RN-PRD-11](#rn-prd-11--cómo-se-mide-el-agua-que-entra)) — es lo que más falta.
- ¿El suministro municipal es continuo o por horarios?
- ¿Cuántos litros consume lavar un botellón? Hay que medirlo.
- ¿Los dos tanques se controlan por separado o como un pozo único?
- **¿Cuántas bolsas trae la paca de 300 ml?** Asumido 50, sin reconfirmar tras el
  cambio de presentación. De ese número depende todo el balance.
- ¿Se controlan las **bolsas** como insumo, además de tapas y sellos?
- ¿Se vende la bolsa suelta, o siempre la paca completa?
- ¿Hay control de lote o fecha de envasado por producción?
- ¿La producción se registra una vez al día, o por turno o por lote?
- ¿Puede haber producto envasado que se descarte por control de calidad?

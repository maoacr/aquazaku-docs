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

## El agua no es una sola cosa

El agua atraviesa **tres estados** antes de ser producto, y cada transición
pierde algo por el camino:

```
LITRO CRUDO ──×0,70──▶ LITRO PROCESADO ──envasado──▶ PRODUCTO
              (filtros)                  (+ lavado)
```

| | **Crudo** | **Procesado** | **Producto** |
| --- | --- | --- | --- |
| Unidad | Litros | Litros | Pacas / botellones |
| Dónde vive | Almacenamiento 13.000 L | Tanques 2 × 2000 L | [Stock](/dominio/stock/) |
| Pérdida al salir | 30% (rechazo) | Agua de lavado | — |
| Se vende | No | No | Sí |

La **producción diaria** es la frontera entre el litro procesado y el producto.
Es donde el sistema convierte una unidad en otra, y por eso tiene su propio
conjunto de reglas.

El recorrido completo está en
[El agua tiene dos estados](#el-agua-tiene-dos-estados-no-uno).

---

## Presentaciones y equivalencia en litros

**Estado:** ✅ Confirmada — presentaciones y unidades verificadas con Aquazaku.

Esta tabla es **el corazón del cálculo**. Todo el balance de agua depende de ella.

| Presentación | Contenido unitario | Unidades por paca | **Litros por paca** |
| --- | --- | --- | --- |
| Paca de bolsas 600 ml | 600 ml | 20 | **12 L** |
| Paca de bolsas 300 ml | 300 ml | 50 | **15 L** |
| Botellón | 20 L | — | **20 L** |

### RN-PRD-01 — La equivalencia en litros es dato de configuración, no código

**Estado:** 🟡 Supuesto

Unidades por paca y volumen por unidad se configuran, no se escriben fijos en el
código. Un cambio de presentación no puede requerir un despliegue.

**Por qué:** el día que salga una bolsa de 500 ml o una paca de 24, el sistema
tiene que absorberlo sin tocar el cálculo.

---

## El agua tiene dos estados, no uno

**Estado:** ✅ Confirmada — capacidad y rendimiento.

El suministro municipal **no es continuo**. Por eso Aquazaku almacena
**13.000 litros**: el almacenamiento es lo que garantiza el servicio cuando la
red no da agua.

Pero no todo lo almacenado se puede envasar. El procesamiento y los filtros
**rechazan el 30% del flujo**.

```
   RED MUNICIPAL  (intermitente, sin medidor)
         │
         ▼
  ┌──────────────────┐
  │   AGUA CRUDA     │   13.000 L de capacidad
  └──────────────────┘
         │
         ▼
   ╔══════════════════╗
   ║  PROCESAMIENTO   ║ ──── 30% rechazo ────▶  (se pierde)
   ║    Y FILTROS     ║
   ╚══════════════════╝
         │ 70%
         ▼
  ┌──────────────────┐
  │  AGUA PROCESADA  │   2 × 2000 L
  └──────────────────┘
         │
         ▼
      ENVASADO
```

### Las tres monedas del agua

| Unidad | Dónde vive | Capacidad | Se convierte en |
| --- | --- | --- | --- |
| **Litro crudo** | Almacenamiento | 13.000 L | Litro procesado (×0,70) |
| **Litro procesado** | Tanques | 2 × 2000 L | Producto envasado |
| **Producto** | Bodega | — | Venta |

Hay **dos fronteras de conversión**, no una. Cada una tiene su propia pérdida:
el procesamiento pierde 30%, y el envasado pierde el agua de lavado
([RN-PRD-05](#rn-prd-05--el-lavado-de-botellón-consume-agua-sin-generar-producto)).

### Capacidad total del sistema

**Estado:** ✅ Confirmada — los 13.000 L son **aparte** de los tanques de 2000 L.

| Etapa | Capacidad | Utilizable para envasar |
| --- | --- | --- |
| Agua cruda | 13.000 L | 9.100 L *(×0,70)* |
| Agua procesada | 2 × 2000 = 4.000 L | 4.000 L |
| **Total** | **17.000 L** | **13.100 L** |

Los 3.900 L de diferencia entre capacidad y utilizable son el rechazo de los
filtros. No es una pérdida evitable: es el costo de procesar.

---

### RN-PRD-02 — El agua se controla en litros, y cada tanque es una ubicación

**Estado:** ✅ Confirmada — los dos tanques son **separados**, no un pozo único.

El sistema lleva **tres saldos independientes**:

| Saldo | Capacidad | Para qué sirve |
| --- | --- | --- |
| Agua cruda | 13.000 L | Autonomía: cuántos días aguanto sin suministro |
| Tanque procesado **A** | 2.000 L | Qué puedo envasar ahora |
| Tanque procesado **B** | 2.000 L | Qué puedo envasar ahora |

**Por qué separados:** un solo saldo no puede responder "¿cuánta agua tengo?",
porque la respuesta depende de para qué. Y como los tanques no están unidos, cada
uno es una **ubicación distinta** — la misma lógica que
[`BODEGA` y `RUTA:{id}`](/dominio/stock/) para el producto.

:::danger[La consecuencia operativa: el techo por tanda es 2.000 L, no 4.000]
Que haya 4.000 L de agua procesada **no significa** que se pueda hacer una tanda
de 4.000 L.

```
Envasar 2.500 L  →  vacía el tanque A (2.000)
                 →  y sigue con el B (500)
                 →  hay que cambiar de tanque a mitad de la corrida
```

Si el envasado se alimenta de un tanque a la vez, el máximo continuo es **2.000 L**
— unas 166 pacas de 600 ml, o 100 botellones. Pasado eso hay una operación manual
de cambio.

Es una restricción real de producción que un saldo único de 4.000 L habría
escondido.
:::

:::tip[Pero los dos pueden operar en paralelo]
Cada tanque individualmente sigue topeado a 2.000 L por corrida. Sin embargo,
**ambos tanques funcionan en paralelo**: se llenan juntos y se vacían juntos, no
uno de reserva. Eso da una capacidad efectiva del sistema de **4.000 L en proceso
simultáneo**, manteniendo la restricción individual. Ver
[RN-PRD-21](#rn-prd-21--los-tanques-se-operan-en-paralelo-no-en-alternancia) abajo.
:::

**Consecuencia sobre el modelo:** toda operación de agua procesada declara su
tanque.

| Operación | Tiene que registrar |
| --- | --- |
| [Corrida de procesamiento](#rn-prd-18--la-corrida-de-procesamiento-se-mide-por-caudal-y-tiempo) | Tanque **destino** (puede ser los dos) |
| [Cierre de producción](#rn-prd-04--cada-día-se-registra-un-cierre-de-producción) | Litros por **cada** tanque (A + B) |

---

### RN-PRD-12 — El procesamiento rinde 70%

**Estado:** ✅ Confirmada

De cada 100 litros crudos que entran al procesamiento, **70 quedan utilizables**
y 30 se rechazan.

```
litros_procesados = litros_crudos × 0,70
```

| Agua cruda | Agua utilizable |
| --- | --- |
| 13.000 L | **9.100 L** |
| 1.000 L | 700 L |

**Por qué:** sin este factor, cualquier planificación sobreestima la capacidad
un 43%. Si creés que tenés 13.000 L envasables cuando en realidad tenés 9.100,
prometés producción que no podés cumplir.

:::danger[El rendimiento es un indicador de mantenimiento]
El 70% no es una constante de la física: es el estado actual de los filtros.

Si el rendimiento **cae**, los filtros están sucios o gastados. Por eso va como
**parámetro configurable**, no como constante en el código.
:::

:::tip[Y ahora es detectable, gratis]
El punto de medición está **después** de los filtros
([RN-PRD-18](#rn-prd-18--la-corrida-de-procesamiento-se-mide-por-caudal-y-tiempo)),
así que el caudal medido ya refleja la resistencia que oponen.

**Filtro sucio ⟶ más resistencia ⟶ menos caudal ⟶ más tiempo de llenado.**

Registrando el tiempo de cada corrida, el sistema ve la tendencia sin ningún
sensor extra:

| Tiempo de llenado de 2.000 L | Lectura |
| --- | --- |
| Estable | Filtros sanos |
| Subiendo mes a mes | **Los filtros se están tapando** |

Avisa antes de que la planta se frene. Es el mejor retorno de todo el módulo de
producción, y sale de un dato que igual hay que registrar.
:::

---

### RN-PRD-18 — La corrida de procesamiento se mide por caudal y tiempo

**Estado:** ✅ Confirmada — existe el punto de medición. 🟡 Pendiente — el valor del caudal.

Hay un flujo medible en galones por minuto, ubicado **después de los filtros y
justo antes de los tanques de 2000 L**. Es decir: mide **agua ya procesada**.

```
ALMACENAMIENTO          FILTROS         ┃ MEDICIÓN ┃      TANQUES
  13.000 L      ───▶   (30% rechazo)  ──┃  GPM     ┃───▶  2 × 2000 L
   (sin medición)                       ┃ × tiempo ┃
```

Encender la planta inicia una **corrida de procesamiento**. Su volumen se calcula:

```
litros_procesados = caudal (L/min) × minutos de corrida
```

**Por qué es el mejor punto posible:** no hace falta leer ningún nivel. El tiempo
se mide con precisión de segundos, y el resultado es un volumen exacto — sin la
incertidumbre de ±1.625 L de la estimación visual
([RN-PRD-11](#rn-prd-11--el-nivel-del-tanque-se-estima-a-ojo-en-cuartos)).

#### Un solo punto de medición, dos saldos resueltos

Como el rendimiento es conocido, medir la salida da también la entrada:

```
litros_procesados  =  caudal × tiempo          ← medido
crudo_consumido    =  litros_procesados ÷ 0,70 ← derivado
rechazo            =  crudo_consumido − litros_procesados
```

| Ejemplo | Litros |
| --- | --- |
| Procesado (medido) | 1.000 L |
| Crudo consumido (derivado) | 1.428 L |
| Rechazo | 428 L |

Con esto, la **bajada** del almacenamiento crudo se conoce con precisión aunque
ese tanque no tenga instrumento propio.

:::danger[Convertir a litros en la frontera]
El caudal viene en **galones por minuto**. Galón americano = 3,785 L; galón
imperial = 4,546 L. **Son 20% de diferencia** — verificar cuál usa la placa de la
bomba antes de cargar el parámetro.

La conversión se hace **una sola vez, al ingresar el dato**. Adentro del sistema
solo circulan litros. Dos sistemas de unidades conviviendo en el modelo es una
fábrica de errores silenciosos.
:::

---

### RN-PRD-20 — Hoy se envasa bajo demanda, no contra stock

**Estado:** ✅ Confirmada

Por el volumen actual de ventas, Aquazaku **empaca cuando hay demanda**. No hay
producto terminado esperando en bodega: se envasa contra el pedido.

| | Hoy — bajo demanda | Objetivo — contra stock |
| --- | --- | --- |
| Dispara el envasado | La venta | Un plan de producción |
| Stock de terminado | Prácticamente cero | Sí, con mínimos |
| Botellón lleno vs vacío | No hace falta distinguir | Sí ([RN-ENV-07](/dominio/botellones-y-bases/)) |

**Por qué importa:** cambia qué significa el
[cierre de producción](#rn-prd-04--cada-día-se-registra-un-cierre-de-producción).
Bajo demanda, envasar y vender ocurren casi juntos, así que el cierre diario es
más un **resumen del día** que un evento de planificación.

---

### RN-PRD-21 — Los tanques se operan en paralelo, no en alternancia

**Estado:** ✅ Confirmada — cerrá la pregunta #14 de
[Qué falta preguntar](/empezar/pendientes/).

Los dos tanques de 2000 L **funcionan en paralelo**: se llenan juntos, se
vacían juntos. No hay alternancia ni un tanque principal + reserva.

| | Significa |
| --- | --- |
| **Capacidad efectiva del sistema** | 4.000 L en proceso simultáneo (2 × 2.000) |
| **Tope por tanda individual** | Sigue siendo 2.000 L POR tanque ([RN-PRD-02](/dominio/produccion/)) |
| **Decisión del operario** | Ninguna activa — el operario (`pos`) usa el tanque que tenga agua disponible |
| **UI** | Mostrar el nivel de los **dos** tanques lado a lado, no un único "nivel del sistema" |
| **Cierre de producción** | Registra litros procesados por **cada** tanque (A + B), no un único número de salida |

:::tip[Por qué se documenta igual que la restricción individual]
Cada tanque conserva su tope de 2.000 L por corrida — no se puede romper esa
restricción para "ahorrar tiempo". Pero el conjunto opera a 4.000 L porque
ambos procesan a la vez. Es 2 + 2, no 4.
:::

**Por qué importa:** un solo saldo de "tanques" escondería la asimetría operativa
entre los dos. Si en algún momento uno solo se usa, el modelo sigue siendo capaz
de representarlo.

---

### RN-PRD-22 — El cierre de producción es diario, no por tanda

**Estado:** ✅ Confirmada — cerrá la pregunta #15 de
[Qué falta preguntar](/empezar/pendientes/).

El registro de cierre de producción se hace **una vez al día**, al final del día
operativo. No se registra por cada tanda individual.

| Datos registrados | |
| --- | --- |
| Total de litros procesados ese día (suma de tanque A + B) | |
| Timestamp del cierre | |
| `user_id` del `pos` que lo registra | |

**Lo que conscientemente NO se registra** (a cambio de simplicidad):
- Duración de cada tanda individual
- Caudal por tanda
- Comparativa entre tanques a nivel tanda

**Por qué es aceptable perder esa granularidad:** con el volumen actual de
Aquazaku y la operación bajo demanda, el agregado diario alcanza para derivar
el consumo promedio y el balance de agua. Si en algún momento hace falta
trazabilidad fina por tanda, se agrega un registro intermedio **opcional** sin
romper el cierre diario.

:::note[Impacto sobre el caudal real]
La pregunta 🟠 #5 ("tiempo de llenado del tanque") ya **no se puede derivar de
los cierres automáticos**. Tendrá que ser una medición manual que el operario
registre informalmente, o se conecta al caudalímetro físico que ya existe en la
planta — a verificar en una ronda posterior.
:::

---

### RN-PRD-19 — Procesar y envasar son dos eventos distintos

**Estado:** 🟡 Supuesto

Hay **dos transformaciones**, con instrumentación distinta y que no
necesariamente ocurren al mismo tiempo:

| Evento | Convierte | Se mide con |
| --- | --- | --- |
| **Corrida de procesamiento** | Crudo ➡️ Procesado | Caudal × tiempo ([RN-PRD-18](#rn-prd-18--la-corrida-de-procesamiento-se-mide-por-caudal-y-tiempo)) |
| **Cierre de producción** | Procesado ➡️ Producto | Conteo de pacas y botellones ([RN-PRD-04](#rn-prd-04--cada-día-se-registra-un-cierre-de-producción)) |

**Por qué:** se puede procesar agua un día y envasarla al siguiente. Modelarlos
como un solo evento obliga a que coincidan, y el saldo de agua procesada deja de
tener sentido.

:::tip[El balance del tanque procesado queda cerrado]
Este es el primer saldo del sistema con **las dos puntas medidas**:

```
+ corrida de procesamiento   ← caudal × tiempo   (medido)
− consumo de envasado        ← pacas y botellones (calculado)
```

Sin estimaciones visuales de por medio. Acá sí se puede detectar merma real.
:::

---

### RN-PRD-13 — La autonomía es el indicador crítico de la planta

**Estado:** 🟡 Supuesto

Con suministro intermitente, la pregunta operativa central no es "cuánta agua
tengo" sino **"cuántos días puedo producir sin que llegue agua"**.

```
autonomía (días) = (litros_crudos × 0,70 + litros_procesados)
                   ────────────────────────────────────────────
                          consumo diario promedio
```

**Por qué:** es lo que convierte el balance de agua en una herramienta de
decisión en vez de un reporte. Con la red cortada, este número dice si hay que
frenar la producción hoy o si se aguanta.

:::tip[Debería ser lo primero que se ve]
De todo lo que este sistema puede mostrar en una pantalla de planta, este es el
número que decide si mañana hay servicio o no.
:::

:::caution[Y se muestra como rango, no como número]
La autonomía hereda la imprecisión de la lectura del tanque. Con ±1.625 L de
error sobre el agua cruda, el resultado tiene que presentarse así:

> **Autonomía: entre 3 y 5 días**

No "4,3 días". Es la aplicación directa de
[RN-PRD-15](#rn-prd-15--nunca-mostrar-precisión-que-no-existe): si la entrada es
una banda, la salida también.
:::

---

### RN-PRD-16 — El peor caso conocido es 5 días sin servicio

**Estado:** ✅ Confirmada

Perfil de cortes de la red municipal en Campo de la Cruz:

| Escenario | Duración | Frecuencia |
| --- | --- | --- |
| Corte normal | **1 día** | Habitual — soportable con la operación actual |
| Corte extremo | **5 días** | Casos aislados |

**Por qué importa:** el dimensionamiento del almacenamiento no lo define el corte
normal, lo define **el peor caso**. Un día se aguanta sin sistema; cinco días es
donde se decide si hay servicio o no.

Estos dos números son los umbrales del semáforo de
[autonomía](#rn-prd-13--la-autonomía-es-el-indicador-crítico-de-la-planta):

| Estado | Autonomía | Significa |
| --- | --- | --- |
| 🟢 Verde | ≥ 5 días | Cubre el peor caso histórico |
| 🟡 Amarillo | 1 – 5 días | Cubre un corte normal, no uno extremo |
| 🔴 Rojo | < 1 día | No cubre ni un corte habitual |

---

### RN-PRD-17 — El sistema calcula cuándo hacen falta más tanques

**Estado:** 🟡 Supuesto — habilita la fase 2

Hoy el almacenamiento alcanza. Pero **alcanza para el nivel de ventas actual**, y
Aquazaku ya previó evaluar más tanques si las ventas crecen.

Esa evaluación no tiene por qué ser una corazonada. Es una división:

```
consumo diario máximo sostenible = agua utilizable total ÷ 5 días
```

Con **13.100 L utilizables** a tanques llenos:

```
13.100 L ÷ 5 días  =  2.620 L/día
```

Ese es el **techo de producción sostenible** si se quiere seguir cubriendo el
peor caso conocido. Traducido a producto:

| Si todo fuera… | Tope diario |
| --- | --- |
| Pacas de 600 ml (12 L) | ≈ 218 pacas |
| Pacas de 300 ml (15 L) | ≈ 174 pacas |
| Botellones (20 L + lavado) | < 131 botellones |

*El número de botellones es menor al que da la división, porque cada uno consume
además el [agua de lavado](#rn-prd-05--el-lavado-de-botellón-consume-agua-sin-generar-producto).
Cuánto menor, depende de un dato que todavía falta medir.*

**Por qué:** convierte "evaluaríamos comprar más tanques" en una **alerta
automática**. Cuando el consumo diario promedio se acerque a ese tope, el sistema
avisa que la capacidad de almacenamiento dejó de cubrir el peor caso — antes de
que un corte de 5 días deje a los clientes sin agua.

:::tip[La pregunta que falta para que esto funcione]
Todo este cálculo necesita un dato que todavía no tenemos: **el consumo diario
promedio actual en litros**.

Es el número más importante que falta en el dominio de producción. Sin él, la
autonomía no se puede calcular y el semáforo no se puede pintar.

La buena noticia: una vez que el sistema registre el cierre de producción
([RN-PRD-04](#rn-prd-04--cada-día-se-registra-un-cierre-de-producción)), ese
número **se calcula solo** a las pocas semanas. No hay que pedírselo a nadie.
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

### RN-PRD-11 — El nivel del tanque se estima a ojo, en cuartos

**Estado:** ✅ Confirmada

No hay medidor **ni regla**. El nivel se estima visualmente en cuatro bandas:
vacío, ¼, ½, ¾, lleno.

Esta es **la restricción más importante de todo el dominio de producción**, y
condiciona todo lo demás de esta página.

#### Cuánto vale un cuarto

| Depósito | Capacidad | 1 cuarto | Error de una lectura (±⅛) |
| --- | --- | --- | --- |
| Agua cruda | 13.000 L | 3.250 L | **± 1.625 L** |
| Tanque procesado | 2.000 L | 500 L | ± 250 L |

Y ahora comparalo con lo que se produce:

| ± 1.625 L equivale a | Cantidad |
| --- | --- |
| Pacas de 600 ml (12 L) | **≈ 135 pacas** |
| Botellones (20 L) | **≈ 81 botellones** |

:::danger[La consecuencia que hay que aceptar]
**El tanque no puede ser la fuente de verdad del balance de agua.**

Un error de lectura de ±1.625 L se traga la producción de un día entero. Cualquier
cálculo que reste dos lecturas visuales para deducir consumo o merma produce un
número que **parece** exacto y es ruido.

Y eso es peor que no tener el dato: un número falso se usa para decidir.
:::

---

### RN-PRD-14 — El saldo calculado manda; la lectura visual reconcilia

**Estado:** 🟡 Supuesto — **es la propuesta de diseño para esta restricción**

Como la medición es gruesa pero **el registro de producción es exacto**, se
invierte quién manda:

| | Fuente | Precisión | Rol |
| --- | --- | --- | --- |
| **Saldo calculado** | Aritmética de producción | Litro | **Fuente de verdad** |
| **Lectura visual** | Estimación en cuartos | ± ⅛ tanque | Punto de control |

El sistema lleva el saldo en litros calculándolo desde la producción
([RN-PRD-06](#rn-prd-06--el-balance-diario-de-agua)). La lectura visual **no
corrige ese saldo**: solo verifica que siga siendo creíble.

```
¿el saldo calculado cae dentro de la banda observada?
   sí  → todo normal, no se hace nada
   no  → ALERTA: el cálculo y la realidad se separaron
```

**Por qué:** es el mismo patrón de inventario contable contra conteo físico. El
libro es preciso pero se desvía; el conteo es real pero grueso. Se reconcilian,
no se pisan.

#### Qué detecta y qué no

Ser honesto sobre esto es parte del diseño:

| Sí detecta | No detecta |
| --- | --- |
| Una producción no registrada | Una fuga chica |
| Una fuga grande o un tanque que se vació | Merma de 50 L/día |
| Un tanque que no se llenó cuando debía | Diferencias finas de rendimiento |

Una pérdida de 100 L por día tarda **más de un mes** en mover una banda de cuarto
en el depósito de 13.000 L. El sistema no la va a ver, y hay que decirlo en la
documentación en vez de fingir que sí.

:::caution[Impacto sobre la merma]
Esto degrada [RN-PRD-07](#rn-prd-07--la-merma-se-detecta-pero-no-se-puede-cuantificar):
la merma **no se puede cuantificar** con esta instrumentación. Solo se puede
detectar cuando es grande.
:::

---

### RN-PRD-15 — Nunca mostrar precisión que no existe

**Estado:** 🟡 Supuesto

Una lectura visual se guarda como **banda**, nunca como un número exacto.

| ❌ Mal | ✅ Bien |
| --- | --- |
| `nivel = 6500 L` | `nivel = MEDIO` → rango 4.875 – 8.125 L |
| "Quedan 4,3 días" | "Quedan entre 3 y 5 días" |

**Por qué:** convertir "medio tanque" a `6500 L` es **falsa precisión**, y es de
los errores más dañinos que se pueden cometer en un sistema de control. Una vez
que el número entra a la base de datos como entero, todo lo que viene después lo
trata como exacto — reportes, alertas, decisiones de producción.

La incertidumbre tiene que **viajar con el dato**, no perderse en el primer
`INSERT`.

---

:::tip[Dónde poner la regleta graduada]
Con el caudal medido después de los filtros
([RN-PRD-18](#rn-prd-18--la-corrida-de-procesamiento-se-mide-por-caudal-y-tiempo)),
los tanques de 2000 L **ya no necesitan instrumentación**: su balance está cerrado
por medición y cálculo.

El único punto ciego que queda es el **almacenamiento de 13.000 L**. Ahí sí vale
una regleta.

| Depósito | ¿Necesita regleta? | Por qué |
| --- | --- | --- |
| Tanques 2 × 2000 L | **No** | Entrada medida, salida calculada |
| Almacenamiento 13.000 L | **Sí** | El ingreso municipal no se puede medir |

Con la regleta en el tanque crudo se cierra el último término del balance, y de
paso el rendimiento real deja de ser un supuesto:

```
rendimiento_real = litros_procesados ÷ bajada_del_tanque_crudo
```

Ese número confirma —o corrige— el 0,70 de [RN-PRD-12](#rn-prd-12--el-procesamiento-rinde-70)
con datos propios de la planta.
:::

#### Cómo marcar la regleta

Especificación práctica, para hacerlo una sola vez:

| Decisión | Recomendación | Por qué |
| --- | --- | --- |
| **Unidad** | Litros, no centímetros | Que nadie tenga que convertir al leer |
| **Calibración** | Empírica, no calculada | Los tanques suelen ser cónicos: los litros por cm **no** son constantes |
| **Método** | Llenar contando botellones de 20 L y marcar cada 5 (100 L) | Usa lo que ya hay en planta, sirve para cualquier forma de tanque |
| **Intervalo** | El que deje marcas a 2–3 cm | Más juntas no se leen; más separadas pierden precisión |
| **Cero** | Al **nivel de salida**, no al fondo | El agua bajo la toma no es utilizable: contarla infla la autonomía |
| **Soporte** | Regleta fija al lado del tubo, no sobre el tubo | El PVC se pone amarillo con el sol y hay que cambiarlo; las marcas deben sobrevivirlo |

:::tip[Pintar el semáforo en el tanque]
Los umbrales de [RN-PRD-16](#rn-prd-16--el-peor-caso-conocido-es-5-días-sin-servicio)
se pueden pintar directamente sobre la regleta: franja verde arriba de la línea de
5 días, amarilla entre 1 y 5, roja abajo.

El operario sabe cómo está parada la planta sin abrir el sistema. La información,
donde se toma la decisión.
:::

**Falta confirmar:**

- ¿Se estima el nivel del almacenamiento crudo, de los tanques procesados, o de
  los dos?
- ¿Quién hace la lectura y con qué frecuencia?

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
| ➕ Ingresa producto | Bodega |

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

Ese consumo sale del **agua procesada**. Y los dos saldos se mueven así:

```
AGUA PROCESADA (2 × 2000 L)          ← balance CERRADO
  saldo inicial
    + corrida de procesamiento         caudal × tiempo   ✅ medido
    − litros consumidos en el día      pacas y botellones ✅ calculado
  = saldo final

AGUA CRUDA (13.000 L)                ← un término sin medir
  saldo inicial
    + ingreso de la red municipal      ❌ SIN MEDICIÓN
    − corrida ÷ 0,70                   ✅ derivado (RN-PRD-18)
  = saldo final
```

:::note[Dónde quedó el único hueco]
De los cuatro términos del balance, **tres son precisos**. El único que no se
puede medir es el ingreso de la red al almacenamiento crudo.

Ese es el punto donde una regleta graduada sigue valiendo la pena — y ahora se
sabe exactamente **en cuál tanque** ponerla.
:::

:::caution[`litros ingresados` no se puede medir]
No hay medidor ni regla ([RN-PRD-11](#rn-prd-11--el-nivel-del-tanque-se-estima-a-ojo-en-cuartos)).
El ingreso de agua **no es un dato que el sistema reciba**.

Lo que se puede hacer es registrar el hecho —*"llegó agua y se llenó el tanque"*—
sin cantidad exacta, y dejar que el saldo calculado suba hasta la banda observada.
Es una recalibración, no una medición.

Ver [RN-PRD-14](#rn-prd-14--el-saldo-calculado-manda-la-lectura-visual-reconcilia).
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

### RN-PRD-07 — La merma se detecta, pero no se puede cuantificar

**Estado:** 🟡 Supuesto — **limitado por la instrumentación**

El consumo calculado nunca coincide exactamente con la realidad del tanque. Esa
diferencia es **merma**: purgas, derrames, evaporación, pérdidas.

Conceptualmente es el equivalente productivo del faltante de ruta
([RN-RUT-03](/dominio/rutas/)): existe, es normal en cierta medida, y una merma
que crece es señal de una pérdida real.

:::danger[Pero hoy no se puede medir]
Con lectura visual en cuartos ([RN-PRD-11](#rn-prd-11--el-nivel-del-tanque-se-estima-a-ojo-en-cuartos)),
la merma **no es cuantificable**. El error de medición (±1.625 L) es mucho más
grande que la merma que se querría detectar.

Lo único que se puede hacer hoy es lo que describe
[RN-PRD-14](#rn-prd-14--el-saldo-calculado-manda-la-lectura-visual-reconcilia):
detectar que el saldo calculado se salió de la banda observada, y levantar una
alerta cualitativa — *"acá hay algo raro"*, no *"faltan 340 litros"*.

Esta regla queda escrita para el día que haya una regla graduada en el tanque.
Hasta entonces, es aspiracional.
:::

---

### RN-PRD-08 — Un cierre de producción no se edita

**Estado:** 🟡 Supuesto

Igual que [RN-VEN-02](/dominio/ventas/) y [RN-RUT-04](/dominio/rutas/): cerrado
el día, el registro es inmutable. Una corrección es un ajuste posterior con
motivo y responsable.

---

### RN-PRD-23 — El cierre diario genera un lote con vencimiento a 30 días

**Estado:** ✅ Confirmada — cerrá la pregunta 🟢
"¿Hay control de lotes o vencimiento?" de
[Qué falta preguntar](/empezar/pendientes/).

Al cerrar la producción del día, el sistema genera **un lote por cierre** con
un identificador y la fecha de vencimiento calculada.

```
cierre_produccion = {
  ...,
  lote_generado: "YYYY-MM-DD-L1",      // generado por el sistema
  fecha_empaque: date,                  // = día del cierre
  ...
}

producto_unidad = {
  sku: ...,
  lote_id: lote_id,
  fecha_empaque: date,
  fecha_vencimiento: date,             // fecha_empaque + 30 días
  ...
}
```

**Reglas**:

- **Vencimiento automático**: 30 días desde empaque. Lo calcula el sistema al cerrar.
- **Impresión física**: el `pos` imprime y adhiere el lote + vencimiento al empaque físico. El sistema genera el formato legible.
- **FIFO en bodega**: el sistema ofrece al vendedor las unidades con vencimiento más próximo primero.
- **Vencidos se bloquean** de la venta (ver [RN-STK-04](/dominio/stock/) sobre stock con vencimiento).

Ver [RN-STK-04](/dominio/stock/) para las reglas completas de stock con lote/vencimiento.

---

### RN-PRD-24 — El encendido y apagado de la planta lo registra el `pos`

**Estado:** ✅ Confirmada — cerrá la pregunta 🟢
"¿Quién registra el encendido y apagado de la planta, y cómo?" de
[Qué falta preguntar](/empezar/pendientes/).

El operario de planta (**`pos`**) registra cada corrida de procesamiento —
desde el encendido hasta el apagado. Esos eventos alimentan el cálculo del
caudal y el mantenimiento predictivo.

```
corrida_procesamiento = {
  id: uuid,
  started_at: timestamp,
  ended_at: timestamp | null,             // null mientras está activa
  tanque_destino: "A" | "B",
  registrado_por: user_id,                // siempre pos
  ...
}
```

**Cálculos derivados**:

```
duracion = ended_at − started_at
litros_procesados = caudal_gpm × galones_a_litros × duracion_en_minutos
```

El cálculo del caudal depende del 🟠 #4 ("valor del caudal en GPM"). Sin ese
dato, la corrida se registra igual pero el sistema no puede derivar los litros
procesados automáticamente.

**Mantenimiento predictivo** (propuesta ya anotada):

- Si los filtros se deterioran, `duracion` sube mes a mes.
- El sistema puede graficarlo sin sensor extra.
- Compatible con la regla del caudalímetro post-filtros ([RN-PRD-18](#rn-prd-18--la-corrida-de-procesamiento-se-mide-por-caudal-y-tiempo)).

**Por qué importa**: el mismo user_id que vende opera la planta. Auditoría
consistente entre la cara POS y la cara de producción.

---

## Preguntas abiertas

- **🟠 Mediciones de planta (requieren ir a la planta):**
  - ¿Cuál es el valor del caudal en GPM, y es galón americano o imperial?
  - ¿Cuánto tarda en llenarse un tanque de 2.000 L?
  - ¿Cuál es el consumo diario promedio en litros? *(Se autocalcula a las pocas semanas de registrar cierres de producción.)*
  - ¿Cuántos litros consume lavar un botellón?
- 🟢 Refinamientos que quedaron en producción:
  - **¿Cuántas bolsas trae la paca de 300 ml?** Asumido 50, sin reconfirmar tras el cambio de presentación.
  - ¿Se controlan las **bolsas** como insumo, además de tapas y sellos?
  - ¿Se vende la bolsa suelta, o siempre la paca completa?
  - ¿Hay control de lote o fecha de envasado por producción?
  - ¿Puede haber producto envasado que se descarte por control de calidad?

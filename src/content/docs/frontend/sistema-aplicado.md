---
title: El sistema, aplicado
description: Las piezas que la fase de diseño dejó construidas, las reglas que las gobiernan y lo que se decidió no construir.
sidebar:
  order: 3
---

Esta página es el índice de lo que **ya existe**. Antes de diseñar o construir
una pantalla nueva, lo que sigue no se vuelve a inventar.

Para el lenguaje visual —vidrio, agua, movimiento— está
[Vidrio y agua](/frontend/vidrio-y-agua/). Para el arte de la marca,
[La marca](/frontend/marca/).

## El par fondo/texto es indivisible

Cada estado del sistema trae **cuatro** tokens, y no son intercambiables:

| Token | Qué es |
| --- | --- |
| `-fondo` | La superficie del aviso |
| `-borde` | Su contorno |
| `-texto` | El texto que va **arriba** de ese fondo |
| `-base` | El color puro, para un punto o un icono sobre el fondo normal |

`-fondo` y `-texto` **se usan juntos**. Están calculados para contrastar entre sí
en los dos modos: en claro el fondo es pálido y el texto oscuro; en oscuro se
invierten los dos a la vez.

Romper el par es lo que dejó **cuatro botones invisibles** en M2. En una palabra:
si ponés `bg-<estado>-fondo`, poné `text-<estado>-texto`. Si necesitás el color
sin superficie, usá `text-<estado>` — que es `-base`.

`globals.contraste.test.ts` recorre los cinco pares declarados más las nueve
combinaciones de nivel de texto × superficie, y exige 4,5:1 en claro **y** en
oscuro. Un par mal calculado no llega a la aplicación.

:::caution[El verde `#33BD73` nunca es decorativo]
Regla dura del sistema de diseño: es la luz verde del semáforo y del cuadre. Si
aparece donde no significa «todo en orden», está mal usado.

Por eso la cinta de marca usa `#1EAA64` —el verde real del arte, muestreado— y
no el verde de éxito. Son dos verdes distintos a propósito.
:::

## La jerarquía de texto se separa por TONO, no por luminosidad

Tres grises que solo cambian de claridad se distinguen en una tabla de tokens y
**no en una pantalla**. Medido en el tablero: seis roles distintos —subtítulo,
rótulo de sección, código de producto, icono de perfil, icono de tarjeta y
créditos— renderizaban el mismo `rgb(195,207,214)`. La pantalla entera eran dos
colores, y `tenue` no aparecía en ninguna parte.

Los niveles tiran al azul de la marca, con más saturación a medida que el nivel
se aleja. El aqua y el verde **no** se usan acá: están reservados a «agua» y a
«cuadra».

| Nivel | Para qué | Ejemplo |
| --- | --- | --- |
| `principal` | Lo que se vino a ver | Título, nombre del producto, la cifra |
| `secundario` | Prosa de apoyo y controles | La bajada del título, los iconos de la cabecera |
| `tenue` | Metadatos | Código, rótulo de sección, unidad, créditos |
| `icono` | Glifos que son **textura** | El icono en la esquina de una tarjeta |

`icono` existe porque los glifos decorativos venían robándose `secundario` —el
mismo valor que la prosa— y competían con el texto que acompañan. No le aplica
el 4,5:1 de texto: no transporta significado, y lo que dice está escrito al
lado. Se verifica sobre 3:1, y que **no iguale a `tenue`** — si lo iguala no es
una capa, es más texto.

:::caution[El icono que es el control no es decorativo]
Los de la cabecera y los del menú usan tokens de texto, porque ahí el glifo es
la única etiqueta que hay.
:::

## Nadie escribe su propio campo ni su propio botón

Diez archivos repetían `rounded border border-fuerte bg-transparent px-2 py-1.5`
copiado, y los botones salían en tres alturas —`py-2`, `h-14`, `min-h-11`—. Por
eso los formularios de auditoría y de usuarios se veían de otro sistema: **no
había con qué construirlos**.

| Clase | Qué es |
| --- | --- |
| `.aq-campo` | El control donde se escribe |
| `.aq-etiqueta-campo` | Su etiqueta, en `tenue` |
| `.aq-boton` + `-primario` / `-secundario` / `-destructivo` | 44 px de alto |
| `.aq-boton-grande` | 56 px, para la pantalla que hace una sola cosa |
| `.aq-boton-compacto` | Solo se angosta — el dedo no se achica en una tabla |

**El campo es la operación inversa a la tarjeta.** Todo flota sobre el agua; el
campo es el único lugar donde se escribe y tiene que leerse **hundido**. De ahí
la sombra interna y el fondo más apagado que la lámina que lo contiene. Con
`bg-transparent`, sobre el agua un campo no se lee como campo — se lee como un
borde dibujado encima del gradiente.

El campo **no declara `:focus`**: el anillo global ya lo cubre, y competir con él
fue lo que dejó el foco invisible la primera vez.

Tres tests recorren los `.tsx` y fallan con la lista de archivos culpables. No
es hipotético: al escribirlos encontraron **tres botones a mano** que el barrido
manual no había visto.

## La ficha: cuando el objetivo táctil es la etiqueta entera

Los roles se elegían con checkboxes **nativos de 16 px**. El problema no es
estético: la regla de los 44 px **exime** a `checkbox` y a `radio` —agrandar la
caja los deforma— y esa exención dejó el control más chico de la app en la
pantalla donde se decide **quién puede hacer qué**. Fallar ahí es darle un rol a
alguien sin querer.

La salida no es agrandar la caja: es que el objetivo sea **la ficha entera**. El
`<label>` pasa a ser una superficie de 44 px que se toca en cualquier parte, y la
caja queda como indicador.

El input sigue siendo un `checkbox` nativo, solo que `sr-only`: el lector de
pantalla anuncia «casilla, admin, marcada», el formulario sigue enviando `roles`,
y **no hay una línea de JavaScript**. Lo único que cambia es dónde se dibuja.

`.aq-ficha-compacta` baja a 36 px para las filas de tabla — sigue siendo más del
doble que el nativo que había.

:::caution[El anillo de foco tiene que saltar del input a la ficha]
El input mide 1 px, y ahí el anillo global se dibuja donde no lo ve nadie. Se
resuelve con `:has(input:focus-visible)` sobre la ficha, **nunca** apagando la
regla global — que es la trampa que ya dejó el foco invisible una vez.
:::

## Un canal, no cuatro márgenes

Había **tres valores** para la misma distancia: el menú a 12 px del borde, el
contenido a 24 y el pie con 24 a los lados y 12 abajo. Nadie eligió eso — cada
pieza traía su propia clase de Tailwind y ninguna sabía de las otras.

`--aq-canal` vive en `.aq-armazon` y lo aplica el armazón con `padding` y `gap`.
Las piezas dejan de traer margen propio; su padding interno sigue siendo de cada
una. Un test verifica que ninguna reponga la distancia a mano.

## La cabecera flotante reclama el ángulo superior derecho

En escritorio la cabecera **no ocupa fila propia**: se monta sobre el contenido
con `z-index: 1`, y por eso el `<main>` puede empezar en el borde del viewport.

La contrapartida es que **nada más puede vivir ahí**. Pasó con «Gestionar
catálogo», que quedó literalmente debajo de los iconos de sesión.

Hay dos remedios y el orden importa:

1. **Mover la acción junto a lo que acciona.** Es lo que hace `/modulos/productos`:
   el aviso y el botón comparten renglón, porque el aviso dice qué arreglar y el
   botón lleva a arreglarlo. `ml-auto` mantiene el botón a la derecha haya o no
   aviso, así que la pantalla no salta.
2. **`.aq-cabecera-pantalla`**, que reserva `--aq-chrome-ancho`, para la pantalla
   que de verdad necesite una acción en el encabezado.

Un test verifica que la reserva alcance para los controles que el chrome
realmente renderiza: si entra un cuarto icono, falla ahí en vez de taparle el
botón a alguien.

## El vidrio se mide en porcentaje del elemento, y eso no escala

`.aq-panel-marca` y `.aq-tarjeta` comparten base y solo cambian tokens. Aun así
se veían distintas, y por dos causas que no eran la opacidad.

**La geometría.** El brillo es un `radial-gradient` medido en porcentaje del
elemento: `120% 65%`. Sobre el menú —256 × 1170— da una elipse de ~307 × 760, un
resplandor amplio. Sobre el pie —1215 × 44— la misma regla da ~1440 × 28: **una
raya fina**. De ahí `.aq-panel-banda`, con la geometría de una caja ancha y baja.

**Los reflejos.** La tarjeta tenía el brillo interno en 0,26 contra 0,10 del
panel, y el canto en 0,42 contra 0,16 — **dos veces y media más fuertes**, con
los rellenos ya casi iguales (0,52 y 0,50). Un borde brillante es lo que hace que
algo se lea como un objeto apoyado encima en vez de una lámina que deja pasar el
agua.

## El modo claro necesita que el agua sea agua

El síntoma reportado fue «un resplandor blanco que tapa el contenido». Medido con
`elementsFromPoint`, **encima del contenido no hay ninguna capa**.

Era la **ausencia** de contraste entre planos: el agua, el body y las láminas
estaban los tres dentro del 5 % de luminancia. La separación panel/agua daba
`1,053:1`, cuando en oscuro esa misma relación es `1,174`.

Subir las láminas no alcanzaba —aun con un panel blanco y opaco el techo era
`1,105`—, así que el agua bajó. Ahora la separación es `1,157`.

`tenue` se recalibró a `#4E6475` porque sobre el agua nueva daba 4,10:1. **No se
bajó más**, aunque los tonos más oscuros también pasan AA: a `#425665` la
separación contra `secundario` cae a 1,08:1 y los dos niveles vuelven a ser el
mismo gris. Pasar el test y no distinguirse no sirve de nada.

:::danger[El test medía la superficie equivocada]
`globals.contraste.test.ts` miraba `--aq-superficie-fondo`, un token **opaco que
casi no se ve**: el fondo real de la app es `--aq-agua`, un gradiente fijo que
cubre el viewport. Por eso hundir el agua dejó `tenue` fuera de AA con la suite
en verde.

Ahora mide **las tres paradas** del gradiente. Comprobado devolviendo el valor
viejo: falla en las tres.
:::

## Una capacidad, una entrada de menú

`auditoria` estuvo registrado **dos veces** —admin y contador—, con dos rutas que
renderizaban el mismo componente con los mismos filtros. El alcance lo resuelve
`api/` a partir de la **sesión**, no de la ruta (RN-ACC-03), así que las dos
entradas eran indistinguibles.

La tentación era filtrar por precedencia —«si es admin, escondé el de
contador»—, y habría sido peor: los roles se **suman** (RN-ACC-01), meter
precedencia contradice el modelo, y solo arregla ese par.

La regla que cierra la clase entera: **una capacidad, una entrada**, con la lista
de roles que la ven. Dos tests rechazan una etiqueta o una ruta repetida.

:::caution[El test que tenía que atraparlo lo estaba sosteniendo]
«multi-rol ve la unión» afirmaba que ver `auditoria` **y** `contador-auditoria`
juntas era correcto. Por eso el defecto sobrevivió hasta que alguien miró el menú.
:::

## La escala tipográfica existe y ahora se usa

Los tokens `--aq-titulo-*` estaban desde el primer día y ninguna pantalla los
usaba — había **cuatro tamaños** para el mismo rol: 24 px, 28→32 y 32.

La razón de que nadie los usara es que no había forma: un token `font:` no se
puede escribir como clase de Tailwind. `.aq-titulo-pantalla`,
`.aq-titulo-seccion`, `.aq-titulo-tarjeta` y `.aq-bajada` son ese puente, con el
salto a móvil incluido — que es lo que cada pantalla venía reimplementando con un
`sm:` distinto. Un `<h1>` que fija su tamaño a mano rompe el build.

## La cabecera flota sobre el contenido

En escritorio la cabecera **no ocupa fila propia**: se monta sobre el área del
contenido con `z-index: 1`. Es lo que permite que el `<main>` empiece en el borde
del viewport y que su primera línea quede a la misma altura que el borde del
panel del menú.

`justify-self: end` la encoge a su ancho y `pointer-events: none` —con `auto` en
los hijos— evita que la banda invisible se coma los clics de la primera línea del
contenido.

:::caution[Un `style` inline le gana a cualquier media query]
El área estaba como `style={{ gridArea: 'cabecera' }}`, y por eso la regla de
escritorio no podía moverla por más que lo dijera la hoja de estilos. Es la
tercera vez que un valor puesto en el lugar equivocado de la cascada rompe el
armazón; ahora hay un test que lo prohíbe.
:::

## `<Estado>` — un estado se dice por cuatro canales

```
dado    cualquier estado del semáforo
entonces se muestran simultáneamente color + forma + icono + texto en mayúsculas
```

Los cuatro canales son independientes. **Con perder tres, el estado se sigue
leyendo** — en una pantalla al sol, en un teléfono en ahorro de batería, en una
foto en blanco y negro por WhatsApp, o para quien no distingue verde de rojo.

| Tono | Significa | Forma | Icono |
| --- | --- | :-: | :-: |
| `cubierto` | Todo en orden | ● | ✓ |
| `justo` | Hay que ocuparse antes de que sea un problema | ▲ | ⚠ |
| `expuesto` | Ya es un problema | ◆ | ✕ |

No son `ok`/`warning`/`error`: son grados de **cobertura**. Un lote que vence
mañana no es un error —nadie se equivocó— es un estado del que hay que ocuparse.

**Un concepto, un icono.** El icono de cada estado sale de `ICONO_DE_ESTADO`, una
sola fuente. La regla existía escrita y ya estaba rota: la tabla de stock marcaba
lo vencido con un triángulo mientras la insignia de lotes usaba una equis. Se
rompía en dos archivos que nadie mira juntos.

Para una etiqueta que solo clasifica —activo/inactivo, permitido/denegado— está
`Etiqueta`, que no tiene forma ni icono porque no es un semáforo.

## Tres vacíos, no uno

Se ven igual —una lista sin nada— y significan cosas opuestas.

| Variante | Qué pasó | Qué ofrece |
| --- | --- | --- |
| `primera-vez` | Nunca hubo nada | Acá **sí** va crear |
| `sin-resultados` | Hay datos, el filtro no los alcanza | **Quitar el filtro** |
| `terminado` | Había y se acabó — buena noticia | Nada; el icono va en verde |

**`sin-resultados` no puede ofrecer crear**, y no es una convención: el tipo no
lo permite. Esa variante no acepta una acción propia — pide una ruta sin filtros
y arma el enlace por su cuenta. Intentarlo da un error de compilación.

Ofrecer «crear» ahí empuja a cargar un producto que ya existe porque se lo buscó
con un filtro equivocado, y ese duplicado después hay que descubrirlo y limpiarlo.

## Carga, errores y dato tibio

**`<EsqueletoDeTabla>`** pide columnas y anchos, y los pide obligatorios. Un
esqueleto genérico de tres columnas delante de una tabla de siete vuelve a
producir el salto que se quería evitar — el mismo *layout shift* que en un punto
de venta se paga en clics equivocados. Nunca un spinner de pantalla completa.

**`errores.ts`** traduce cualquier fallo a algo que se le pueda mostrar a una
persona. No traduce todo, y esa es la decisión: `api/` ya manda mensajes humanos
en español para las violaciones de regla, y reemplazarlos perdería lo único útil
—qué regla frenó la operación—. El cuerpo del servidor se usa **solo** en 409 y
422; en los demás se ignora, porque un 500 puede traer un stack.

Un status sin traducir **rompe el build**, no cae en un genérico.

**`<SelloDeHora>`** marca el dato viejo en vez de esconderlo. En Aquazaku el
stock lo mueven varias personas a la vez: un número en pantalla siempre es de
hace un rato, y la pregunta no es si está viejo sino cuánto. Decir la hora
convierte una certeza falsa en una estimación honesta.

## La interfaz habla de usted

Español de Colombia, trato de **usted**. No voseo, no «tú».

Una voz se pierde de a una frase: nadie decide cambiarla, alguien escribe «Probá
de nuevo» un martes porque le salió así, y a los seis meses la mitad del producto
vosea. `voz.test.ts` corre siempre y falla en la línea exacta.

**Dos voces, a propósito.** Los mensajes de arranque que lee quien levanta el
servidor —«Copiá `.env.example`…»— siguen en voseo, igual que esta
documentación. Son otro lector.

## Accesibilidad, medida y no supuesta

- **Objetivo táctil de 44 px** en todo control, declarado en una regla sobre los
  elementos y no archivo por archivo. Los enlaces van caso por caso: el que es
  una acción suelta lo lleva; el que vive dentro de una oración queda exento,
  como permite WCAG 2.2.
- **Foco siempre visible**, con `outline` y `outline-offset` — no con
  `box-shadow`, que compite con las elevaciones. El anillo cambia de paso entre
  modos: el mismo aqua para los dos daba **1,62:1** en claro.
- **Tipografía**: piso de 14 px para cuerpo. Los 11 px solo con `.aq-micro`, que
  exige mayúsculas y tracking.
- **Contraste medido componiendo**, no leyendo el color declarado. Sobre una
  superficie translúcida el color declarado da bien y la pantalla igual es
  ilegible.
- **Los cuatro niveles de texto** se verifican sobre las tres superficies, en
  los dos modos, más el enlace suave. Sin esa fila, el celeste `#8CF0FA` que se
  ve bien en oscuro cruzaba a modo claro —donde da 1,2:1— y no se enteraba nadie
  hasta abrirlo de día.

## Qué se decidió NO construir

Tan importante como lo anterior, porque evita rehacer la discusión.

| No se construyó | Por qué |
| --- | --- |
| **Semáforo de autonomía** | Necesita producción y consumo reales. Es M4 |
| **App móvil del `seller`** | M8, post-MVP. La web es responsiva y mobile-first como metodología |
| **Modo offline** | Cuelga de la app móvil |
| **Vistas de ruta** | El modelo se descartó: el `seller` no visita con producto |
| **`backdrop-filter` en las tarjetas** | Costaba 17 fps y no mostraba nada: detrás hay un gradiente suave, o sea ya borroso |
| **Animación ligada al scroll** | El fondo del `<body>` cubre el alto del documento; el descenso se recorre, no se anima |

## Lo que esto deja listo

M3 (Insumos) necesita tabla, formulario de alta, aviso de stock mínimo y estados
de vencimiento. **Nada de eso se diseña de nuevo**: `<Estado>`, `<Vacio>`, los
esqueletos, el mapa de errores, el par fondo/texto y la voz ya existen.

Ese es el retorno de haber hecho esta fase antes y no después.

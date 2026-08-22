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

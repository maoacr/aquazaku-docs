---
title: Gráficos
description: "Por qué el tablero dibuja con SVG propio y no con una librería, y qué decide cada gráfico antes de dibujar: la unidad, la escala y qué se hace con un dato que falta."
---

Los tres gráficos del tablero —el tanque, la producción diaria y los insumos
contra su mínimo— son **SVG plano, escrito acá**. No hay librería de gráficos en
el proyecto.

## Por qué no se adoptó una librería

Se evaluó [Rosen Charts](https://rosencharts.com/docs), que era la candidata. Lo
que apareció al mirarla de cerca:

| | |
|---|---|
| **No es un paquete npm** | Es copy-paste estilo shadcn. El código aterriza en el repo y pasa a ser nuestro de mantener — con la diferencia de que no lo escribimos nosotros |
| **Algunos gráficos son pagos** | Pago único, acceso de por vida. No es un problema en sí; sí lo es descubrirlo a mitad de camino |
| **Dibuja con `div`, no con SVG** | Es su truco para no necesitar `'use client'`. Funciona, pero limita precisión y accesibilidad |

Y sobre todo: los gráficos que este tablero necesita son **tres**, y uno de ellos
—el tanque— es custom con cualquier librería, porque ninguna trae un tanque.

Traer una dependencia de D3 más código de terceros para dibujar barras y una
línea de umbral costaba más que escribirlas. La cuenta cambiaría el día que
haga falta un scatter, un heatmap o un eje temporal con zoom: ahí una librería
gana, y esta decisión se revisa.

:::note[La tercera opción que también se descartó]
`recharts` es maduro, npm, SVG y gratis. Pero exige `'use client'` en todo
gráfico, y eso empuja al browser trabajo que en este proyecto vive en el
servidor ([patrón BFF](/frontend/bff-pattern/)). Un gráfico que necesita
hidratarse para dibujar una barra manda al cliente algo que ya estaba hecho.
:::

## Los tres son Server Components

SVG plano, sin estado ni efectos. Se pintan en el servidor y llegan como HTML.
**No hay `'use client'` en el tablero.**

## Las decisiones que se toman antes de dibujar

### El tanque marca cuartos, no litros

`RN-PRD-11` es explícita: no hay medidor ni regleta. Lo que alguien puede
afirmar mirando un tanque es *un cuarto*, *la mitad*, *tres cuartos*.

Un eje graduado de 0 a 13.000 prometería una precisión que nadie tiene, y sería
una escala que hay que traducir mentalmente cada vez. Los litros siguen estando
—arriba, en cifra— porque el saldo del libro es el que manda (`RN-PRD-14`). **El
dibujo es para comparar, no para medir.**

Cuando el último cierre anotó un nivel observado, se pinta la franja que ese
nivel representa. Ahí el gráfico deja de ser un adorno: si la línea del agua cae
dentro de la franja, el libro y el ojo dicen lo mismo; si cae afuera, hay algo
sin registrar y se ve de un vistazo.

:::caution[Un saldo negativo no es un tanque vacío]
Es un libro al que se le perdió una entrada, y pasa de forma esperable: el
ingreso de la red se registra **sin cantidad**, así que hasta el primer ajuste
el consumo baja un saldo que nunca subió.

Dibujarlo vacío diría que no hay agua, que es otra cosa. El tanque lo dice con
palabras y la cifra sale en tono de alerta — el celeste del agua diría con el
color lo contrario que el texto.
:::

### La producción va en litros y en UNA serie

La tentación era apilar pacas de 600, pacas de 300 y botellones. Dos razones
para no hacerlo:

1. **No son la misma unidad.** Una paca trae 20 bolsas y un botellón es uno.
   Sumarlos da un número que no significa nada, y apilarlos invita a compararlos
   como si fueran comparables.
2. **Tres segmentos apilados se distinguen solo por color**, que es exactamente
   el problema que el sistema resuelve con cuatro canales en el semáforo
   ([R40](/frontend/sistema-aplicado/)). Cerca del 8 % de los varones no separa
   el par verde/azul, y al sol en la planta no lo separa nadie.

Los litros sí son una unidad común, están siempre —no dependen del caudal— y
contestan la pregunta que alguien se hace mirando: cuánto salió cada día.

### Un dato que falta no se dibuja en cero

`litrosProcesados` es `null` mientras nadie mida el caudal
([pregunta 4](/empezar/pendientes/)). Un cero diría «ese día no se procesó
nada», que es otra cosa: se marca con un punto tenue, que significa *hubo
cierre, falta el dato*.

Es la misma regla que atraviesa el sistema — un hueco se declara como hueco.

### La escala se comparte, aunque los mínimos difieran

En los insumos, todas las barras usan la misma escala. Escalar cada una a su
propio máximo haría que dos saldos muy distintos se vean iguales, que es **la
forma más común de que un gráfico mienta sin decir nada falso**.

El techo contempla los mínimos además de los saldos: si todos los insumos
estuvieran por debajo de su mínimo, escalar solo por el saldo dejaría las marcas
de umbral fuera del dibujo, justo cuando más importan.

## Accesibilidad

Cada `<svg>` lleva `role="img"` y un `aria-label` que **dice los números, no la
forma**. «Un gráfico de barras» no le sirve a nadie; «795 litros en el último
cierre, sin el caudal medido» sí.

El color nunca es el único canal: cada insumo lleva además su insignia de
estado con los cuatro canales del sistema.

## Qué falta

El tanque se sincroniza hoy con la producción y los ajustes. **Todavía no con
las reducciones por ventas**, porque las ventas son M6 y no existen. Cuando M6
entre, el saldo del agua no cambia —el agua sale al envasar, no al vender— pero
sí va a poder aparecer un gráfico de rotación que hoy no tendría datos.

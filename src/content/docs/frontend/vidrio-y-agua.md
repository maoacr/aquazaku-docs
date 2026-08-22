---
title: Vidrio y agua
description: Cómo está construido el lenguaje visual de Aquazaku, y por qué la primera versión no se veía.
---

El producto de Aquazaku es **agua**, y eso tenía que estar en el sistema y no
solo en el logo. Esta página explica cómo, y sobre todo **por qué el primer
intento no funcionó** — porque el error es el tipo de cosa que se repite.

## El error que hay que entender primero

La primera versión puso `backdrop-filter: blur()` en las tarjetas, subió una
lámina translúcida, agregó un borde tenue… y las tarjetas seguían pareciendo
rectángulos un poco más claros.

La reacción natural es pensar que el efecto quedó flojo y subir los valores. Es
la reacción equivocada:

> `backdrop-filter` desenfoca **lo que hay detrás**. Detrás de una superficie
> plana hay una superficie plana. Desenfocar algo plano da exactamente lo mismo.

El efecto no estaba tenue: **no tenía qué mostrar**. El resplandor de fondo
estaba al 7–9 % de opacidad, o sea invisible, así que el vidrio refractaba la
nada.

**El vidrio no es un material que se pinta: es una relación con lo que hay
detrás.** Sin algo detrás, no hay vidrio — hay opacidad.

## La arquitectura: una sola agua

```
  fondo de la app  ·  el agua + su luz          ← lo único que tiene color propio
  ├── menú         ·  lámina de vidrio
  ├── cabecera     ·  transparente
  ├── contenido    ·  transparente
  │   └── tarjetas ·  lámina de vidrio
  └── pie          ·  lámina de vidrio
```

Hubo una versión intermedia donde el menú tenía **su propio** gradiente y el
contenido **su propio** resplandor. Dos fuentes de luz en la misma pantalla, y el
resultado era que el menú se leía como un bloque pegado al costado en vez de una
pieza apoyada sobre lo mismo que las tarjetas.

Con una sola fuente, todas las piezas comparten lo que refractan y el conjunto se
lee como un sistema.

### El agua sigue al tema

| Modo | Qué es |
| --- | --- |
| Claro | Agua de superficie: casi blanca, con reflejos aqua y verde |
| Oscuro | Agua profunda: navy → teal → verde |

Esto tiene una consecuencia que simplificó el sistema: **el menú dejó de
necesitar colores de texto propios**. Cuando el panel era oscuro en los dos
modos hacían falta `--aq-menu-texto` y `--aq-menu-apagado`; ahora usa
`text-principal` y `text-secundario` como todo lo demás.

## Un solo canal de alineación

Todo lo que vive en la columna de contenido —los iconos de la cabecera, los
títulos, las tarjetas y el pie— comparte **el mismo borde izquierdo y el mismo
borde derecho**.

Suena obvio y es exactamente el tipo de cosa que se rompe sola: cada pieza llega
con su propio padding razonable, ninguno está mal por separado, y el conjunto
queda desalineado. Acá llegaron a convivir tres bordes derechos —16 px en la
cabecera, 24 en el contenido y 12 en el pie—. Ocho y doce píxeles: poco para
nombrarlo, suficiente para que la pantalla se sienta torcida sin saber por qué.

La regla es que el **padding horizontal de la cabecera y los márgenes del pie son
el mismo valor que el padding del contenido**. Y se verifica midiendo, no
mirando:

```js
const der = el => Math.round(el.getBoundingClientRect().right)
new Set([iconos, titulo, tarjeta, pie].map(der)).size === 1
```

El menú es la excepción, y a propósito: es una tarjeta que flota contra el borde
de la ventana, no contenido de la columna.

## La navegación cambia de forma según el ancho

No es la misma navegación encogida: son dos, y cada una responde a cómo se
sostiene el aparato.

| Ancho | Navegación | Créditos |
| --- | --- | --- |
| Teléfono | **Barra inferior** + cajón para el resto | Al fondo del cajón |
| Tablet y escritorio | Panel lateral fijo | En el pie |

Con el cajón como única navegación, cambiar de módulo son **tres gestos**: abrir,
elegir, y esperar que se cierre. En un mostrador eso se hace decenas de veces por
turno. Abajo es **un toque**, y es la zona que el pulgar alcanza sin recolocar la
mano — la parte de arriba de un teléfono grande no se llega sin hacer malabares.

### El desborde

Cinco ranuras es lo que entra a 375 px conservando los 44 px de objetivo táctil
(R54). Quien ve cuatro módulos o menos los ve todos; a quien ve más —un admin con
varios roles ve seis entradas— la última ranura se convierte en **«Más»** y abre
el cajón.

Se prefiere eso a apretar seis iconos: **una barra donde no se le puede pegar a
nada es peor que una con un botón extra.**

El cajón no desaparece nunca: sigue siendo donde vive todo. La barra es el atajo
a lo que más se usa.

:::caution[Un componente no cruza la frontera servidor/cliente]
La barra recibía los módulos ya resueltos, y eso **rompió la aplicación entera**:

```
Functions cannot be passed directly to Client Components
  {$$typeof: ..., render: function Package}
```

`MenuModule.icono` es un componente, o sea una función. Un componente de servidor
no puede pasarle una función a uno de cliente — React no la sabe serializar.

La barra recibe los **roles**, que son texto, y resuelve sus módulos importando
`computeVisibleModules`. Del lado del cliente los iconos sí están.

**Regla:** lo que cruza de servidor a cliente tiene que ser serializable. Datos,
no comportamiento.
:::

## Rendimiento: el desenfoque casi no se usa, y hay una razón

`backdrop-filter` es **caro**. Cada elemento que lo lleva fuerza una capa de
composición propia y se vuelve a desenfocar en cada frame.

Medido en el tablero, con cuatro productos:

| | fps | peor frame |
| --- | --- | --- |
| Con desenfoque en las 6 piezas | 43,1 | 50,9 ms |
| Sin desenfoque | **60** | **17,4 ms** |

**17 fps.** Y las capturas con y sin salieron **idénticas**.

La explicación es la misma que hace que el vidrio funcione, dada vuelta: detrás
de las piezas está el agua, que es un gradiente suave — o sea **ya borroso**.
Desenfocar algo borroso da lo mismo borroso.

> El desenfoque solo aporta cuando detrás pasa **contenido con detalle**.

En este sistema eso pasa en un lugar: **el cajón del menú en teléfono**, que se
abre sobre la pantalla que se está leyendo. Ahí está, y solo ahí.

Lo que sí sostiene el efecto —y no cuesta— son las otras tres capas: la
translucidez, el canto y las sombras.

### Qué se anima

Solo `transform` y `opacity`. Las dos las resuelve el compositor sin repintar.

La primera versión animaba `box-shadow` y `background-color`: las dos obligan a
repintar la pieza entera en cada frame. La sombra del hover ahora vive en el
mismo `box-shadow` de reposo y lo que se mueve es la elevación.

## Las tres capas de una lámina

Translucidez más desenfoque **no es vidrio**: es un rectángulo con opacidad. Lo
que hace que el ojo lea «vidrio» son tres cosas, y las tres tienen que estar.

### 1 · El canto refracta

Un borde de un solo color es plástico. El vidrio tiene el canto encendido donde
le pega la luz —arriba a la izquierda— y apagado en la diagonal opuesta.

Eso es un **borde con degradado**, que en CSS no existe. Se falsifica pintando el
degradado en un `::after` y recortándole el centro con dos máscaras que se
excluyen entre sí:

```css
.pieza::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  padding: 1px;
  background: linear-gradient(145deg, var(--luz) 0%, var(--sombra) 42%, var(--luz) 100%);
  -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
  -webkit-mask-composite: xor;
  mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
  mask-composite: exclude;
  pointer-events: none;
}
```

Queda solo el `padding` de 1 px, que es el marco. Safari todavía pide el prefijo.

### 2 · Hay un reflejo especular

Una mancha de luz ancha y suave que entra por la esquina superior. No es un
degradado de fondo a fondo: es un óvalo corrido **fuera** de la pieza, del que
solo se ve la caída.

En las tarjetas se apaga antes de la mitad, y eso es a propósito: cae sobre el
título y nunca sobre la cifra. Un brillo cruzando un «110» lo vuelve decorado en
vez de dato.

### 3 · La pieza tiene espesor

**Dos** sombras, no una. Una amplia y difusa que la separa del fondo, y otra
corta y cerrada justo debajo —la de contacto—, que es la que dice a qué distancia
está. Y hacia adentro, una línea clara arriba y una oscura abajo: el grosor del
canto visto desde arriba.

### En oscuro el canto no es blanco

Es el aqua de la marca. Un canto blanco sobre una lámina ahumada se ve como un
borde pintado, no como vidrio: **el canto tiene que ser del color de lo que lo
ilumina**.

## Contraste: cómo se verifica

Esta es la parte que no se puede hacer a ojo, y la que hace que el vidrio sea
seguro de usar sobre datos.

`getComputedStyle` devuelve el color **declarado** de la lámina, no el que
resulta de componerla con lo que hay detrás. Sobre ese color declarado el
contraste da bien y la pantalla igual es ilegible.

Hay que **componer a mano**: lámina × alfa + fondo × (1 − alfa), y medir contra
eso. Con el peor caso del fondo — la parada más clara del agua en oscuro, la más
oscura en claro.

Valores actuales, medidos así:

| Superficie | Claro | Oscuro |
| --- | --- | --- |
| Tarjeta de datos | 8,29:1 | 9,07:1 |
| Menú | sin hallazgos | sin hallazgos |
| Pie | — | 5,73:1 |

:::caution[Dos trampas de medición que ya mordieron]
**El color en vuelo.** Cambiar `data-tema` y medir en el mismo tick devuelve el
color a mitad de la transición. El selector de tema llegó a marcar 1,59:1 cuando
en reposo da 8,45:1. Hay que esperar a que la transición termine — y es peligroso
al revés también: un color a mitad de camino puede *pasar* y tapar un defecto.

**`color: transparent`.** Un texto con `bg-clip-text` tiene el color en
transparente y el gradiente en el fondo. Medirlo da ratios absurdos —1,2:1— que
parecen defectos graves y no lo son. Hay que medir las paradas del gradiente
contra la superficie.
:::

## Micro-animaciones

Una sola curva para todo lo que se mueve:

```css
--aq-fluido: cubic-bezier(0.22, 0.85, 0.3, 1);
```

Arranca rápido y frena largo, que es como se asienta un líquido. Un `ease` normal
frena parejo y se siente mecánico; una curva con rebote se siente de juguete.
Esta no rebota: solo tarda en detenerse.

### El hover de tarjeta vive en el selector, no en el criterio

```css
a.aq-tarjeta:hover,
button.aq-tarjeta:hover { transform: translateY(-2px); … }
```

**Una tarjeta que se levanta al pasar el mouse enseña que se puede hacer clic.**
Si no lleva a ningún lado, esa promesa es falsa — y las promesas falsas de
interfaz se pagan en confianza: la próxima vez tampoco se prueba la que sí
funciona.

Por eso el estado no vive en `.aq-tarjeta` sino en `a.aq-tarjeta` y
`button.aq-tarjeta`. Una tarjeta de solo lectura no puede tenerlo ni por
accidente. Cuando se le agregó la animación a las tarjetas del tablero, hubo que
**volverlas enlaces** a los lotes del producto — que además era lo que hacía
falta.

Todo respeta `prefers-reduced-motion`: se apaga el desplazamiento, **no** el
cambio de estado. Quien pidió menos movimiento igual necesita saber que algo
respondió.

## Una trampa de CSS que apareció dos veces

Las clases de este sistema van **sin capa**, así que le ganan a las utilidades de
Tailwind, que viven en `@layer utilities`. Eso es lo que se quiere para colores y
sombras — y es un problema para el posicionamiento.

`.aq-panel-marca` declaraba `position: relative` para sus pseudo-elementos. Esa
regla le ganaba a la utilidad `fixed`, y en teléfono el cajón del menú dejaba de
flotar: se metía en el grid como un ítem más, con un `grid-area` que en móvil no
existe, y el armazón se llenaba de filas y columnas implícitas.

**Regla:** una clase del sistema no declara `position`. Lo pone quien la usa.

Apareció **tres veces** — el toggle de tema con `display`, el panel con
`position`, y otra vez al consolidar las reglas de vidrio en una sola base. Ya
hay un test que lo impide: verifica que `.aq-panel-marca` no declare ni
`position` ni `display`, y que el componente siga declarando su `fixed`.

Es el mismo defecto que tuvo el toggle de tema con `display`. La solución
general —que una regla gane por **especificidad** y no por orden de aparición—
está registrada en las notas de T5 del
[plan de la fase de diseño](/superpowers/plans/2026-08-21-fase-diseno/):

| escalón | especificidad |
| --- | --- |
| utilidades de Tailwind | `0,1,0` |
| esconder | `0,2,0` |
| mostrar | `0,3,0` |

Cada escalón le gana al anterior en cualquier orden, y sin depender de si
Tailwind dejó sus utilidades dentro de `@layer`.

## Dos huecos de verificación que hay que conocer

Los tests de este sistema pasaron en verde con la aplicación rota. **Dos veces**,
por razones distintas, y conviene saberlo antes de confiar en un check verde.

**Los tests de CSS leen el archivo como texto.** Se rompió la sintaxis del
`globals.css` —un bloque sin cerrar— y los 404 tests siguieron pasando, porque
ninguno lo compila. La verificación real fue pedirle la hoja al servidor:

```bash
curl -s http://localhost:3000/login | rg -o '/_next/static/[^"]*\.css'
```

**Los tests de componentes no tienen frontera servidor/cliente.** Renderizan todo
en un proceso, así que un componente pasado como prop de servidor a cliente pasa
sin protestar — y en la aplicación real revienta la pantalla entera. Eso lo agarra
el log del servidor de desarrollo, no la suite.

En los dos casos la lección es la misma: **la suite verifica lo que sabe
verificar.** Para lo demás hay que mirar la aplicación corriendo.

---
title: Plan de la fase de diseño — 11 tasks
description: "Las 11 tasks de la fase de diseño, ordenadas por lo que obliga a rehacer trabajo: el modo oscuro primero, porque si llega último todas las pantallas se repintan dos veces."
---

**Objetivo:** implementar la
[spec de la fase de diseño](/superpowers/specs/2026-08-21-fase-diseno-design) —
modo oscuro vivo, marca, estados por cuatro canales, accesibilidad y voz única.

**Sistema de diseño:** `claude-design/` — tokens, 13 diseños de referencia y
`reglas-como-tests.md` (R40, R49–R55).

**Estado:** 🚧 En curso — T1 a T8 cerradas. **12 tasks** (T2 se agregó el 22-ago-2026).

---

## El orden es por lo que obliga a rehacer trabajo

En M2 el criterio fue el costo de revertir, porque un error de inventario se
descubre semanas después. Acá el criterio es otro: **cuánto trabajo visual te
obliga a repetir**.

Un módulo de inventario falla en silencio. Una fase de diseño falla en voz alta
—se ve— pero te hace repintar veinte archivos dos veces si el orden está mal.

| Riesgo | Qué pasa si llega tarde | Task |
| --- | --- | :-: |
| 🔴 **Modo oscuro al final** | Cada pantalla repintada en claro se repinta de nuevo al descubrir que en oscuro no funciona. **Trabajo duplicado, garantizado** | **T1** |
| 🔴 **Hex sueltos sin barrer** | Se ven bien en claro y mal en oscuro. Aparecen de a uno, durante meses | T2 |
| 🔴 **Par fondo/texto sin regla** | Es el bug que ya tenemos en el menú, y el que dejó 4 botones invisibles en M2 | T2 |
| 🟠 **Primitivas después de repintar** | Cada pantalla inventa su propio vacío, su propio error y su propio estado | T3–T6 |
| 🟢 **Voz mezclada** | Es mecánico y aditivo, pero rompe tests que buscan por texto | T7 |

**T1 es la compuerta.** Nada visual arranca antes de que el modo oscuro se pueda
activar y ver.

:::danger[La regla de M2, y acá vale doble]
Una task no está terminada porque sus tests pasen. En M2 eso dejó **cuatro
botones invisibles** con typecheck limpio y 234 tests en verde, y lo agarró una
captura de pantalla.

En esta fase **todo lo que se produce es exactamente lo que los tests no ven.**
Cada task que toque una pantalla se cierra viéndola **en claro y en oscuro**.
:::

## Lo que va a romperse a propósito

**T7 rompe tests de M0, M1 y M2.** Cambiar "¿Olvidaste tu contraseña?" por
"¿Olvidó su contraseña?" hace fallar todo test que busque por texto visible.
**Eso está bien**: esos tests afirman una voz que el sistema de diseño nunca
autorizó. Se actualizan entendiendo por qué fallaron, nunca se silencian.

**T2 puede romper tests de snapshot o de clase.** Ídem.

---

## Grafo de dependencias

```
T1 modo oscuro ── T2 barrido + par fondo/texto ──┬── T3 accesibilidad ──┐
   (compuerta)                                   ├── T4 marca ─────────┤
                                                 ├── T5 <Estado> ──────┼── T8 repintar ──┐
                                                 ├── T6 estados de IU ─┤                 │
                                                 └── T7 voz: usted ────┘                 │
                                                                                         ├── T11 cierre
T9  docs/ con tokens ────────────────────────────────────────────────────────────────────┤
T10 corregir el brief ───────────────────────────────────────────────────────────────────┘
    (ninguna de las dos toca web/)
```

- **T1** es la compuerta: sin modo oscuro visible, nada visual arranca.
- **T3 a T7** son independientes entre sí. Se pueden hacer en cualquier orden.
- **T9** y **T10** no tocan `web/`: pueden ir en paralelo desde el principio.
- **T8** consume todo lo de `web/`. **T11** cierra.

## Restricciones globales

- Convención del proyecto: 2 espacios, comillas simples, sin punto y coma.
- Conventional commits, sin `Co-Authored-By`. **Nunca buildear.**
- Cada commit deja el proyecto en verde: `pnpm test`, `pnpm lint`, `pnpm typecheck`.
- **`web/src/app/tokens.css` es una copia — no se edita.** Todo lo derivado va en
  `globals.css`, que es el puente. Si el sistema de diseño cambia, `tokens.css`
  se vuelve a copiar entero.
- **Ningún hex en un componente.** Si falta un token, se agrega al puente.
- Patrón BFF vigente: nada de `localStorage`, nada de `fetch` directo.
- Iconos: **solo Lucide**, y nunca dos iconos distintos para el mismo concepto.
- **El verde `#33BD73` es reservado.** Solo "cuadra" o "todo en orden".

---

## T1 · Modo oscuro vivo — la compuerta

**Objetivo:** que `data-tema` se escriba en el `<html>` desde el servidor, según
una cookie, sin destello, con tres valores.

**Archivos:**
- `web/src/lib/tema.ts` — tipo `Tema = 'claro' | 'oscuro' | 'sistema'`, lectura y
  normalización de la cookie
- `web/src/app/layout.tsx` — lee la cookie y pinta `data-tema`
- `web/src/app/actions-tema.ts` — Server Action que escribe la cookie
- `web/src/components/ui/selector-tema.tsx` — el control
- `web/src/app/globals.css` — bloque `@media (prefers-color-scheme: dark)` para
  el valor `sistema`

**Pasos:**

1. `tema.ts`: `leerTema()` y `esTemaValido()`. Cualquier valor que no sea de los
   tres se normaliza a `sistema` — una cookie la escribe el cliente y **no se
   confía en ella**.
2. `layout.tsx`: `const tema = await leerTema()`. Se pinta `data-tema="oscuro"`
   solo cuando es `oscuro`; con `claro` y `sistema` **no se escribe el atributo**.
3. `globals.css`: dentro de `@media (prefers-color-scheme: dark)`, aplicar los
   valores del bloque oscuro **cuando `data-tema` no está presente**. Con
   `:root:not([data-tema])`, para que una elección explícita de `claro` gane
   sobre la preferencia del sistema.
4. Server Action `cambiarTema(tema)`: valida contra los tres valores, escribe la
   cookie (`sameSite: 'lax'`, un año, **sin `httpOnly`** — no es un secreto, y
   nada de JS necesita leerla) y `revalidatePath('/', 'layout')`.
5. `<SelectorTema>`: tres opciones, en el menú lateral. Objetivo táctil ≥ 44 px.

**Verificación:**
- Tests: el layout escribe `data-tema` con `oscuro` y **no** lo escribe con
  `claro` ni con `sistema`. La acción rechaza `'azul'` y normaliza a `sistema`.
- **Con los ojos:** entrar, cambiar a oscuro, **recargar**. Si hay un destello
  blanco, el mecanismo está mal y no se cierra la task.
- **Sacarle el peso:** quitar la lectura de cookie del layout. Los tests tienen
  que fallar.

**Commit:** `feat(tema): modo oscuro desde el servidor, sin destello`

:::danger[Notas de ejecución — T1: el plan tenía un bug]
**El paso 2 estaba mal.** Decía que con `claro` **no** se escribiera el
atributo, igual que con `sistema`.

Con eso, `:root:not([data-tema])` matchea y la media query
`prefers-color-scheme: dark` se aplica: **alguien que eligió claro con el
sistema en oscuro vería la app oscura.** Su elección explícita perdería contra
el sistema, que es al revés de lo que significa elegir.

`claro` **sí** escribe `data-tema="claro"`. No necesita reglas CSS propias —los
tokens base ya son claros— pero el atributo tiene que **existir** para que
`:not()` falle.
:::

:::danger[Y los tests no cubrían la costura]
Al sacarle el peso al mecanismo apareció algo peor que el bug: **quitar
`{...atributoDeTema(tema)}` del layout no rompía nada.** 265 tests en verde con
la funcionalidad completamente desconectada.

Las funciones estaban probadas. El CSS estaba probado. Nadie probaba que el
layout **las usara**. Es la misma costura donde vivieron los dos peores bugs de
M0: entre *"la pieza funciona"* y *"alguien la llama"*.

Se agregó `layout-tema.test.tsx`, que inspecciona el árbol devuelto por el
layout. Repetido el experimento, ahora **caen 2 tests**.

La lección no es sobre el tema: es que **probar las piezas no prueba el
cableado**, y el cableado es donde se rompen las cosas.
:::

:::note[Otras notas — T1 cerrada el 22-ago-2026]
**El bloque de `prefers-color-scheme` se GENERA**, no se escribe a mano: repite
las 27 declaraciones del bloque oscuro porque CSS no puede reusar un bloque bajo
otro selector. `tema-css.test.ts` verifica que las dos listas declaren las
mismas propiedades — sin eso, agregar un token y olvidarse del otro bloque deja
el modo sistema **a medio pintar**, y no lo nota nadie hasta que un usuario con
el sistema en oscuro abre la app.

**El selector no lleva `'use client'`.** Son tres botones que envían un
formulario a una Server Action: no hay estado que necesite JavaScript, y
funcionan con JS deshabilitado.

**Verificado en el HTML crudo, no solo en la pantalla.** Ver que se vea oscuro
prueba que se ve oscuro; que el atributo venga en el HTML del servidor es lo que
prueba que **no puede haber destello**:

```
cookie oscuro  → <html lang="es" data-tema="oscuro" …>
cookie claro   → <html lang="es" data-tema="claro"  …>
sin cookie     → <html lang="es" …>            ← decide el sistema
cookie "azul"  → <html lang="es" …>            ← normalizado, no error
```

**Mocks que hicieron falta:** `next/font/google` es una transformación de build
y fuera de Next devuelve `undefined`; `leerTema` va a `cookies()`, que solo
existe dentro de una petición.

**Resultado:** 32 tests nuevos, suite de `web/` en **270** (venía de 238).
:::

---

## T2 · La app ocupa el viewport y funciona en un teléfono

**Por qué va acá y no al final:** es estructura, no pintura. Repintar pantallas
—T9— sobre un layout que después cambia es trabajo hecho dos veces. Y el bug del
menú que crece con el contenido se ve en **cada** pantalla, no en una.

:::danger[Esta task no estaba en el plan, y debió estar]
Mobile-first ya era un principio declarado del proyecto —*"touch targets ≥ 44px,
sticky bottom CTAs, responsive de entrada"*, en las convenciones del
[roadmap](/arquitectura/roadmap/)— y esta fase lo pasó por alto: escribí once
tasks de color, marca y estados sin una sola de disposición.

Lo encontró Aquazaku usando la app desde el teléfono. Todo lo de abajo son
defectos reportados, no mejoras imaginadas.
:::

**Los defectos, tal como aparecen:**

| Qué pasa | Dónde |
| --- | --- |
| El menú lateral **crece con el contenido**: en Auditoría, el selector de tema y el botón de salir quedan fuera de la pantalla | `(app)/layout.tsx` — `flex flex-1` sin altura |
| **No hay menú en mobile**: el lateral ocupa 256 px fijos y come la pantalla | `sidebar.tsx` — `w-64` sin responsive |
| El scroll es de la página entera en vez del contenido | mismo layout |
| Los campos numéricos abren **teclado alfabético** en el teléfono | 5 `type="number"` sin `inputMode` |
| La ruta `/` es un título y una línea de bienvenida | `(app)/page.tsx` |

**Pasos:**

1. **El armazón ocupa exactamente el viewport.** `h-dvh` y no `h-screen`: en
   iOS, `100vh` incluye la barra de direcciones y deja el pie cortado. El
   scroll vive **solo** en el `<main>`, con `overflow-y-auto` y `min-h-0` —
   sin `min-h-0` un hijo flex no se encoge y el scroll se escapa al documento.
2. **El menú lateral se esconde bajo `sm`.** Botón hamburguesa, panel que entra
   desde la izquierda, fondo que lo cierra al tocar. Con `<details>` y CSS, sin
   JavaScript: es un menú, no una aplicación.
3. **Cerrar con `Escape` y devolver el foco** al botón que lo abrió.
4. **`inputMode="numeric"`** en todo campo de cantidad. Con `decimal` donde
   aceptamos decimales — los precios.
5. **La ruta `/` muestra algo que sirve**: qué hay para hacer hoy, según el rol.
   No un panel de métricas: los datos que ya existen —stock por vencer, productos
   sin precio— y el camino a la pantalla que los resuelve.

**Verificación:**
- A 375 px: el menú está cerrado, el hamburguesa se ve, abre y cierra.
- A 1280 px: el menú está fijo y **no hay hamburguesa**.
- En Auditoría, con la tabla larga: el selector de tema y el botón de salir
  **siguen visibles** sin scrollear.
- **Sacarle el peso:** quitar `min-h-0` del `main`. El scroll tiene que
  escaparse al documento y el test tiene que fallar.

**Commit:** `feat(ui): la app ocupa el viewport y el menú se esconde en mobile`

:::danger[Notas de ejecución — T2: el `<details>` no alcanzaba]
El primer intento fue **un solo `<details>`** con una regla de CSS que mostrara
el panel siempre en pantalla ancha. **No funciona.** El navegador esconde el
contenido de un `<details>` cerrado, y ni `display: flex` ni
`content-visibility: visible` lo revierten de forma confiable: en escritorio el
menú reservaba sus 256 px y no pintaba nada.

**Lo encontró una captura de pantalla, no un test.** Y algo peor:
`checkVisibility()` devolvía `false` incluso con el panel **abierto** y midiendo
256 px. Ni los tests ni la API del navegador decían la verdad — mirarlo fue lo
único que la dijo.

La solución es **dos instancias del mismo componente**: un cajón `<details>` para
el teléfono y una columna estática para escritorio, y cuál se ve lo decide
`display`, que sí es determinista. La oculta sale del árbol de accesibilidad, así
que un lector de pantalla ve un solo menú.

**Costo en tests:** jsdom no aplica media queries, así que las dos instancias
existen y cada consulta encuentra todo dos veces. **11 tests cayeron.** Se
acotaron con `data-testid`, y se agregó uno que verifica que las dos rendericen
los mismos módulos: si divergen, alguien editó una copia y no la otra.
:::

:::note[Otras notas — T2 cerrada el 22-ago-2026]
**`h-dvh` y no `h-screen`.** En iOS, `100vh` incluye la barra de direcciones: el
pie del menú queda debajo del borde visible y hay que scrollear la página entera
para llegar al botón de salir.

**`min-h-0` en el `<main>` es lo que encierra el scroll.** Sin él, un hijo de
flex no se encoge por debajo de su contenido: el `main` crece, empuja al
contenedor, y el scroll se escapa al documento **arrastrando el menú con él**.
Era exactamente el bug reportado en Auditoría.

Verificado midiendo, no mirando: `document.documentElement.scrollHeight <=
innerHeight` ⇒ el documento no scrollea.

**Para verificar el armazón hizo falta una página descartable.** El menú solo
existe con sesión, y el panel del browser no la tiene. Se creó una ruta temporal
que renderiza el `Sidebar` sin auth, se verificó a 375 y a 949 px, y se borró.

Ojo con dónde se pone: la primera versión quedó dentro de `(auth)`, que centra
su contenido en `max-w-sm` — las mediciones salieron polucionadas y parecían un
bug del menú. Una ruta de verificación va **fuera de todo route group**.

**Resultado:** 10 tests nuevos, suite de `web/` en **281** (venía de 271).
:::

:::danger[Notas de ejecución — los controles de sesión y una cascada que dependía del orden]
**Perfil, tema y salida se mudaron del pie del menú a la derecha de la cabecera.**
En un teléfono el menú vive detrás de un cajón: cambiar el tema exigía abrirlo,
bajar y cerrarlo. Ahora son tres iconos de 44 px, y el cambio de tema es un toque.

**El toggle es claro ↔ oscuro; `sistema` se mudó al perfil.** Con tres opciones
en línea el control quedaba apretado, y `sistema` es una preferencia de fondo:
ocupando un botón obligaba a pasar por él para algo que se hace de un toque.

**Se renderizan los dos botones y el CSS muestra uno.** Cuando el tema es
`sistema`, el servidor no puede saber qué prefiere el sistema operativo de quien
mira. Preguntarlo con JavaScript al montar traería de vuelta el destello que la
cookie evita, así que la decisión la toma la cascada.

**Y ahí estuvo el bug: la cascada dependía del orden de aparición.** Los botones
llevan utilidades de Tailwind, y `.flex` declara `display` igual que la regla que
esconde. Las dos tenían especificidad `0,1,0`, así que ganaba la que saliera
después. En desarrollo eso no es estable —el CSS se reconstruye por partes— y en
el browser de otra persona salió al revés: **se veían la luna y el sol a la vez**.

El arreglo no fue reordenar, fue sacar el orden de la ecuación con una escalera
de especificidad, que sí es invariante:

| escalón | regla | especificidad |
|---|---|---|
| utilidades | `.flex` | `0,1,0` |
| esconder | `.aq-toggle-tema .aq-en-*` | `0,2,0` |
| mostrar | `[data-tema=…] .aq-toggle-tema .aq-en-*` | `0,3,0` |

Y los tres casos de "mostrar" se hicieron **mutuamente excluyentes** —explícito
claro, explícito oscuro, o sin atributo con lo que diga el sistema— para que
ninguno necesite pisar a otro. Las dos consultas de `prefers-color-scheme` son
complementarias (`not all and (…)` cubre incluso al browser que no la entienda),
así que siempre se ve exactamente uno.

**Dos lecciones que costaron tiempo.** La primera: leer el archivo CSS servido y
contar llaves para adivinar si una regla quedó dentro de `@layer` **da respuestas
falsas**. La medición buena es preguntarle al CSSOM del browser recorriendo
`document.styleSheets`, que dice la capa real de cada regla. La primera lectura
dijo que `.flex` estaba fuera de capa; el CSSOM mostró que estaba dentro.

La segunda: **el chunk de CSS en desarrollo no cambia de nombre al editar
`globals.css`**. Navegando por links, el App Router trae markup nuevo por RSC y
no vuelve a pedir la hoja. Markup nuevo + CSS viejo explica síntomas que parecen
imposibles. Ante un "en mi browser se ve distinto", recargar duro es el primer
descarte.

**Verificado quitando el mecanismo**, como el resto de la fase: sin la clase
`aq-toggle-tema` se ven los dos botones —el síntoma reportado, reproducido— y el
test nuevo falla. Los cuatro casos dan exactamente un icono, y siempre el
contrario del tema que se está viendo.

**Se agrega la pantalla de perfil**, que no existía: quién es, qué habilita cada
uno de sus roles y desde dónde cambiar la contraseña. Los roles se ven pero no se
editan ahí — los asigna un admin desde Usuarios, y dejarlos editables sugeriría
que uno puede darse permisos.

**Resultado:** suite de `web/` en **288**.
:::

---

## T3 · Barrido de hex sueltos y el par fondo/texto

**Objetivo:** cerrar el bug de contraste del menú y dejar el sistema sin colores
que el modo oscuro no controle.

**Archivos:** `web/src/components/**`, `web/src/app/**`, `globals.css`

**Pasos:**

1. Barrer `web/src` buscando hex sueltos y clases de la paleta de Tailwind
   (`neutral-*`, `gray-*`, `slate-*`, `red-*`, `green-*`). Cada una se reemplaza
   por el token semántico que corresponda **según su rol**, no según su número.
2. **Cerrar el bug del menú.** `hover:bg-accion` sale. El hover pasa a ser
   `hover:bg-tarjeta`, y `bg-accion` + `text-invertido` queda reservado para el
   módulo **activo**.
3. Documentar el par fondo/texto en `globals.css`, arriba de las utilidades.
4. **Test de contraste sobre los tokens.** Un test que lee los pares declarados
   en la spec (D2), calcula la relación de contraste WCAG desde los hex de
   `tokens.css` y exige ≥ 4.5:1 en claro **y** en oscuro.

:::note[Por qué el test de contraste va sobre los tokens y no sobre el DOM]
`axe` en jsdom **no puede medir contraste**: necesita un motor de render real
que resuelva colores computados. Un test que dijera "el contraste está bien"
corriendo en jsdom estaría mintiendo.

Sobre los tokens sí se puede: los hex están ahí, la fórmula de WCAG es
aritmética, y el resultado es exacto. No cubre que alguien use el par
equivocado —eso lo agarra el ojo— pero **sí** garantiza que ningún par
declarado del sistema sea ilegible.
:::

**Verificación:**
- El barrido no deja hex ni clases de paleta cruda en `web/src`.
- El test de contraste pasa en los dos modos.
- **Con los ojos, en claro y en oscuro:** recorrer las cinco pantallas. Buscar
  específicamente **botones invisibles** — es el defecto que M2 dejó documentado.
- **Sacarle el peso:** poner a mano un par malo en la tabla del test. Tiene que
  fallar.

**Commit:** `fix(ui): cerrar el contraste del menú y barrer color fuera de tokens`

:::danger[Notas de ejecución — T3 cerrada el 22-ago-2026]
**El barrido fue chico; lo que apareció debajo, no.** No había un solo hex suelto
en `web/src` —todos viven en `tokens.css` y `globals.css`, que es donde van— y
las clases de paleta cruda eran 19 en 8 archivos. Se mapearon **por rol y no por
número**: `text-red-*` con `role="alert"` es `text-error-texto`, `text-emerald-*`
con `role="status"` es `text-exito-texto`, y el trío ámbar de los avisos es
`border-alerta-borde bg-alerta-fondo text-alerta-texto`.

**Faltaba un token: el velo.** El fondo del cajón usaba `bg-neutral-950/50`, y no
tenía token porque no encaja en ninguna familia. Es el único color del sistema
que **no cambia** entre claro y oscuro, y es a propósito: un velo tiene que
apagar lo que hay debajo, y si se invirtiera en oscuro quedaría un velo claro
iluminando el fondo. Se agregó `--aq-velo` con esa explicación al lado.

**El hover del menú no podía ser `bg-tarjeta`.** La spec lo pedía así, pero el
`<nav>` ya es `bg-tarjeta`: ese hover era invisible. Quedó `bg-fondo`, que es el
mismo hover que usan los iconos de la cabecera sobre esa misma superficie. La
spec (D2) se corrigió.

**Y apareció el estado activo, que no existía.** `bg-accion` + `text-invertido`
se usaba en el hover de *todos* los enlaces, así que dos enlaces se veían igual
—uno porque estabas ahí, otro porque tenías el mouse encima— y el activo no
significaba nada. Ahora el par está reservado para el módulo activo, con
`aria-current="page"`. Vive en `enlace-de-menu.tsx`, un componente de cliente
aparte: `usePathname()` es un hook y el armazón es de servidor, y extraer el
enlace es más barato que volver cliente al armazón entero.

── **El test de contraste encontró dos defectos reales** ────────────────────────

**Uno: el fondo de éxito en oscuro daba 4,46:1.** Falla por 0,04. La causa era un
hex escrito a mano —`#14603F`— en el único lugar donde el resto de los estados
usa `var(--aq-*-900)`. Ese hex es una parada del gradiente de marca: alguien usó
un color de gradiente como superficie. Siguiendo el patrón del sistema
(`var(--aq-exito-900)`) da **5,47:1**.

**Dos, y más grave: toda la jerarquía de texto estaba corta.** `--aq-texto-tenue`
daba 3,65:1 en claro y 4,04:1 sobre una tarjeta en oscuro. Y no es problema de
uso: `text-tenue` sostiene contenido real en veinte lugares —el email en la tabla
de auditoría, "(cuenta eliminada)", el link de recuperar contraseña—. Nada
decorativo, así que el que se movió fue el token. Correr `secundario` y `tenue`
un paso en los dos modos conserva los tres niveles bien separados y deja todo por
encima de 4,5:1 en las tres superficies.

**Lo importante de ese segundo hallazgo: el ojo no lo vio.** El barrido sobre el
DOM dijo "sin hallazgos" en oscuro, porque en la pantalla mirada ese texto caía
sobre `fondo` (4,69:1, pasa) y no sobre `tarjeta` (4,04:1, falla). **El ojo
revisa lo que está a la vista; la tabla revisa lo que el sistema permite.** Por
eso el test cubre las nueve combinaciones —tres niveles × tres superficies— y no
solo las que hoy se usan.

── **Dos trampas de medición** ──────────────────────────────────────────────────

**El barrido del DOM mide mal si hay `transition-colors`.** Cambiar `data-tema` y
medir en el mismo tick devuelve el color **en vuelo**: el selector de tema marcó
1,59:1 cuando en reposo da 8,45:1. Falso positivo, y peligroso al revés — un
color a mitad de camino puede *pasar* y tapar un defecto. Hay que esperar la
transición antes de medir.

**El test de sincronía comparaba nombres, no valores.** Se fortaleció para
comparar `nombre → valor`, que es exactamente el defecto que acababa de pasar:
corregir `--aq-texto-tenue` en el bloque explícito y dejar el generado con el
valor viejo. Los nombres coincidían; la pantalla no.

**Verificado quitando el peso**, como el resto de la fase: un par ilegible puesto
a mano hace fallar el test de contraste, y un valor cambiado en un solo bloque
hace fallar el de sincronía.

**Queda anotado, fuera de T3:** quien tiene rol admin y contador ve **dos ítems
de menú llamados "Auditoría"**. La duplicación de rutas es intencional —alcances
distintos— pero las etiquetas idénticas no se pueden distinguir. Es una decisión
de producto sobre cómo nombrarlas.

**Resultado:** 29 tests nuevos, suite de `web/` en **319** (venía de 288).
:::

---

## T4 · Accesibilidad transversal (R54, R55)

**Objetivo:** foco siempre visible y objetivos táctiles que se puedan tocar.

**Pasos:**

1. **R55 — anillo de foco.** En `globals.css`, un `:focus-visible` global con
   `0 0 0 2px <fondo>, 0 0 0 5px var(--aq-anillo-foco)`. Prohibido
   `outline: none` sin reemplazo. El punto de venta se opera con teclado.
2. **R54 — objetivos táctiles.** Mínimo 44 px en todo control; botón primario
   56 px. Se aplica en las primitivas, no pantalla por pantalla.
3. Ningún texto de contenido por debajo de 13 px. Los 11 px solo con `.aq-micro`,
   que ya existe y exige mayúsculas y tracking.

**Verificación:**
- Test: recorrer los controles renderizados y afirmar que ninguno declara alto
  menor a 44 px.
- **Con el teclado:** recorrer login y stock con `Tab`. Si en algún salto se
  pierde de vista dónde está el foco, la task no está.

**Commit:** `feat(ui): anillo de foco y objetivos táctiles del sistema`

:::danger[Notas de ejecución — T4 cerrada el 22-ago-2026]
**El anillo ya existía. Era casi invisible.**

`tokens.css` traía la regla de foco, así que a primera vista T4 estaba hecha.
Medido contra las superficies reales, el anillo daba **1,62:1** sobre el fondo
claro: WCAG 2.2 pide **3:1** para un indicador de foco. La causa es que la copia
del sistema usa el mismo aqua claro en los dos modos, y ese color solo funciona
sobre oscuro (10,57:1). Ahora baja a `acento-700` en claro —4,87:1— y se queda en
`acento-400` en oscuro. Misma familia: el foco conserva su identidad.

**Y el mecanismo tenía dos defectos.** La regla resolvía el anillo con
`box-shadow` en dos capas: 2 px del color de la tarjeta para abrir un hueco, y
3 px del anillo afuera.

El hueco estaba **fijo en `tarjeta`**, así que un control sobre el fondo de la
página se rodeaba de un halo del color equivocado y el hueco dejaba de leerse
como hueco. Y `box-shadow` es la misma propiedad que usan las elevaciones: un
`shadow-elev-1` compite por ella con la misma especificidad, y gana el que salió
último — el mismo defecto que tenía el toggle de tema.

`outline` con `outline-offset` resuelve los dos de una. El hueco es
**transparente**, así que muestra la superficie real sea cual sea, y `outline` es
una propiedad propia que ninguna utilidad de sombra puede pisar. Además sigue el
`border-radius`. Y `:is()` en vez de `:where()`, que aporta especificidad cero.

**El anillo estaba recortado, y eso no se ve en una captura.** El `<ul>` del menú
tiene `overflow-y-auto`, y el anillo sale 5 px del control —2 de separación más
3 de grosor—, así que el primer y el último ítem se quedaban sin la mitad del
anillo. Se detectó comparando la caja del anillo contra la de cada ancestro que
recorta; se arregla con `p-[5px]` en la lista. **No es padding estético: es el
lugar que el anillo necesita.**

── **Objetivos táctiles: el hallazgo estructural** ──────────────────────────────

`select` e `input` medían **42 px**. Dos píxeles cortos: invisible a la vista,
molesto con el pulgar. Pero lo importante es por qué.

**Hay campos de formulario en once archivos y no existe una primitiva
compartida.** Cada módulo escribe sus propias clases. Arreglar los once
funcionaría hoy y fallaría en la próxima pantalla que alguien escriba — que es
exactamente como se llegó a los 42 px. El mínimo pasa a ser **una regla sobre los
elementos**, que cubre lo que hay y lo que venga.

Las casillas y los radios quedan afuera: estirarlos deforma el control en vez de
agrandar el objetivo. El objetivo de una casilla lo da su `<label>`.

**Los enlaces son caso por caso, y no se puede automatizar.** "Ver lotes" medía
19 px y es la acción para entrar a un producto: lleva el mínimo. "Hecho con 💚 por
**@maoacr**" mide 17 px y va dentro de una oración: **no puede** medir 44 px sin
romper el renglón, y WCAG 2.2 lo exime justamente por eso. Los cuatro enlaces con
forma de botón —Ver lotes, la marca, Limpiar, Cargar más— lo declaran en su lugar.

── **La tipografía tampoco estaba en el sistema** ───────────────────────────────

25 usos de `text-xs`, que en Tailwind son **12 px**. La escala del sistema **no
tiene 12 px**: el piso de cuerpo es `cuerpo-chico` (14 px) y abajo solo `micro`
(11 px, mayúsculas y tracking). Era un default de Tailwind filtrándose — el mismo
tipo de filtración que las clases de paleta cruda que se barrieron en T3.

Los dos que eran etiquetas de verdad —los encabezados de tabla, que traían
`text-xs uppercase tracking-wide` escrito a mano, y la insignia de estado— pasan
a `.aq-micro`, que es exactamente para eso. **Ojo: eso pone la insignia en
mayúsculas** ("ACTIVO"). Es lo que el sistema dice para una etiqueta, y T6
rediseña ese componente igual.

**Se borró `cerrar-sesion.tsx`**, huérfano desde que los controles de sesión se
mudaron a la cabecera.

**Verificado quitando cada mecanismo**: volver a `box-shadow`, cambiar `:is()` por
`:where()` y bajar el mínimo a 24 px hacen fallar un test cada uno.

**Queda para T9:** en la tabla de usuarios, "Pendiente de cambiar contraseña"
envuelve en tres líneas porque las columnas no tienen ancho asignado. Ya envolvía
antes; subir de 12 a 14 px lo hizo más visible. Es repintado de tabla, no
accesibilidad.

**Resultado:** 10 tests nuevos, suite de `web/` en **329** (venía de 319).
:::

---

## T5 · La marca aparece

**Objetivo:** isotipo y gradiente, solo en superficies de marca.

**Archivos:**
- `web/src/components/marca/isotipo.tsx` — SVG en línea, tres gotas,
  `currentColor`
- `web/src/components/marca/logotipo.tsx` — isotipo + palabra
- `web/src/app/(auth)/layout.tsx` — gradiente de marca
- `web/src/components/ui/sidebar.tsx` — cabecera con logotipo

**Pasos:**

1. `<Isotipo>` como SVG en línea con `fill="currentColor"`: tiene que funcionar
   en claro y en oscuro **sin duplicar el archivo**.
2. Layout de acceso: gradiente `linear-gradient(135deg, #0E2A3C, #12525C, #14603F)`,
   declarado como token en `globals.css`, no como hex en el componente.
3. Menú lateral: reemplazar el `<h2>Aquazaku</h2>` por `<Logotipo>`.
4. **El gradiente no va a ningún otro lado.** Nunca detrás de una tabla ni de
   una cifra.

**Verificación:**
- Test: el isotipo tiene `role="img"` y nombre accesible.
- **Con los ojos, en los dos modos:** el isotipo se ve en ambos; el gradiente
  aparece **solo** en acceso.
- **Sacarle el peso:** buscar el gradiente en `web/src`. Si aparece fuera del
  layout de acceso y del token, está mal.

**Commit:** `feat(marca): isotipo y gradiente en las superficies de marca`

:::danger[Notas de ejecución — T5 cerrada el 22-ago-2026, y el plan estaba mal]
**Los pasos 1 y 2 de arriba se hicieron al revés de como están escritos.** El
plan se redactó sin tener el arte de la marca; cuando Mao lo entregó, dos
decisiones dejaron de tener sentido.

── **El isotipo NO es un SVG con `currentColor`** ───────────────────────────────

El paso 1 pedía redibujarlo en línea. Se hizo, y **estuvo mal**. El argumento era
"el original pesa 9,7 MB y una cabecera no manda eso"; el argumento es cierto y
la conclusión no. Mao lo dijo en una línea: *«¿por qué no simplemente usás el
asset que te di?»*.

**El peso se arregla optimizando, no redibujando.** Ese mismo arte a 240 px en
WebP pesa **11 KB** — de 9,7 MB— y es la marca de verdad, con su bisel, su
cavidad y sus ondas. El redibujo, puesto al lado, se veía genérico: le faltaba
justamente lo que hace especial al arte.

Queda como regla: **antes de recrear un asset, probá optimizarlo.**

Y `currentColor` tampoco iba: la marca es de tres colores. Un isotipo monocromo
que hereda el color del texto no es esta marca.

── **Los colores no se eligen: se cuentan** ────────────────────────────────────

El paso 2 fijaba el gradiente en `#0E2A3C, #12525C, #14603F`. Muestreando el
archivo original con Pillow, los colores reales de las tres gotas son otros:

| Gota | Honda | Media | Luz |
| --- | --- | --- | --- |
| Azul | `#003250` | `#0A8CBE` | `#8CF0FA` |
| Aqua | `#005A50` | `#3CBEAA` | `#BEF0F0` |
| Verde | `#003C1E` | `#1EAA64` | `#DCFAAA` |

La copia del sistema traía aproximaciones: el azul en `#1D78B3` contra el
`#0A8CBE` real, el verde en `#33BD73` contra el `#1EAA64`. El aqua sí estaba
bien (`#5CD9CC` contra `#54D8CC` medido). Los dos gradientes del sistema se
rearmaron sobre los colores reales, y **verificado en el browser**: la cinta
resuelve a `#0a8cbe → #3cbeaa → #1eaa64`.

── **Cada pieza en su superficie** ─────────────────────────────────────────────

| Superficie | Pieza | Por qué |
| --- | --- | --- |
| Acceso | Lockup completo | Es grande y es el único momento en que se mira la marca sin estar haciendo otra cosa |
| Cabecera | Isotipo + nombre en **texto** | A 28 px el wordmark con extrusión se embarra, y sus tonos oscuros desaparecen en modo oscuro |
| Favicon e iOS | La gota sola | Tres gotas a 16 px son una mancha |

El icono de iOS es el único que **no** puede ser transparente: iOS lo compone
sobre negro y la gota oscura desaparecería. Va sobre el gradiente de marca.

── **Vidrio, que no estaba en el plan** ────────────────────────────────────────

Mao pidió un sistema con aspecto *liquid glass*. La primera versión era una
lámina translúcida con desenfoque, y él fue directo: *«el card tiene
transparencia pero no se ve liquid glass»*. Tenía razón — eso es un rectángulo
con opacidad. El vidrio son **tres** cosas:

1. **El canto refracta**, encendido donde pega la luz y apagado en la diagonal
   opuesta. Un borde con degradado no existe en CSS: se pinta en un `::after` y
   se le recorta el centro con dos máscaras que se excluyen (`mask-composite`).
2. **Hay un reflejo especular**: un óvalo de luz corrido fuera del panel, del que
   solo se ve la caída.
3. **La pieza tiene espesor**: dos sombras, no una — una difusa que la separa del
   fondo y una corta de contacto que dice a qué distancia está.

En oscuro el canto **no es blanco**, es el aqua de la marca: el canto tiene que
ser del color de lo que lo ilumina.

Y el vidrio necesita algo detrás. Sobre un gris plano, `backdrop-filter`
desenfoca un gris plano. De ahí `--aq-ambiente`, un resplandor de marca amplísimo
y muy tenue. **Ojo con D3**: eso no contradice la regla. `--aq-gradiente-marca`
es el degradado FUERTE y sigue yendo solo en acceso —verificado, aparece
únicamente ahí—; `--aq-ambiente` es otra cosa, sin bordes visibles, y no compite
con una cifra.

Un detalle medido: una lámina fina sobre fondo oscuro compone **color sucio**.
Blanco al 0,62 sobre el verde de marca da `rgb(158,186,183)`, y ahí el link de
recuperar contraseña caía a 2,88:1. Por eso los paneles que se apoyan sobre la
marca usan una lámina con más cuerpo.

── **Regla de oro nueva: un módulo llega con su icono** ────────────────────────

Mao la pidió explícitamente. Está implementada **en el tipo**, no acá:
`MenuModule.icono` es obligatorio y sin él el proyecto no compila. Una regla
escrita solo en documentación se olvida en el décimo módulo.

Los dos de auditoría llevan iconos distintos —escudo y calculadora— a propósito:
quien tiene los dos roles ve las dos entradas, y el icono es lo primero que las
separa.

── **Un defecto de T4 que apareció acá** ───────────────────────────────────────

Mao reportó que en auditoría los campos se montaban unos sobre otros. Era mío:
subir la tipografía de 12 a 14 px en T4 ensanchó los inputs de 145 a 168 px
dentro de columnas de 131. **Un `<input>` sin ancho declarado mide su ancho
intrínseco, que depende del tamaño de fuente**, y como ítem de grid trae
`min-width: auto`, que le prohíbe encogerse. Arreglado con una regla global.

**Verificado quitando el mecanismo**: sacarle `decorativo` al isotipo de la
cabecera hace que la marca diga su nombre dos veces y falla un test; sacarle el
`alt` al lockup lo deja mudo y falla otro.

**Resultado:** 4 tests nuevos, suite de `web/` en **333** (venía de 329).
:::

---

## T6 · El componente `<Estado>` (R40)

**Objetivo:** un estado se comunica por **cuatro canales a la vez** — color,
forma, icono y texto en mayúsculas — y eso se escribe una sola vez.

**Archivos:** `web/src/components/ui/estado.tsx`

**Pasos:**

1. `<Estado tono="cubierto" | "justo" | "expuesto">` con los cuatro canales.
   Las formas salen de `.aq-forma-*`, que ya está en `tokens.css` y hoy no la
   usa nadie.
2. Iconos de Lucide: `check`, `alert-triangle`, `x`. Nunca dos iconos distintos
   para el mismo concepto.
3. Aplicarlo al **vencimiento de lotes de M2** — vigente / vence pronto /
   vencido — y al bloqueo de vencidos.
4. **No** se implementa el semáforo de autonomía: necesita producción y consumo
   real, y es de M4.

**Verificación:**
- Test: cada tono renderiza los cuatro canales. El texto va en mayúsculas.
- **Sacarle el peso:** quitar la clase de forma. El test tiene que fallar — si
  pasa, solo está probando el color, que es exactamente lo que R40 prohíbe.
- **Con los ojos:** en escala de grises los tres estados siguen siendo
  distinguibles. Ese es el punto de la regla.

**Commit:** `feat(ui): estado por color, forma, icono y texto`

:::danger[Notas de ejecución — T6 cerrada el 22-ago-2026]
**Dos cosas que el plan daba por sentadas y no existían.**

**La forma no puede ser el contenedor.** `.aq-forma-justo` y `.aq-forma-expuesto`
son `clip-path`: recortan el elemento al que se aplican. Puestas en la insignia
se llevarían el texto por delante — un triángulo con letras adentro corta las
letras. La forma quedó como una marca de 10 px al principio, pintada con
`currentColor` para que siga al tono sin declararlo dos veces.

**«Vence pronto» no tiene regla.** El dominio fija la vida útil en 30 días
([RN-STK-08](/dominio/stock/)) y bloquea lo vencido, pero **no define cuántos
días antes avisar**. Se implementó con 7 días —una cuarta parte de la vida, y
«lo que vence esta semana» se dice fácil en la planta— marcado en el código como
propuesta y no como regla. Es la **pregunta 36**. El test no valida el número:
valida que la frontera esté donde diga la constante, sea cual sea.

── **La violación que encontró la propia task** ─────────────────────────────────

El paso 2 pedía «nunca dos iconos distintos para el mismo concepto». Al aplicar
el componente apareció que **ya estaba rota**: la tabla de stock marcaba las
unidades vencidas con un triángulo de alerta mientras la insignia de lotes usaba
una equis. Los dos decían «vencido» y no se parecían en nada.

Se rompía en dos archivos que nadie mira juntos, así que documentarla de nuevo no
servía. Ahora hay **una sola fuente** —`ICONO_DE_ESTADO`— y los dos lugares leen
de ahí: divergir exige cambiarla, y ahí se ve que cambia en todos lados.

── **Los tres estados, siempre** ───────────────────────────────────────────────

La tabla de lotes mostraba insignia solo cuando el lote estaba vencido. «Sin
insignia» significaba vigente, y eso obliga a deducir por ausencia: quien mira
rápido no distingue «está bien» de «no se calculó». Ahora los tres se dicen.

── **La prueba en escala de grises** ───────────────────────────────────────────

Es la que importa, y necesitó una **ruta descartable**: los datos sembrados
tienen un solo lote y está vigente, así que la pantalla real nunca muestra los
tres juntos. Se creó fuera de todo route group, se miró y se borró.

En gris los tres se siguen distinguiendo por forma —círculo, triángulo, rombo— y
por icono —✓, ⚠, ✕—. Eso es R40 funcionando: el color no carga solo el
significado. Protege a quien no distingue verde de rojo, y también a una pantalla
al sol en la planta, un teléfono en ahorro de batería o una foto en blanco y
negro por WhatsApp.

**Verificado quitando cada canal**, como pide el plan. Los cinco casos rompen
tests: sin forma (4), las tres formas iguales (2), sin icono (4), los tres con el
mismo icono (1), y sin `.aq-micro` (3). El caso «todas las formas iguales» es el
que de verdad cuida la regla: sin él, los tests pasarían con un semáforo que solo
cambia de color.

**Resultado:** 22 tests nuevos, suite de `web/` en **355** (venía de 333).
:::

---

## T7 · Estados de interfaz (R49–R53)

**Objetivo:** carga, vacíos y errores implementados una vez, no por pantalla.

**Archivos:**
- `web/src/components/ui/esqueleto.tsx`
- `web/src/components/ui/vacio.tsx`
- `web/src/lib/errores.ts`
- `loading.tsx` por ruta de `(app)`
- `web/src/app/(app)/error.tsx`

**Pasos:**

1. **R49 — carga.** `loading.tsx` con esqueleto que copia **la grilla real** de
   esa tabla, no un rectángulo genérico. **Nunca** un spinner de pantalla
   completa.
2. **R50 — tres vacíos.** `<Vacio variante="primera-vez" | "sin-resultados" |
   "terminado">`. El de filtro **nunca** sugiere crear: ofrece quitar el filtro.
3. **R52 — errores sin jerga.** `errores.ts` mapea `ApiError.status` a texto
   humano. Prohibido que salga un código HTTP, «timeout», «null» o un nombre de
   tabla. Un solo botón primario. Se apoya en el `ApiError` que ya tira
   `apiServerFetch` — ver [patrón BFF](/frontend/bff-pattern/).
4. **R53 — sin conexión.** Mensaje neutro que **aclara que no se perdió nada**,
   con reintentar y llamar a la planta. No es culpa del usuario.
5. **R51 — dato tibio.** Sello de hora en las consultas de stock. El dato viejo
   se marca, no se esconde.

**Verificación:**
- Test: el mapa de errores no filtra códigos ni jerga para 401, 403, 404, 409,
  422 y 500. Cada variante de `<Vacio>` renderiza su acción, y `sin-resultados`
  **no** ofrece crear.
- **Con los ojos:** apagar `api/` y entrar. El mensaje tiene que ser neutro y no
  mostrar un stack.
- **Sacarle el peso:** agregar un status sin traducir al mapa. El test tiene que
  fallar, no caer en un texto genérico.

**Commit:** `feat(ui): esqueletos, vacíos diferenciados y errores sin jerga`

:::danger[Notas de ejecución — T7 cerrada el 22-ago-2026]
**R52 · el mapa no traduce todo, y esa fue la decisión importante.**

`api/` ya manda mensajes humanos en español para las violaciones de regla —«la
cantidad tiene que ser mayor que cero», «no hay unidades suficientes en el
lote»—. Reemplazarlos por un genérico **perdería lo único útil**: quien está en
el mostrador necesita saber QUÉ regla frenó la operación, no que «algo salió
mal».

Así que el cuerpo del servidor se usa **solo** en 409 y 422, que son los que
emite `ErrorDeNegocio`. En cualquier otro se ignora, porque un 500 puede traer un
stack y un 400 el nombre de un campo de Zod — confiar en esos sería filtrar
exactamente la jerga que R52 prohíbe. Hay tests para las dos mitades.

La lista de status no es la de todos los códigos HTTP: es la que sale de **leer
las rutas de `api/`** — 400, 401, 403, 404, 409, 422, 429 y 500.

── **Lo que encontró la verificación con los ojos** ─────────────────────────────

El boundary mostraba `aquazaku-api:500` como código de soporte, y tenía **dos**
problemas a la vez.

Decía «500», que a la persona no le significa nada y que R52 no quiere en
pantalla. Y era el **mismo string para todas las fallas del sistema**: alguien lo
reportaba, soporte lo buscaba en los logs y encontraba cuatrocientas.

Ahora el digest lleva también el `requestId` —el mismo que viajó en
`x-request-id` hacia api/— y lo que se muestra es solo eso. Verificado en el
browser contra una falla real: cero jerga, un botón, y un identificador que
encuentra **esa** petición.

Un test existente falló al cambiarlo, y **estuvo bien que fallara**: decía una
verdad que dejó de serlo.

── **R50 · «no ofrecer crear» pasó a ser un error de compilación** ─────────────

La regla es que un vacío de filtro nunca sugiera crear, porque empuja a cargar un
producto que ya existe y ese duplicado después hay que descubrirlo y limpiarlo.

Un test que revisara el texto renderizado solo probaría lo que se escribió hoy.
Así que `sin-resultados` **no acepta una acción propia**: pide una ruta sin
filtros y arma el enlace por su cuenta. Verificado — intentar pasarle un botón de
«crear» da **TS2322**.

── **R49 · cada `loading.tsx` describe SU grilla** ─────────────────────────────

`EsqueletoDeTabla` pide columnas y anchos, y los pide obligatorios. Un esqueleto
genérico de tres columnas delante de una tabla de siete vuelve a producir el
salto que R49 quiere evitar — el mismo *layout shift* de Core Web Vitals, que en
un punto de venta se paga en clics equivocados.

En stock el esqueleto dibuja **tres** columnas y no cuatro: la de vencidos
aparece solo cuando hay algo vencido, y dibujar una que puede no llegar es el
mismo salto al revés.

── **R51 · el sello de hora, y por qué el servidor la calcula** ────────────────

`leidoEn` se toma **después** del `await`, no antes: la hora que interesa es
cuándo se leyó la base, no cuándo empezó a renderizarse la pantalla. Y llega por
parámetro en vez de salir de `new Date()` en el componente, porque en el browser
mediría cuándo se pintó — y entre las dos cosas hay una carga de red y un render,
que es justamente el rato que se quiere reportar.

── **Una deuda que se deja a propósito** ───────────────────────────────────────

Los textos nuevos están escritos en **voseo**, como el resto de la app. Es
incoherente con el destino —T8 pasa todo a usted— pero escribir estos en usted
dejaría dos voces conviviendo en la misma pantalla hasta que T8 corra. Una voz
mezclada se nota más que una voz que todavía no cambió.

**Verificado quitando el mecanismo:** sacar un status del mapa hace fallar 2
tests —no cae en un genérico, que es lo que el plan pedía comprobar— y ofrecer
«crear» en un filtro vacío no compila.

**Resultado:** 44 tests nuevos, suite de `web/` en **399** (venía de 355).
:::

---

## T8 · La interfaz habla de usted

**Objetivo:** una sola voz en el producto — usted, español de Colombia.

**Pasos:**

1. Barrer `web/src` por voseo (`á`/`é` imperativos: `Revisá`, `elegí`, `Ingresá`)
   y por tuteo (`tu`, `tus`, `olvidaste`, `podés`, `vas a`).
2. Reescribir a usted. Tres archivos ya identificados: `login-form.tsx`,
   `forgot-password-form.tsx`, `change-password-form.tsx`. Barrer el resto.
3. **Actualizar los tests que fallen.** Fallan porque afirman una voz que el
   sistema de diseño nunca autorizó.
4. **La documentación no se toca.** `/docs` sigue en voseo: son dos voces
   distintas y a propósito.

**Verificación:**
- Test: un barrido sobre los textos de interfaz que falle ante imperativos
  voseantes y ante `tu`/`tus` dirigido al usuario.
- **Con los ojos:** leer las cinco pantallas de corrido. Si en alguna el sistema
  tutea, falta una.

**Commit:** `fix(ui): la interfaz habla de usted, como manda el sistema de diseño`

:::danger[Notas de ejecución — T8 cerrada el 22-ago-2026]
**43 líneas en 15 archivos. Cero tuteo: era todo voseo**, lo cual al menos era
consistente. El sistema de diseño lo dice sin margen — *«Español de Colombia,
trato de "usted". No voseo, no "tú"»*.

── **El bug que casi deja el guardián inservible** ─────────────────────────────

El primer barrido —hecho con Python— dio 46 casos. Al escribir el test en
TypeScript, el mismo patrón no encontraba **nada**.

En JavaScript `\b` se define contra `\w`, que es `[A-Za-z0-9_]`. Una `á` **no**
es carácter de palabra, así que entre `á` y un espacio **no hay frontera**:
`/\bprobá\b/` no coincide jamás con «probá de nuevo». En Python el mismo patrón
sí funciona, porque ahí `á` cuenta como letra.

Es una trampa silenciosa y cara: el precio es un guardián que pasa en verde
mientras la app entera vosea. Lo atrapó el test de autocontrol —el que verifica
que las reglas detecten lo que dicen detectar— antes de que llegara a producción.
El cierre pasó a ser `(?![a-záéíóúüñ])`.

── **Dos voces, a propósito** ──────────────────────────────────────────────────

El paso 4 del plan dice que `/docs` no se toca. Al barrer aparecieron tres
mensajes que **también** quedan en voseo por la misma razón:

```
'Copiá .env.example a .env.local y completala.'
```

Eso no lo lee un usuario de Aquazaku: lo lee quien levanta el servidor y le falta
una variable de entorno. Misma audiencia que `/docs`.

La excepción va en el test como **lista de frases exactas, no de archivos**. Un
archivo excluido deja de mirarse entero, y el día que alguien le agregue un texto
de interfaz nadie se entera. Así, agregar un mensaje de arranque obliga a
anotarlo — o sea, a decidirlo a propósito.

── **Y una regla que evita un guardián mentiroso** ────────────────────────────

La detección es por lista de raíces verbales, no por un patrón genérico tipo
`\w+á`. En español hay muchísimas palabras que terminan en vocal con tilde y no
son imperativos: «está», «acá», «quizá», «allá», «café». Un test que grite por
esas se apaga solo, porque nadie tolera un guardián que miente. Hay un caso
propio que lo verifica.

**Los tests que fallaron, fallaron bien.** Cuatro afirmaban la voz vieja —«no
tenés acceso», «¿olvidaste tu contraseña?», «todas tus sesiones», «Completá»—.
Decían una verdad que dejó de serlo.

**Verificado quitando el mecanismo:** devolver un imperativo voseante, un
posesivo de vos o un tuteo hace fallar el guardián en los tres casos. Y con los
ojos, recorriendo las pantallas y barriendo el DOM renderizado —no el código—:
cero hallazgos en stock, perfil y acceso.

**Resultado:** 4 tests nuevos, suite de `web/` en **403** (venía de 399).
:::

---

## T9 · Repintar las pantallas que ya tienen backend

**Objetivo:** aplicar todo lo anterior a acceso, productos, stock, usuarios y
auditoría, usando las 13 pantallas de referencia como especificación visual.

**Pasos:**

1. Abrir `claude-design/disenos/Documentacion Aquazaku.dc.html` y usar la
   pantalla de referencia que corresponda a cada módulo.
2. Repintar en este orden: acceso → menú → productos → stock → usuarios →
   auditoría.
3. **Toda cifra, ID, código de lote y dinero en `IBM Plex Mono` con
   `tabular-nums`.** Las columnas de números tienen que cuadrar a la vista.
   Nunca mono en texto corrido.
4. Elevación: sombra en claro, **tono en oscuro**. No se usan sombras en oscuro.
5. Los botellones y las bases van en aqua y **fuera del total**: no son plata.
   (No aplica todavía, pero la regla se respeta desde ahora.)

**Verificación:**
- Suite completa en verde: tests, lint, typecheck.
- **Con los ojos, pantalla por pantalla, en claro y en oscuro.** Es la única
  verificación que sirve acá, y es obligatoria.
- Recorrido con `Tab` en cada pantalla.

**Commit:** uno por pantalla, no uno gigante. `feat(ui): repintar <pantalla> con el sistema de diseño`

---

## T10 · `docs/` con los tokens de Aquazaku

**Objetivo:** que el sitio de documentación deje de usar el tema por defecto de
Starlight.

**Pasos:**

1. Mapear las custom properties de Starlight (`--sl-color-*`) a los tokens
   `--aq-*` en un CSS propio.
2. IBM Plex en el sitio, igual que en el producto.
3. Que el modo oscuro de Starlight coincida con el nuestro.
4. **No se reescribe el tema de Starlight**: se le pasan los valores.

**Verificación:**
- Los enlaces siguen funcionando: 41 páginas, 553 anclas, 0 rotas.
- **Con los ojos:** el sitio en claro y en oscuro.

**Commit:** `feat(docs): el sitio usa los tokens de Aquazaku`

---

## T11 · El brief de diseño describe un proyecto que no existe

**Objetivo:** que `/frontend/brief-de-diseno/` deje de mandar a quien lo lea a
diseñar el sistema equivocado.

:::danger[Esto no es documentación vieja: es documentación que engaña]
El brief se advierte a sí mismo: *"Si el dominio cambia, este brief cambia. Es
la traducción del dominio a pantallas — si se desactualiza, **se diseña sobre
reglas viejas**"*.

Se desactualizó. Y está publicado en `/frontend/`, exactamente donde alguien
—persona o asistente— iría a buscar antes de diseñar cualquier pantalla.
:::

**Lo que el brief afirma y el dominio ya descartó:**

| Línea | Afirma | La verdad |
| :-: | --- | --- |
| 47 | "Operación sin señal. El vendedor de ruta trabaja donde no hay internet" | No hay vendedores de calle. Todo es web **con conexión asumida** |
| 57 | `seller` opera en **app móvil**, "calle, sol directo, sin señal, una sola mano" | No hay app móvil. El `seller` entra por navegador |
| 64 | La app móvil "es su superficie real y la que hay que diseñar" | La superficie real es escritorio de 1440 px |
| 236 | "Esta es **la superficie con más peso del proyecto**" | Es una superficie que no existe |
| 209–254 | Pantallas de armado de ruta, inicio de ruta y rendición de ruta | `rutas.md` está marcado como **modelo descartado** |

**Cómo funciona el negocio de verdad:** los pedidos llegan **por WhatsApp** al
teléfono de la planta o del punto de venta, y el cliente **recoge** o **paga un
flete externo** (mototaxi, carro). Quien contesta el chat es la misma persona
que atiende el mostrador.

**Pasos:**

1. Corregir las afirmaciones falsas contra el modelo vigente: sin vendedores de
   calle, sin app móvil, sin operación sin señal, superficie de escritorio.
2. Quitar las pantallas de ruta del listado de vistas, o marcarlas explícitamente
   como descartadas con enlace a `rutas.md`.
3. Encabezar el documento con su estado real y su relación con `claude-design/`:
   **el brief es el insumo que produjo el sistema de diseño; ante cualquier
   contradicción, manda `claude-design/`.**
4. Revisar `frontend/index.md` por la misma deriva.

:::note[Por qué no se borra]
El brief tiene valor histórico: explica por qué el sistema de diseño quedó como
quedó. Se corrige y se fecha, no se borra. Borrarlo perdería el porqué; dejarlo
como está sigue costando decisiones equivocadas.
:::

**Verificación:**
- Barrer el brief por "sin señal", "offline", "app móvil" y "ruta". Lo que quede
  tiene que estar marcado como descartado.
- Leerlo entero de corrido: al terminar, el modelo que describe tiene que ser el
  de WhatsApp y mostrador.

**Commit:** `docs(frontend): el brief describía un modelo descartado`

---

## T12 · Cierre

**Pasos:**

1. Recorrido visual completo, claro y oscuro, con teclado. Capturas.
2. Documentar el sistema de diseño aplicado en
   `docs/src/content/docs/frontend/` — el par fondo/texto, `<Estado>`, los tres
   vacíos, la voz de usted y qué se decidió **no** construir.
3. Actualizar el [roadmap](/arquitectura/roadmap/): fase de diseño ✅, y M3 pasa
   a "por arrancar".
4. Notas de ejecución por task en este mismo archivo, como en M2.
5. Confirmar que `/frontend/` ya no contradice a `claude-design/` (T10).

**Commit:** `docs: cerrar la fase de diseño`

---

## Lo que esta fase deja listo para M3

M3 (Insumos) va a necesitar tabla, formulario de alta, aviso de stock mínimo y
estados de vencimiento. **Al terminar esta fase, nada de eso se diseña de nuevo:**
`<Estado>`, `<Vacio>`, los esqueletos, el mapa de errores, el par fondo/texto y
la voz ya existen.

Ese es el retorno de haberla hecho antes y no después.

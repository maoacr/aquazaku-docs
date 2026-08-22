---
title: Spec de la fase de diseño — hacer que el sistema de diseño exista
description: "Los tokens están adoptados pero inertes: el modo oscuro nunca se activa, la marca no aparece y las reglas de accesibilidad no están implementadas. Esta fase las hace reales antes de que M3 nazca torcido."
---

**Fecha:** 2026-08-21
**Estado:** 📝 Diseñado — por implementar
**Ubicación:** entre M2 y M3 del [Roadmap Aquazaku](/arquitectura/roadmap/)
**Autores:** Mao (product owner) + AI (asistente de diseño)

---

## 1. Por qué esto va antes de M3 y no después

M2 dejó el sistema de diseño **adoptado pero inerte**. Los tokens se copiaron, el
puente a Tailwind se construyó bien, IBM Plex se cargó con los pesos exactos —
y después nada de eso se usó para lo que fue diseñado.

El costo de dejarlo así no es estético. Es que **M3, M4, M5 y M6 van a nacer
torcidos**, cada uno inventando su propia forma de mostrar un estado, un vacío o
un error. Después no hay refactor que valga: hay veinte pantallas con veinte
criterios.

Arreglar la fundación con tres módulos encima es barato. Con diez, no.

:::note[Esta fase no rediseña nada]
El diseño ya está decidido y es de alta fidelidad: colores, tipografía,
espaciado, radios, sombras y estados de interacción son **finales**. Esta fase
no discute diseño. Lo **implementa**.
:::

## 2. El diagnóstico, con evidencia

Seis hallazgos, todos verificados el 21-ago-2026 contra el código y la documentación.

| # | Hallazgo | Evidencia | Gravedad |
| :-: | --- | --- | :-: |
| 1 | **El modo oscuro no existe** | `data-tema` aparece en 3 archivos CSS y en **cero** archivos TSX. Toda la columna "oscuro" de los tokens es código muerto | 🔴 |
| 2 | **Bug de contraste en el menú** | `ui/sidebar.tsx` usa `hover:bg-accion` con texto heredado oscuro: `#1B252B` sobre `#1D78B3` = **3.26:1**. WCAG AA pide 4.5:1 | 🔴 |
| 3 | **La voz de la interfaz está mezclada** | Tuteo en `login-form.tsx`, voseo rioplatense en `forgot-password-form.tsx` y `change-password-form.tsx`. El sistema exige **usted** | 🟠 |
| 4 | **La marca no aparece** | El menú es un `<h2>Aquazaku</h2>` pelado; el layout de acceso, un `div` centrado. Sin isotipo, sin gradiente | 🟠 |
| 5 | **Las reglas ejecutables R40 y R49–R55 no están** | `.aq-forma-*` definido en `tokens.css` y usado en ningún lado. Sin esqueletos, sin vacíos diferenciados, sin anillo de foco propio | 🟠 |
| 6 | **El brief de diseño describe un proyecto que no existe** | `/frontend/brief-de-diseno/` afirma que el `seller` opera en **app móvil sin señal** y que esa es "la superficie con más peso del proyecto". El modelo real es web con conexión asumida y pedidos por WhatsApp | 🔴 |

### El hallazgo 2 merece un párrafo

`hover:bg-accion` pinta el fondo del enlace con el azul de marca y **deja el
texto en el color principal**, que es casi negro. El resultado es que al pasar
el mouse por un módulo del menú, el nombre del módulo se vuelve más difícil de
leer que cuando no estaba señalado.

Es exactamente el mismo defecto que M2 dejó documentado: `bg-neutral-900` cumplía
dos roles y el número no decía cuál. Acá `bg-accion` es un color de **fondo de
acción**, y quien lo usa se compromete a poner `text-invertido` encima. No lo
hizo.

**Lección que esta fase tiene que institucionalizar:** un token de fondo de
acción y su color de texto son un **par**. Separarlos es lo que produce botones
invisibles y menús ilegibles, y ninguna de las dos cosas la agarra un test de
unidad.

## 3. Objetivos

1. **Modo oscuro funcionando de punta a punta**, sin destello al cargar.
2. **Cerrar el bug de contraste** y establecer el par fondo/texto como regla.
3. **Voz única en la interfaz**: usted, español de Colombia.
4. **Marca presente** donde corresponde, y solo donde corresponde.
5. **R40 y R49–R55 implementadas** como componentes reutilizables, no como
   copias por pantalla.
6. **Repintar lo que ya tiene backend**: acceso, productos, stock, usuarios y
   auditoría.
7. **`docs/` con el tema de Aquazaku**, no el de Starlight por defecto.
8. **Corregir el brief de diseño**, que todavía describe un modelo descartado.

## 4. Fuera de alcance

| Queda fuera | Va en | Por qué |
| --- | --- | --- |
| Pantallas de pedidos, clientes, bases con ID | M5, M6, M7 | No tienen backend. Serían maquetas que se pudren |
| Panel de planta y semáforo de autonomía | M4 · M12 | El semáforo necesita producción y consumo real (R39 de `reglas-como-tests.md`) |
| Panel del contador | M10 | Ídem |
| Rediseñar cualquier cosa | — | El diseño es final. Esta fase implementa |
| Modo oscuro en `api/` o Bruno | — | No tienen interfaz |

:::caution[Las 13 pantallas de referencia no se construyen acá]
Se usan como **especificación visual** de lo que sí se construye, y quedan de
guía para los módulos que vienen. Construir las que no tienen backend produciría
pantallas sin datos que hay que rehacer cuando el backend llegue.
:::

## 5. Decisiones de diseño

### D1 · El tema vive en una cookie, no en `localStorage`

**El problema:** el enfoque habitual —guardar la preferencia en `localStorage` y
aplicarla desde un `useEffect`— produce un **destello**: la página pinta en claro
y salta a oscuro cuando React hidrata. En una pantalla de planta a las cinco de
la mañana, ese destello es un fogonazo blanco en la cara.

**Además, lo prohíbe el patrón BFF.** La regla 3 del
[patrón BFF](/frontend/bff-pattern/) es explícita: nada de `localStorage`.

**La decisión:** una cookie `aq-tema`, escrita por una Server Action y leída en
el layout raíz, que pinta `data-tema` en el `<html>` **del lado del servidor**.
El HTML llega ya con el tema correcto. No hay destello porque no hay corrección.

```tsx
// Server Component — el tema llega resuelto en el HTML
const tema = (await cookies()).get('aq-tema')?.value ?? 'sistema'
return <html lang="es" data-tema={tema === 'oscuro' ? 'oscuro' : undefined}>
```

**Tres valores, no dos:** `claro`, `oscuro` y `sistema`. `sistema` no escribe
`data-tema` y deja que `prefers-color-scheme` decida en CSS. Un sistema que solo
ofrece dos valores obliga a elegir para siempre, y nadie quiere elegir para
siempre a las cinco de la mañana.

**Lo que esto cuesta:** leer una cookie en el layout raíz vuelve **dinámico todo
el árbol**. Se acepta, y se acepta barato: cada ruta de `(app)` ya era dinámica
porque resuelve la sesión con `getServerUser()`. La única que se pierde es la
prerenderización de las pantallas de acceso, que a esta escala no vale nada.

**Lo que NO se hace:** guardar el tema en la base a través de `api/`. Es una
preferencia de dispositivo, no del usuario — el mismo operario puede querer
claro en el mostrador y oscuro en la oficina. Meterla en `api/` sería inventarle
trabajo al backend para empeorar el resultado.

### D2 · El par fondo/texto es indivisible

Todo token de fondo de acción se expone **junto a su color de texto**, y las
utilidades sueltas que permiten separarlos dejan de usarse en componentes.

| Fondo | Texto obligatorio | Dónde |
| --- | --- | --- |
| `bg-accion` | `text-invertido` | Botón primario, enlace activo del menú |
| `bg-destructiva` | `text-invertido` | Anular, descartar, dar de baja |
| `bg-exito-fondo` | `text-exito-texto` | Aviso de "cuadra" |
| `bg-alerta-fondo` | `text-alerta-texto` | Aviso de vencimiento próximo |
| `bg-error-fondo` | `text-error-texto` | Error de formulario |

El menú lateral, además, **no usa `bg-accion` para el hover**. El hover es un
cambio de superficie, no un cambio de acción. `bg-accion` queda reservado para
el módulo **activo**, y ahí sí con `text-invertido`.

La superficie del hover es **`bg-fondo`**, no `bg-tarjeta`: el `<nav>` ya es
`bg-tarjeta`, así que ese hover no se vería. `bg-fondo` es además el mismo hover
que usan los iconos de la cabecera, que está sobre la misma superficie.

### D3 · La marca aparece en superficies de marca, nunca detrás de datos

Regla dura del sistema de diseño, y la respetamos literal:

| Superficie | Qué lleva |
| --- | --- |
| Pantallas de acceso | Lockup completo + gradiente de marca de fondo |
| Cabecera | Isotipo + "Aquazaku" en texto, con el gradiente de la cinta |
| Favicon e icono de iOS | La gota sola |
| Todo lo demás | Nada. El gradiente **nunca** va detrás de una tabla ni de una cifra |

### El resplandor de ambiente NO es el gradiente de marca

Hay dos cosas distintas y conviene no confundirlas, porque una está prohibida
fuera de las superficies de marca y la otra no:

| Token | Qué es | Dónde va |
| --- | --- | --- |
| `--aq-gradiente-marca` | El degradado **fuerte**, las tres hondas en diagonal | Solo la pantalla de acceso |
| `--aq-gradiente-cinta` | La secuencia azul → aqua → verde | La línea de la cabecera y el nombre en texto |
| `--aq-ambiente` | Un resplandor amplísimo al 2–16 % de opacidad, sin bordes | Toda la app, detrás de todo |

`--aq-ambiente` existe por una razón técnica, no decorativa: **una lámina de
vidrio no se ve por ser translúcida, se ve por lo que deja pasar**. Sobre un gris
plano, `backdrop-filter` desenfoca un gris plano y el panel queda como un
rectángulo con opacidad. El resplandor es lo que el vidrio refracta.

Al 2 % en claro no tiene borde visible ni compite con una cifra, que es lo que
D3 protege. En oscuro sube al 16 %: sobre un fondo casi negro el mismo 2 % no se
ve, y el ojo necesita más señal para leer el mismo gesto.

El isotipo —tres gotas— se implementa como **componente SVG en línea**, no como
imagen: tiene que heredar `currentColor` para funcionar en claro y en oscuro sin
duplicar el archivo.

:::danger[El verde es reservado]
`#33BD73` no es decorativo **nunca**. Significa "cuadra" o "todo en orden". Si
aparece en un botón de guardar, en un ícono simpático o en el gradiente de una
cabecera, está mal usado. El botón primario es azul.
:::

### D4 · Un estado se comunica por cuatro canales a la vez (R40)

> `dado cualquier estado del semáforo, entonces se muestran simultáneamente
> color + forma + icono + texto en mayúsculas`

Un solo componente `<Estado>` centraliza los cuatro canales. Nadie vuelve a
escribir un `<span>` verde a mano.

| Estado | Color | Forma | Icono | Texto |
| --- | --- | --- | --- | --- |
| Cubierto / vigente | `#33BD73` | círculo (`pill`) | `check` | CUBIERTO |
| Justo / vence pronto | `#E5A00D` | triángulo | `alert-triangle` | JUSTO |
| Expuesto / vencido | `#C0362A` | rombo | `x` | EXPUESTO |

Las formas ya existen en `tokens.css` (`.aq-forma-cubierto`, `.aq-forma-justo`,
`.aq-forma-expuesto`) y hoy no las usa nadie.

**Qué se puede aplicar hoy:** el vencimiento de lotes de M2 (vigente / vence
pronto / vencido) y el bloqueo de lotes vencidos. **Qué no:** el semáforo de
autonomía, que necesita producción y consumo real — es de M4.

### D5 · Los estados de interfaz se implementan una vez (R49–R53)

| Regla | Qué exige | Cómo se implementa |
| --- | --- | --- |
| **R49** carga | < 300 ms nada · 300 ms–5 s esqueleto con la **forma real** · > 5 s texto y salida. **Nunca** spinner de pantalla completa | `loading.tsx` por ruta con esqueleto que copia la grilla real de esa tabla |
| **R50** vacíos | Tres distintos: primera vez (explica) · filtro sin resultados (**nunca** sugiere crear) · terminado (verde + avanzar) | `<Vacio variante="…">`, tres variantes explícitas |
| **R51** dato tibio | Estimado, desactualizado y parcial **se marcan**, no se esconden. Nunca pantalla en blanco por dato viejo | Sello de hora en las consultas de stock |
| **R52** errores | Sin códigos HTTP, sin «timeout», sin «null», sin nombres de tabla. Primera línea aclara si se perdió algo. **Un** botón primario | Mapa de `ApiError.status` → texto humano, en un solo lugar |
| **R53** sin conexión | Mensaje neutro, aclara que no se perdió nada, ofrece reintentar y llamar a la planta | Variante del error boundary |

R52 se cruza con el [patrón BFF](/frontend/bff-pattern/): `apiServerFetch` ya
tira `ApiError` con `status`. El mapa vive del lado de `web/` y traduce **401 →
sesión vencida**, **403 → sin acceso**, **5xx → problema nuestro, no suyo**.

### D6 · La interfaz habla de usted; la documentación, de vos

Son dos voces distintas y **no se mezclan**.

| Superficie | Voz | Ejemplo |
| --- | --- | --- |
| Interfaz del producto | **Usted**, español de Colombia | "¿Olvidó su contraseña?" · "Revise su correo" |
| Documentación (`/docs`) | Voseo, registro técnico | "Recordá que esto es cosmética" |

El sistema de diseño lo dice sin ambigüedad: los textos de interfaz son finales,
en español de Colombia con trato de usted, y **no se cambian por traducciones
genéricas**. Hoy hay tres archivos que lo violan.

### D7 · `docs/` usa los mismos tokens

Starlight expone sus colores como custom properties. Se mapean a los tokens
`--aq-*`, con lo cual el sitio de documentación queda en la misma paleta que el
producto y el modo oscuro de Starlight empieza a coincidir con el nuestro.

No se reescribe el tema de Starlight: se le pasan los valores.

## 6. Cómo se verifica que esto funciona

**El aprendizaje más caro de M2 aplica entero acá.** Migrar clases a tokens dejó
cuatro botones invisibles con typecheck limpio y 234 tests en verde. Lo agarró
**una captura de pantalla**.

Por eso esta fase tiene dos capas de verificación, y la segunda no es opcional:

1. **Lo testeable, con tests.** Que el layout escriba `data-tema` según la
   cookie. Que la Server Action rechace un valor que no sea de los tres. Que
   `<Estado>` renderice los cuatro canales. Que el mapa de errores no filtre
   códigos HTTP. Que ningún objetivo interactivo baje de 44 px.
2. **Lo visual, con los ojos.** Cada task que toque una pantalla se cierra
   **viéndola en claro y en oscuro**, no cuando los tests pasan.

**Y la práctica de M2 que vale repetir:** probar que el mecanismo carga peso
**sacándolo**. Si al quitar el par `text-invertido` de un botón el test no falla,
el test no está probando nada.

## 7. Riesgos

| Riesgo | Por qué duele | Mitigación |
| --- | --- | --- |
| 🔴 **Repintar rompe contraste en silencio** | Es literalmente lo que pasó en M2. Typecheck y tests no lo ven | Par fondo/texto como regla (D2) + revisión visual obligatoria en claro y oscuro |
| 🟠 **El modo oscuro descubre tokens faltantes** | Cualquier hex suelto o clase `neutral-*` que sobreviva se ve mal recién en oscuro | Barrer hex sueltos y `neutral-*` de `web/src` antes de repintar |
| 🟠 **Cambiar textos rompe tests** | Los tests de M0–M2 buscan por texto visible | Es correcto que fallen: dicen una verdad que dejó de serlo. Se actualizan entendiendo por qué |
| 🟢 **El gradiente se filtra a pantallas de datos** | Deja de significar "marca" y compite con las cifras | Solo en acceso y cabecera del menú (D3) |

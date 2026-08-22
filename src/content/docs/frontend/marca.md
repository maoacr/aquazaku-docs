---
title: La marca
description: El arte de Aquazaku, dónde va cada pieza y de dónde salen los colores del sistema.
---

El arte de la marca son tres gotas —azul, aqua, verde— y el nombre. La secuencia
no es decorativa: es **el agua que entra de la red y sale potable**, y por eso el
gradiente del sistema la repite en ese orden.

## Descargar

Los originales, con transparencia y en alta. Son para diseño e impresión: la app
usa sus propias versiones optimizadas, que están más abajo.

| Pieza | Archivo |
| --- | --- |
| Isotipo, tres gotas | [aquazaku-isotipo.png](/marca/aquazaku-isotipo.png) |
| Gota sola | [aquazaku-gota.png](/marca/aquazaku-gota.png) |
| Lockup completo | [aquazaku-completo.png](/marca/aquazaku-completo.png) |
| Solo el nombre | [aquazaku-wordmark.png](/marca/aquazaku-wordmark.png) |

## Dónde va cada pieza

Un sistema de marca no usa la misma pieza en todos lados, y no por gusto: el
lockup completo a la altura de una cabecera se embarra, y el isotipo solo en una
pantalla de acceso no dice el nombre.

| Superficie | Qué lleva | Por qué |
| --- | --- | --- |
| Pantalla de acceso | **Lockup completo** sobre el gradiente de marca | Es grande y es el único momento en que alguien mira la marca sin estar haciendo otra cosa |
| Cabecera de la app | **Isotipo + el nombre en texto** | A 28 px el wordmark con extrusión 3D se embarra, y sus tonos oscuros desaparecen en modo oscuro |
| Favicon e icono de iOS | **La gota sola** | Tres gotas a 16 px son una mancha; una sola se sigue leyendo |
| Detrás de una tabla o una cifra | **Nada** | Regla D3: el gradiente compite con los datos |

El nombre en la cabecera va en texto con el gradiente de la cinta recortado
encima, no como imagen. Así se lee en los dos modos y a cualquier tamaño.

## Los colores salen del arte, no de una elección

Los hex de la marca en `globals.css` no están elegidos a ojo: salen de **contar
píxeles** sobre el archivo original. Cada gota es un degradado de tres paradas.

| Gota | Honda | Media | Luz |
| --- | --- | --- | --- |
| Azul | `#003250` | `#0A8CBE` | `#8CF0FA` |
| Aqua | `#005A50` | `#3CBEAA` | `#BEF0F0` |
| Verde | `#003C1E` | `#1EAA64` | `#DCFAAA` |

La copia del sistema de diseño traía aproximaciones —el azul en `#1D78B3` contra
el `#0A8CBE` real, el verde en `#33BD73` contra el `#1EAA64`—. El aqua sí estaba
bien: `#5CD9CC` contra `#54D8CC` medido. Se corrigieron los tres para que la
pantalla y lo impreso sean el mismo color.

De ahí salen los dos gradientes del sistema:

- `--aq-gradiente-cinta` — la línea de la cabecera, en la secuencia del isotipo
- `--aq-gradiente-marca` — el fondo de las superficies de marca, en diagonal

## Por qué el arte va como imagen y no como SVG

La primera versión redibujó el isotipo como SVG a mano, para no mandarle 9,7 MB
a un navegador. Era resolver el problema equivocado: **el peso se arregla
optimizando, no dibujando de nuevo.**

Ese mismo arte a 240 px de ancho en WebP pesa **11 KB**. Es la marca de verdad
—con su bisel, su cavidad y sus ondas— y ningún redibujo a mano iba a llegar a
eso. Peor: se iba a notar que era un redibujo.

Las versiones que usa la app:

| Archivo | Ancho | Peso | Para |
| --- | --- | --- | --- |
| `isotipo.webp` | 240 px | 11 KB | La cabecera lo pinta a 37 px; alcanza para 3x |
| `gota.webp` | 512 px | 20 KB | Usos chicos y cuadrados |
| `logo-completo.webp` | 900 px | 49 KB | Pantalla de acceso |
| `wordmark.webp` | 900 px | 29 KB | Solo el nombre |

El icono de iOS es el único que **no** puede ser transparente: iOS lo compone
sobre negro y la gota oscura desaparecería, así que va sobre el gradiente de
marca.

## Regla de oro: un módulo nuevo llega con su icono

Todo módulo del menú lateral tiene icono. No está solo escrito acá —eso se
olvida— sino en el tipo: `MenuModule.icono` es obligatorio y sin él el proyecto
**no compila**.

| Módulo | Icono |
| --- | --- |
| Inicio | `Home` |
| Productos | `Package` |
| Stock | `Boxes` |
| Usuarios | `Users` |
| Auditoría (admin) | `ShieldCheck` |
| Auditoría (contador) | `Calculator` |

Los dos de auditoría llevan iconos distintos a propósito: quien tiene los dos
roles ve las dos entradas, y el icono es lo primero que las separa.

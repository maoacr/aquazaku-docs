---
title: Cómo documentar
description: Reglas para escribir y mantener la documentación de Aquazaku.
sidebar:
  order: 1
---

## La regla base

La documentación se escribe **junto con el código**, no después. Un cambio que
altera el comportamiento del sistema y no toca esta documentación está incompleto.

## Dónde va cada cosa

| Si estás escribiendo… | Va en |
| --- | --- |
| Una regla de negocio | `dominio/` |
| El porqué de una elección técnica | `decisiones/` (ADR) |
| Cómo está armado el sistema hoy | `arquitectura/` |
| Un endpoint | `backend/` |
| Una tabla o migración | `base-de-datos/` |
| Una pantalla o componente | `frontend/` o `mobile/` |

## Agregar una página

1. Creá el `.md` en la carpeta que corresponde.
2. Poné `title` y `description` en el frontmatter — la `description` va al SEO
   y al buscador interno, no la dejes vacía.
3. Listo. El sidebar usa `autogenerate`, así que la entrada aparece sola.

Usá `sidebar.order` solo cuando el orden alfabético no sirva.

```md
---
title: Registrar una venta
description: Flujo completo de una venta desde la app del vendedor.
sidebar:
  order: 2
---
```

## Marcar lo que no sabemos

Un supuesto sin marcar es un bug esperando. Marcalo visible:

```md
:::caution[Supuesto sin confirmar]
Asumimos que un cliente pertenece a una sola ruta. Falta confirmar con Aquazaku.
:::
```

## Estilo

- Español, voseo, directo. Escribís para alguien que entra al proyecto mañana.
- Frases cortas. Si una oración necesita dos comas para respirar, partila.
- Mostrá el ejemplo antes que la teoría.
- Si algo no está definido, decilo. "Pendiente" es información; el silencio no.

## Levantar el sitio

```bash
pnpm dev      # http://localhost:4321
pnpm build    # genera ./dist
pnpm preview  # sirve el build
```

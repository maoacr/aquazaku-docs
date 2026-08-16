---
title: Plantilla de ADR
description: Estructura base para registrar una decisión técnica.
sidebar:
  order: 2
---

Copiá el bloque de abajo a un archivo nuevo en `src/content/docs/decisiones/`
con el nombre `NNNN-titulo-corto.md`.

````markdown
---
title: ADR-0001 — Título corto en imperativo
description: Una línea con la decisión tomada.
---

**Estado:** Propuesto | Aceptado | Reemplazado por ADR-XXXX
**Fecha:** AAAA-MM-DD
**Deciden:** nombres

## Contexto

Qué situación nos obliga a decidir. Hechos, restricciones y presiones reales
del negocio o del sistema. Sin opinión todavía.

## Alternativas evaluadas

### Opción A — nombre
- ✅ A favor
- ❌ En contra

### Opción B — nombre
- ✅ A favor
- ❌ En contra

## Decisión

Elegimos **Opción X** porque…

El "porque" es la parte que importa. Si no se puede escribir en dos frases,
la decisión todavía no está tomada.

## Consecuencias

Qué se vuelve fácil y qué se vuelve difícil a partir de ahora. Incluí el costo
que aceptamos pagar — toda decisión tiene uno.
````

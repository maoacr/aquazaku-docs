---
title: Decisiones técnicas
description: Registro de decisiones de arquitectura (ADR) del sistema Aquazaku.
sidebar:
  order: 1
---

Toda decisión técnica que sea **cara de revertir** se registra acá como un ADR
(*Architecture Decision Record*).

## Por qué registramos decisiones

Dentro de seis meses nadie se acuerda por qué se eligió una base de datos, un
esquema de permisos o un formato de sincronización offline. Sin el registro, el
equipo vuelve a discutir lo mismo — o peor, revierte una decisión sin conocer el
motivo que la originó.

Un ADR no documenta lo que hicimos. Documenta **qué alternativas descartamos y por qué**.

## Cuándo escribir un ADR

Escribilo cuando la decisión cumpla al menos una:

- Afecta a más de un proyecto (`api`, `web`, `mobile`).
- Revertirla implica migrar datos o reescribir un módulo.
- Hubo más de una alternativa razonable sobre la mesa.
- Alguien va a preguntar "¿y por qué no usamos X?".

Si no cumple ninguna, no es un ADR: es una nota de implementación.

## Convención

Un archivo por decisión, numerado y en orden cronológico:

```
decisiones/
├── 0001-titulo-de-la-decision.md
├── 0002-otra-decision.md
```

Los ADR **no se editan ni se borran**. Si una decisión queda obsoleta, se escribe
un ADR nuevo que la reemplaza y se marca el viejo como `Reemplazado por ADR-XXXX`.
El historial de cómo pensamos vale tanto como la conclusión.

Usá la [plantilla de ADR](/decisiones/plantilla/) para arrancar.

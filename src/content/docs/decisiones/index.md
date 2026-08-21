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

## Los que hay

| ADR | Decisión | Salió de |
| --- | --- | --- |
| [0001](/decisiones/0001-stack-m0/) | Stack del sistema: Fastify, Drizzle, Postgres, Better-Auth, Next | Diseño de M0 |
| [0002](/decisiones/0002-bff-pattern/) | `web/` es un BFF: el browser nunca habla con `api/` | Diseño de M0 |
| [0003](/decisiones/0003-roles-permisos-matriz/) | La matriz de permisos vive en TypeScript, no en la base | Diseño de M0 |
| [0004](/decisiones/0004-audit-log-inmutable/) | `audit_log` es append-only por triggers **y** por permisos | Implementación de M0 |
| [0005](/decisiones/0005-scopes-fail-closed/) | Un alcance que no aplica falla, no devuelve todo | Implementación de M0 |
| [0006](/decisiones/0006-invariantes-en-la-base/) | Los invariantes viven en la base; el servicio explica el error | Implementación de M1 |
| [0007](/decisiones/0007-auditoria-bloqueante/) | Una acción sensible sin bitácora no se ejecuta | Implementación de M1 |

Los dos últimos salieron de **construir**, no de planear. Es el patrón esperable:
un ADR de diseño elige entre alternativas conocidas; uno de implementación
aparece cuando la realidad muestra una que nadie había visto.

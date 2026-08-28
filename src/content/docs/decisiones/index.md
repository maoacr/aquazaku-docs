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
| [0008](/decisiones/0008-saldo-derivado-o-materializado/) | Un saldo se materializa **solo** si hay que descontarlo atómicamente | Implementación de M2 a M7 |
| [0009](/decisiones/0009-donde-corre-aquazaku/) | Postgres gestionado; `api` y `web` juntos en una máquina | Puesta en producción, después de M9 |

El `0009` es el primero que sale de **desplegar**, y llegó tarde a propósito:
recién cuando había algo que poner en producción existieron los hechos para
decidir. Antes habría sido elegir un proveedor por gusto.

Los tres anteriores salieron de **construir**, no de planear. Es el patrón
esperable: un ADR de diseño elige entre alternativas conocidas; uno de
implementación aparece cuando la realidad muestra una que nadie había visto.

El `0008` es un caso aparte y vale la pena notarlo: **no apareció, se repitió**.
La misma decisión se tomó cinco veces —en M2, M3, M4, M6 y M7— siempre igual y
siempre por intuición. Se escribió recién cuando quedó claro que había un
criterio y no cinco coincidencias.

:::tip[Cuándo escribir un ADR de implementación]
Cuando notás que ya tomaste esa decisión antes. La tercera vez es tarde, pero es
mejor que la sexta.
:::

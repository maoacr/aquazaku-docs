---
title: Arquitectura
description: "Cómo está construido el sistema Aquazaku: roadmap de implementación, contrato entre proyectos y catálogo de módulos."
sidebar:
  order: 1
---

Esta sección describe el **estado actual** del sistema: qué proyecto vive
dónde, cómo se conectan, en qué orden se construye y qué módulos lo componen.

El **porqué** de cada decisión arquitectónica vive en
[Decisiones técnicas](/decisiones/) — los ADR describen cómo llegamos hasta
acá; esta sección describe dónde estamos parados.

## Qué hay en esta sección

| Página | Qué cubre |
| --- | --- |
| [Roadmap de desarrollo](/arquitectura/roadmap/) | Orden y criterios para construir el sistema, módulo por módulo. Incluye principios rectores, dependencias, estado actual y decisiones abiertas. |
| [Catálogo de módulos](/arquitectura/modulos/) | Índice rápido de cada módulo con propósito, roles, dependencias y link al doc de dominio. Útil para no scrollear el roadmap entero. |

## Qué NO va acá

- El **dominio del negocio** (reglas de producción, ventas, clientes,
  envases) vive en [Dominio](/dominio/). Esta sección solo **apunta** a esos
  documentos — no los copia.
- Las **decisiones técnicas con alternativas evaluadas** (por qué Supabase y no
  Firebase, por qué Postgres y no Mongo, etc.) viven en
  [Decisiones técnicas](/decisiones/) como ADR numerados. El roadmap **enumera
  qué se decide**, no **cómo se decide**.
- El **cómo se ve cada pantalla** vive en [`/claude-design/`](https://github.com/maoacr/aquazaku/tree/main/claude-design) como referencia visual — los
  mockups no son código de producción y no se versionan en este sitio de docs.

:::tip[Cómo usar esta sección]
Si venís a implementar un módulo: arrancá por el
[roadmap](/arquitectura/roadmap/), fijate en qué fase está y qué módulos
necesita tener terminados antes. Después saltá al doc de dominio
correspondiente para entender las reglas, y al catálogo de módulos para ver
los links cruzados.
:::

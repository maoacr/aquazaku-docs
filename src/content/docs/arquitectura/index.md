---
title: Arquitectura
description: Cómo se separan las piezas del sistema Aquazaku y por qué.
sidebar:
  order: 1
---

Acá va el **cómo está construido** el sistema: límites entre módulos, flujo de datos,
qué habla con qué y por dónde.

## Qué documentar en esta sección

- Diagrama de contexto: quién usa el sistema y qué sistemas externos toca.
- Separación por proyecto (`api`, `web`, `mobile`) y el contrato entre ellos.
- Capas dentro de cada proyecto y la regla de dependencia entre capas.
- Flujos críticos de punta a punta: una venta, una recarga, un cierre de ruta.

## Qué NO va acá

El **porqué** de cada decisión va en [Decisiones técnicas](/decisiones/), no acá.
Esta sección describe el estado actual; los ADR describen cómo llegamos a él.

:::note[Sin definir todavía]
La arquitectura se define cuando arranque el proyecto `api/`. Hasta entonces esta
página es un contenedor vacío a propósito — no inventamos arquitectura antes de
entender el dominio.
:::

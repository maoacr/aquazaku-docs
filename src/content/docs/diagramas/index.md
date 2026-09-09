---
title: Diagramas del sistema
description: Mapas visuales de los flujos, ciclos de vida, despliegue y permisos de Aquazaku. Generados con archify.
sidebar:
  order: 5
---

# Diagramas del sistema

Mapas visuales del estado del sistema al 9 de septiembre de 2026. Cada diagrama
es un HTML standalone generado con la skill `archify` (calidad `showcase` o
`standard`).

:::note[Cómo están hechos]
Los archivos viven en `static/diagramas/` y se sirven directamente — son
HTML autocontenidos, sin dependencias externas. Los fuentes JSON están en
`/Users/mao/.agents/skills/archify/examples/aquazaku-*.json`.
:::

## Índice

### [Despliegue](./despliegue/)

- [Deploy de producción](./despliegue#deploy-de-produccion) — merge a main → build → deploy → migración deliberada
- [Deploy de preview](./despliegue#deploy-de-preview) — push a PR → Vercel preview + Railway staging → sync a preview

### Personas

- [Flujos por rol](./flujos-por-rol) — admin, seller, POS, contador
- [Permisos por módulo](./permisos) — quién hace qué (matriz por rol × módulo)

### Ciclos de vida

- [Venta](./ciclo-de-venta) — state machine: REGISTRADA → PENDIENTE_PAGO → COMPLETADA
- [Botellón](./ciclo-de-botellon) — DISPONIBLE → ASIGNADO → CON CLIENTE → DEVUELTO

### Flujos de venta

- [Venta — happy path + branches](./flujo-de-venta) — lineal con branches documentadas en cards

## Cómo se generaron

```bash
# Ejemplo: deploy de producción
node /Users/mao/.agents/skills/archify/bin/archify.mjs deliver \
  workflow /tmp/aquazaku-deploy-prod.json \
  static/diagramas/aquazaku-deploy-prod.html \
  --quality showcase
```

Los fuentes JSON se iteran con `validate` hasta que pasan. Los `showcase` requieren 9/9 checks
sin warnings; los `standard` son los que no se pudo llegar a showcase por complejidad del
layout (múltiples lanes con branches). En esos casos las branches se documentan en las cards
en vez de pelearse con `labelAt` y `via`.

## Calidad por diagrama

| Diagrama | Tipo | Calidad |
| --- | --- | --- |
| Deploy de producción | workflow | showcase |
| Deploy de preview | workflow | showcase |
| Flujos por rol | workflow | showcase |
| Permisos por módulo | workflow | standard |
| Ciclo de venta | lifecycle | standard |
| Ciclo de botellón | lifecycle | standard |
| Flujo de venta | workflow | standard |

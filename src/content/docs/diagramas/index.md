---
title: Diagramas del sistema
description: Mapas visuales de los flujos, ciclos de vida, despliegue y permisos de Aquazaku. Generados con archify.
sidebar:
  order: 5
---

# Diagramas del sistema

Mapas visuales del estado del sistema al 9 de septiembre de 2026. Cada diagrama
es un HTML standalone generado con la skill `archify` (calidad `showcase` o
`standard`) y se sirve desde `/diagramas/*.html`. Hacé click para ver el
diagrama completo, con theme switch, pan/zoom y search integrados.

## Despliegue

- [Deploy de producción](/diagramas/aquazaku-deploy-prod.html) — merge a `main` → build → deploy → migración deliberada (`pnpm db:migrate:prod`)
- [Deploy de preview](/diagramas/aquazaku-deploy-preview.html) — push a PR → Vercel preview + Railway staging → `db:sync-preview`

## Personas

- [Flujos por rol](/diagramas/aquazaku-roles.html) — admin, seller, POS, contador (workflow, showcase)
- [Permisos por módulo](/diagramas/aquazaku-permisos.html) — quién hace qué, cita [ADR-0003](/decisiones/0003-roles-permisos-matriz/) (workflow, standard)

## Ciclos de vida

- [Venta](/diagramas/aquazaku-venta-lifecycle.html) — state machine: `REGISTRADA → PENDIENTE_PAGO → PAGO_PARCIAL/TOTAL → COMPLETADA`, con terminales `ANULADA` y `FALLO_AUDITORIA` (lifecycle, standard)
- [Botellón](/diagramas/aquazaku-botellon-lifecycle.html) — `DISPONIBLE → ASIGNADO → CON CLIENTE → DEVUELTO`, con terminales `DAÑADO` y `DESCARTADO` (lifecycle, standard)

## Flujos de venta

- [Venta — happy path + branches](/diagramas/aquazaku-venta-flujo.html) — lineal con branches documentadas en cards (workflow, standard)

## Cómo se generaron

```bash
# Ejemplo: deploy de producción
node /Users/mao/.agents/skills/archify/bin/archify.mjs deliver \
  workflow /tmp/aquazaku-deploy-prod.json \
  static/diagramas/aquazaku-deploy-prod.html \
  --quality showcase
```

Los `showcase` requieren 9/9 checks sin warnings. Los `standard` son diagramas donde las branches o lanes múltiples no llegaban a showcase — el contenido está, las branches se documentan en las cards del HTML.

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

# Diagramas de Aquazaku

Diagramas generados con `archify` (calidad `showcase` o `standard`) sobre el estado del sistema al 9 de septiembre de 2026.

## Despliegue

- [Deploy de producción](static/diagrams/aquazaku-deploy-prod.html) — `pnpm db:migrate && pnpm db:sync-preview && pnpm start` reducido a `CMD ["pnpm", "start"]` + `pnpm db:migrate:prod` deliberado
- [Deploy de preview](static/diagrams/aquazaku-deploy-preview.html) — push a PR → Vercel preview + Railway staging → `db:sync-preview`

## Personas

- [Flujos por rol](static/diagrams/aquazaku-roles.html) — admin, seller, POS, contador
- [Permisos por módulo](static/diagrams/aquazaku-permisos.html) — quién hace qué, citando ADR-0003

## Ciclos de vida

- [Venta](static/diagrams/aquazaku-venta-lifecycle.html) — state machine REGISTRADA → PENDIENTE_PAGO → PAGO_PARCIAL/TOTAL → COMPLETADA, con terminales ANULADA y FALLO_AUDITORIA
- [Botellón](static/diagrams/aquazaku-botellon-lifecycle.html) — DISPONIBLE → ASIGNADO → CON CLIENTE → DEVUELTO, con terminales DAÑADO y DESCARTADO

## Flujos de venta

- [Venta — happy path + branches](static/diagrams/aquazaku-venta-flujo.html) — lineal con las branches explicadas en las cards

## Cómo se generaron

Cada `.json` está en `/Users/mao/.agents/skills/archify/examples/aquazaku-*.json` (o en `/tmp/` mientras se iteraba). Se generaron con el binario de archify:

```bash
node /Users/mao/.agents/skills/archify/bin/archify.mjs deliver <type> <input>.json <output>.html --quality showcase
```

## Calidad

- `showcase`: deploy-prod, deploy-preview, roles (3 archivos)
- `standard`: venta-lifecycle, botellon-lifecycle, venta-flujo, permisos (4 archivos)

Los `standard` son diagramas donde las branches o los nodos múltiples en una misma lane generaron cruces que el validador `showcase` rechazaba. Se documentaron los branches en las cards en lugar de pelear con el layout.

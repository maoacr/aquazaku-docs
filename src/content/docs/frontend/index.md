---
title: Frontend
description: Panel de administración web de Aquazaku.
sidebar:
  order: 1
---

Documentación del proyecto `web/`: el panel de administración que usa la oficina.

## Qué documentar acá

- **Stack y estructura de carpetas** — y la razón de esa estructura.
- **Sistema de diseño** — componentes, tokens, criterios de composición.
- **Manejo de estado y datos** — cómo se consume la API y dónde vive el estado.
- **Rutas y permisos en UI** — qué ve cada rol. La UI oculta; la API prohíbe.
  Las dos capas, siempre.

## Estado actual

**M0 — Auth + RBAC** está diseñado y pendiente de implementación.

- **Spec de diseño:** [`/superpowers/specs/2026-08-19-auth-rbac-design.md`](/superpowers/specs/2026-08-19-auth-rbac-design)
  — incluye estructura de web/, rutas `(auth)` y `(app)`, módulos UI
- **Plan de implementación:** [`/superpowers/plans/2026-08-19-m0-auth-rbac.md`](/superpowers/plans/2026-08-19-m0-auth-rbac)
- **Patrón BFF:** [`/frontend/bff-pattern.md`](/frontend/bff-pattern) — guía para devs sobre `apiServerFetch()`, el helper único, anti-patrones y ESLint rule
- **Decisiones arquitectónicas relevantes:**
  - [ADR-0001 — Stack del módulo M0](/decisiones/0001-stack-m0) — Next.js 16 (App Router) + React 19 + Tailwind + TanStack Table
  - [ADR-0002 — Patrón BFF desde M0](/decisiones/0002-bff-pattern) — web/ como Backend-For-Frontend, defensa en 3 capas

**Cuando el código arranque**, esta sección se llena con:
- Stack y estructura concreta de carpetas de web/
- Sistema de diseño (paleta, tipografía, componentes)
- Manejo de Server Components, Server Actions, Server-Side Fetching
- Rutas y permisos por rol en la UI (qué módulos ve cada rol)

---
title: Backend
description: API, autenticación y permisos del sistema Aquazaku.
sidebar:
  order: 1
---

Documentación del proyecto `api/`: contratos, endpoints, autenticación y el
esquema de permisos por rol.

## Qué documentar acá

- **Referencia de API** — endpoints, request/response, códigos de error.
  Un endpoint sin documentar no está terminado.
- **Autenticación** — cómo se emite y renueva el token, cómo se cierra sesión.
- **Autorización** — cómo se implementa el modelo de permisos.

  :::note[Fuente única de verdad]
  La matriz de roles × permisos **no se duplica acá**. Vive en
  [Dominio → Roles y permisos](/dominio/roles-y-permisos/), porque es una regla
  de negocio, no una decisión de implementación.

  Esta sección documenta *cómo* se aplica esa matriz: middleware, claims del
  token y dónde se resuelve el filtro de alcance
  ([RN-ACC-03](/dominio/roles-y-permisos/)).
  :::
- **Errores** — catálogo de códigos y qué significa cada uno para el cliente.

## Estado actual

**M0 — Auth + RBAC** está diseñado y pendiente de implementación.

- **Spec de diseño:** [`/superpowers/specs/2026-08-19-auth-rbac-design.md`](/superpowers/specs/2026-08-19-auth-rbac-design)
  — incluye endpoints `/auth/*`, `/users/*`, `/audit`, modelo de datos, flujos completos
- **Plan de implementación:** [`/superpowers/plans/2026-08-19-m0-auth-rbac.md`](/superpowers/plans/2026-08-19-m0-auth-rbac)
- **Decisiones arquitectónicas relevantes:**
  - [ADR-0001 — Stack del módulo M0](/decisiones/0001-stack-m0) — Node 20 + Fastify + Drizzle + Postgres + Better-Auth + custom authz
  - [ADR-0003 — Matriz de permisos resuelta](/decisiones/0003-roles-permisos-matriz) — multi-rol sin switch, state machine de ventas (M2)

**Cuando el código arranque**, esta sección se llena con:
- Referencia de API de cada endpoint (request/response/Zod schemas)
- Documentación del módulo `authz/` (matriz ejecutable, scopes, middleware)
- Catálogo de errores (códigos HTTP + significado para el cliente)
- Decisiones de implementación que NO están en el spec

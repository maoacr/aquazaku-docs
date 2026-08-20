---
title: Base de datos
description: Modelo de datos, migraciones y decisiones de modelado de Aquazaku.
sidebar:
  order: 1
---

## Qué documentar acá

- **Modelo de datos** — diagrama entidad-relación y qué representa cada tabla
  en términos del [dominio](/dominio/).
- **Migraciones** — cómo se crean, cómo se aplican, cómo se revierte.
- **Índices y consultas críticas** — las consultas que tienen que ser rápidas sí o sí.
- **Datos semilla** — qué necesita una instalación limpia para arrancar.

## El punto delicado

El modelo tiene que distinguir **producto** de **envase retornable**. Una paca sale
y no vuelve; un botellón sale, se espera que vuelva, y a veces no vuelve. Son dos
ciclos de vida distintos y un solo campo `stock` no los representa.

Esa decisión, cuando se tome, va documentada como
[ADR](/decisiones/) — es de las caras de revertir.

## Estado actual

**M0 — Auth + RBAC** está diseñado y pendiente de implementación. El motor de
base de datos está elegido.

- **Motor:** PostgreSQL 16 — registrado en [ADR-0001](/decisiones/0001-stack-m0)
- **Modelo de datos M0** (5 tablas): ver sección 6 del
  [`/superpowers/specs/2026-08-19-auth-rbac-design.md`](/superpowers/specs/2026-08-19-auth-rbac-design)
  - `users` — identidad de usuarios
  - `sessions` — sesiones de Better-Auth (multi-rol, httpOnly cookies)
  - `roles` — catálogo de los 4 roles
  - `user_roles` — N:M entre usuarios y roles
  - `audit_log` — log append-only con REVOKE + trigger
- **Migraciones:** Drizzle Kit, explícitas (nunca auto-generadas contra producción)
- **Seed:** ver sección 13 del spec — script `pnpm db:seed` con seguridad de producción
- **Decisiones de modelado:** las reglas de negocio viven en `/dominio/`, no se duplican acá

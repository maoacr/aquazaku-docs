---
title: ADR-0001 — Stack del módulo M0 (Auth + RBAC)
description: Decisiones de stack para el primer módulo del sistema: custom auth + custom authz, Better-Auth, Fastify + Drizzle, Next.js App Router.
---

**Estado:** Aceptado
**Fecha:** 2026-08-19
**Deciden:** Mao (product owner), asistente AI

## Contexto

M0 es el cimiento del sistema. Las decisiones de stack tomadas acá condicionan
todos los módulos siguientes. Necesitamos:

- Identidad de usuario con sesiones revocables (mejor para auditoría)
- Autorización declarativa que represente los 4 roles × permisos × alcances
  definidos en `/docs/dominio/roles-y-permisos.md`
- Multi-rol por usuario (RN-ACC-01)
- Custom scope model (`todo` / `propio` / `ruta` / `BODEGA` / read-only)
  aplicado en una sola capa de datos (RN-ACC-03)
- Auditoría inmutable de toda acción sensible (RN-ACC-04)
- Polyrepo: `api/` y `web/` son repos independientes
- Mobile post-MVP (la `api/` debe ser reusable desde una app futura)

## Alternativas evaluadas

### Auth (identidad)

#### Opción A — Supabase Auth
- ✅ Rápido para empezar, gratis hasta cierto umbral
- ✅ Auth + Postgres + Storage en un solo servicio
- ❌ Lock-in alto (migrar después duele)
- ❌ El modelo multi-rol hay que armarlo a mano con tablas custom
- ❌ El scope model (`propio`/`ruta`/`BODEGA`) no es nativo — hay que
  pelearse con RLS o agregar una capa authz encima
- ❌ El usuario (dueño) tendría que confiar la auditoría al panel de Supabase

#### Opción B — Auth0
- ✅ SaaS robusto, mucha documentación
- ✅ Multi-rol posible via Rules/Actions
- ❌ Caro al escalar (precios por MAU + features premium)
- ❌ Lock-in alto (formato de users, rules engine, JWT custom)
- ❌ Auditoría de acciones del sistema debe exportarse para verse en la UI
- ❌ Para una operación chica en Colombia, no tiene sentido económico

#### Opción C — Auth.js (NextAuth) + JWT bridge a api/
- ✅ Open source, gratis, sin lock-in
- ✅ Integración nativa con Next.js (Server Components leen sesión directo)
- ❌ Multi-rol hay que modelarlo a mano (un user con `roles: ["pos","seller"]`)
- ❌ El access control no viene declarativo, hay que escribirlo
- ❌ Si elegimos Next.js full-stack, ok; si web/ y api/ están separados, JWT
  bridge agrega complejidad (firmar/validar, revocación, audience)

#### Opción D — Custom auth + custom authz ← **elegida**
- ✅ Cero lock-in, código en nuestro repo
- ✅ Better-Auth (la librería de auth) tiene soporte nativo de multi-rol
  via admin plugin + createAccessControl declarativo
- ✅ El módulo `authz/` es nuestro — codifica exactamente el scope model
  del doc con la UNA capa de datos (RN-ACC-03)
- ✅ Auditoría 100% bajo nuestro control (RN-ACC-04)
- ✅ `api/` es reusable desde mobile post-MVP sin reescribir auth
- ❌ Más código upfront (~200 líneas para el módulo `authz/`)
- ❌ Somos responsables del mantenimiento de la capa de auth

### Librería de Auth (dentro de Opción D)

#### Lucia v3
- ❌ **Deprecada desde marzo 2025.** El sitio oficial es ahora un recurso
  educativo, no una librería mantenida. Descartada.

#### Better-Auth ← **elegida**
- ✅ Activamente mantenida (v1.3.x en ago-2026, releases frecuentes)
- ✅ Multi-rol nativo via admin plugin (`hasPermission` recorre roles[]
  separados por coma)
- ✅ Access control declarativo: `createAccessControl({ recurso: [acciones] })`
  + `ac.newRole({ recurso: [acciones_concedidas] })`
- ✅ Framework-agnostic, con adapter oficial para Next.js (`toNextJsHandler`)
- ✅ Self-hosted, sin telemetría
- ✅ Tiene el patrón de sesiones con cookies httpOnly (lo que queremos para
  revocación inmediata — mejor que JWT stateless para auditoría)

### Framework backend

#### Express
- ❌ Más lento que Fastify
- ❌ Menos typesafety out-of-the-box

#### Fastify ← **elegido**
- ✅ Más rápido que Express
- ✅ Schema-first (se integra nativo con Zod)
- ✅ Hooks/preHandlers para authz middleware
- ✅ Ecosistema maduro

### ORM

#### Prisma
- ❌ Runtime pesado (query engine binario)
- ❌ Migraciones menos explícitas
- ❌ Menos control sobre las queries

#### Drizzle ← **elegido**
- ✅ TypeScript-first, sin runtime
- ✅ Migraciones SQL explícitas (lo que queremos para `audit_log` append-only)
- ✅ Queries que se ven como SQL (importante para RN-ACC-03 — la UNA capa)
- ✅ Compose-friendly: `scopedQuery()` puede clonar y modificar queries

### Frontend

#### Next.js (App Router) ← **elegido**
- ✅ Server Components leen datos server-side sin exponer API al browser
- ✅ Server Actions para mutaciones (calza con flujos de ventas)
- ✅ Ecosistema enorme, fácil de contratar devs
- ❌ Si quisiéramos SvelteKit/Astro, también sería válido

#### SvelteKit
- Más rápido y liviano que Next, pero mercado laboral más chico en Colombia
- Decidido Next por razones de mercado + ecosistema

### Patrón de comunicación web ↔ api

#### A — Browser → api/ directo con CORS
- Más simple en dev
- Tokens/cookies se exponen al browser
- api/ queda visible en DevTools

#### C — BFF en web/ (web habla a api/ server-to-server) ← **elegido**
- ✅ browser nunca ve api/ directamente
- ✅ CORS no aplica (server-to-server)
- ✅ Un solo lugar para propagar cookies, request_id, auth
- ✅ El helper `apiServerFetch()` codifica el patrón correcto y evita errores
- ❌ Más código en web/ (el helper)
- ❌ Un hop más por request (aceptable)

Justificación extendida y costos: [ADR-0002](/decisiones/0002-bff-pattern).

## Decisión

Stack del M0 (Auth + RBAC):

| Capa | Elección |
|---|---|
| Runtime `api/` | Node.js 22 LTS |
| Framework `api/` | Fastify 5.x |
| ORM | Drizzle 0.45.x |
| DB | Postgres 16 |
| Auth (identidad) | Better-Auth 1.7.x con admin plugin |
| Authz (permisos) | Módulo propio `src/modules/authz/` con `createAccessControl`-style |
| Sesiones | Cookies httpOnly (no JWT stateless) — mejor revocación |
| Hashing | argon2id (`@node-rs/argon2`) via Better-Auth |
| Email (reset) | Resend (prod), Mailpit (dev) |
| Logging | Pino 10.x con `request_id` propagado |
| Validación | Zod 4.x |
| Frontend | Next.js 16 (App Router) + React 19.2 |
| Estilos frontend | Tailwind CSS |
| Tablas/filtros | TanStack Table |
| Patrón | BFF-native (web/ es proxy server-to-server hacia api/) |
| Tests | Vitest 4.x + Supertest (api/) + Testing Library + MSW (web/) |

Las reglas de la matriz viven en código TypeScript (no en DB). Ver
[ADR-0003](/decisiones/0003-roles-permisos-matriz).

### Revisión 2026-08-19 — versiones

La primera redacción de este ADR fijó Node 20, Fastify 4, Better-Auth 1.3,
Next 15, Zod 3 y Vitest 2. Al validar contra el registro de npm **antes** de
escribir la primera línea de código, todas estaban una línea mayor por detrás
del stable vigente.

**Qué cambió:** solo los números de versión. Ninguna elección de herramienta se
revirtió — sigue siendo Fastify, Drizzle, Better-Auth, Next, y el razonamiento
de este ADR se mantiene íntegro.

**Por qué:** arrancar un proyecto greenfield una major por detrás es deuda
técnica autoinfligida el día uno. El costo de migrar Fastify 4→5 con el código
ya escrito es muchísimo mayor que el de empezar en 5.

**Único reemplazo real:** MailHog → **Mailpit**. MailHog no recibe mantenimiento
desde 2020; Mailpit es su sucesor de facto y cumple el mismo rol (SMTP falso en
dev). Ver [Entorno local](/empezar/entorno-local/).

**Criterio que queda fijado:** las versiones se actualizan **deliberadamente
entre módulos, nunca en medio de uno**. Durante M0 el stack no se mueve.

## Consecuencias

**Se vuelve fácil:**
- Migrar a otro proveedor de DB / hosting — sin lock-in
- Mobile post-MVP reusa `api/` tal cual, sin reimplementar auth
- Auditar todo desde un solo lugar (nuestro `audit_log`)
- Testear la matriz completa en código (cada celda es un test unit)
- Cambiar el scope model sin tocar 50 endpoints — un solo lugar

**Se vuelve difícil / costoso:**
- No tenemos el "panel de Auth0" listo para ver usuarios — hay que
  construir un admin UI mínimo (parte de M0)
- Somos responsables de mantener Better-Auth actualizado y compatible
- El módulo `authz/` es código nuestro — hay que mantenerlo

**Lo que aceptamos pagar:**
- ~200 líneas extra de código vs. usar un SaaS
- Una skill del proyecto + helper module + ESLint rule para evitar
  errores de BFF (esto se amortiza desde el primer día)

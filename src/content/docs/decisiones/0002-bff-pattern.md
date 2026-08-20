---
title: ADR-0002 — Patrón BFF desde M0
description: Web/ actúa como Backend-For-Frontend desde el inicio. El browser nunca habla directo a api/.
---

**Estado:** Aceptado
**Fecha:** 2026-08-19
**Deciden:** Mao (product owner), asistente AI

## Contexto

`api/` y `web/` son proyectos separados (polyrepo decidido previamente). El
browser necesita datos de `api/`. Hay tres formas de cruzar ese borde:

1. **Cookie compartida por dominio**: server setea cookie, browser adjunta
   automáticamente.
2. **Token en header**: web obtiene token, lo adjunta manualmente.
3. **Proxy/BFF**: browser habla a web/, web/ habla a api/ server-to-server.

Mobile post-MVP va a pegar contra `api/` directo. Esto descarta opciones que
duplican auth en mobile.

Los flujos de M0 son pocos (login, forgot, dashboard) pero los módulos M1+
(ventas, stock, clientes) van a tener múltiples endpoints por vista desde el
primer día, así que el patrón que elijamos se mantiene por años.

## Alternativas evaluadas

### A — Auth en api/, browser habla directo con CORS

```
Browser → api/  (fetch con credentials: include)
```

- ✅ Setup inicial más simple
- ✅ web/ no tiene código de reenvío
- ❌ CORS se complica en dev (cross-origin cookies)
- ❌ api/ queda visible en DevTools
- ❌ Cada llamada a api/ tiene que manejar CORS preflight
- ❌ Migrar a BFF después = reescribir todos los fetch del frontend

### B — Auth en web/, JWT firmado para api/

```
Web (Next.js) → firma JWT → api/ valida
```

- ✅ Integración Next.js nativa (Server Components leen sesión)
- ✅ Sin cross-origin en dev
- ❌ Auth duplicado cuando llegue mobile
- ❌ JWT revocation requiere denylist (lo que hace que tengas estado igual
  que sesiones, sin las ventajas)
- ❌ El scope model del RBAC vive en api/ — el JWT tiene que llevar los
  roles y scopes, lo que crece el token

### C — Auth en api/, BFF en web/ ← **elegida**

```
Browser → web/ (Server Component) → api/ (server-to-server)
                                  ← (reenvía cookies)
```

- ✅ Single source of truth de identidad (api/)
- ✅ Mobile post-MVP usa api/ directo sin reescribir auth
- ✅ Sin CORS (server-to-server no aplica)
- ✅ api/ queda invisible al browser
- ✅ Un solo lugar para propagar cookies, request_id, auth headers
- ❌ Más código en web/ (el helper)
- ❌ Un hop más por request (~5-50ms)

## Decisión

**Patrón BFF-native desde M0.** `web/` actúa como Backend-For-Frontend: el
browser solo habla a `web/`, y `web/` habla a `api/` server-to-server usando
el helper único `apiServerFetch()`.

```ts
// web/src/lib/api-server.ts (única forma de hablar a api/)
export async function apiServerFetch<T>(path: string, init: RequestInit = {}): Promise<T>
export async function getServerUser(): Promise<User | null>
```

**Reglas codificadas en el helper:**
- SIEMPRE reenvía cookies del browser (`cookies()` → `Cookie` header)
- SIEMPRE propaga `x-request-id` para tracing distribuido
- SIEMPRE `cache: 'no-store'` por default (datos de sesión no se cachean)
- Logging estructurado en cada error

**Defensa en profundidad en 3 capas:**

| Capa | Protege contra | Cuándo actúa |
|---|---|---|
| **Skill del proyecto** (`aquazaku-bff`) | LLM (asistente AI) olvidando el patrón | Antes de generar código |
| **Helper module** (`apiServerFetch`) | Cualquier dev escribiendo código que bypassee el patrón | En desarrollo |
| **ESLint rule** custom | `fetch()` directo o `localStorage` | Pre-commit / CI |

```json
// web/.eslintrc.json
{
  "no-restricted-syntax": [
    "error",
    { "selector": "CallExpression[callee.name='fetch']",
      "message": "Use apiServerFetch() from @/lib/api-server instead of fetch() directly. See /docs/frontend/bff-pattern.md" },
    { "selector": "MemberExpression[object.name='localStorage']",
      "message": "No tokens in localStorage. Use httpOnly cookies only." }
  ]
}
```

Documentación para devs: [`/frontend/bff-pattern.md`](/frontend/bff-pattern).

## Consecuencias

**Se vuelve fácil:**
- Agregar agregación de múltiples endpoints en una página (Server
  Components hacen fetch paralelos automáticamente, deduplicado)
- Tracing distribuido entre web/ y api/ via `request_id`
- Migrar a un cliente pesado (mobile, CLI) sin tocar api/
- Cambiar la estrategia de auth sin tocar mobile ni web/ (solo api/)

**Se vuelve difícil / costoso:**
- ~100 líneas extra de helper module
- Hay que mantener la skill del proyecto actualizada
- Un hop más por request (~5-50ms) — aceptable para la escala de M0
- Dev local necesita CORS resuelto entre puertos (se hace una vez con
  Caddy o `.localhost`)

**Lo que aceptamos pagar:**
- Más código upfront vs. empezar con browser → api/ directo
- La inversión se paga cuando M5+ tiene dashboards con 5+ calls por vista

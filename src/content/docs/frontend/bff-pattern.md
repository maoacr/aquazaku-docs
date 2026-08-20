---
title: Patrón BFF (Backend-For-Frontend)
description: Cómo web/ habla a api/ server-to-server. Convenciones, helper, lint rule, anti-patrones.
sidebar:
  order: 3
---

`web/` (Next.js) actúa como Backend-For-Frontend: **el browser nunca habla
directo a `api/`**. Toda la comunicación pasa por un helper único en web/ que
reenvía cookies, propaga `request_id` y nunca cachea datos de sesión.

Justificación arquitectónica: [ADR-0002](/decisiones/0002-bff-pattern).

## El helper: `apiServerFetch`

**Único punto de contacto con `api/`.** Si necesitás datos de backend, usás
este helper. Si pensás en usar `fetch` directo, no.

```ts
// web/src/lib/api-server.ts

import { cookies, headers } from 'next/headers'

const API_URL = process.env.API_INTERNAL_URL!  // ej: http://api:3001 en docker

export async function apiServerFetch<T>(
  path: string,
  init: RequestInit = {}
): Promise<T> {
  const cookieStore = await cookies()
  const headerStore = await headers()

  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      ...init.headers,
      // SIEMPRE reenvía cookies del browser
      Cookie: cookieStore.toString(),
      // SIEMPRE propaga request_id para tracing distribuido
      'x-request-id': headerStore.get('x-request-id') ?? crypto.randomUUID(),
    },
    cache: init.cache ?? 'no-store',  // nunca cachear datos de sesión
  })

  if (!res.ok) {
    logger.error({ status: res.status, path }, 'apiServerFetch failed')
    throw new ApiError(res.status, await res.text())
  }

  return res.json()
}

// Helper específico: "dame el usuario actual"
export async function getServerUser(): Promise<User | null> {
  try {
    return await apiServerFetch<User>('/auth/me')
  } catch (e) {
    if (e instanceof ApiError && e.status === 401) return null
    throw e
  }
}
```

### El header `Origin` no es opcional

Better-Auth responde **403 `MISSING_OR_NULL_ORIGIN`** a toda petición que cambie
estado y llegue sin header `Origin`. Es una defensa contra CSRF y está bien que
exista.

El problema: `fetch` del lado del servidor **no manda `Origin`** — no hay
documento que origine la petición. Así que el helper lo declara explícitamente,
con el valor de `WEB_PUBLIC_URL`, que `api/` ya tiene en sus `trustedOrigins`.

:::danger[Este bug rompió todo el login y ningún test lo vio]
Se descubrió recién al correr los dos servidores juntos y entrar por el browser.

- Los tests de `api/` usan `app.inject()`, que **no dispara** el chequeo de origen.
- Los tests de `web/` **mockean `fetch`**, así que nunca sale una petición real.
- `curl` sin `Origin` devolvía **200**, porque omite otros headers que disparan
  el chequeo y además descarta los headers vacíos.

Los dos repos en verde, el sistema sin funcionar. **El bug vivía exactamente en
la costura entre ambos**, que es el único lugar que ninguna suite unitaria mira.

Moraleja para el resto de M0 y para M1+: una task no está terminada porque sus
tests pasen. Está terminada cuando se la vio funcionar de punta a punta.
:::

La solución correcta fue **declarar el origen real**, no desactivar el chequeo en
`api/`. Apagar la validación resolvía el síntoma tirando abajo una protección
legítima. Y `Origin` se manda **solo el origen**, sin path ni query: un
`Origin: https://app.aquazaku.com/algo` no matchea contra `trustedOrigins` y
devuelve el mismo 403 por otra causa.

## Convenciones

### En Server Components

```tsx
// ✅ CORRECTO
import { getServerUser } from '@/lib/api-server'

export default async function DashboardPage() {
  const user = await getServerUser()
  if (!user) redirect('/login')

  const ventas = await apiServerFetch<Venta[]>('/ventas/hoy')
  return <DashboardUI user={user} ventas={ventas} />
}
```

### En Server Actions (mutaciones)

```tsx
// ✅ CORRECTO
'use server'

export async function cambiarPassword(formData: FormData) {
  const newPassword = formData.get('password') as string
  await apiServerFetch('/auth/change-password', {
    method: 'POST',
    body: JSON.stringify({ password: newPassword }),
    headers: { 'Content-Type': 'application/json' },
  })
  // ...
}
```

### En Route Handlers (proxy a api/)

Solo si necesitás exponer un endpoint desde web/. Raro.

```ts
// ✅ CORRECTO (caso edge)
import { apiServerFetch } from '@/lib/api-server'

export async function GET() {
  const data = await apiServerFetch('/algo')
  return Response.json(data)
}
```

## Anti-patrones (NO hacer)

❌ **`fetch` directo** a api/ desde un Server Component:

```tsx
// ❌ MAL — bypassa el helper, no propaga cookies ni request_id
const res = await fetch('http://api:3001/ventas')
```

❌ **`fetch` con URL hardcodeada**:

```tsx
// ❌ MAL — usa siempre API_INTERNAL_URL
const res = await fetch('http://localhost:3001/auth/me')
```

❌ **Tokens en `localStorage`**:

```tsx
// ❌ MAL — tokens solo en cookies httpOnly
localStorage.setItem('token', jwt)
```

❌ **Cachear datos de sesión**:

```tsx
// ❌ MAL — datos de sesión NUNCA se cachean
const data = await apiServerFetch('/ventas', { cache: 'force-cache' })
```

❌ **Confiar en la respuesta sin chequear status**:

```tsx
// ❌ MAL — si api/ devolvió 500, .json() puede fallar silenciosamente
const data = await (await fetch(...)).json()
```

## Defensa en profundidad

Tres capas se complementan. Si una falla, las otras atrapan:

| Capa | Qué atrapa | Cómo se configura |
|---|---|---|
| **Skill del proyecto** | LLM (asistente AI) que olvida el patrón | `.claude/skills/aquazaku-bff/SKILL.md` en el repo paraguas |
| **Helper module** | Dev que escribe código que bypassee | El único export para hablar a api/ |
| **ESLint rule** | `fetch` directo o `localStorage` en código | `web/eslint.config.mjs` (ver abajo) |

### ESLint rule

ESLint 9 usa **flat config**. El archivo lo genera `create-next-app` y se
extiende, no se reemplaza:

```js
// web/eslint.config.mjs — se agrega al array existente
{
  rules: {
    'no-restricted-syntax': [
      'error',
      {
        selector: "CallExpression[callee.name='fetch']",
        message:
          'Usá apiServerFetch() de @/lib/api-server en vez de fetch() directo. Ver /frontend/bff-pattern/.',
      },
      {
        selector: "MemberExpression[object.name='localStorage']",
        message: 'Nada de tokens en localStorage. Solo cookies httpOnly.',
      },
      {
        selector: "MemberExpression[object.name='sessionStorage']",
        message: 'Nada de tokens en sessionStorage. Solo cookies httpOnly.',
      },
    ],
  },
},
```

El helper es el único lugar donde `fetch()` es legítimo, así que lleva su
excepción — si no, la regla se muerde la cola:

```js
{
  files: ['src/lib/api-server.ts'],
  rules: { 'no-restricted-syntax': 'off' },
},
```

Si tu build falla con este error, **es para bien** — te está protegiendo de
un bug que se manifiesta en producción, no en dev.

## Tracing distribuido

El helper genera o propaga un `x-request-id` en cada request. api/ lo lee y lo
agrega a cada log line. Para correlacionar logs entre web/ y api/:

```bash
# Buscar todas las acciones de un usuario específico
grep "x-request-id: 550e8400-e29b-41d4-a716" logs/

# O filtrar por correlation_id en el dashboard de logs
```

## Errores comunes

### "Mi Server Component no recibe datos"

Probablemente te falta reenviar cookies. Verificá que el helper use
`cookies().toString()` y que el browser realmente esté enviando cookies (chequear
DevTools → Application → Cookies).

### "api/ responde 401 pero estoy logueado"

Dos causas comunes:
1. El helper no reenvió cookies (raro si usás el helper — es bug en él)
2. El browser no tiene la cookie (sesión expirada, o dominio cruzado)

### "El log de api/ no muestra el request_id"

El helper lo está propagando — api/ necesita leerlo y agregarlo al contexto
del log. Ver `api/src/lib/logger.ts`.

## Resumen en una línea

> **En web/, si necesitás datos de api/, usá `apiServerFetch()`. Nada más.**

# M0 — Auth + RBAC: Diseño

**Fecha:** 2026-08-19
**Estado:** Draft para revisión
**Módulo:** M0 del [Roadmap Aquazaku](/arquitectura/roadmap/)
**Autores:** Mao (product owner) + AI (asistente de diseño)

---

## 1. Contexto

M0 es el cimiento del sistema Aquazaku. Gates todos los demás módulos (M1+). Sin auth y RBAC sólidos, no se puede construir nada que dependa de identidad o permisos.

El sistema modela 4 roles (`admin`, `seller`, `pos`, `contador`) con multi-rol por usuario (RN-ACC-01), un sistema de alcances por recurso (`todo`, `propio`, `ruta`, `BODEGA`, `read-only`) y auditoría inmutable de toda acción sensible (RN-ACC-04).

Las reglas de negocio que este módulo implementa están definidas en [`/docs/dominio/roles-y-permisos.md`](/dominio/roles-y-permisos/) (RN-ACC-01 a 05). Este spec describe **cómo** se implementan, no redefine el **qué**.

## 2. Objetivos

1. Identidad de usuarios (email + password, sesión httpOnly)
2. Autorización declarativa (matriz 4 roles × permisos × scopes, en código)
3. Aplicación de alcance en UNA capa de datos (RN-ACC-03)
4. Auditoría automática de cada check (allow/deny) y de acciones sensibles (RN-ACC-04)
5. UI consultable de la auditoría (admin + contador)
6. Defense in depth: UI oculta + API prohíbe (RN-ACC-02)

## 3. Fuera de alcance (M0)

- Tablas de productos, stock, ventas, clientes → M1+
- State machine completa de ventas (pendiente → verificado) → M2
- Módulo `/admin/cuentas-pendientes` (gestión de pendientes de pago) → M2
- Job nocturno de ventas vencidas → M2
- Exportación PDF de auditoría → M13
- Analítica / alertas automáticas → M13
- App mobile del seller → post-MVP
- OAuth / SSO / 2FA → post-MVP
- Internacionalización → post-MVP

## 4. Decisiones arquitectónicas

| Decisión | ADR |
|---|---|
| Custom auth + custom authz (no Supabase, no Auth0) | [ADR-0001-stack-m0](/decisiones/0001-stack-m0) |
| Better-Auth como librería de auth (Lucia v3 está deprecada desde marzo 2025) | [ADR-0001-stack-m0](/decisiones/0001-stack-m0) |
| Polyrepo: `api/` y `web/` separados,，各自各自的git repo | Estrategia ya decidida (ver memoria) |
| BFF-native desde M0: web/ hace de proxy server-to-server hacia api/ | [ADR-0002-bff-pattern](/decisiones/0002-bff-pattern) |
| Sesiones via cookies httpOnly (no JWT stateless) — mejor revocación para auditoría | [ADR-0001-stack-m0](/decisiones/0001-stack-m0) |
| Multi-rol sin switch: todos los roles asignados activos simultáneamente | [ADR-0003-roles-permisos-matriz](/decisiones/0003-roles-permisos-matriz) |
| Matriz de permisos en TypeScript (no en DB) — regla de negocio pura | [ADR-0003-roles-permisos-matriz](/decisiones/0003-roles-permisos-matriz) |
| Defense in depth: skill del proyecto + helper module + ESLint rule | [ADR-0002-bff-pattern](/decisiones/0002-bff-pattern) |

## 5. Stack

### `api/` (Fastify backend)

| Capa | Elección |
|---|---|
| Runtime | Node.js 22 LTS |
| Framework HTTP | Fastify 5.x |
| ORM | Drizzle 0.45.x |
| DB | Postgres 16 |
| Auth | Better-Auth 1.7.x |
| Validación | Zod 4.x |
| Email | Resend (prod), Mailpit (dev) |
| Logging | Pino 10.x |
| Tests | Vitest 4.x + Supertest |
| Hashing password | argon2id (`@node-rs/argon2`, vía Better-Auth) |

### `web/` (Next.js frontend)

| Capa | Elección |
|---|---|
| Framework | Next.js 16.x (App Router) |
| UI | React 19.2 |
| Estilos | Tailwind CSS |
| Componentes | Headless UI + custom |
| Tablas / filtros | TanStack Table |
| Validación | Zod 4.x |
| Tests | Vitest 4.x + Testing Library + MSW |

> **Nota de versiones (corrección 2026-08-19).** La primera redacción de este spec
> fijaba Node 20, Fastify 4, Better-Auth 1.3 y Next 15. Al validar contra el
> registro de npm antes de implementar, todas estaban una línea mayor por detrás
> del stable actual. Para un proyecto greenfield eso es deuda técnica
> autoinfligida el día uno, así que se sube al stable vigente. El criterio queda
> fijado: **se actualiza deliberadamente entre módulos, nunca en medio de uno.**
>
> Setup de la máquina en [Entorno local](/empezar/entorno-local/).

## 6. Modelo de datos

Solo las tablas de M0. Las de M1+ se agregan en sus respectivos módulos.

```
┌─────────────────────────────────┐
│ users                           │
├─────────────────────────────────┤
│ id            uuid PK           │
│ email         citext UNIQUE     │
│ password_hash text              │
│ name          text              │
│ status        enum(active,      │
│                       inactive) │
│ must_change_  bool default true │
│   password                      │
│ created_at    timestamptz       │
│ updated_at    timestamptz       │
└─────────────────────────────────┘
                ▲
                │ 1:N
                │
┌─────────────────────────────────┐
│ sessions (Better-Auth managed)  │
├─────────────────────────────────�
│ id            text PK (token)   │
│ user_id       uuid FK → users   │
│ roles         text[] (todos los │
│                       activos)  │
│ expires_at    timestamptz       │
│ ip            inet              │
│ user_agent    text              │
│ created_at    timestamptz       │
└─────────────────────────────────┘

┌─────────────────────────────────┐
│ roles (catálogo)                │
├─────────────────────────────────┤
│ name        text PK             │
│   ('admin', 'seller', 'pos',   │
│    'contador')                  │
│ description text                │
│ created_at  timestamptz         │
└─────────────────────────────────┘
                ▲
                │ N:M
                │
┌─────────────────────────────────┐
│ user_roles                      │
├─────────────────────────────────�
│ user_id     uuid FK → users     │
│ role_name   text FK → roles     │
│ granted_at  timestamptz         │
│ granted_by  uuid FK → users     │
│ PK (user_id, role_name)         │
└─────────────────────────────────┘

┌─────────────────────────────────┐
│ audit_log (INMUTABLE)           │
├─────────────────────────────────┤
│ id            bigserial PK      │
│ user_id       uuid              │
│ rol_ejercido  text[]            │
│ action        text              │
│ resource      text              │
│ resource_id   text              │
│ result        enum(ok, denied)  │
│ request_id    uuid              │
│ ip            inet              │
│ user_agent    text              │
│ payload       jsonb             │
│ created_at    timestamptz       │
│                                 │
│ REVOKE UPDATE, DELETE ON        │
│   audit_log FROM app_user       │
│ + trigger que rechaza mutations │
└─────────────────────────────────┘
```

**Multi-rol:** un usuario tiene N roles en `user_roles`. `sessions.roles` se llena al login con todos los roles del usuario. NO existe `active_role` ni switch. Todos los roles asignados están activos simultáneamente.

## 7. Flujos de autenticación

### 7.1 Login normal

```
Browser → web/login (RSC renderiza form)
       → form submit → Server Action
       → Server Action llama api/auth/sign-in vía apiServerFetch()
       → Better-Auth valida password, chequea status=active
       → crea session con roles[] del usuario
       → devuelve Set-Cookie: aquazaku_session
       → Server Action propaga Set-Cookie al browser response
       → 302 redirect a /dashboard
```

### 7.2 Primer login (must_change_password=true)

Después del login normal, web/ chequea `user.must_change_password`:
- Si `true` → redirect forzado a `/change-password` (no se puede skipear)
- Form → Server Action → `api/auth/change-password` → actualiza hash + flag → redirect a `/dashboard`

### 7.3 Forgot password

1. `/login` → "¿Olvidaste tu contraseña?" → `/forgot-password`
2. Form con email → Server Action → `api/auth/forgot-password`
3. api/ genera token (1h expiry), guarda, envía email via Resend
4. Email contiene link: `https://web.aquazaku.com/reset-password?token=xxx`
5. User clickea → form con nueva password → Server Action → `api/auth/reset-password`
6. api/ valida token, actualiza password, borra token usado
7. Redirect a `/login` con toast

### 7.4 Logout

1. Click "Cerrar sesión" → Server Action
2. `api/auth/sign-out` → borra session en DB
3. Web limpia cookie en response
4. Redirect a `/login`

### 7.5 Expiración / desactivación

- Cookie expira en 7 días (refresh on use → sliding window)
- api/ chequea `user.status === 'active'` en cada request
- Sesión expirada o user inactivo → 401 con código específico
- Web detecta 401 → redirect a `/login?toast=sesion-expirada` o `?toast=cuenta-desactivada`

## 8. Módulo `authz/` — RBAC

### 8.1 Estructura

```
api/src/modules/authz/
├── matrix.ts          # PERMISSION_MATRIX: Record<Role, PermissionRule[]>
├── scopes.ts          # SCOPES: Record<Scope, ScopeFilter>
├── can.ts             # can(user, resource, action): boolean
├── scoped-query.ts    # scopedQuery(user, baseQuery, resource, action)
├── middleware.ts      # requireAuth, requirePermission(resource, action)
└── audit.ts           # audit.allow / audit.deny
```

### 8.2 Sistema de scopes

| Scope | Filtro aplicado |
|---|---|
| `todo` | Sin filtro |
| `propio` | `WHERE created_by = $user.id` |
| `ruta` | `WHERE ruta_id IN $user.activeRutas` |
| `BODEGA` | `WHERE ubicacion = 'BODEGA'` |
| `read-only` | Sin filtro de datos (readonly se enforce en otra capa) |

### 8.3 `can(user, resource, action)`

Devuelve `true` si **cualquiera** de los roles del usuario concede el permiso (unión, sin switch). Sin estado mutable, sin caché, función pura testeable.

### 8.4 `scopedQuery(user, baseQuery, resource, action)`

La UNA capa que aplica el filtro de alcance (RN-ACC-03). Si el usuario tiene el scope `todo` desde cualquier rol, no aplica filtro. Si tiene `propio` y `BODEGA` (multi-rol), aplica la **unión** (registros que cumplan cualquiera).

### 8.5 Middleware Fastify

```ts
fastify.get('/api/ventas', {
  preHandler: [requireAuth, requirePermission('ventas', 'ver')],
}, async (req) => {
  const query = scopedQuery(req.user, db.select().from(ventas), 'ventas', 'ver')
  return query
})
```

`requirePermission` registra en `audit_log` cada allow y deny.

### 8.6 Constraints de negocio (NO son authz)

`mismo_dia`, `con_motivo`, `cliente_verificado`, `cantidades` — viven en la capa de servicio del módulo correspondiente (ej: `ventas/service.ts`). `authz/` solo decide SI PUEDO; el servicio decide SI APLICA.

## 9. Patrón BFF (Backend-For-Frontend)

Web es un proxy server-to-server hacia api/. El browser nunca habla directo a api/. Ver [ADR-0002-bff-pattern](/decisiones/0002-bff-pattern) para la justificación completa.

### 9.1 Helper único

```ts
// web/src/lib/api-server.ts
export async function apiServerFetch<T>(path: string, init: RequestInit = {}): Promise<T>
export async function getServerUser(): Promise<User | null>
```

**Reglas codificadas en el helper:**
- SIEMPRE reenvía cookies del browser (`cookies()` → `Cookie` header)
- SIEMPRE propaga `x-request-id` para tracing distribuido
- SIEMPRE `cache: 'no-store'` por default (datos de sesión no se cachean)
- Logging estructurado en cada error

### 9.2 ESLint rule

Regla custom que falla el build si alguien usa `fetch()` directo o `localStorage`:

```json
{
  "no-restricted-syntax": [
    "error",
    { "selector": "CallExpression[callee.name='fetch']", "message": "Use apiServerFetch() from @/lib/api-server instead of fetch() directly. See /docs/frontend/bff-pattern.md" },
    { "selector": "MemberExpression[object.name='localStorage']", "message": "No tokens in localStorage. Use httpOnly cookies only." }
  ]
}
```

### 9.3 Skill del proyecto

Un skill que el LLM (asistente de código) consulta antes de escribir código BFF. Contiene: patrón correcto, anti-patrones, reglas de caching, convenciones de logging, estructura del helper.

**Estado: creado** en `.claude/skills/aquazaku-bff/SKILL.md` del repo paraguas (`/Users/mao/code/aquazaku`). Vive ahí y no en `web/` porque el repo paraguas es el directorio de trabajo de las sesiones de asistente y aloja lo transversal; así el skill carga aunque se esté editando `api/` o `web/`. No duplica contenido: apunta a [`/frontend/bff-pattern`](/frontend/bff-pattern/), que es la fuente de verdad.

## 10. Matriz de permisos — versión final

Las celdas marcadas ⚠️ en [`/docs/dominio/roles-y-permisos.md`](/dominio/roles-y-permisos/) quedan así:

| Permiso | `admin` | `seller` | `pos` | `contador` |
|---|---|---|---|---|
| `ventas:anular` | ✅ todo | 🟡 propio + status=pendiente | 🟡 propio + status=pendiente | ❌ |
| `ventas:anular_verificada` | ✅ todo (motivo obligatorio) | ❌ | ❌ | ❌ |
| `ventas:verificar_pago` | ✅ todo | 🟡 propio | 🟡 propio | ❌ |
| `ventas:gestionar_cuentas_pendientes` | ✅ todo | ❌ | ❌ | ❌ |
| `stock:cargar_ruta` | ✅ todo | ❌ | ✅ todo | ❌ |
| `bases:prestar` | ✅ todo | ❌ | ✅ con cliente verificado | ❌ |
| `compras:recibir` | ✅ todo | ❌ | ✅ si compra=pendiente y proveedor=activo | ❌ |
| `auditoria:ver` | ✅ todo | ❌ | ❌ | ✅ todo (readonly) |

**El resto de la matriz** (las celdas que no estaban ⚠️) se transcribe 1-a-1 desde `/docs/dominio/roles-y-permisos.md` al `PERMISSION_MATRIX` en código.

## 11. State machine de ventas (forward-looking)

Documentada para que M2 la implemente, no es parte de M0:

```
registrada
  ├─ pago total  →  pendiente_verificacion_pago (+ payment_method)
  └─ pago parcial →  pago_parcial_verificado (+ saldo_pendiente)
                          ↓ (cliente paga saldo)
                    pago_verificado
                          ↓ (admin anula con motivo)
                    anulada_con_devolucion

(>7 días sin verificar)
  pendiente_verificacion_pago → vencida (+ alerta al admin)
```

**Constraints adicionales que M2 deberá implementar:**
- `payment_method`: enum(efectivo, transferencia, cuenta_bajo_monto)
- `verified_by`: quién confirmó el pago (puede ser el mismo registrador o admin)
- `verified_at`: timestamp
- `saldo_pendiente`: calculado automáticamente
- Vencimiento: job nocturno marca `vencida` después de 7 días

## 12. Estrategia de testing

| Componente | Coverage mínimo | Tipo de test |
|---|---|---|
| `authz/matrix.ts` | 100% | Unit (cada celda) |
| `authz/can.ts` | 100% | Unit (multi-rol, sin roles, etc.) |
| `authz/scoped-query.ts` | 100% | Unit (cada scope, combinaciones) |
| `authz/middleware.ts` | 95% | Unit + integration |
| `auth/*` | 80% | Integration (Supertest) |
| `audit/*` | 90% | Unit + integration |
| `web/lib/api-server.ts` | 90% | Unit |
| `web/lib/modules.ts` | 90% | Unit |
| **Global** | **70%** | — |
| **authz/** (consolidado) | **85%** | — |

**TDD-first:** tests se escriben antes que la implementación. CI falla si coverage baja del threshold.

**Tests críticos end-to-end:**
- Login flow completo
- Forgot-password flow completo
- Must-change-password flow completo
- 401 cuando sesión expira
- 403 cuando rol no tiene permiso (seller intenta `usuarios:*`)
- Audit log se escribe en cada allow/deny
- Admin desactiva user → próximo request del user → 401 USER_INACTIVE
- User multi-rol ve módulos de ambos roles en sidebar

## 13. Seed y deploy

### 13.1 Seed script (`api/drizzle/seed.ts`)

Crea idempotentemente:
1. Las 4 filas en `roles` (admin, seller, pos, contador)
2. El primer usuario admin desde env vars:
   ```
   SEED_ADMIN_EMAIL=admin@aquazaku.com
   SEED_ADMIN_NAME="Admin Inicial"
   SEED_ADMIN_PASSWORD=<password fuerte>
   ```
3. Asigna rol `admin` al usuario creado

**Seguridad:**
- En `NODE_ENV=production`, requiere `SEED_CONFIRM=yes` para correr
- Si ya existe algún usuario con rol `admin`, abort con mensaje claro
- En dev corre sin confirmación

### 13.2 Primer deploy

1. Aplicar migrations Drizzle (`pnpm db:migrate`)
2. Configurar env vars con passwords fuertes
3. Correr seed: `SEED_CONFIRM=yes pnpm db:seed`
4. Login con el admin inicial, cambiar contraseña
5. Crear resto de usuarios desde `/admin/usuarios`

## 14. Archivos a crear

Ver estructura completa en sección 4 del diseño presentado al usuario (pre-spec). Resumen:

**`api/`** (~25 archivos): server.ts, db/, modules/auth/, modules/users/, modules/audit/, modules/authz/, lib/

**`web/`** (~20 archivos): app/(auth)/*, app/(app)/*, lib/api-server.ts, lib/modules.ts, components/, .eslintrc con regla custom

**`docs/`** (actualizaciones):
- `/arquitectura/modulos.md` → M0 pasa de "por arrancar" a ✅
- `/dominio/roles-y-permisos.md` → actualizar tabla con la matriz resuelta
- `/frontend/bff-pattern.md` (nuevo) → cómo se usa el helper BFF
- `/decisiones/0001-stack-m0.md` (nuevo)
- `/decisiones/0002-bff-pattern.md` (nuevo)
- `/decisiones/0003-roles-permisos-matriz.md` (nuevo)

**Skill del proyecto**: `aquazaku-bff` en `.claude/skills/` del repo paraguas, con las reglas duras para el LLM. Ya creado.

## 15. Criterios de éxito (Definition of Done de M0)

- [ ] Un admin puede crear usuarios y asignar roles desde la UI
- [ ] Un usuario con 1 rol ve solo los módulos de ese rol
- [ ] Un usuario multi-rol ve los módulos de todos sus roles (sin switch)
- [ ] Cualquier intento de acción sin permiso devuelve 403 y queda en audit_log
- [ ] Cualquier acción sensible (anular venta, ajustar stock, prestar base) queda registrada con `user_id`, `rol_ejercido[]`, `request_id`, timestamp
- [ ] `audit_log` es append-only: triggers rechazan UPDATE y DELETE
- [ ] La UI de auditoría en `/admin/auditoria` y `/contador/auditoria` muestra el log con filtros y paginación
- [ ] Forgot-password funciona end-to-end (email llega, link funciona, password se cambia)
- [ ] Primer login fuerza cambio de contraseña
- [ ] Admin puede desactivar un usuario y este pierde acceso en el siguiente request
- [ ] ESLint rule falla el build si alguien intenta `fetch()` directo en web/
- [ ] Coverage: `authz/` ≥ 85%, global ≥ 70%
- [ ] CI pasa (lint + typecheck + tests + coverage)
- [ ] Seed funciona en dev sin confirmación; en prod requiere `SEED_CONFIRM=yes`

## 16. Preguntas abiertas / riesgos

| # | Pregunta | Estado |
|---|---|---|
| 1 | ¿El doc `/docs/dominio/roles-y-permisos.md` necesita revisión formal con Aquazaku para confirmar la matriz resuelta? | Pendiente — se confirma al inicio de M2 |
| 2 | ¿`seller` alguna vez tendrá acceso web (vs solo mobile)? | Documentado como "respaldo, no superficie de trabajo" — no se usa en M0 |
| 3 | ¿Necesitamos refresh tokens o sliding window de cookie es suficiente? | Decidido: sliding window en M0, refresh tokens en post-MVP si hace falta |
| 4 | ¿Qué hacer si el email provider (Resend) cae? | M0: fail gracefully, mostrar mensaje en UI; post-MVP: queue de retry |
| 5 | ¿Rate limit en producción necesita Redis o memoria basta? | M0: memoria por instancia (suficiente para 1 server); M5+: Redis cuando escale |

---

**Próximo paso:** una vez aprobado este spec, invocar la skill `writing-plans` para descomponer M0 en tasks de implementación.

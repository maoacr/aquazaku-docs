---
title: Spec de preview environments
description: Una sola base Supabase Free con dos schemas de Postgres (`public` y `preview`), separación por `search_path` según `AQUAZAKU_ENV`, y un staging environment persistente en Railway que comparten todas las PRs de Vercel. Cero costo extra, cero dominios nuevos.
---

**Estado:** 📝 Diseñado — listo para escribir el plan de implementación.

---

## Por qué este spec existe

Hoy, desarrollar en Aquazaku sin tocar producción requiere docker-compose local. No hay preview environments por PR: cualquier cambio mergeado a `main` ya está en producción. Eso funciona mientras los cambios son chicos y se revisan con cuidado, pero **bloquea probar cosas sin riesgo** — crear usuarios de prueba, cargar insumos, validar migraciones antes de un merge.

**Lo que se necesita**: poder abrir una PR y tener una URL donde la API y la base de datos sean **distintas de producción**, sin pagar Supabase Pro ni agregar un dominio custom.

---

## La decisión

**Una sola base Supabase Free con dos schemas de Postgres: `public` para producción y `preview` para no-prod.** La separación vive en `search_path`, seteado por una variable de entorno nueva.

```
                    PR abierto a main
                          │
            ┌─────────────┴─────────────┐
            ▼                           ▼
   Vercel Preview              Railway (env: staging)
   AQUAZAKU_ENV=preview        AQUAZAKU_ENV=preview
            │                           │
            └─────────────┬─────────────┘
                          ▼
              api.staging.aquazaku.com
                          │
                          ▼
              Supabase (proyecto único)
              ┌─────────┴─────────┐
              ▼                   ▼
      schema "public"      schema "preview"
      (datos prod)         (datos dev/PR)
```

**Por qué schema de Postgres y no tablas espejo con sufijo `_development`**: porque Postgres resuelve `FROM ventas` al schema correcto sin tocar una sola query. Renombrar 27 tablas (`ventas` → `ventas_development`) duplica cada JOIN, cada FK, cada GRANT/REVOKE y cada migración. Con schema, una declaración de Drizzle sirve para los dos.

**Por qué `search_path` y no dos connection strings separados**: porque Better Auth respeta `search_path` automáticamente — sus tablas (`user`, `session`, `account`, `verification`) caen en el schema actual sin cambios. Y porque el código de la API no tiene que saber en qué ambiente está: sigue diciendo `from(ventas)` y Postgres resuelve.

**Por qué un solo staging en Railway y no PR Environments por PR**: porque Vercel no sabe automáticamente qué URL de Railway le corresponde a cada PR — solo se puede hacer con un wildcard domain custom. Un staging estable al que apuntan todos los previews cubre el 90% del caso con cero glue entre Vercel y Railway.

---

## Detección de ambiente

Variable nueva: `AQUAZAKU_ENV` ∈ `{production, preview, development}`.

| Ambiente | `AQUAZAKU_ENV` | `search_path` | Quién lo setea |
|----------|----------------|---------------|----------------|
| Local (`pnpm dev`) | `development` | `public` | `.env` |
| Vercel prod | `production` | `public` | Vercel env var |
| Vercel preview | `preview` | `preview` | Vercel env var |
| Railway prod | `production` | `public` | Railway env var |
| Railway staging | `preview` | `preview` | Railway env var |

**Default**: si no se setea, vale `production`. Esto evita romper deploys que no setean la variable.

El pool de Postgres se crea con `connection: { search_path: <derivado> }`. La derivación:

```
AQUAZAKU_ENV=production  → search_path=public
AQUAZAKU_ENV=preview     → search_path=preview
AQUAZAKU_ENV=development → search_path=public
```

> **Nota de implementación (7-sep-2026):** `postgres.js` v3.4.9 — el driver instalado — no acepta un campo top-level `options` (esa sintaxis es de `node-postgres`/`pg-promise`, libpq). Los parámetros de arranque, incluido `search_path`, van bajo `connection` como key/value. Ver `postgres/src/connection.js:996`.

`api/src/lib/env.ts` valida `AQUAZAKU_ENV` con Zod. Si está mal o falta en producción, el proceso muere con mensaje claro (igual que el resto del entorno).

---

## Migraciones

**El problema**: las migraciones generadas por Drizzle Kit incluyen `"public"."ventas"` literal — no se pueden correr contra `preview` sin cambio.

**La solución**: reescribir con `sed` antes de aplicar al schema no-prod.

```bash
# Aplica una migración a un schema específico
pnpm db:migrate --schema=preview
# por dentro:
#   1. CREATE SCHEMA IF NOT EXISTS preview
#   2. GRANT USAGE, CREATE ON SCHEMA preview TO aquazaku
#   3. cat migrations/*.sql | sed 's/"public"\./"preview"./g' | psql $DATABASE_MIGRATION_URL
#   4. correr auditoría de permisos (ver abajo)
```

**Cuándo corre**:

| Deploy | ¿Qué pasa? |
|--------|-----------|
| Prod (post-merge) | Crea schema `preview` si no existe → corre migraciones contra `public` → re-corre contra `preview` |
| Preview (Railway staging) | Crea schema si no existe → corre migraciones contra `preview` |
| Local | Igual que prod pero sin re-aplicar a `preview` |

**Reglas que las migraciones tienen que cumplir**:

1. Ser **idempotentes** — `CREATE TABLE IF NOT EXISTS`, no `DROP` ciego. Hoy hay que auditar las migraciones existentes; agregar `IF NOT EXISTS` donde falte.
2. Los `GRANT`/`REVOKE` finales de cada migración se reescriben también para el schema `preview`.
3. La **creación del schema** vive en el runner (`db:migrate`), no en una migración.
4. **Permisos de schema para `aquazaku_app`**: además del `GRANT USAGE, CREATE` al dueño, el runner tiene que dar `USAGE ON SCHEMA <schema> TO aquazaku_app` y `ALTER DEFAULT PRIVILEGES IN SCHEMA <schema> GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO aquazaku_app` (más `USAGE, SELECT ON SEQUENCES`). Sin esto, el rol de aplicación no puede ni mirar los objetos del schema nuevo.

---

## Permisos — la mitad dura de la garantía

`aquazaku_app` tiene `REVOKE UPDATE, DELETE ON audit_log` ([ADR-0004](/decisiones/0004-audit-log-inmutable/)). Si esto **no** se replica en `preview`, los tests pasarían mintiendo: una PR con código que rompe la inmutabilidad pasaría sus tests porque el rol SÍ puede borrar en `preview`.

**Cómo se garantiza**:

1. Las migraciones terminan con `GRANT`/`REVOKE` para el rol `aquazaku_app`. El `sed` los duplica a `preview`.
2. Un script `auditar-permisos-preview.ts` corre después de cada migración contra preview:
   ```sql
   -- Conectado como aquazaku_app con search_path=preview
   UPDATE audit_log SET action = 'prueba';
   -- Tiene que responder: permission denied for table audit_log
   ```
3. Si la auditoría falla, el deploy aborta. Esto es **deseado** — significa que un GRANT mal escrito bloquea hasta arreglarse.

---

## Seed

- `db:seed` ya exige `NODE_ENV≠production`. Le sumamos `AQUAZAKU_ENV≠production` (defensa redundante, defensa en profundidad).
- En cada deploy de preview, después de migraciones + auditoría, corre `db:seed`.
- En preview, el seed **reemplaza** los datos (`TRUNCATE` antes de sembrar) — cada deploy arranca limpio.
- El seed incluye: admin user, productos de muestra, clientes de muestra, datos mínimos para que cualquier pantalla tenga algo.

---

## Deploy

### Railway — environment `staging`

1. Crear environment `staging` (Duplicate Environment desde production).
2. Cambiar en staging: `AQUAZAKU_ENV=preview`. Las demás variables quedan igual — apuntan a la misma Supabase.
3. Configurar release command: `pnpm db:migrate && pnpm start` (hoy es solo `pnpm start`).
4. **PR Environments quedan desactivados** — duplican recursos sin uso.

### Vercel — variables por ambiente

Vercel exige una entrada por `(nombre, ambiente)` para tener valores distintos. Total: **6 entries** (3 variables × 2 ambientes).

| Variable | Ambiente | Valor |
|----------|----------|-------|
| `API_INTERNAL_URL` | Production | `https://api.aquazaku.com` |
| `API_INTERNAL_URL` | Preview | `https://<URL-de-staging-railway>` |
| `WEB_PUBLIC_URL` | Production | `https://app.aquazaku.com` |
| `WEB_PUBLIC_URL` | Preview | `https://${VERCEL_URL}` |
| `NODE_ENV` | Production | `production` |
| `NODE_ENV` | Preview | `preview` |

> `${VERCEL_URL}` lo expande Vercel con la URL del preview (`xxx-git-feature-usuario.vercel.app`). Si el `Origin` header que arma `web/` no matchea con los `trustedOrigins` de `api/`, Better Auth rechaza con 403. Solución: agregar `*.vercel.app` a `trustedOrigins` (cambio de código en Etapa 1).

---

## Lifecycle

| Evento | Qué pasa |
|--------|----------|
| PR abierta | Vercel preview + Railway staging redesplega → migraciones a `preview` → auditoría → seed |
| Push nuevo a la PR | Redespliega, repite todo (seed trunca y reemplaza) |
| PR mergeada | Deploy prod → migraciones a `public` → re-aplica a `preview` para sincronizar |
| PR cerrada sin merge | Vercel borra URL preview, pero Railway staging y el schema `preview` **siguen vivos** |

**Decisión**: el schema `preview` queda como **playground compartido** que se resetea con cada merge a main. No hay limpieza periódica. Si alguna vez hace falta, se agrega un cron más tarde sin romper nada.

---

## Error handling

| Falla | Comportamiento |
|-------|----------------|
| Migración falla en deploy de preview | Deploy aborta |
| Auditoría de permisos falla | Deploy aborta |
| Seed falla | Deploy aborta |
| Migración falla en deploy de prod | Deploy aborta, prod queda con schema anterior |
| Migración falla al sincronizar `preview` durante deploy de prod | **Deploy aborta** — decisión: nada debe fallar para pasar a producción |

---

## Testing

### Unit (api/)
- `AQUAZAKU_ENV` parsea y deriva el `search_path` correcto.
- `db:migrate` corre dos veces cuando se le pide.
- `db:seed` rechaza `AQUAZAKU_ENV=production`.

### Integración
Un test nuevo que:
1. Levanta Postgres efímero.
2. Crea schema `test_preview`.
3. Aplica migraciones con la reescritura `sed`.
4. Corre la auditoría de permisos.
5. Verifica que `aquazaku_app` no puede UPDATE/DELETE en `audit_log` del schema test.

### Smoke test del preview
Script que corre después de cada deploy de preview:
1. Login con admin del seed.
2. GET `/health`.
3. POST a endpoint simple + verificación de que el dato quedó.
4. Si falla, el deploy se marca como "smoke falló".

---

## Archivos a tocar

### `api/`

| Archivo | Cambio |
|---------|--------|
| `src/lib/env.ts` | Agregar `AQUAZAKU_ENV` al schema de Zod, derivar `search_path` |
| `src/lib/db.ts` | Agregar `options: -c search_path=...` al pool |
| `drizzle/migrate.ts` | Aceptar schema como argumento, crear schema si no existe, correr auditoría |
| `src/db/seed.ts` | Sumar guard `AQUAZAKU_ENV≠production` |
| `scripts/auditar-permisos-preview.ts` (nuevo) | Verifica REVOKE UPDATE/DELETE en `audit_log` del schema preview |
| `scripts/sincronizar-preview.ts` (nuevo) | Re-aplica migraciones a `preview` después de un deploy de prod |
| `package.json` | Scripts: `db:audit-permisos`, `db:sync-preview`, `smoke:preview` |
| `src/__tests__/env.test.ts` | Tests para `AQUAZAKU_ENV` y derivación de `search_path` |
| `src/__tests__/migrate.test.ts` (extender) | Test que aplica migraciones a schema efímero + auditoría |

### `despliegue/`

| Archivo | Cambio |
|---------|--------|
| `docker-compose.yml` | Agregar `AQUAZAKU_ENV=development` en servicios `api` y `migraciones` |

### `docs/`

| Archivo | Cambio |
|---------|--------|
| `docs/decisiones/0010-preview-environment.md` (nuevo) | ADR de la decisión |
| `docs/arquitectura/entornos.md` (nuevo) | Cómo funciona dev/preview/prod |

### Operacional (UI)

- **Railway**: crear staging, configurar release command, desactivar PR Environments.
- **Vercel**: 6 entries de env vars por ambiente.
- **Supabase**: cero cambios.

---

## Plan de implementación

| Etapa | Qué | Cómo se valida |
|-------|-----|---------------|
| **1 — Local** | `env.ts`, `db.ts`, `migrate.ts`, `seed.ts`, docker-compose + tests | `pnpm test` + `docker compose up` con el sistema completo |
| **2 — Scripts nuevos** | `auditar-permisos-preview.ts`, `sincronizar-preview.ts` + tests | Tests + correrlos contra el Postgres del compose |
| **3 — Docs** | ADR + doc operativa | Revisión del contenido |
| **4 — Operación** | Habilitar config Railway/Vercel | PR de prueba → preview deploys, migra, audita, pasa smoke |
| **5 — Cierre** | PR de prueba mergeada | Verificar migraciones en `public` + sync a `preview` + smoke |

**Trabajo estimado**: ~1.5 días desde el primer commit hasta previews funcionando.

---

## Riesgos

1. **Migraciones no idempotentes**: si alguna no tiene `IF NOT EXISTS` o tiene `DROP` ciego, aplicar dos veces rompe. Hay que auditar antes.
2. **Cambio en `env.ts` rompe deploy de prod**: si la validación de `AQUAZAKU_ENV` tiene un bug, prod no arranca. Mitigación: Etapa 1 valida con docker-compose + tests antes de tocar Railway.
3. **Permisos rotos en preview bloquean deploys**: si un GRANT mal escrito falla la auditoría, todos los deploys de preview se abortan hasta arreglarse. Es lo correcto, pero suma fricción.
4. **Storage acumula archivos en preview**: el bucket de Supabase Storage es global, no por schema. Decisión diferida — ver [Storage (diferido)](#storage-diferido).

**Rollback**: revert del commit. Las migraciones son idempotentes, re-aplicar no rompe nada.

---

## Storage (diferido)

Los buckets de Supabase Storage son globales, no por schema. Tres opciones:

- Mismo bucket con prefijo `preview/` en el path — cambio chico de código en upload.
- Bucket separado (`avatars-preview`, etc.) — duplica config en Supabase pero cero código.
- No hacer nada — archivos de preview se mezclan con prod. **Descartado**.

Recomendación: bucket separado. Decisión concreta queda para cuando se toque Storage por otra razón.

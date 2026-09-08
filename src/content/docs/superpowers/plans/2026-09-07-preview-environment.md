---
title: Plan de preview environments
description: "Schema de Postgres `preview` aislado por search_path según AQUAZAKU_ENV, con staging único en Railway que comparten todas las PRs de Vercel. Supabase Free, sin branching pago."
---

**Objetivo:** implementar el spec de [preview environments](/superpowers/specs/2026-09-07-preview-environment-design/) — una sola base Supabase con dos schemas separados por `search_path`, más un environment `staging` en Railway al que apuntan los previews de Vercel.

**Dominio:** [Cómo distinguir entornos](/decisiones/0009-donde-corre-aquazaku/) — el spec se apoya en ADR-0009 (Postgres en Supabase, app en una máquina).

**Estado:** 📝 Diseñado — listo para ejecutar.

---

## El orden importa

```
T1 env vars + pool search_path ── T2 migrate con schema ──┬── T3 auditoría ── T4 sincronizar
                                                          │
                                                          T5 seed guard ── T6 trustedOrigins ── T7 docker
                                                          │
                                                          T8 docs ── T9 verificación end-to-end
```

- **T1** va primero porque sin `AQUAZAKU_ENV` en el esquema validado, el resto no puede derivar el `search_path`.
- **T2** depende de T1: la migración corre con el pool que ya setea el search_path.
- **T3 y T4** dependen de T2: la auditoría es el control de calidad de la migración, y `sincronizar-preview` la dispara.
- **T5–T7** son cambios chicos, independientes entre sí.
- **T8** es la doc del cambio, no bloquea nada.
- **T9** es la verificación: PR de prueba + merge + smoke.

## Restricciones globales

- **Variables de entorno en la API**: agregar `AQUAZAKU_ENV ∈ {production, preview, development}`, default `production`. Validar con Zod igual que las demás.
- **`search_path`**: `production` y `development` → `public`. `preview` → `preview`. Setear en el pool, no en cada query.
- **Idempotencia de migraciones**: `CREATE TABLE IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`. No `DROP` ciego. Antes de tocar `migrate.ts`, auditar las migraciones existentes — si alguna no es idempotente, agregar `IF NOT EXISTS` o reescribirla.
- **Migraciones con `IF NOT EXISTS`**: agregar `IF NOT EXISTS` en TODA migración que cree objetos. Hoy algunas ya lo tienen; verificar el resto antes de la Etapa 1.
- **Mejor Auth respeta `search_path` automáticamente**: no tocar `auth/better-auth.ts` para esto. Sí tocarlo para `trustedOrigins` (T6).
- **El rol `aquazaku_app` tiene `REVOKE UPDATE, DELETE ON audit_log`**: la auditoría (T3) garantiza que ese REVOKE se replica en `preview`. Si la auditoría falla, el deploy aborta.
- **Operacional**: el release command de Railway staging tiene que ser `pnpm db:migrate && pnpm db:seed && pnpm start`. El de producción también, y al final dispara `pnpm db:sync-preview`. El `db:seed` en staging re-puebla el schema `preview` con datos de prueba en cada push — el guard de T5 impide que corra en producción.
- **Migraciones en el script, no en cada deploy**: el `migrate.ts` reescribe con `sed` solo cuando `--schema=preview`. Cuando corre contra `public`, aplica las migraciones tal cual.
- **El journal de Drizzle**: vive en `drizzle.__drizzle_migrations` (fijo de Drizzle). Si se reescriben las migraciones con sed para `preview`, Drizzle va a creer que las migraciones ya están aplicadas. **Decisión**: pasar `migrationsTable: '__drizzle_migrations_preview'` cuando el target schema es `preview`, para que cada ambiente tenga su propio journal en el schema `drizzle`.
- **Permisos de schema para `aquazaku_app`** (CRÍTICO, agregado tras T2 round 1): el runner de migración, después del `CREATE SCHEMA` y antes del `migrate()`, debe correr `GRANT USAGE ON SCHEMA <schema> TO aquazaku_app` y `ALTER DEFAULT PRIVILEGES IN SCHEMA <schema> GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO aquazaku_app` (más `USAGE, SELECT ON SEQUENCES`). Sin esto, el rol de aplicación no puede leer ni escribir tablas del schema nuevo.
- **`audit_log` necesita un `REVOKE UPDATE, DELETE FROM aquazaku_app` que NO EXISTE hoy** (CRÍTICO, detectado en T3 round 1): `0001_audit_append_only.sql` define el trigger `reject_audit_mutation` pero omite el `REVOKE`. El ALTER DEFAULT PRIVILEGES de T2 lo hace peor: `audit_log` termina con `aquazaku_app=arwd` en vez de `ar`. **Fix**: crear `0015_audit_revoke.sql` con `REVOKE UPDATE, DELETE ON audit_log FROM aquazaku_app;` (sin schema qualifier — search_path resuelve). NO modificar `0001` para no romper el hash del journal existente en `public`.

---

## Task 1 — `AQUAZAKU_ENV` y `search_path` en el pool

Las variables de entorno del runtime y el pool de Postgres. Fundamento del resto.

**Files:**
- Modify: `api/src/lib/env.ts:11`
- Modify: `api/src/lib/__tests__/env.test.ts`
- Modify: `api/src/db/client.ts:13`

**Interfaces:**
- Consumes: nada — primera task.
- Produces: `env.AQUAZAKU_ENV: 'production' | 'preview' | 'development'` (default `'production'`); `db` se conecta con `connection: { search_path }` (no `options` — esa es libpq, no la API de `postgres.js`)..

- [ ] **Step 1: Escribir el test que falla en `env.test.ts`**

```ts
import { parseEnv } from '@/lib/env'

describe('AQUAZAKU_ENV', () => {
  it('default es production', () => {
    const minimo = {
      DATABASE_URL: 'postgres://x@y/z',
      DATABASE_MIGRATION_URL: 'postgres://x@y/z',
      BETTER_AUTH_SECRET: 'a'.repeat(32),
      BETTER_AUTH_URL: 'https://api.example.com',
    }
    expect(parseEnv(minimo).AQUAZAKU_ENV).toBe('production')
  })

  it('acepta preview', () => {
    const minimo = {
      AQUAZAKU_ENV: 'preview',
      DATABASE_URL: 'postgres://x@y/z',
      DATABASE_MIGRATION_URL: 'postgres://x@y/z',
      BETTER_AUTH_SECRET: 'a'.repeat(32),
      BETTER_AUTH_URL: 'https://api.example.com',
    }
    expect(parseEnv(minimo).AQUAZAKU_ENV).toBe('preview')
  })

  it('rechaza valores fuera del enum', () => {
    const minimo = {
      AQUAZAKU_ENV: 'staging',
      DATABASE_URL: 'postgres://x@y/z',
      DATABASE_MIGRATION_URL: 'postgres://x@y/z',
      BETTER_AUTH_SECRET: 'a'.repeat(32),
      BETTER_AUTH_URL: 'https://api.example.com',
    }
    expect(() => parseEnv(minimo)).toThrow(/AQUAZAKU_ENV/)
  })
})
```

- [ ] **Step 2: Correr el test para verificar que falla**

Run: `cd api && pnpm test src/lib/__tests__/env.test.ts`
Expected: FAIL — `AQUAZAKU_ENV` no existe en el esquema.

- [ ] **Step 3: Agregar `AQUAZAKU_ENV` al esquema en `env.ts`**

En `api/src/lib/env.ts`, dentro de `envSchema`:

```ts
AQUAZAKU_ENV: z.enum(['production', 'preview', 'development']).default('production'),
```

- [ ] **Step 4: Correr el test para verificar que pasa**

Run: `cd api && pnpm test src/lib/__tests__/env.test.ts`
Expected: PASS.

- [ ] **Step 5: Modificar `db/client.ts` para que el pool setee `search_path`**

```ts
const searchPath =
  env.AQUAZAKU_ENV === 'preview' ? 'preview' : 'public'

const queryClient = postgres(env.DATABASE_URL, {
  max: env.NODE_ENV === 'test' ? 1 : 10,
  onnotice: env.NODE_ENV === 'test' ? () => {} : undefined,
  // `postgres.js` no acepta `options: '-c ...'` (es libpq-style de
  // node-postgres). Los parámetros de arranque van bajo `connection`.
  connection: { search_path: searchPath },
})
```

- [ ] **Step 6: Verificar local con docker-compose**

Run: `cd api && pnpm dev`
Expected: el proceso arranca y los queries a `ventas` (sin schema) resuelven a `public.ventas`. Loguear `search_path` en el arranque confirma el valor.

- [ ] **Step 7: Commit**

```bash
git add api/src/lib/env.ts api/src/lib/__tests__/env.test.ts api/src/db/client.ts
git commit -m "feat(env): AQUAZAKU_ENV + search_path en el pool"
```

---

## Task 2 — `migrate.ts` con `--schema` y sed

El runner de migraciones aprende a aplicar a un schema distinto de `public`.

**Files:**
- Modify: `api/drizzle/migrate.ts`
- Modify: `api/scripts/describir-conexion.ts` (si hace falta — confirmar primero)
- Modify: `api/package.json` (scripts)

**Interfaces:**
- Consumes: `db:migrate --schema=<name>` (nuevo flag). Las migraciones viven en `./src/db/migrations` (ya confirmado).
- Produces: `db:migrate` corre sobre `public`; `db:migrate --schema=preview` corre sobre `preview` con sed.

- [ ] **Step 1: Antes de tocar el script, auditar que las migraciones son idempotentes**

Run: `grep -L "IF NOT EXISTS" api/src/db/migrations/*.sql | head -20`
Expected: lista de migraciones que NO usan `IF NOT EXISTS`. Si hay migraciones sin `IF NOT EXISTS`, evaluarlas caso por caso y agregar el flag (TAREA PREVIA antes de Step 2).

- [ ] **Step 2: Modificar `migrate.ts` para aceptar `--schema=<name>`**

```ts
const args = process.argv.slice(2)
const schemaArg = args.find((a) => a.startsWith('--schema='))
const targetSchema = schemaArg ? schemaArg.split('=')[1] : 'public'

// Conexión como dueño (sin search_path — la corrida es explícita)
const client = postgres(url, { max: 1, onnotice: () => {} })

try {
  await client.unsafe(
    targetSchema === 'public'
      ? ''
      : `CREATE SCHEMA IF NOT EXISTS "${targetSchema}";
         GRANT USAGE, CREATE ON SCHEMA "${targetSchema}" TO aquazaku;`,
  )

  let sql = readFileSync(join(migrationsFolder, `${tag}.sql`), 'utf8')
  if (targetSchema !== 'public') {
    sql = sql.replace(/"public"\./g, `"${targetSchema}".`)
  }

  await client.unsafe(sql)
} finally {
  await client.end()
}
```

- [ ] **Step 3: Pasar `migrationsTable` distinto cuando el target es `preview`**

Drizzle guarda el journal en una tabla configurable. Para que cada ambiente tenga su propio journal:

```ts
await migrate(drizzle(client), {
  migrationsFolder: './src/db/migrations',
  migrationsTable:
    targetSchema === 'preview' ? '__drizzle_migrations_preview' : '__drizzle_migrations',
})
```

Sin esto, Drizzle cree que las migraciones de `public` ya están aplicadas a `preview`.

- [ ] **Step 4: Test de integración: aplicar a un schema efímero**

Crear `api/src/__tests__/migrate.test.ts`:

```ts
import { execSync } from 'node:child_process'
import postgres from 'postgres'

describe('migrate --schema=preview', () => {
  it('crea el schema y aplica las tablas adentro', async () => {
    execSync('pnpm db:migrate --schema=test_preview', { env: { ...process.env } })

    const client = postgres(process.env.DATABASE_URL_TEST!)
    const [{ exists }] = await client`SELECT EXISTS (
      SELECT FROM information_schema.tables
      WHERE table_schema = 'test_preview' AND table_name = 'ventas'
    ) AS exists`
    expect(exists).toBe(true)
    await client.end()
  })
})
```

- [ ] **Step 5: Correr el test para verificar que pasa**

Run: `cd api && pnpm test src/__tests__/migrate.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add api/drizzle/migrate.ts api/src/__tests__/migrate.test.ts api/package.json
git commit -m "feat(migrate): --schema con sed y journal por ambiente"
```

---

## Task 3 — Auditoría de permisos en preview

La mitad dura de la garantía de inmutabilidad: el `REVOKE UPDATE, DELETE ON audit_log` se replica en `preview`.

**Files:**
- Create: `api/scripts/auditar-permisos-preview.ts`
- Create: `api/src/__tests__/auditar-permisos.test.ts` (opcional — el script se prueba manualmente)

**Interfaces:**
- Consumes: `DATABASE_URL` (rol `aquazaku_app`), `AQUAZAKU_ENV=preview` o el schema a auditar como argumento.
- Produces: exit code 0 si `aquazaku_app` NO puede UPDATE/DELETE en `audit_log` del schema auditado; 1 si puede.

- [ ] **Step 1: Escribir el script**

```ts
import postgres from 'postgres'
import { exit } from 'node:process'

const args = process.argv.slice(2)
const schemaArg = args.find((a) => a.startsWith('--schema='))
const schema = schemaArg ? schemaArg.split('=')[1] : 'preview'

const url = process.env.DATABASE_URL
if (!url) {
  console.error('✗ Falta DATABASE_URL.')
  exit(1)
}

const client = postgres(url, {
  max: 1,
  options: `-c search_path=${schema}`,
})

try {
  await client.unsafe(`UPDATE audit_log SET action = 'prueba' WHERE FALSE`)
  console.error(`✗ PELIGRO: aquazaku_app PUEDE actualizar audit_log en schema "${schema}".`)
  console.error('  Las migraciones no replicaron el REVOKE UPDATE,DELETE. Deploy abortado.')
  exit(1)
} catch (err) {
  if (err instanceof Error && /permission denied/i.test(err.message)) {
    console.log(`✓ audit_log en "${schema}" es append-only para aquazaku_app.`)
    exit(0)
  }
  console.error('✗ Error inesperado:', err)
  exit(1)
} finally {
  await client.end()
}
```

- [ ] **Step 2: Validar localmente**

Run: `cd api && pnpm db:migrate --schema=preview && pnpm tsx scripts/auditar-permisos-preview.ts --schema=preview`
Expected: `✓ audit_log en "preview" es append-only para aquazaku_app.` y exit code 0.

- [ ] **Step 3: Validar el camino negativo — REVOCAR temporalmente y verificar que falla**

```bash
docker compose exec postgres psql -U aquazaku -d aquazaku \
  -c "GRANT UPDATE ON preview.audit_log TO aquazaku_app;"
pnpm tsx scripts/auditar-permisos-preview.ts --schema=preview
echo "exit=$?"  # tiene que ser 1
docker compose exec postgres psql -U aquazaku -d aquazaku \
  -c "REVOKE UPDATE ON preview.audit_log FROM aquazaku_app;"
```

Expected: el script termina con exit code 1 y mensaje de PELIGRO. Después del REVOKE, vuelve a exit code 0.

- [ ] **Step 4: Commit**

```bash
git add api/scripts/auditar-permisos-preview.ts
git commit -m "feat(migrate): auditoría de permisos append-only en preview"
```

---

## Task 4 — `sincronizar-preview`

Wrapper que dispara `db:migrate --schema=preview` después de un deploy de producción.

**Files:**
- Create: `api/scripts/sincronizar-preview.ts`
- Modify: `api/package.json`

**Interfaces:**
- Consumes: `DATABASE_MIGRATION_URL` (rol dueño, para DDL).
- Produces: el schema `preview` queda con todas las migraciones aplicadas, incluyendo las que acaban de entrar en `public`.

- [ ] **Step 1: Crear el script**

```ts
import { spawnSync } from 'node:child_process'

// 1. Aplica las migraciones a preview
const migrate = spawnSync(
  'pnpm',
  ['db:migrate', '--schema=preview'],
  { stdio: 'inherit' },
)
if (migrate.status !== 0) process.exit(migrate.status ?? 1)

// 2. Audita los permisos — si falla, aborta el deploy
const audit = spawnSync(
  'pnpm',
  ['tsx', 'scripts/auditar-permisos-preview.ts', '--schema=preview'],
  { stdio: 'inherit' },
)
process.exit(audit.status ?? 1)
```

Si cualquiera de los dos pasos falla, el sync entero aborta — por la decisión de T0, **nada falla para pasar a producción**.

- [ ] **Step 2: Agregar el script a `package.json`**

```json
"db:sync-preview": "tsx scripts/sincronizar-preview.ts"
```

- [ ] **Step 3: Validar localmente**

Run: `cd api && pnpm db:sync-preview`
Expected: las migraciones se aplican a `preview` y la auditoría pasa.

- [ ] **Step 4: Commit**

```bash
git add api/scripts/sincronizar-preview.ts api/package.json
git commit -m "feat(migrate): sincronizar-preview para post-deploy de prod"
```

---

## Task 5 — Guard de seed para `AQUAZAKU_ENV`

El seed ya rechaza `NODE_ENV=production`. Agregamos `AQUAZAKU_ENV=production` como segunda línea de defensa.

**Files:**
- Modify: `api/drizzle/seed.ts:252`

- [ ] **Step 1: Endurecer la condición**

```ts
if (
  (env.NODE_ENV === 'production' || env.AQUAZAKU_ENV === 'production') &&
  env.SEED_CONFIRM !== 'yes'
) {
  // ... mensaje y exit
}
```

- [ ] **Step 2: Validar**

Run: `AQUAZAKU_ENV=production pnpm db:seed`
Expected: rechazo con mensaje claro, exit code != 0.

- [ ] **Step 3: Commit**

```bash
git add api/drizzle/seed.ts
git commit -m "feat(seed): rechaza AQUAZAKU_ENV=production sin confirmación"
```

---

## Task 6 — `trustedOrigins` para previews de Vercel

El `Origin` del preview (`xxx-git-feature-usuario.vercel.app`) tiene que estar entre los `trustedOrigins` de Better Auth.

**Files:**
- Modify: `api/src/modules/auth/better-auth.ts`

- [ ] **Step 1: Verificar que Better Auth soporta wildcards en `trustedOrigins`**

Run: `grep -rn "trustedOrigins" api/src/modules/auth/`
Si NO soporta wildcards, hay que pasar el dominio exacto del preview — pero como es dinámico, esto se vuelve frágil. Plan B: agregar `*.vercel.app` y verificar.

- [ ] **Step 2: Agregar el wildcard**

```ts
trustedOrigins: [
  env.WEB_PUBLIC_URL,
  'https://*.vercel.app',
],
```

- [ ] **Step 3: Validar contra un preview real**

Después de T9 abrir una PR de prueba, hacer sign-in desde la URL del preview. Si Better Auth rechaza con 403, el patrón `*.vercel.app` no funciona — volver a Step 1 con plan B.

- [ ] **Step 4: Commit**

```bash
git add api/src/modules/auth/better-auth.ts
git commit -m "feat(auth): trustedOrigins incluye *.vercel.app"
```

---

## Task 7 — `docker-compose` con `AQUAZAKU_ENV=development`

El compose local necesita la nueva variable para que el pool setee `search_path=public`.

**Files:**
- Modify: `despliegue/docker-compose.yml`

- [ ] **Step 1: Agregar la variable al servicio `api` y al servicio `migraciones`**

```yaml
services:
  api:
    environment:
      AQUAZAKU_ENV: ${AQUAZAKU_ENV:-development}
      # ... las demás vars ...
  migraciones:
    environment:
      AQUAZAKU_ENV: ${AQUAZAKU_ENV:-development}
      # ... las demás vars ...
```

- [ ] **Step 2: Actualizar `despliegue/.env.ejemplo` con la variable**

```bash
# ── Ambiente ───────────────────────────────────────────────────────────────
# production | preview | development
AQUAZAKU_ENV=development
```

- [ ] **Step 3: Validar local**

Run: `cp despliegue/.env.ejemplo despliegue/.env && cd despliegue && docker compose --profile local up -d postgres && docker compose logs postgres | grep "rol .* listo" && docker compose --profile tareas run --rm migraciones && docker compose up -d`
Expected: el servicio `api` arranca, los queries a `ventas` resuelven a `public.ventas`.

- [ ] **Step 4: Commit**

```bash
git add despliegue/docker-compose.yml despliegue/.env.ejemplo
git commit -m "feat(despliegue): AQUAZAKU_ENV en docker-compose"
```

---

## Task 8 — Documentación

ADR y doc operativa. No bloquea nada técnico.

**Files:**
- Create: `docs/src/content/docs/decisiones/0010-preview-environment.md`
- Create: `docs/src/content/docs/arquitectura/entornos.md`

- [ ] **Step 1: Escribir el ADR**

```markdown
---
title: 'ADR-0010 — preview environments sin pagar Supabase Pro'
description: 'Una sola base con dos schemas separados por search_path, según AQUAZAKU_ENV.'
---

## Contexto
...
## Decisión
...
## Consecuencias
...
```

- [ ] **Step 2: Escribir la doc operativa de entornos**

Cubrir: qué hace cada ambiente, qué variables usa, cómo se deploya, cómo se hace un rollback, qué pasa cuando falla.

- [ ] **Step 3: Commit**

```bash
git add docs/src/content/docs/decisiones/0010-preview-environment.md docs/src/content/docs/arquitectura/entornos.md
git commit -m "docs: ADR-0010 + operativa de entornos"
```

---

## Task 9 — Verificación end-to-end con PR de prueba

Cerrar el ciclo: una PR real ejercita todo el flujo.

**Files:**
- ninguno (verificación operacional)

**Interfaces:**
- Consumes: PR abierta contra `main` del repo `api` (o un PR con cambios pequeños en `web/`).
- Produces: confirmación de que el preview funciona y de que el sync post-merge corre.

- [ ] **Step 1: Configurar Railway staging**

1. Crear environment `staging` (Duplicate desde production).
2. Cambiar `AQUAZAKU_ENV=preview`. Las demás variables quedan iguales.
3. Cambiar release command de staging: `pnpm db:migrate && pnpm db:seed && pnpm start` (hoy es solo `pnpm start`). El `db:seed` repuebla el schema `preview` con datos de prueba — el guard de T5 impide que corra en producción.

- [ ] **Step 2: Verificar que Vercel tiene las 6 entries correctas**

Vercel → Settings → Environment Variables, proyecto `aquazaku-web`:
- `API_INTERNAL_URL` Production: `https://api.aquazaku.com`
- `API_INTERNAL_URL` Preview: URL del environment staging de Railway
- `WEB_PUBLIC_URL` Production: `https://app.aquazaku.com`
- `WEB_PUBLIC_URL` Preview: `https://${VERCEL_URL}`
- `NODE_ENV` Production: `production`
- `NODE_ENV` Preview: `preview`

- [ ] **Step 3: Abrir una PR de prueba contra `web/`**

Una PR con un cambio trivial (un color, un texto). Vercel genera preview URL.

- [ ] **Step 4: Verificar que el preview funciona**

Abrir la URL del preview, hacer sign-in con el admin del seed, navegar un módulo. Si Better Auth rechaza con 403, volver a T6.

- [ ] **Step 5: Verificar el smoke test**

Después del primer deploy de preview, Railway corre `pnpm db:migrate --schema=preview && pnpm db:audit-permisos`. El log tiene que mostrar la auditoría pasando.

- [ ] **Step 6: Mergear la PR**

Vercel redesplega producción con el cambio. Railway producción corre `pnpm db:migrate && pnpm db:sync-preview && pnpm start`. El log tiene que mostrar el sync exitoso a `preview`.

- [ ] **Step 7: Validar que `preview` quedó con las últimas migraciones**

Run: `vercel env pull --project aquazaku-web --environment preview | grep VERCEL_URL`
Y desde Railway staging, correr `pnpm tsx scripts/auditar-permisos-preview.ts --schema=preview` — debe pasar.

- [ ] **Step 8: Cierre**

Cerrar la issue / ticket de seguimiento si existe. Actualizar el spec con un link al PR de verificación.

---

## Resumen de archivos tocados

```
api/src/lib/env.ts                                  ← T1
api/src/lib/__tests__/env.test.ts                   ← T1
api/src/db/client.ts                                ← T1
api/drizzle/migrate.ts                              ← T2
api/src/__tests__/migrate.test.ts                   ← T2 (nuevo)
api/scripts/auditar-permisos-preview.ts             ← T3 (nuevo)
api/scripts/sincronizar-preview.ts                  ← T4 (nuevo)
api/drizzle/seed.ts                                 ← T5
api/src/modules/auth/better-auth.ts                 ← T6
api/package.json                                    ← T2, T4
despliegue/docker-compose.yml                       ← T7
despliegue/.env.ejemplo                             ← T7
docs/src/content/docs/decisiones/0010-preview-environment.md   ← T8 (nuevo)
docs/src/content/docs/arquitectura/entornos.md      ← T8 (nuevo)
```

**Trabajo estimado**: ~1.5 días desde el primer commit hasta previews funcionando.

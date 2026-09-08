---
title: Entornos
description: 'Cómo coexisten los tres ambientes de Aquazaku — local, preview y producción — sobre una sola base Supabase con dos schemas.'
sidebar:
  order: 3
---

:::note[Para el **por qué** de cada decisión]
Esta página es operativa. La decisión de tener un solo proyecto Supabase con
dos schemas separados por `search_path` está en
[ADR-0010](/decisiones/0010-preview-environment/). El diseño técnico (qué
variable se setea, qué reescritura se aplica, qué script corre) está en el
[spec de preview
environments](/superpowers/specs/2026-09-07-preview-environment-design/) y en
el [plan de implementación](/superpowers/plans/2026-09-07-preview-environment/).
El diagrama que muestra cómo se conectan las piezas está en
[`/aquazaku-arquitectura.html`](https://aquazaku-docs.maoacr.com/aquazaku-arquitectura.html).
:::

## Los tres ambientes

| Ambiente | Quién lo usa | `AQUAZAKU_ENV` | Schema de Postgres | Cuándo nace | Cuándo muere |
| --- | --- | --- | :-: | --- | --- |
| **Local** | quien desarrolla | `development` | `public` | `docker compose up` | cuando se apaga la máquina |
| **Preview** | quien revisa una PR antes de mergear | `preview` | `preview` | push a una PR | merge a `main` (resetea), PR cerrada sin merge (queda hasta el próximo push) |
| **Producción** | la planta | `production` | `public` | primer deploy de prod | nunca, mientras el negocio siga |

:::tip[El schema `preview` no es un backup]
El schema `preview` se trunca con cada merge a `main`. No es un lugar donde
dejar cosas que importen: es un playground que arranca limpio.
:::

## Las variables

`AQUAZAKU_ENV` es la única variable nueva del sistema. El resto es lo que ya
existía — las cadenas de Supabase, el secreto de Better Auth, el `WEB_PUBLIC_URL`,
etc.

### Local

En `despliegue/.env` (copiar de `despliegue/.env.ejemplo`):

```bash
AQUAZAKU_ENV=development
```

`docker compose` la propaga a los servicios `api` y `migraciones`. El pool
de Postgres arranca con `search_path=public` y los queries resuelven a las
tablas de siempre.

### Preview

Cada preview es una URL de Vercel apuntando al environment `staging` de
Railway. Los dos lados setean `AQUAZAKU_ENV=preview`:

| Plataforma | Variable | Valor |
| --- | --- | --- |
| Railway (`staging`) | `AQUAZAKU_ENV` | `preview` |
| Vercel (`Preview`) | `API_INTERNAL_URL` | URL pública del environment `staging` de Railway |
| Vercel (`Preview`) | `WEB_PUBLIC_URL` | `https://${VERCEL_URL}` |
| Vercel (`Preview`) | `NODE_ENV` | `preview` |

`*.vercel.app` tiene que estar en los `trustedOrigins` de Better Auth — si no,
el login falla con `403`. Cambio aplicado en T6.

### Producción

| Plataforma | Variable | Valor |
| --- | --- | --- |
| Railway (`production`) | `AQUAZAKU_ENV` | `production` |
| Vercel (`Production`) | `API_INTERNAL_URL` | `https://api.aquazaku.com` |
| Vercel (`Production`) | `WEB_PUBLIC_URL` | `https://app.aquazaku.com` |
| Vercel (`Production`) | `NODE_ENV` | `production` |

`AQUAZAKU_ENV` **no** se setea explícitamente en producción; vale por su
default (`production`). Esto es deliberado: si alguien borra la variable por
accidente, el proceso no rompe.

---

## Cómo se deploya cada ambiente

### Local

```bash
# Una vez por máquina
cp despliegue/.env.ejemplo despliegue/.env

# Cada vez que se arranca
docker compose --profile local up -d postgres
docker compose --profile tareas run --rm migraciones   # corre las migraciones
docker compose up -d
```

`pnpm dev` desde `api/` también funciona contra el Postgres del compose, con
la variable `AQUAZAKU_ENV=development` en `.env`.

### Preview

Cada push a una PR dispara dos cosas:

1. **Vercel** redesplega la URL del preview (`xxx-git-feature-usuario.vercel.app`).
2. **Railway (`staging`)** redesplega, y su release command corre:
   ```bash
   pnpm db:migrate && pnpm start
   ```
   `db:migrate` aplica las migraciones al schema `preview` y dispara la
   auditoría de permisos. Si la auditoría falla, el deploy aborta.

Después del primer deploy de preview, el seed corre contra `preview`. Cada
push nuevo trunca y reemplaza los datos.

:::caution[Las migraciones tienen que ser idempotentes]
`db:migrate` corre **dos veces** durante un deploy normal —una contra `public`
y otra contra `preview`—. Si una migración tiene `DROP` ciego o crea un
objeto sin `IF NOT EXISTS`, la segunda pasada rompe. El plan auditó las
migraciones existentes antes de tocar `migrate.ts`; cualquier migración nueva
tiene que cumplir la misma regla.
:::

### Producción

Cada merge a `main` dispara el deploy de producción. El release command de
Railway (`production`) es:

```bash
pnpm db:migrate && pnpm db:sync-preview && pnpm start
```

- `db:migrate` aplica las migraciones a `public`.
- `db:sync-preview` re-aplica las mismas migraciones a `preview`, para que
  el playground quede sincronizado con lo que acaba de entrar en prod.
  Incluye la auditoría de permisos.
- `pnpm start` levanta el servidor.

Si **cualquiera** falla, el deploy aborta. Es deliberado: nada falla para
pasar a producción.

---

## Qué pasa cuando algo falla

| Falla | Comportamiento | Qué hacer |
| --- | --- | --- |
| Migración falla en deploy de preview | El deploy de Railway `staging` aborta. La URL del preview queda con la versión anterior. | Corregir la migración, pushear, esperar el redespliegue. |
| Migración falla en deploy de prod | El deploy aborta. **Producción queda con el schema anterior**. | Revisar el log de Railway (`production`). Si la migración nueva tiene un bug, revertir el commit. |
| Auditoría de permisos falla | El deploy aborta, en preview o en prod. | El log dice qué `GRANT`/`REVOKE` falta replicar. La causa típica es una migración nueva que olvidó su `REVOKE`. Se arregla en una migración siguiente. |
| `db:sync-preview` falla después de un deploy de prod exitoso | El deploy aborta. **Producción ya quedó migrada**; el playground `preview` queda desincronizado. | Re-correr `pnpm db:sync-preview` a mano desde Railway. El próximo push a cualquier PR va a arreglar la desincronización, igual. |
| Seed falla | El deploy de preview aborta. | El seed no toca prod — el problema es del script, no del schema. Corregir y pushear. |
| Vercel preview levanta pero el login devuelve `403` | Better Auth rechaza el `Origin` del preview. | Confirmar que `*.vercel.app` está en `trustedOrigins` (ver T6 del plan). |
| Pool de Postgres setea `search_path` incorrecto | Los queries del preview leen datos de `public`. | Verificar que la variable `AQUAZAKU_ENV` está bien seteada en Railway. Si está bien, revisar que el código del pool use `connection: { search_path }` — no `options: '-c ...'`, que es libpq-style y **falla silenciosamente** con `postgres.js`. |

---

## Cómo se hace un rollback

### Código

Revert del commit. Las migraciones son idempotentes, así que re-aplicar el
commit no rompe nada. Railway y Vercel detectan el push y redespliegan.

### Schema

`DROP SCHEMA preview CASCADE` borra el schema y todo lo que tenga adentro. Lo
que sigue funcionando:

- `public` queda intacto.
- El próximo deploy de preview lo recrea con `CREATE SCHEMA IF NOT EXISTS`
  y vuelve a correr las migraciones desde cero.

Lo que se pierde: los datos de prueba del último seed. Eso es **lo que
queremos**: un preview roto se arregla tirándolo a la basura.

### Permisos

Si una migración nueva rompe los `REVOKE` del schema `preview`, la auditoría
lo detecta y el deploy aborta. La fix es una migración nueva con los
`GRANT`/`REVOKE` que faltan — siguiendo el patrón de `0015_audit_revoke`,
que arregló un agujero pre-existente de `0001`.

---

## Cómo se verifica que funciona

Después de cualquier cambio al flujo de preview environments, una PR de
prueba ejercita todo:

1. Abrir una PR con un cambio trivial contra `main`.
2. Esperar a que Vercel levante el preview y Railway termine el deploy de
   `staging`.
3. Abrir la URL del preview. El log de Railway tiene que mostrar la
   auditoría de permisos pasando (`✓ audit_log en "preview" es append-only
   para aquazaku_app.`).
4. Login con el admin del seed (`SEED_ADMIN_EMAIL`).
5. Navegar un módulo. Si Better Auth rechaza con `403`, falta el wildcard
   en `trustedOrigins`.
6. Mergear la PR. Vercel redesplega producción; Railway corre
   `db:migrate && db:sync-preview && start`.
7. Desde Railway `staging`, correr
   `pnpm tsx scripts/auditar-permisos-preview.ts --schema=preview`. Tiene
   que pasar.

Si los siete pasos pasan, el ambiente entero está sano.

---

## Lo que NO se hace acá

- **No** se crean archivos por ambiente en el repo. Las variables viven en
  los paneles de Railway, Vercel y `.env` local.
- **No** se mantiene un script que limpie el schema `preview` periódicamente.
  El reseteo con cada merge es suficiente. Si en algún momento deja de
  serlo, se agrega un cron — no se cambia la estrategia.
- **No** se configura un dominio custom para los previews. La URL
  `*.vercel.app` es fea, pero la wildcard en `trustedOrigins` la hace
  funcional sin agregar infra.
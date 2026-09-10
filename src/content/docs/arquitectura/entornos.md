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
2. **Railway (`staging`)** redesplega, y su `startCommand` corre:
   ```bash
   pnpm db:sync-preview && pnpm db:seed && pnpm start
   ```
   `db:sync-preview` aplica las migraciones al schema `preview` (el
   migrador lee `AQUAZAKU_ENV` del entorno, así que sabe que va contra
   `preview` y no contra `public`) y corre la auditoría de permisos. Si
   la auditoría falla, el deploy de staging aborta —y queremos que
   aborte, porque un preview con el schema roto no debería pasar—. Después,
   `db:seed` siembra el catálogo y el administrador inicial. El guard de T5
   rechaza `db:seed` si `AQUAZAKU_ENV=production`, así que es seguro incluirlo
   en el `startCommand` de staging.

:::caution[El preview NO se vacía en cada push: acumula]
Es fácil suponer lo contrario, y esta página lo decía mal.

Ni `db:sync-preview` ni `db:seed` truncan nada. El seed son **inserciones
idempotentes**: el catálogo entra con `onConflictDoNothing`, y si ya hay un
administrador activo responde *«Ya hay un administrador activo: no se creó
ninguno»* y no toca nada.

O sea que los clientes, ventas y movimientos que alguien cree probando **quedan
ahí**, deploy tras deploy, hasta que alguien los saque a mano.

Consecuencias prácticas:

- Un preview con datos raros no se arregla volviendo a pushear.
- Los tests manuales arrancan sobre lo que dejó la prueba anterior.
- La contraseña del admin del preview **no se resetea**: si alguien entró una
  vez y la cambió, vale la que puso, no la de `SEED_ADMIN_PASSWORD`.

Para empezar de cero, el schema se tira entero:

```sql
DROP SCHEMA preview CASCADE;
```

El próximo deploy de staging lo recrea con `CREATE SCHEMA IF NOT EXISTS`,
vuelve a correr las migraciones desde cero y siembra de nuevo. `public` queda
intacto — son dos schemas separados en la misma base.
:::

#### Cómo se entra al preview

Dos portones, uno detrás del otro, y el primero no es de Aquazaku.

**1 · Vercel.** Los deployments de preview están protegidos: la URL redirige a
`vercel.com/sso-api` antes de servir nada. No importa qué usuario de Aquazaku se
intente — no se llega ni a la pantalla de login.

Se pasa entrando a [vercel.com](https://vercel.com) con la cuenta del proyecto,
**en el mismo navegador**, y volviendo a abrir el enlace. La protección se puede
apagar en *Project Settings → Deployment Protection*, pero conviene dejarla: un
preview con datos de prueba abierto a internet es superficie que no hace falta.

**2 · Aquazaku.** Recién ahí aparece el login de la app, y la contraseña de
producción **no sirve**: el preview vive en el schema `preview`, que tiene su
propia tabla `users`.

| | |
| --- | --- |
| Usuario | `SEED_ADMIN_EMAIL` del environment **staging** de Railway |
| Contraseña | `SEED_ADMIN_PASSWORD` del **mismo** environment |
| Primer ingreso | pide cambiarla: el seed deja `mustChangePassword` en `true` |

Y como el preview acumula, si alguien ya entró y la cambió, **vale la que puso**:
nada la resetea salvo tirar el schema.

### Producción

El `startCommand` de Railway para producción es **vacío**: el container
arranca con el `CMD ["pnpm", "start"]` del Dockerfile. Las migraciones a
producción son un paso deliberado y separado.

El flujo de un deploy de producción es:

1. Merge a `main`. Vercel redesplega `app.aquazaku.com`; Railway redesplega
   `api.aquazaku.com`.
2. Railway arranca el server con el último build mergeado. El server
   responde 200 en `/health` apenas el pool conecta.
3. **Después** del deploy, alguien corre las migraciones a mano:
   ```bash
   DATABASE_MIGRATION_URL=... pnpm db:migrate:prod
   ```
   El script anuncia a qué base y a qué schema va a apuntar antes de
   tocarlos. Si hay algo mal, el rollback es `git revert` del commit —las
   migraciones son idempotentes, así que re-aplicar no rompe nada.

:::danger[Una migración que RENOMBRA invierte este orden]
El flujo de arriba —desplegar y después migrar— vale para migraciones
**aditivas**: agregar una columna nullable, una tabla, un índice. Ahí el código
viejo sigue funcionando contra el schema nuevo, y el código nuevo aguanta hasta
que la migración corra.

Una migración que **renombra o convierte** una columna no tiene esa propiedad, y
el orden documentado rompe la planta. Medido contra la base con `0016`, que
renombró `nombre` a `nombre_libre` y lo reemplazó por una columna generada:

| Orden | Leer clientes | Registrar cliente |
| --- | :-: | --- |
| **Migrar primero**, desplegar después | ✅ | ❌ solo el alta, durante el deploy |
| Desplegar primero, migrar después | ❌ | ❌ |

Con el código nuevo contra el schema viejo, el `SELECT` pide columnas que no
existen: **se cae todo lo de clientes**, y con eso ventas, retornables y
cartera.

Migrando primero el sistema sigue funcionando —se vende, se consulta, se
cobra— y lo único que falla es dar de alta un cliente nuevo, durante los dos
minutos del deploy.

**Cómo se hace**: con la rama en local, antes de mergear.

```bash
DATABASE_MIGRATION_URL=... pnpm db:migrate:prod
```

La alternativa sin ventana es expandir y contraer —agregar las columnas
nuevas, desplegar código que escriba las dos formas, y recién después
convertir la vieja—. Son tres despliegues coordinados para ahorrar dos
minutos en un negocio que trabaja de día: no vale la pena acá, pero sí el
día que la planta opere de noche.
:::

:::caution[Por qué las migraciones NO son automáticas]
[ADR-0009](/decisiones/0009-donde-corre-aquazaku/) asume que dos instancias
no migran a la vez: una migración a medias es peor que un deploy demorado.
Con `startCommand` migrando, un auto-deploy de Vercel que dispare un
redeploy de Railway podría migrar mientras la app corre y romper el pool.

El flujo de merge a `main` ya es deliberado (PR + review + merge).
Agregar `pnpm db:migrate:prod` después del merge no introduce una
nueva categoría de "olvidos".
:::

:::danger[El `startCommand` viejo tumbó producción durante un día]
La versión anterior de esta página recomendaba
`pnpm db:migrate && pnpm db:sync-preview && pnpm start`. Once deploys
fallaron en silencio. La cadena ataba el arranque del server a la
sincronización de preview: si `db:sync-preview` fallaba, `pnpm start` no
corría y el healthcheck moría. La fix se documenta en
[ADR-0011](/decisiones/0011-separacion-de-arranques/).
:::

---

## Qué pasa cuando algo falla

| Falla | Comportamiento | Qué hacer |
| --- | --- | --- |
| Migración falla en deploy de staging | El deploy de Railway `staging` aborta. La URL del preview queda con la versión anterior. | Corregir la migración, pushear, esperar el redespliegue. |
| Migración falla en deploy de prod (`pnpm db:migrate:prod`) | El comando aborta. **Producción queda con el schema anterior**; el server sigue corriendo con el código mergeado. | Revisar el log del comando. Si la migración nueva tiene un bug, revertir el commit. La app puede quedar sirviendo errores 500 hasta que se corrija. |
| Auditoría de permisos falla en staging | El deploy de staging aborta. | El log dice qué `GRANT`/`REVOKE` falta replicar. La causa típica es una migración nueva que olvidó su `REVOKE`. Se arregla en una migración siguiente. |
| `db:sync-preview` falla en staging | El deploy de staging aborta. **Producción no se ve afectada** —sus migraciones son separadas—. | Corregir y pushear. La próxima corrida del sync reintenta. |
| Seed falla en staging | El deploy de staging aborta. | El seed no toca prod — el problema es del script, no del schema. Corregir y pushear. |
| Vercel preview levanta pero el login devuelve `403` | Better Auth rechaza el `Origin` del preview. | Confirmar que `*.vercel.app` está en `trustedOrigins` (ver T6 del plan). |
| Pool de Postgres setea `search_path` incorrecto | Los queries del preview leen datos de `public`. | Verificar que la variable `AQUAZAKU_ENV` está bien seteada en Railway. Si está bien, revisar que el código del pool use `connection: { search_path }` — no `options: '-c ...'`, que es libpq-style y **falla silenciosamente** con `postgres.js`. |

---

## Cómo se hace un rollback

### Código

Revert del commit. Railway y Vercel detectan el push y redesplegan. Las
migraciones son idempotentes, así que re-aplicar el commit no rompe nada.

Si la migración nueva que vino en el commit revertido ya se corrió a
producción, **revertir el código no la deshace**. La app va a fallar al
acceder a la columna o tabla que la migración nueva creó. En ese caso, se
escribe una migración explícita que deshaga el cambio (`ALTER TABLE ...
DROP COLUMN ...`) y se corre con `pnpm db:migrate:prod`.

### Schema

`DROP SCHEMA preview CASCADE` borra el schema y todo lo que tenga adentro. Lo
que sigue funcionando:

- `public` queda intacto.
- El próximo deploy de staging lo recrea con `CREATE SCHEMA IF NOT EXISTS`
  y vuelve a correr las migraciones desde cero.

Lo que se pierde: **todo lo acumulado**, no solo lo del último seed — el
preview no se vacía en cada push. Eso es justamente lo que queremos: un
preview roto se arregla tirándolo a la basura.

### Permisos

Si una migración nueva rompe los `REVOKE` del schema `preview`, la auditoría
lo detecta y el deploy de staging aborta. La fix es una migración nueva con
los `GRANT`/`REVOKE` que faltan — siguiendo el patrón de `0015_audit_revoke`,
que arregló un agujero pre-existente de `0001`.

---

## Cómo se verifica que funciona

Después de cualquier cambio al flujo de preview environments, una PR de
prueba ejercita todo:

1. Abrir una PR con un cambio trivial contra `main`.
2. Esperar a que Vercel levante el preview y Railway termine el deploy de
   `staging`.
3. Abrir la URL del preview. El log de Railway (`staging`) tiene que
   mostrar la auditoría de permisos pasando (`✓ audit_log en "preview" es
   append-only para aquazaku_app.`).
4. Login con el admin del seed (`SEED_ADMIN_EMAIL`).
5. Navegar un módulo. Si Better Auth rechaza con `403`, falta el wildcard
   en `trustedOrigins`.
6. Mergear la PR. Vercel redesplega producción; Railway redesplega
   `api.aquazaku.com` con el `startCommand` vacío — solo arranca el server.
7. Correr las migraciones a mano:
   ```bash
   DATABASE_MIGRATION_URL=... pnpm db:migrate:prod
   ```
8. Desde Railway `staging`, correr
   `pnpm tsx scripts/auditar-permisos-preview.ts --schema=preview`. Tiene
   que pasar.

Si los ocho pasos pasan, el ambiente entero está sano.

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

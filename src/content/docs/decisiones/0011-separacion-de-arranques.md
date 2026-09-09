---
title: 'ADR-0011 — Producción arranca sola; staging sincroniza su schema; migrar es deliberado'
description: Separar los `startCommand` de Railway para que un fallo de preview no tumbe producción, y para que staging no migre el schema de producción en silencio.
---

**Estado:** Aceptado — corregido el 9-sep-2026
**Fecha:** 2026-09-09
**Deciden:** Mao
**Sale de:** Deploy de T9 del SDD `2026-09-07-preview-environment`, donde el bug se manifestó como deploys que fallaban en silencio.

---

## Contexto

[ADR-0010](/decisiones/0010-preview-environment/) introdujo los dos schemas
separados por `search_path` y el `db:sync-preview` que sincroniza el schema
`preview` con el de `public` después de cada deploy de producción. La
implementación se diseñó con un `startCommand` único en Railway que encadenaba
todo:

```bash
pnpm db:migrate && pnpm db:sync-preview && pnpm start
```

La intención era que cada deploy migrara `public`, sincronizara `preview` y
levantara el server, atómicamente. La realidad, una vez desplegado, fue otra.
Dos bugs aparecieron a la vez, y los dos eran de diseño:

### Bug 1 — Staging migraba el schema de producción en cada deploy

La aplicación (`api/src/db/client.ts`) leía `AQUAZAKU_ENV` para decidir el
`search_path` del pool. El migrador (`api/drizzle/migrate.ts`) tenía `'public'`
escrito a mano, y solo cambiaba con el flag `--schema=`.

Resultado: el `db:migrate` sin flag —el que corría como parte del
`startCommand`— **siempre** migraba `public`, en todos los ambientes. En
staging, eso significaba migrar el schema de producción en cada deploy, en
silencio, sin que ningún test lo detectara. Cada deploy de staging era un
deploy de producción con `search_path=preview` puesto después.

No fallaba: producía DDL contra `public` y luego la app leía de `preview`. El
resultado neto era un deploy exitoso con migraciones fantasma —la base de
producción quedaba alterada, los previews veían un schema desincronizado con su
propia versión del código, y nadie se enteraba hasta que el próximo deploy de
producción chocaba contra una migración que `preview` ya tenía aplicada.

### Bug 2 — Producción no arrancaba si preview fallaba

El `startCommand` ataba el arranque del server a la sincronización de preview.
Si `db:sync-preview` fallaba —por un GRANT faltante, por un seed roto, por
lo que fuera—, el `&&` cortaba la cadena y `pnpm start` nunca corría. El
healthcheck de Railway moría cinco minutos después, y el container quedaba
marcado como `FAILED`.

El error de fondo: **preview existe para no tocar producción**, y el
`startCommand` las había vuelto a atar. Un fallo en el playground tumbaba el
server de la planta.

:::caution[Por qué el log no ayudaba]
El log del deploy fallido mostraba `✓ migraciones aplicadas` y después silencio.
Cinco minutos sin output, el healthcheck cayendo, Railway matando el container.
Nada en el log decía qué paso había colgado ni por qué.
:::

---

## Alternativas evaluadas

### Opción A — Seguir parchando el `&&` chain

Intentar que el output del `db:sync-preview` apareciera en el log, y
descubrir por qué se colgaba. Agregar `console.log` al wrapper, mover el
`spawnSync` a un nivel distinto, lo que fuera.

- ❌ Trata el síntoma (output perdido), no el problema (diseño).
- ❌ Staging sigue migrando producción en silencio — el primer bug sigue
  vigente aunque el segundo se vea "arreglado".
- ❌ Cada deploy sigue siendo una lotería: si preview falla, producción cae.

### Opción B — Separar los `startCommand` por ambiente

- **Producción** no migra ni sincroniza. Solo arranca el server. Las
  migraciones a producción son un comando a mano (`pnpm db:migrate:prod`) que
  anuncia a qué base va antes de tocarla.
- **Staging** sincroniza su propio schema contra `public` (`pnpm db:sync-preview
  && pnpm db:seed && pnpm start`). El `db:sync-preview` sabe que va contra
  `preview` porque el migrador ahora lee `AQUAZAKU_ENV` igual que la app.
- **Migrador y aplicación** consultan la misma función `searchPathFor(env)`
  para decidir el schema objetivo. Una sola fuente de verdad.

- ✅ Un fallo de `preview` no afecta a producción. Producción sigue
  arrancando con código viejo mientras se arregla staging.
- ✅ Staging ya no migra `public` accidentalmente.
- ✅ El `startCommand` de cada ambiente es explícito sobre qué hace.
- ❌ Las migraciones de producción se vuelven un paso humano. Aceptable:
  el flujo de merge a `main` ya es deliberado (PR + review + merge), agregar
  `pnpm db:migrate:prod` después del merge no es una carga nueva.

---

## Decisión

**Opción B.** El `startCommand` se separa por ambiente. El conocimiento
sobre "qué schema le corresponde" se centraliza en una función
`searchPathFor(env)` que comparten la app y el migrador.

| Servicio | `startCommand` en Railway |
| --- | --- |
| **Producción** | *(vacío — usa el `CMD` del Dockerfile: `pnpm start`)* |
| **Staging** | `pnpm db:sync-preview && pnpm db:seed && pnpm start` |

El Dockerfile de `api` mantiene `CMD ["pnpm", "start"]` como red de
seguridad: si un `startCommand` queda vacío o se borra por accidente, el
container igual sabe qué correr. La doc de
[puesta en producción](/empezar/puesta-en-produccion/) llama a esto
explícitamente.

El migrador se modifica para que:

```ts
// api/drizzle/migrate.ts
import { searchPathFor } from './src/lib/search-path'
const targetSchema = schemaArg ?? searchPathFor(env)
```

`searchPathFor` vive en `api/src/lib/` y es una función pura que devuelve
`'preview'` si `AQUAZAKU_ENV === 'preview'`, `'public'` en cualquier otro
caso. La app ya la usaba; el migrador se suma.

Las migraciones de producción corren a mano:

```bash
DATABASE_MIGRATION_URL=... pnpm db:migrate:prod
```

…que es el mismo `pnpm db:migrate` de siempre, pero con un script que
anuncia la base y el schema objetivo antes de tocarlos. El merge a `main`
dispara el deploy; el humano dispara la migración.

---

## Consecuencias

### Producción deja de tener un punto de falla único

Un `db:sync-preview` que falla, o un seed roto, o un GRANT faltante en
preview, ya no tumban el deploy de producción. Producción arranca con el
último build que se mergeó a `main`, y se queda arriba hasta que el próximo
merge traiga el arreglo.

### Staging puede fallar sin consecuencias

Staging sí aborta si el sync falla, y eso es lo que queremos: si el
schema `preview` quedó mal, **el deploy de staging no debería pasar** y
dejar a la PR con un preview roto. El error se ve en el log de Railway, se
arregla, y el próximo push lo reintenta.

### Una sola fuente de verdad para "en qué schema estoy"

Antes, la app leía `AQUAZAKU_ENV` y el migrador leía el flag `--schema`.
Dos fuentes de verdad para la misma decisión. Ahora, ambos llaman a
`searchPathFor(env)`. Si el día de mañana hay un tercer schema (e.g.,
`staging_per_pr`), se cambia una función y los dos lados se enteran.

### Las migraciones de producción son explícitas

El flujo de deploy ya tenía el merge a `main` como paso humano. Agregar
`pnpm db:migrate:prod` después del merge no introduce una nueva categoría
de "olvidos": el deploy ya era atencional. Lo que sí se pierde es la
"migración automática que alguien configuró una vez y nunca más revisamos".

### El `CMD` del Dockerfile se queda

Antes se intentó sacar el `CMD` del Dockerfile y delegar todo al
`startCommand` de Railway. Eso movió el comportamiento del container a una
casilla de un panel: no se revisa en un diff, no se prueba en una máquina,
nadie la ve salvo quien la abra. Un cambio ahí rompió todos los deploys
durante un día sin que nada avisara. El `CMD` vuelve a ser la fuente de
verdad, y el `startCommand` la excepción para los ambientes que la
necesitan (staging).

### El primer deploy de producción trae migraciones

Después de aceptar este ADR, el primer merge a `main` con migraciones
nuevas requiere que alguien corra `pnpm db:migrate:prod` después del
deploy. Si se olvida, la app arranca con código que espera tablas que
todavía no existen. La mitigación: el deploy de Railway sigue pasando
aunque las migraciones no se hayan corrido, así que un descuido se ve
enseguida (errores 500 desde el primer request), no se acumula.

---

## Lo que el deploy de T9 nos dio y nos sacó — 9 de septiembre de 2026

Este ADR se escribió al cierre del SDD `2026-09-07-preview-environment`,
cuando el ciclo completo (PR → Vercel preview → Railway staging → Supabase
preview schema) empezó a verificarse de punta a punta. Lo que se ejecutó:

| Pieza | Estado |
| --- | --- |
| `AQUAZAKU_ENV` en el esquema validado | ✅ |
| `search_path` seteado en el pool con `connection` (no `options`) | ✅ |
| `db:migrate --schema=preview` con sed y journal separado | ✅ |
| `auditar-permisos-preview.ts` (REVOKE en `audit_log` de preview) | ✅ |
| `sincronizar-preview` migrando contra `preview` desde staging | ✅ |
| Guard `AQUAZAKU_ENV≠production` en el seed | ✅ |
| `*.vercel.app` en `trustedOrigins` de Better Auth | ✅ |
| `AQUAZAKU_ENV=development` en `docker-compose` | ✅ |
| `0015_audit_revoke.sql` (gap pre-existente en `0001`) | ✅ |
| **Migrador lee `searchPathFor(env)`** | ✅ |
| **`startCommand` de producción vacío; staging sincroniza** | ✅ |
| **PR de prueba end-to-end (T9)** | ✅ |

Los dos hallazgos que no estaban en el plan original, y que motivaron este
ADR:

1. **El migrador no leía `AQUAZAKU_ENV`.** La app sí, el pool de conexiones
   sí, las migraciones no. Staging migraba `public` en cada deploy sin
   que ningún test lo detectara. **Corregido en commit `27178cb`**
   ([`api/drizzle/migrate.ts`](https://github.com/maoacr/aquazaku-api)) con
   la función `searchPathFor`.
2. **El `startCommand` ataba producción a preview.** Producción no
   arrancaba si `db:sync-preview` fallaba, y `db:sync-preview` corría
   contra el schema equivocado en staging. **Corregido en commit
   `31ae27f`** ([`api/Dockerfile`](https://github.com/maoacr/aquazaku-api))
   restaurando el `CMD` y en `8626a45` (este repo) documentando el
   `startCommand` por ambiente.

Ambos fixes se documentan también en
[puesta en producción](/empezar/puesta-en-produccion/) y en
[entornos](/arquitectura/entornos/).

---

## Ver también

- [ADR-0010](/decisiones/0010-preview-environment/) — la decisión original
  de los dos schemas separados por `search_path`. Este ADR no la reemplaza:
  agrega la separación de los `startCommand`, que es ortogonal.
- [ADR-0009](/decisiones/0009-donde-corre-aquazaku/) — el principio "cada
  pieza en su plataforma". Este ADR lo aplica al arranque de cada
  ambiente dentro de Railway.
- [Puesta en producción](/empezar/puesta-en-produccion/) — operativa
  completa, paso a paso, con la tabla de `startCommand` por servicio.
- [Entornos](/arquitectura/entornos/) — la visión de los tres
  ambientes y qué schema le toca a cada uno.

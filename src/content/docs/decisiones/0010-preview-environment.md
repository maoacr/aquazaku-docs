---
title: ADR-0010 — Preview environments sin pagar Supabase Pro
description: Una sola base Supabase con dos schemas (`public` y `preview`) separados por search_path según AQUAZAKU_ENV.
---

**Estado:** Aceptado — ejecutado el 7-sep-2026
**Fecha:** 2026-09-07
**Deciden:** Mao

:::note[Para el diseño técnico, leer el spec]
Este ADR registra **la decisión**. El diseño —cómo se setea `search_path`,
cómo se reescriben las migraciones, qué scripts nuevos se agregan, cómo se
configuran Railway y Vercel— vive en el [spec de preview
environments](/superpowers/specs/2026-09-07-preview-environment-design/) y en
el [plan de implementación](/superpowers/plans/2026-09-07-preview-environment/).
Esta página **no los repite**.
:::

## Contexto

Después de salir a producción en [ADR-0009](/decisiones/0009-donde-corre-aquazaku/),
desarrollar sin tocar producción requería `docker compose` local. No había
preview environments: cualquier cambio mergeado a `main` ya estaba arriba.

Eso bloqueaba **probar cosas sin riesgo** — crear usuarios de prueba, cargar
insumos, validar una migración antes de mergear. Y la opción obvia para
resolverlo —branching de Supabase, un schema por PR— es la **Pro**, USD 25 por
mes por proyecto.

Para una planta de ocho personas y un sistema en MVP, **el precio paga cosas
que no necesitamos**. El branching de Supabase entrega:

- un **proyecto** Postgres completo por ambiente, no un schema;
- una **conexión** distinta por ambiente, no un cambio de `search_path`;
- la promesa de **aislamiento físico**, que no aplica cuando los datos de
  previews se tiran a la basura cada push.

Lo que sí necesitamos es **separar lo que es prod de lo que no**, con el mismo
esfuerzo de una variable de entorno.

## Alternativas evaluadas

### Opción A — Branching pago de Supabase (Pro)

- ✅ Aislamiento físico real. Una caída del schema de preview no toca prod.
- ✅ UI de Supabase para gestionar branches, time-travel, etc.
- ❌ USD 25/mes por proyecto, **antes** de pagar el resto de la infra.
- ❌ Dos conexiones por ambiente (pooler transacción + pooler sesión) y dos
  juegos de variables — lo que hoy son dos cadenas se vuelve cuatro.
- ❌ Rompe el contrato con [ADR-0009](/decisiones/0009-donde-corre-aquazaku/),
  que asumió Supabase **Free** con dos cadenas, no cuatro.

### Opción B — Un proyecto Supabase por ambiente

- ✅ Totalmente gratis en Free.
- ❌ Tres proyectos: prod, preview, dev. La pausa por inactividad del Free
  ([ADR-0009](/decisiones/0009-donde-corre-aquazaku/) ya lo resolvió con el
  latido) ahora se paga **tres veces**.
- ❌ Tres `DATABASE_URL` para rotar contraseñas, tres juegos de roles,
  tres migraciones. Lo que se gana en aislamiento se pierde en mantenimiento.

### Opción C — Un proyecto, dos schemas separados por `search_path`

- ✅ Cero costo. Supabase Free sigue siendo suficiente.
- ✅ Dos cadenas, no cuatro. Migración + aplicación siguen viviendo donde
  siempre.
- ✅ El código de la API no cambia: `from(ventas)` resuelve al schema correcto
  sin tocar una sola query.
- ✅ Better Auth respeta `search_path` automáticamente — sus tablas (`user`,
  `session`, `account`, `verification`) caen en el schema actual sin cambios.
- ❌ La separación es lógica, no física: un `DROP TABLE` con el rol equivocado
  podría romper los dos schemas. Mitigación: el rol de la aplicación **no es
  dueño** del schema (ver Permisos, en Consecuencias).

## Decisión

**Opción C.** Una sola base Supabase Free. Dos schemas — `public` para
producción, `preview` para no-prod— separados por `search_path`, seteado en el
pool de Postgres a partir de una variable nueva `AQUAZAKU_ENV`.

```
AQUAZAKU_ENV=production  → search_path=public
AQUAZAKU_ENV=preview     → search_path=preview
AQUAZAKU_ENV=development → search_path=public
```

Una sola instancia de Railway (`staging`) recibe los previews de Vercel, y
cada deploy corre migraciones + auditoría + seed contra el schema `preview`. El
schema se resetea con cada merge a `main`.

Lo que se eligió en concreto, en una línea: **dos schemas de Postgres en lugar
de un proyecto Supabase aparte**.

## Consecuencias

### Hay UNA sola base, y eso se nota

Los dos ambientes comparten proyecto de Supabase, pooler, roles y
`DATABASE_MIGRATION_URL`. Lo único que cambia entre producción y preview es
**una variable de entorno** y, por lo tanto, una línea en el panel de Railway
o Vercel.

| Variable | Antes | Ahora |
| --- | --- | --- |
| `DATABASE_URL` | una | **la misma** |
| `DATABASE_MIGRATION_URL` | una | **la misma** |
| `AQUAZAKU_ENV` | — | nueva, default `production` |

El detalle de qué variables se setean dónde está en la
[operativa de entornos](/arquitectura/entornos/).

### La inmutabilidad se replica — pero hay que verificarla

[ADR-0004](/decisiones/0004-audit-log-inmutable/) sostiene la garantía en dos
mitades: triggers **y** permisos. La mitad de los permisos —los veinte
`REVOKE` repartidos en nueve migraciones— se duplican al schema `preview` con
la reescritura `sed` que aplica `db:migrate --schema=preview`. La otra mitad
—los triggers— se duplican solos, porque van en el mismo `CREATE TABLE`.

Lo que **no** se duplica solo: `REVOKE UPDATE, DELETE ON audit_log FROM
aquazaku_app`. Resultado de la implementación: **`0001_audit_append_only.sql`
definía el trigger pero omitía el `REVOKE`**. La inmutabilidad de la bitácora
dependía solo del trigger, no de los permisos.

Esto es un **agujero pre-existente**, no algo del preview environment: la
única tabla append-only del sistema sin `REVOKE`. Se arregló en una migración
nueva, `0015_audit_revoke.sql`, sin tocar `0001` para no romper el hash del
journal de Drizzle en `public`.

:::caution[Por qué se verificó con un script y no con un trigger]
El trigger `reject_audit_mutation` aborta antes del chequeo de permisos, así
que `UPDATE … WHERE FALSE` no sirve para revelar los `GRANT`. La auditoría
usa `has_table_privilege('aquazaku_app', 'audit_log', 'UPDATE')`, que consulta
el catálogo sin pasar por el trigger. Si la auditoría falla, **el deploy
aborta**.
:::

### El pool no se configura con `options: '-c …'`

`postgres.js` (v3.4.9, la versión instalada) **no** acepta la sintaxis
`-c key=value` de `node-postgres`/`pg-promise`/libpq. Los parámetros de
arranque, incluido `search_path`, van bajo `connection` como key/value:

```ts
postgres(env.DATABASE_URL, {
  connection: { search_path: 'preview' },
})
```

La primera versión del spec usó `options: '-c search_path=preview'`, que es
correcto para `pg` pero falla silenciosamente con `postgres.js`: el proceso
arranca, los queries van a `public`, y el preview queda mostrando datos de
producción. **La falla no avisa.**

### El schema nuevo no es visible para `aquazaku_app` por defecto

Postgres no concede acceso al schema solo porque existe. Sin un
`GRANT USAGE ON SCHEMA preview TO aquazaku_app` y un
`ALTER DEFAULT PRIVILEGES IN SCHEMA preview …` para tablas y secuencias, el
rol de aplicación abre conexiones pero **no puede ni listar** las tablas del
schema nuevo. Detectado en T2, antes de cualquier deploy a staging.

### El journal de Drizzle es por ambiente

Drizzle guarda su registro de migraciones en una tabla configurable. Si el
runner reescribe las migraciones con `sed` y las aplica a `preview`
apuntando al mismo journal que `public`, Drizzle **cree que las migraciones
ya están aplicadas** y no vuelve a correr ninguna.

Solución: `migrationsTable: '__drizzle_migrations_preview'` cuando el target
es `preview`. Cada schema tiene su propio journal, en `drizzle`.

### Storage queda fuera del split

Los buckets de Supabase Storage son globales, no por schema. Un archivo
subido desde un preview queda en el mismo bucket que producción. La
decisión concreta (bucket separado, prefijo en el path, o no hacer nada) se
difiere hasta que se toque Storage por otra razón. **Recomendado**: bucket
separado cuando llegue.

### El schema `preview` no es un jardín

El schema es un **playground compartido** que se resetea con cada merge a
`main`. No hay limpieza periódica: si alguien lo necesita, se agrega un cron
después sin romper nada.

Lo que **no** se tolera: tratar al schema `preview` como un backup, o crear
datos ahí que se quieran conservar. El día que se necesite persistencia en
preview, la pregunta es si el flujo necesita un ambiente propio — y esa
decisión es más grande que este ADR.

### Rollback

Es un revert del commit. Las migraciones son idempotentes — `CREATE TABLE IF
NOT EXISTS`, no `DROP` ciego. Re-aplicar no rompe nada.

Lo que **no** se revierte con un revert: el schema `preview` queda con datos
residuales hasta el próximo deploy, que lo trunca. Si la urgencia es total,
`DROP SCHEMA preview CASCADE` lo deja como antes del primer deploy de preview.

---

## Lo que el preview nos dio y nos sacó — 7 de septiembre de 2026

Este ADR dejó de ser un plan el mismo día que se aceptó. Lo que se ejecutó:

| Pieza | Estado |
| --- | --- |
| `AQUAZAKU_ENV` en el esquema validado | ✅ |
| `search_path` seteado en el pool con `connection` (no `options`) | ✅ |
| `db:migrate --schema=preview` con `sed` y journal separado | ✅ |
| `auditar-permisos-preview.ts` (REVOKE en `audit_log` del schema preview) | ✅ |
| `sincronizar-preview` (post-deploy de prod) | ✅ |
| Guard `AQUAZAKU_ENV≠production` en el seed | ✅ |
| `*.vercel.app` en `trustedOrigins` de Better Auth | ✅ |
| `AQUAZAKU_ENV=development` en `docker-compose` | ✅ |
| `0015_audit_revoke.sql` (gap pre-existente en `0001`) | ✅ |
| PR de prueba end-to-end | 🔲 operativo |

Los tres hallazgos que no estaban en el plan original, y vale la pena
recordar:

1. **El bug de `0001`.** La bitácora dependía solo del trigger. Una PR con
   código que rompía la inmutabilidad habría pasado sus tests en preview
   porque el rol **sí podía** borrar ahí. El script de auditoría lo detectó
   antes de cualquier deploy. La fix `0015` se aplicó también a `public`.
2. **El API de `postgres.js`.** `options: '-c …'` es libpq-style. Con
   `postgres.js` falla silenciosamente: el proceso arranca, los queries van a
   `public`, y el preview muestra datos de producción **sin avisar**. La
   verificación con `SHOW search_path` en el log de arranque es lo que
   descubrió la falla.
3. **Los privilegios del schema.** Postgres no concede acceso por default.
   El runner de migración necesita `GRANT USAGE` + `ALTER DEFAULT PRIVILEGES`
   para que `aquazaku_app` pueda ni mirar el schema nuevo. Sin esto, el pool
   se conecta pero las queries devuelven `relation does not exist`.
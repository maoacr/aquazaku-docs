---
title: Desplegar, paso a paso
description: 'El recorrido completo de un cambio: de tu máquina a la planta. Con los comandos exactos, desde qué carpeta y en qué plataforma.'
sidebar:
  order: 6
---

Esta página es el **recorrido completo**, sin dar nada por sabido: qué se toca,
en qué orden, desde qué carpeta y en qué plataforma.

[Puesta en producción](/empezar/puesta-en-produccion/) explica cómo se armó la
infraestructura una vez. Esta explica cómo se despliega **cada cambio**.

## Primero: el mapa

Tres repositorios separados, tres plataformas, una sola base de datos.

| Repo | Dónde vive en tu máquina | Se despliega en | Qué es |
| --- | --- | --- | --- |
| `api` | `~/code/aquazaku/api` | **Railway** | El backend. Habla con Postgres |
| `web` | `~/code/aquazaku/web` | **Vercel** | El front. Habla con `api`, nunca con Postgres |
| `docs` | `~/code/aquazaku/docs` | (sitio estático) | Esta documentación |

Y la base:

| | Dónde | Schema |
| --- | --- | --- |
| **Producción** | Supabase | `public` |
| **Preview** | la MISMA Supabase | `preview` |
| **Local** | Postgres de tu máquina | `public` de `aquazaku_dev` |

:::note[Producción y preview comparten base, no datos]
Son dos **schemas** dentro del mismo Postgres. `preview.clientes` y
`public.clientes` son tablas distintas, con datos distintos y usuarios
distintos. Cuál usa cada proceso lo decide `AQUAZAKU_ENV` — ver
[Entornos](/arquitectura/entornos/).
:::

## La regla que hay que entender antes de nada

**Railway y Vercel despliegan solos al mergear a `main`. Las migraciones NO.**

El `startCommand` de producción está vacío a propósito: el container solo
arranca el servidor. Migrar es un acto separado, deliberado, que hacés vos desde
tu máquina.

De ahí salen las dos preguntas de todo despliegue:

1. ¿Este cambio trae una migración?
2. Si la trae, ¿el código nuevo aguanta el schema viejo, o al revés?

## Caso A — Sin migraciones

El caso común. No hay nada que coordinar.

```bash
gh pr merge --merge
```

Railway y Vercel detectan el push a `main` y redespliegan. Listo.

## Caso B — Con migración ADITIVA

Aditiva quiere decir que solo **agrega**: una columna nullable, una tabla, un
índice. El código viejo no se entera de que existe.

Ahí el orden documentado funciona: mergear primero, migrar después.

```bash
gh pr merge --merge
```

```bash
cd ~/code/aquazaku/api
DATABASE_MIGRATION_URL='<cadena de Supabase>' pnpm db:migrate
```

## Caso C — Con migración que RENOMBRA o CONVIERTE

Acá el orden se invierte, y no es una preferencia: es que el otro orden rompe la
planta.

Una migración que renombra `nombre` a `nombre_libre` deja al código viejo y al
nuevo incompatibles **en direcciones opuestas**. Medido:

| | Leer clientes | Registrar cliente |
| --- | :-: | :-: |
| Código viejo + schema nuevo | ✅ | ❌ |
| Código nuevo + schema viejo | ❌ | ❌ |

Migrar primero deja el sistema **funcionando**: se vende, se consulta, se cobra,
y lo único que falla es dar de alta un cliente nuevo durante los dos minutos del
deploy. Al revés se cae todo lo de clientes, y con eso ventas, retornables y
cartera.

### C.1 — Respaldo

```bash
cd ~/code/aquazaku/api
DATABASE_MIGRATION_URL='<cadena de Supabase>' pnpm db:respaldo
```

:::danger[Sin la cadena, respalda TU MÁQUINA]
`db:respaldo` lee `DATABASE_MIGRATION_URL` — la misma variable que el migrador —
y el script corre con `--env-file-if-exists=.env`, que apunta a `localhost`. Sin
pasarla explícitamente, el respaldo sale de `aquazaku_dev` y **termina con un
`✓` que parece éxito**.

Como el migrador, anuncia el destino antes de empezar:

```
→ respaldando postgres.taytdxptguvrszjtsroz@aws-0-us-east-1.pooler.supabase.com/postgres
```

Si dice `aquazaku@localhost/aquazaku_dev`, ese respaldo no sirve para lo que lo
pediste.
:::

### C.2 — Migrar producción, ANTES de mergear

La rama tiene que estar en tu máquina —ahí vive el archivo de la migración—.

```bash
cd ~/code/aquazaku/api
git checkout <la-rama-de-la-PR>
```

```bash
DATABASE_MIGRATION_URL='<cadena de Supabase>' pnpm db:migrate
```

### C.3 — Mergear

```bash
gh pr merge --merge
```

`api` primero y `web` después: el front llama al backend, no al revés.

### C.4 — Verificar

```bash
curl -s https://api.aquazaku.com/health
```

## De dónde sale la cadena de Supabase

Es la parte que más se traba, y tiene dos trampas.

En el panel de Supabase: **Project Settings → Database → Connection string**.

:::danger[La conexión directa NO sirve]
`db.<ref>.supabase.co` tiene **solo registro AAAA**: es IPv6. Falla con un
`ENOTFOUND` que jamás menciona IPv6, y se persigue como si fuera un problema de
credenciales.

Va la del **pooler**, no la que el panel ofrece primero.
:::

Para migrar hacen falta estas características:

| | Valor |
| --- | --- |
| Modo | **sesión** (no transacción) |
| Puerto | **5432** |
| Usuario | **`postgres.<ref-del-proyecto>`** |

El modo sesión es obligatorio porque las migraciones hacen DDL y `REVOKE`, y el
modo transacción no los sostiene.

:::caution[El pooler pide el rol con el ref pegado]
El usuario del pooler no es `postgres` a secas, es `postgres.<ref>`. El panel ya
te la da armada así — copiala tal cual y solo reemplazá `[YOUR-PASSWORD]`.
:::

## Lo que el migrador imprime, y por qué hay que leerlo

**Antes de tocar nada**, el script anuncia a dónde va:

```
→ migrando postgres.taytdxptguvrszjtsroz@aws-0-us-east-1.pooler.supabase.com/postgres → schema "public"
✓ migraciones aplicadas
```

La contraseña nunca aparece — está sacada a propósito, porque esta línea termina
en logs y en capturas de pantalla.

:::danger[Si esa línea dice `localhost`, cortá con Ctrl+C]
Es el error más caro que se puede cometer acá, y ya pasó: se dumpeó la base
local creyendo que era producción, porque la variable se había puesto con
`export` en otra terminal y el `.env` tomó el control en silencio.

Por eso el script lo anuncia. **Leelo siempre.**
:::

:::caution[`pnpm db:migrate:prod` lee un archivo, no tu variable]
Ese atajo corre `tsx --env-file-if-exists=.env.produccion.local`. Si ese archivo
quedó apuntando a otro lado —pasa— vas a migrar la base equivocada y el comando
te va a decir «✓ migraciones aplicadas» igual.

La forma explícita no depende de ningún archivo:

```bash
DATABASE_MIGRATION_URL='...' pnpm db:migrate
```
:::

## Cómo saber si quedó bien

```bash
curl -s https://api.aquazaku.com/health
```

**Bien:**

```json
{"status":"ok","service":"aquazaku-api","base":"ok","desdeHaceMs":19608}
```

**Mal — faltan migraciones:**

```json
{"status":"ok","service":"aquazaku-api","base":"ok","desdeHaceMs":97950,
 "esquema":"pendientes","faltan":["0016_nombre_partido"]}
```

Mientras aparezca `faltan`, el código desplegado está pidiéndole a la base algo
que no tiene. `status` sigue diciendo `ok` porque el **servidor** está sano —
lo que está mal es el schema, y por eso se reporta aparte.

Y la comprobación que ninguna consola reemplaza: entrá a
[app.aquazaku.com](https://app.aquazaku.com) y registrá **un** cliente de
verdad.

## El preview, que es otro camino

Un push a una PR despliega dos cosas más:

| Plataforma | Qué |
| --- | --- |
| **Vercel** | La URL `xxx-git-<rama>-aquazaku.vercel.app` |
| **Railway (`staging`)** | La api del preview, contra el schema `preview` |

El `startCommand` de staging **sí** migra, porque va contra un schema
desechable:

```bash
pnpm db:sync-preview && pnpm db:seed && pnpm start
```

:::caution[Los `&&` encadenan: si uno falla, `pnpm start` no corre]
Y entonces la api de staging **no levanta**, aunque Vercel muestre el front sin
problemas. Desde afuera se ve como «el login no me acepta», que es un síntoma
que apunta al lado equivocado.

Cuando el preview no ande, el log del deploy de staging en Railway es el primer
lugar a mirar, no el último.
:::

Cómo entrar al preview y qué usuario usar está en
[Entornos](/arquitectura/entornos/#cómo-se-entra-al-preview).

## Cuando algo sale mal

| Síntoma | Qué pasó | Qué hacer |
| --- | --- | --- |
| `/health` dice `faltan: [...]` | Se mergeó sin migrar | Correr la migración |
| `ENOTFOUND db.<ref>.supabase.co` | Es la conexión directa, IPv6 | Usar la del pooler |
| El migrador dice `localhost` | La cadena no es la de producción | Ctrl+C |
| 500 en todas las pantallas de clientes | Casi siempre el schema atrasado | Mirar `/health` |
| El preview no acepta ningún usuario | La api de staging no arrancó | Log del deploy en Railway |
| CI en rojo pero GitHub deja mergear | `main` no tiene protección de rama | Decidirlo aparte |

## Rollback

**Código**: revert del commit. Railway y Vercel redespliegan solos.

**Migración**: revertir el código **no la deshace**. Si la migración ya corrió,
hay que escribir otra que la deshaga explícitamente y correrla igual que la
primera. Por eso el respaldo del paso C.1 no es ceremonia.

---
title: Arrancar a trabajar
description: 'Qué levantar, en qué orden y cómo saber que quedó bien — la rutina de cada día, no la instalación.'
sidebar:
  order: 5
---

Esta página es la de **cada día**. Da por hecho que la máquina ya está
provisionada: si es la primera vez, primero va
[Entorno local](/empezar/entorno-local/), que instala Postgres, crea las bases y
los roles, y deja los servicios corriendo.

:::tip[La versión corta]
Si nada cambió desde ayer, son dos comandos y una comprobación:

```bash
pnpm --dir api dev
```

```bash
pnpm --dir web dev
```

Y `curl -s localhost:3001/health` tiene que decir `"base":"ok"` sin `faltan`.
:::

## 1 · Los servicios que no se arrancan a mano

Postgres y Mailpit están instalados como servicios de `brew` y arrancan solos
con la máquina. No hay que hacer nada — pero sí conviene mirarlos cuando algo
raro pasa:

```bash
brew services list
```

Lo que tiene que decir:

| Servicio | Estado esperado |
| --- | --- |
| `postgresql@16` | `started` |
| `mailpit` | `started` |

:::caution[Hay dos Postgres instalados y solo uno sirve]
`postgresql@17` también aparece en la lista, en estado `error`. **Es el que NO
se usa.** Las bases de Aquazaku viven en el 16.

Si alguna vez alguien arranca el 17, va a pelear por el puerto 5432 con el 16 y
la app se va a conectar a una base vacía que parece corrupta. No lo arranques.
:::

Si Postgres está caído:

```bash
brew services start postgresql@16
```

## 2 · ¿Hay migraciones nuevas?

**Este es el paso que más se olvida**, y el que produce los errores más
confusos: el código pide columnas que la base todavía no tiene, y lo que se ve
es un 500 que no dice por qué.

Después de cualquier `git pull` que traiga migraciones:

```bash
cd api && pnpm db:migrate
```

:::danger[La base de tests se migra APARTE]
`pnpm db:migrate` toca `aquazaku_dev`. La base de tests es **otra**, y si se
queda atrás los tests fallan con errores de columna inexistente que parecen
bugs del código:

```bash
cd api && pnpm db:migrate:test
```

Son dos comandos porque son dos bases. Olvidarse del segundo cuesta media hora
de buscar un bug que no existe.
:::

El migrador **anuncia a qué base y a qué schema apunta antes de tocarlos**.
Leé esa línea siempre:

```
→ migrando aquazaku@localhost/aquazaku_dev → schema "public"
✓ migraciones aplicadas
```

## 3 · Levantar la api

```bash
pnpm --dir api dev
```

Corre con `tsx watch`: se reinicia sola al guardar. Queda en el **3001**.

## 4 · Levantar el front

En **otra terminal** —los dos servidores quedan en primer plano—:

```bash
pnpm --dir web dev
```

Queda en el **3000**.

:::caution[Next se niega a arrancar dos veces desde la misma carpeta]
Si ya hay un `next dev` corriendo, el segundo no arranca y avisa con el PID del
primero:

```
⨯ Another next dev server is already running.
- PID: 1728
```

No es un error que haya que resolver con `--port`: es que ya está levantado.
Abrí el que corre, o matá el PID que te dice si quedó colgado.
:::

## 5 · Comprobar que quedó bien

Tres comprobaciones, en orden. Si una falla, las de abajo no importan.

```bash
curl -s localhost:3001/health
```

```json
{"status":"ok","service":"aquazaku-api","base":"ok","desdeHaceMs":377602}
```

Lo que hay que mirar:

| Campo | Qué significa |
| --- | --- |
| `"base":"ok"` | La api habla con Postgres |
| `"base":"arrancando"` | Todavía no hubo primer contacto. Esperá unos segundos |
| `"base":"sin-contacto"` | Perdió la base. Mirá `brew services list` |
| **`faltan: [...]`** | **Hay migraciones sin aplicar.** Volvé al paso 2 |

El campo `faltan` solo aparece cuando algo está pendiente. Si no está, el
schema está al día.

Después:

```bash
curl -s -o /dev/null -w '%{http_code}\n' localhost:3000/login
```

Un `200` quiere decir que el front levantó **y** que pudo hablar con la api —
la pantalla de login se arma del lado del servidor.

## 6 · Entrar

En [localhost:3000](http://localhost:3000), con un usuario de `aquazaku_dev`.

:::note[Si no te acordás de la contraseña]
En desarrollo **ningún correo sale a internet**: van a Mailpit.

Usá «¿Olvidó su contraseña?» en el login y leé el mensaje acá:

```bash
open http://localhost:8025
```

El enlace de recuperación funciona igual que en producción. Resend solo se usa
allá.
:::

## Las otras dos cosas que a veces hacen falta

### La documentación

```bash
pnpm --dir docs dev
```

Queda en el **4321**. Solo hace falta cuando se escribe documentación — no es
parte del arranque normal.

### La colección de Bruno

Corre en CI en cada push, y a veces conviene correrla en local antes. Necesita
**dos condiciones** que la base de desarrollo no cumple: estar vacía y tener un
solo administrador. Por eso va contra la base de **tests**, en el 3002.

Está explicado en la propia colección (`bruno/aquazaku/collection.bru`) y hay
una configuración `api-pruebas` en `.claude/launch.json` que la levanta apuntada
a `aquazaku_test`.

## Puertos: quién es quién

| Puerto | Qué |
| --- | --- |
| 3000 | `web` |
| 3001 | `api` |
| 3002 | `api` contra la base de tests, solo para Bruno |
| 4321 | `docs` |
| 5432 | Postgres |
| 1025 | Mailpit, SMTP |
| 8025 | Mailpit, la bandeja para leer |

Para ver qué está ocupando uno:

```bash
lsof -nP -iTCP:3000 -sTCP:LISTEN
```

Liberar un puerto colgado y el resto de la gestión de servicios están en
[Entorno local](/empezar/entorno-local/#liberar-un-puerto-de-dev-colgado).

## Cuando algo no arranca

| Síntoma | Causa más probable |
| --- | --- |
| `ECONNREFUSED :5432` | Postgres caído → `brew services start postgresql@16` |
| `/health` dice `faltan: [...]` | Migraciones sin aplicar → paso 2 |
| Los tests fallan por columnas que no existen | Falta `pnpm db:migrate:test` |
| `Another next dev server is already running` | Ya está levantado. Usá ese |
| La pantalla de login no carga | La api está caída: el front la consulta del lado del servidor |
| El correo de recuperación «no llega» | Llegó a Mailpit, no a internet → `localhost:8025` |
| Un 500 en todas las pantallas | Casi siempre el schema desactualizado. Mirá `/health` |

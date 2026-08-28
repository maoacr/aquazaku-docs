---
title: ADR-0009 — Postgres gestionado, aplicación en una máquina
description: Dónde corre Aquazaku en producción, y por qué el hosting no es una decisión libre.
---

**Estado:** Aceptado
**Fecha:** 2026-08-28
**Deciden:** Mao

## Contexto

Aquazaku llegó a M9 sin una sola decisión de infraestructura escrita. No había
ADR, no había Dockerfile, y **la palabra «internet» no aparecía en ninguno de
los ocho ADR anteriores ni en el dominio**.

Eso importaba más de lo que parecía: todo el MVP se diseñó *web-first* asumiendo
que la planta tiene conexión, y esa suposición nunca se dijo en voz alta ni se
validó. Se validó al empezar esto: **el servicio de internet en Campo de la Cruz
es continuo.** El día que haya que operar sin conexión será una PWA con
sincronización, y eso es M8 — no una restricción de hoy.

### Lo que el sistema exige del hosting

El hosting no es una elección libre. Hay dos condiciones que salen del código:

**1. Veinte `REVOKE` repartidos en nueve migraciones.** Las bitácoras
—`audit_log`, `movimientos_stock`, `movimientos_base`, `movimientos_insumo`,
`lineas_de_compra`— son append-only, y esa garantía tiene **dos** mitades: los
triggers y los permisos. [ADR-0006](/decisiones/0006-invariantes-en-la-base/)
explica por qué viven en la base.

Cualquier Postgres que no permita `CREATE ROLE` y `REVOKE` deja la mitad de esa
garantía sin poner — y lo hace **en silencio**, porque las migraciones corren
igual.

**2. `pg_advisory_xact_lock`** en el parque de botellones, y un pool de diez
conexiones persistentes.

## Alternativas evaluadas

### Opción A — Todo en una máquina con Docker

- ✅ Un artefacto, una factura, una cosa que respaldar.
- ✅ Control total de los roles de Postgres.
- ✅ El BFF le habla a `api` por red privada: la API **no es alcanzable desde
  internet**.
- ❌ **Los respaldos quedan a cargo de uno.** Un `pg_dump` por cron que hay que
  acordarse de sacar de la máquina. Es la parte más débil.

### Opción B — Todo repartido: Vercel para `web`, algo para `api`, Postgres gestionado

- ✅ Respaldos y escalado gestionados.
- ❌ **El BFF deja de ser interno.** Hoy `web` le habla a `api` por la red
  privada de Docker. Repartido, ese tráfico sale a internet y la API tiene que
  quedar expuesta. No es fatal —hay HTTPS, validación de `Origin` y sesión— pero
  es un cambio de postura que el diseño no asumía.
- ❌ El pool de diez conexiones asume un proceso vivo. En serverless cada
  instancia abre el suyo y se agota el límite.
- ❌ Tres proveedores para ocho personas y un mostrador.

### Opción C — Postgres gestionado, aplicación en una máquina

- ✅ Respaldos gestionados con recuperación a un punto en el tiempo.
- ✅ El BFF sigue hablándole a `api` por red privada.
- ✅ Solo cambia una variable de entorno respecto de la opción A.
- ❌ Dos proveedores en vez de uno.
- ❌ Latencia de red entre la aplicación y la base, en vez de un socket local.

## Decisión

**Opción C.** Postgres en Supabase; `api` y `web` juntos en una máquina con
Docker Compose.

Lo que inclinó la balanza fueron **los respaldos**. Un dump que se queda en el
mismo disco no es un respaldo: es una copia que se pierde con el disco. Esa era
la debilidad concreta de la opción A, y es exactamente lo que un Postgres
gestionado resuelve.

## Lo que se verificó antes de decidir, y no se supuso

La condición no negociable se probó contra una instancia real:

| Qué | Resultado |
| --- | --- |
| `CREATE ROLE aquazaku_app` | ✅ el rol `postgres` puede, sin ser superusuario |
| Los veinte `REVOKE` | ✅ toman |
| Las once migraciones | ✅ 27 tablas, 13 triggers |
| Bitácoras después de migrar | ✅ `SELECT INSERT`, sin `UPDATE` ni `DELETE` |
| `pg_advisory_xact_lock` por el pooler de transacción | ✅ toma y libera |
| `UPDATE audit_log` con el rol de la aplicación | ✅ `permission denied` |

El último es el que cierra la decisión: la garantía se sostiene **en caliente y
por el camino que usa la aplicación de verdad**, no en un test sintético.

## Consecuencias

### Hay DOS cadenas de conexión, y confundirlas rompe cosas

| Variable | Pooler | Puerto | Por qué |
| --- | --- | :-: | --- |
| `DATABASE_URL` | transacción | 6543 | La aplicación. `pg_advisory_xact_lock` se libera al cerrar la transacción, así que este modo le sirve. |
| `DATABASE_MIGRATION_URL` | sesión | 5432 | Las migraciones. Necesitan DDL, `CREATE ROLE` y `REVOKE`, que el modo transacción no sostiene. |

:::danger[La conexión DIRECTA no sirve]
`db.<ref>.supabase.co` resuelve **solo por IPv6**: Supabase convirtió IPv4 en un
complemento pago. No funciona desde una máquina sin ruta IPv6 —ni desde la
mayoría de los servidores baratos— y el error es un `ENOTFOUND` que no dice nada
sobre IPv6.

Es la cadena que el panel ofrece primero. Van las del pooler.
:::

### La versión de Postgres deja de coincidir

Supabase corre **17.6**; el CI y el entorno local corren **16**. Las migraciones
pasaron contra 17, pero eso es una brecha de paridad: un bug que solo aparezca
en 17 no se vería hasta producción.

**Se sube el CI y el compose local a 17** para cerrarla.

### La aplicación sigue siendo portable

`api` y `web` corren en contenedores contra cualquier Postgres que cumpla las
dos condiciones de arriba. Si Supabase deja de convenir, cambia una variable de
entorno — no la arquitectura.

Es lo mismo que permitió probar todo el despliegue contra un Postgres local en
Docker antes de tocar una nube.

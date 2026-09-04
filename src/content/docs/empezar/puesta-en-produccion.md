---
title: Puesta en producción
description: Los pasos concretos para poner Aquazaku a funcionar, en orden y con lo que hay que verificar en cada uno.
---

[ADR-0009](/decisiones/0009-donde-corre-aquazaku/) explica **por qué** cada pieza
va donde va. Esta página es el **cómo**, en orden.

:::caution[El orden importa]
Los pasos 1 y 2 se hacen **antes** de cargar el primer cliente. Mover un
proyecto de Supabase o cambiar de cuenta con datos reales adentro ya no es un
paso: es una migración.
:::

## Las cinco piezas

| Pieza | Dónde corre | Se despliega con |
| --- | --- | --- |
| `web` | Vercel | push a `main` |
| `api` | **pendiente** — Railway o Fly | push a `main` |
| Postgres | Supabase | migraciones |
| Correo | Resend | — |
| DNS | Cloudflare (dominio en Namecheap) | — |

### ¿`api` puede correr en Supabase?

**No.** Supabase corre Postgres, y para código ofrece *Edge Functions*, que son
**Deno y serverless**. `api` es Node con Fastify. Son dos incompatibilidades
distintas y cada una alcanza sola:

| | Lo que ofrece Supabase | Lo que necesita `api` |
| --- | --- | --- |
| Runtime | Deno | Node 22 |
| Ciclo de vida | una función por petición | un proceso que sigue vivo |

Lo segundo es lo que no se negocia: `api` mantiene un **pool de diez
conexiones** y toma **`pg_advisory_xact_lock`** dentro de transacciones. Las dos
cosas asumen un proceso que sobrevive entre peticiones. En funciones, cada
invocación abriría su propio pool y la base se quedaría sin conexiones antes que
sin trabajo.

Supabase hace de base de datos. `api` se despliega aparte.

### Dónde sí, entonces

Cualquier plataforma que corra el **Dockerfile que `api` ya tiene** y lo
mantenga arriba:

| Servicio | A favor | En contra |
| --- | --- | --- |
| **Railway** | Detecta el Dockerfile solo, deploy en cada push, variables en el panel. Lo más corto de acá a producción | Cuesta más por hora que Fly |
| **Fly.io** | Más barato al escalar, elección de región | Pide `fly.toml` y su CLI: más pasos antes del primer deploy |
| Render | Similar a Railway | Los planes gratuitos duermen el servicio |

**Para Aquazaku conviene Railway.** No por ser mejor plataforma, sino porque el
cuello de botella no es el costo ni la latencia: es cuántos pasos hay entre un
push y la planta usando el sistema. Con ocho personas y una sola región, la
región configurable de Fly no compra nada y sí cuesta un archivo más que
mantener.

Si en un año el costo empieza a doler, mudarse es cambiar de plataforma el mismo
Dockerfile.

---

## 1. Las cuentas van a nombre de la empresa

Las cinco con el correo de Aquazaku, no con el personal. No es formalidad: el
día que alguien más administre la planta, una cuenta a nombre de una persona es
un rehén.

## 2. Rotá la contraseña de la base

Si la contraseña de Postgres pasó por un chat, un ticket o un mensaje, **ya no
es secreta**. Se rota en el panel de Supabase antes de cargar nada.

---

## 3. El reparto de dominios, y por qué no es cosmético

| Subdominio | Apunta a |
| --- | --- |
| `app.<dominio>` | Vercel (`web`) |
| `api.<dominio>` | Railway o Fly (`api`) |

Los dos **tienen que compartir el dominio padre**. La sesión vive en una cookie
que emite `api` con el atributo `domain`, y `web` la reenvía tal cual al
navegador ([`api-server.ts`](https://github.com/maoacr/aquazaku-web)). Con
dominios distintos, el navegador la descarta y **el login parece funcionar pero
nadie queda logueado**.

Por eso `COOKIE_DOMAIN` va con el padre: `.<dominio>`.

:::note[Cloudflare delante de Vercel]
Si dejás el registro *proxied* (nube naranja), revisá que el modo SSL/TLS de
Cloudflare esté en **Full (strict)**. Con «Flexible» se arma un bucle de
redirecciones que se lee como un problema de la aplicación y no lo es.
:::

---

## 4. Supabase: el rol de la aplicación

La mitad dura de la inmutabilidad del `audit_log`
([ADR-0004](/decisiones/0004-audit-log-inmutable/)) son permisos, no triggers.
Hacen falta **dos roles**:

| Rol | Para qué | Puede |
| --- | --- | --- |
| `aquazaku` | migraciones | DDL, `CREATE ROLE`, `REVOKE` |
| `aquazaku_app` | la aplicación | leer y escribir; **no** `UPDATE` ni `DELETE` sobre `audit_log` |

Y **dos cadenas distintas**, que Supabase ofrece en el mismo panel:

| Variable | Modo del pooler | Puerto | Por qué ese |
| --- | --- | :-: | --- |
| `DATABASE_URL` | transacción | 6543 | `pg_advisory_xact_lock` se libera al cerrar la transacción, así que este modo le sirve |
| `DATABASE_MIGRATION_URL` | sesión | 5432 | Las migraciones necesitan DDL, `CREATE ROLE` y `REVOKE`, que el modo transacción no sostiene |

:::danger[La conexión directa no sirve]
`db.<ref>.supabase.co` **solo tiene registro AAAA**: es IPv6. Falla con un
`ENOTFOUND` que nunca menciona IPv6, y se persigue como si fuera un problema de
credenciales. Van las cadenas del **pooler**, no la que el panel ofrece primero.
:::

### La verificación que cierra el paso

No alcanza con que las migraciones corran. Hay que probar que el candado existe:

```sql
-- Con el rol de la aplicación. Tiene que responder «permission denied».
UPDATE audit_log SET accion = 'otra cosa' WHERE id = (SELECT id FROM audit_log LIMIT 1);
```

Si eso **no** falla, el rol quedó mal y la bitácora es editable. Todo lo demás
puede esperar; esto no.

---

## 5. Las variables, por plataforma

### `api` — Railway o Fly

| Variable | Valor |
| --- | --- |
| `DATABASE_URL` | pooler en modo transacción, rol `aquazaku_app` |
| `DATABASE_MIGRATION_URL` | pooler en modo sesión, rol `aquazaku` |
| `BETTER_AUTH_SECRET` | 32 caracteres o más, generado al azar |
| `BETTER_AUTH_URL` | `https://api.<dominio>` |
| `COOKIE_DOMAIN` | `.<dominio>` |
| `WEB_PUBLIC_URL` | `https://app.<dominio>` |
| `MAIL_TRANSPORT` | `resend` |
| `RESEND_API_KEY` | del panel de Resend |
| `EMAIL_FROM` | `noreply@<dominio>` |
| `NODE_ENV` | `production` |

El esquema **valida al importarse**: si falta una, el proceso no arranca y dice
cuál. Eso es a propósito — un servidor a medio configurar que igual levanta es
peor que uno que no levanta.

### `web` — Vercel

| Variable | Valor |
| --- | --- |
| `API_INTERNAL_URL` | `https://api.<dominio>` |
| `WEB_PUBLIC_URL` | `https://app.<dominio>` |

Son solo dos, y ninguna es `NEXT_PUBLIC_`. Eso no es casualidad: el navegador
nunca le habla a `api` ([ADR-0002](/decisiones/0002-bff-pattern/)), así que no
hay nada que exponer al cliente.

---

## 6. Resend

El transporte ya está implementado y con tests
([ADR-0001](/decisiones/0001-stack-m0/)): en desarrollo apunta a
Mailpit y no sale nada a internet, en producción va por Resend. **Es el mismo
código.**

Falta solo lo de afuera:

1. Verificar el dominio en Resend
2. Cargar en Cloudflare los registros que Resend indique — SPF, DKIM y el de
   verificación
3. Poner `EMAIL_FROM` con ese dominio

Sin los registros DNS el correo sale, pero cae en spam. Y un correo de
recuperación de contraseña en spam es una cuenta perdida.

---

## 7. La primera vuelta completa

El sistema arranca **vacío a propósito**. Nada de datos de prueba: un cliente
inventado en producción sobrevive años y aparece en un reporte.

1. Crear el usuario `admin`
2. Entrar y **cambiar la contraseña** — el sistema lo exige antes de dejar pasar
   a ningún lado
3. Cargar los productos reales
4. Cargar las 40 bases con su consecutivo, que ya tienen sticker desde `0001`
5. Registrar el primer cliente de verdad
6. Hacer una venta y verificar que aparece en el extracto del contador

El paso 6 es el que prueba que el sistema entero está conectado: toca ventas,
stock, retornables y reportes en una sola operación.

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

## 4. Supabase, en orden

### 4.1 — El rol de la aplicación va ANTES de migrar

En Supabase el rol dueño ya existe y se llama `postgres`. El que falta es el de
la aplicación.

:::danger[El orden no es negociable]
La migración `0001` hace `GRANT ... TO aquazaku_app`, y **ninguna migración crea
ese rol**. Si no existe antes, la primera migración falla — y falla a la mitad,
con la base ya tocada.
:::

En el SQL Editor de Supabase:

```sql
CREATE ROLE aquazaku_app LOGIN PASSWORD 'una-contraseña-fuerte-y-distinta';
```

Distinta de la de `postgres`. Son dos roles justamente para que comprometer uno
no entregue el otro.

### 4.2 — Las dos cadenas

Del panel de Supabase, **las del pooler**. El panel ofrece las dos con el usuario
`postgres`: **la de la aplicación hay que cambiarla a mano.**

:::danger[El pooler pide el rol con el ref del proyecto pegado]
Un rol propio se conecta como `<rol>.<ref-del-proyecto>`, no como `<rol>` a
secas. Para `DATABASE_URL`, el usuario va así:

```
postgres.abcdefghijk      ← lo que da el panel   ✗ es el DUEÑO
aquazaku_app.abcdefghijk  ← lo que va            ✓
```

Y la contraseña es la que le pusiste al rol, no la del proyecto.
:::

| Variable | Modo | Puerto | Rol | Por qué ese |
| --- | --- | :-: | --- | --- |
| `DATABASE_URL` | transacción | 6543 | `aquazaku_app` | `pg_advisory_xact_lock` se libera al cerrar la transacción |
| `DATABASE_MIGRATION_URL` | sesión | 5432 | `postgres` | DDL y `REVOKE`, que el modo transacción no sostiene |

:::danger[La conexión directa no sirve]
`db.<ref>.supabase.co` **solo tiene registro AAAA**: es IPv6. Falla con un
`ENOTFOUND` que nunca menciona IPv6, y se persigue como si fuera un problema de
credenciales. Van las del **pooler**, no la que el panel ofrece primero.
:::

### 4.3 — Migrar

Desde tu máquina, con `DATABASE_MIGRATION_URL` apuntando a Supabase:

```bash
pnpm db:migrate
```

### 4.4 — La verificación que cierra el paso

Que las migraciones corran **no prueba que el candado exista**. Conectate con la
cadena de `DATABASE_URL` —la de `aquazaku_app`— y hacé estas tres:

```sql
-- 1. ¿Con qué rol estoy conectado?  Tiene que decir aquazaku_app.
SELECT current_user;

-- 2. Un libro de movimientos: tiene que responder «permission denied».
UPDATE movimientos_stock SET cantidad = 0 WHERE id IS NOT NULL;

-- 3. La bitácora: tiene que responder «bitácora de auditoría es de solo inserción».
UPDATE audit_log SET accion = 'otra cosa' WHERE id IS NOT NULL;
```

:::danger[La 1 y la 2 son las que importan, y la 3 sola engaña]
La 3 falla **igual con cualquier rol**, porque la frena un trigger. Si se usa
sola como verificación, una base conectada con el rol `postgres` la pasa —y todo
lo demás queda desprotegido—.

Lo que distingue los roles es la 2: los 20 `REVOKE` **no aplican al dueño de las
tablas**. Con `postgres`, los diez libros de movimientos vuelven a ser
editables.
:::

### Cómo se protege cada cosa, que no es igual

| Qué | Cómo | ¿Frena a `postgres`? |
| --- | --- | :-: |
| `audit_log` | nunca recibe `UPDATE`/`DELETE`, y tres triggers | El trigger sí; pero el dueño puede **desactivarlo** |
| 10 libros de movimientos | 20 `REVOKE` en 9 migraciones | **No.** El `REVOKE` no aplica al dueño |

Por eso las dos capas se sostienen entre sí: los triggers frenan la mutación, y
los permisos impiden quitar los triggers. Conectar la aplicación como `postgres`
elimina la segunda, y con ella la primera queda a un `ALTER TABLE` de distancia.

### 4.5 — Sembrar lo mínimo

Crea el catálogo de roles, un administrador y los tres productos reales. **No
carga clientes ni ventas de prueba**: un cliente inventado en producción
sobrevive años y aparece en un reporte.

```bash
SEED_CONFIRM=yes \
SEED_ADMIN_EMAIL=vos@tudominio.com \
SEED_ADMIN_PASSWORD='una-contraseña-larga' \
pnpm db:seed
```

`SEED_CONFIRM=yes` es obligatorio en producción a propósito. Es idempotente: si
ya hay un admin activo, no hace nada.

Los productos quedan **desactivados y sin precio**. No se pueden vender hasta que
un admin les cargue el precio real — sembrar un precio inventado sería peor.

---

## 5. Probá el respaldo antes de tener qué perder

:::caution[Supabase Free no tiene respaldos]
El plan gratuito dice `Backup retention: None`. No son respaldos limitados: **no
hay**. Mientras el plan sea ese, `pnpm db:respaldo` **es** el respaldo.
:::

```bash
# pg_dump tiene que ser 17: Supabase corre 17.6 y pg_dump se niega a volcar
# un servidor más nuevo que él. Homebrew no lo enlaza solo.
export PATH="$(brew --prefix postgresql@17)/bin:$PATH"

pnpm db:respaldo
```

Conviene correrlo **ahora**, con la base recién sembrada. Un respaldo roto
descubierto hoy cuesta cero; descubierto en marzo cuesta el año.

El script verifica el volcado antes de comprimirlo: el marcador de cierre de
`pg_dump`, las tablas que declara el esquema, y que haya `REVOKE`. Ese último
existe porque `--no-privileges` produce un archivo que restaura una base
funcional **con la bitácora editable**.

Agregá el `export PATH` a tu perfil de shell, o el comando falla en cada terminal
nueva.

---

## 6. Desplegar `api`

`api` **no tiene plan gratuito viable**: necesita un proceso vivo, y eso cuesta
entre 3 y 6 dólares al mes. Es la única pieza que no puede arrancar gratis.

Con [Railway](https://railway.com):

1. Nuevo proyecto → conectar el repo `aquazaku-api`
2. Detecta el `Dockerfile` solo
3. Cargar las variables
4. Generar el dominio, o dejarlo interno si `web` también vive ahí

| Variable | Valor |
| --- | --- |
| `NODE_ENV` | `production` |
| `DATABASE_URL` | pooler transacción, rol `aquazaku_app` |
| `DATABASE_MIGRATION_URL` | pooler sesión, rol `postgres` |
| `BETTER_AUTH_SECRET` | 32 caracteres o más, al azar |
| `BETTER_AUTH_URL` | `https://api.<dominio>` |
| `COOKIE_DOMAIN` | `.<dominio>` |
| `WEB_PUBLIC_URL` | `https://app.<dominio>` |
| `MAIL_TRANSPORT` | `resend` |
| `RESEND_API_KEY` | del panel de Resend |
| `EMAIL_FROM` | `noreply@<dominio>` |

El esquema **valida al importarse**: si falta una, el proceso no arranca y dice
cuál. Es a propósito — un servidor a medio configurar que igual levanta es peor
que uno que no levanta.

---

## 7. Desplegar `web`

En [Vercel](https://vercel.com): importar el repo `aquazaku-web`. Dos variables,
ninguna `NEXT_PUBLIC_`:

| Variable | Valor |
| --- | --- |
| `API_INTERNAL_URL` | `https://api.<dominio>` |
| `WEB_PUBLIC_URL` | `https://app.<dominio>` |

Que ninguna sea pública no es casualidad: el navegador nunca le habla a `api`
([ADR-0002](/decisiones/0002-bff-pattern/)), así que no hay nada que exponer al
cliente.

---

## 8. DNS en Cloudflare

| Registro | Apunta a |
| --- | --- |
| `app` | Vercel |
| `api` | Railway |
| SPF, DKIM y verificación | lo que indique Resend |

Los dos subdominios **tienen que compartir el padre**. La sesión vive en una
cookie que emite `api` con atributo `domain`, y `web` la reenvía tal cual. Con
dominios distintos el navegador la descarta y **el login parece funcionar sin
que nadie quede logueado**.

:::note[Cloudflare delante de Vercel]
Si dejás el registro *proxied* (nube naranja), poné el modo SSL/TLS de
Cloudflare en **Full (strict)**. Con «Flexible» se arma un bucle de
redirecciones que se lee como un problema de la aplicación y no lo es.
:::

Sin los registros de Resend el correo sale, pero cae en spam. Y un correo de
recuperación de contraseña en spam es una cuenta perdida.

---

## 9. La primera vuelta completa

1. Entrar con el admin sembrado y **cambiar la contraseña** — el sistema lo exige
   antes de dejar pasar a ningún lado
2. Cargar el precio de los tres productos y activarlos
3. Cargar las 40 bases con su consecutivo, que ya tienen sticker desde `0001`
4. Registrar el primer cliente de verdad
5. Hacer una venta
6. Verificar que aparece en el extracto del contador

El paso 6 es el que prueba que el sistema entero está conectado: toca ventas,
stock, retornables y reportes en una sola operación.

---

## Lo que queda sin cubrir en la capa gratuita

| Riesgo | Estado |
| --- | --- |
| Supabase Free no tiene respaldos | Cubierto a mano con `pnpm db:respaldo` — **manual, depende de acordarse** |
| Supabase Free se pausa a la semana sin uso | Con uso diario no aparece; en vacaciones sí |
| Vercel Hobby prohíbe el uso comercial | Sin cubrir. El seguro es que `web/Dockerfile` funciona: mudar a Railway son horas |

Ninguno bloquea arrancar. Los tres se resuelven con dinero el día que el sistema
haya demostrado que vale la pena gastarlo.

---
title: Entorno local de desarrollo
description: Qué instalar y cómo dejar la máquina lista para trabajar en api/ y web/. Postgres, Mailpit, Bruno, Node.
sidebar:
  order: 4
---

Todo lo que necesitás instalado antes de escribir la primera línea de `api/` o
`web/`. Si el entorno no está, la [Task 1 del plan de M0](/arquitectura/roadmap/)
falla en el primer paso.

## Requisitos

| Herramienta | Versión | Para qué |
|---|---|---|
| Node.js | 22 LTS | Runtime de `api/` y `web/` |
| pnpm | 11.x | Gestor de paquetes de ambos repos |
| PostgreSQL | 16.x | Base de datos (dev + test) |
| Mailpit | 1.30+ | Servidor SMTP falso para probar emails en dev |
| Bruno CLI (`bru`) | 4.x | Correr la colección de API desde terminal y CI |
| Docker | opcional | Solo si preferís Postgres en contenedor |

:::note[Por qué Postgres nativo y no Docker]
Postgres corre nativo vía Homebrew como servicio de login. Es más rápido para
el ciclo de dev y evita el overhead del contenedor en cada arranque.

Si preferís contenedor, corré la misma imagen que usa el CI mapeada a `5432` y
pará el servicio de brew — el resto de la documentación aplica igual.
:::

:::caution[Local puede quedar una versión atrás, y está previsto]
Producción corre **Postgres 17** en Supabase ([ADR-0009](/decisiones/0009-donde-corre-aquazaku/)),
y el CI usa 17 para parecerse a producción — no a tu máquina.

Si tenés `postgresql@16` local, no hace falta migrar hoy: la compuerta que
decide si algo se mergea es el CI, y esa sí corre contra la versión real. Lo que
**no** puede pasar es lo contrario —CI en 16 y producción en 17— porque un bug
propio de 17 no se vería hasta estar desplegado.

Para alinearte del todo: `brew install postgresql@17` y apuntá las cadenas de
conexión a su puerto.
:::

## Instalación (macOS)

```bash
# Base de datos + cliente psql
brew install postgresql@16
brew services start postgresql@16

# Servidor SMTP falso para dev (reemplaza a MailHog, sin mantenimiento desde 2020)
brew install mailpit
brew services start mailpit

# Cliente de API para exploración manual y CI
npm install -g @usebruno/cli
```

:::caution[pnpm global no sirve para Bruno acá]
En esta máquina el `global-bin-dir` de pnpm (`~/Library/pnpm/bin`) no está en el
`PATH` — el que está es `~/Library/pnpm`. Instalar con `pnpm add -g` deja el
binario invisible. Por eso Bruno va con `npm install -g`, que aterriza en el
bin de Node que sí está en el `PATH`.
:::

## Provisionar bases y roles

### Dos roles, no uno

Esto no es ceremonia: es lo que hace que `audit_log` sea de verdad inmutable.

| Rol | Quién lo usa | Puede |
|---|---|---|
| `aquazaku` | drizzle-kit y el runner de migraciones | Es **dueño** de las tablas. DDL completo |
| `aquazaku_app` | el servidor de `api/` en runtime | Leer y escribir datos. Sobre `audit_log`, **solo `SELECT` e `INSERT`** |

Si la aplicación se conectara como dueña, un bug o una inyección podrían correr
`ALTER TABLE audit_log DISABLE TRIGGER` y después borrar la bitácora. Con un rol
que no es dueño, no puede — ni siquiera teniendo control del proceso.

Los triggers frenan a todo el mundo, incluido el dueño; los permisos frenan a la
aplicación aunque alguien desactive los triggers. Cada capa tapa el hueco de la
otra. Ver [ADR-0004](/decisiones/0004-audit-log-inmutable).

### Comandos

```bash
# Rol dueño: crea y altera tablas
psql -d postgres -c "CREATE ROLE aquazaku LOGIN PASSWORD 'aquazaku' CREATEDB;"

# Rol de la aplicación: sin CREATEDB, sin CREATEROLE, sin superuser
psql -d postgres -c "CREATE ROLE aquazaku_app LOGIN PASSWORD 'aquazaku_app';"

# Una base para desarrollo y otra que los tests truncan entre suites
createdb -O aquazaku aquazaku_dev
createdb -O aquazaku aquazaku_test

for db in aquazaku_dev aquazaku_test; do
  psql -d postgres -c "GRANT CONNECT ON DATABASE $db TO aquazaku_app;"
  psql -d "$db" -c 'GRANT USAGE ON SCHEMA public TO aquazaku_app;'
done
```

Los roles son objetos de **cluster**, no de base: por eso se crean acá y no en
una migración. Los `GRANT` sobre tablas sí viven en la migración
`0001_audit_append_only`, porque dependen del schema.

### Aplicar el schema

```bash
cd api && pnpm db:migrate && pnpm db:migrate:test
```

La migración crea la extensión `citext` sola — `users.email` la necesita para que
el login sea case-insensitive sin depender de que cada query recuerde un
`LOWER()`. No hace falta crearla a mano.

## Cómo se conecta cada cosa

| Servicio | URL / DSN |
|---|---|
| Postgres — app, dev | `postgres://aquazaku_app:aquazaku_app@localhost:5432/aquazaku_dev` |
| Postgres — migraciones, dev | `postgres://aquazaku:aquazaku@localhost:5432/aquazaku_dev` |
| Postgres — app, test | `postgres://aquazaku_app:aquazaku_app@localhost:5432/aquazaku_test` |
| Postgres — migraciones, test | `postgres://aquazaku:aquazaku@localhost:5432/aquazaku_test` |
| Mailpit SMTP | `smtp://localhost:1025` |
| Mailpit web UI | <http://localhost:8025> |
| `api/` | <http://localhost:3001> |
| `web/` | <http://localhost:3000> |

:::caution[Limpiar audit_log en un test cuesta]
Los triggers rechazan también el `TRUNCATE`, así que vaciar la bitácora exige
desactivarlos y volver a prenderlos — y eso solo lo puede hacer el rol dueño. El
helper `resetDb()` de `api/src/test/db.ts` ya lo encapsula.

Que sea incómodo es la señal de que la protección funciona. Si limpiar el log
fuera fácil, no estaría protegido.
:::

En dev los emails de recuperación de contraseña **no salen a internet**: van a
Mailpit y se leen en su UI web. Resend solo se usa en producción.

## Verificar que todo está arriba

```bash
pg_isready
psql -h localhost -U aquazaku -d aquazaku_dev -c '\dx'
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:8025
bru --version
node -v && pnpm -v
```

Esperado: `accepting connections`, la lista de extensiones con `citext` y
`pgcrypto`, `200`, `4.x`, `v22.x`, `11.x`.

## Gestionar los servicios

Postgres y Mailpit se instalaron con `brew services`, o sea que Homebrew les
creó un **LaunchAgent**: arrancan solos cuando iniciás sesión en la Mac y
sobreviven a un reinicio.

Fue una decisión, no un accidente. Casi toda task de M0 en adelante toca la base
—migrations, seeds, tests de integración— y un servicio que hay que prender a
mano es un servicio que un día olvidás prender y te comés diez minutos
debuggeando un `ECONNREFUSED` que no era un bug.

### Estado

```bash
brew services list
```

Buscá `postgresql@16` y `mailpit` en `started`.

### Prender, parar, reiniciar

```bash
brew services start postgresql@16
```

```bash
brew services stop postgresql@16
```

```bash
brew services restart postgresql@16
```

Lo mismo con `mailpit`. `stop` además desactiva el LaunchAgent: el servicio deja
de arrancar solo hasta que hagas `start` de nuevo.

### Correr uno sin dejarlo instalado como servicio

Útil si querés el proceso en primer plano, ver sus logs en vivo, o simplemente no
dejar nada corriendo de fondo:

```bash
LC_ALL="en_US.UTF-8" /usr/local/opt/postgresql@16/bin/postgres -D /usr/local/var/postgresql@16
```

```bash
/usr/local/opt/mailpit/bin/mailpit
```

Se cortan con `Ctrl+C` y no queda nada arrancando al iniciar sesión.

## Puertos: quién usa qué

| Puerto | Quién | Vive |
|---|---|---|
| 5432 | Postgres | permanente (LaunchAgent) |
| 1025 | Mailpit — SMTP | permanente (LaunchAgent) |
| 8025 | Mailpit — UI web | permanente (LaunchAgent) |
| 3001 | `api/` (`pnpm dev`) | solo mientras lo corrés |
| 3000 | `web/` (`pnpm dev`) | solo mientras lo corrés |

Los tres primeros están ocupados siempre y está bien. Los dos últimos deberían
estar **libres** cuando no estás desarrollando: si aparecen ocupados, quedó un
dev server colgado de una sesión anterior.

### Ver qué está escuchando

```bash
for p in 3000 3001 5432 1025 8025; do printf '%-6s %s\n' "$p" "$(lsof -nP -iTCP:$p -sTCP:LISTEN 2>/dev/null | awk 'NR==2 {print $1" (pid "$2")"; f=1} END {if (!f) print "libre"}')"; done
```

Salida esperada con todo en orden y sin desarrollar:

```
3000   libre
3001   libre
5432   postgres (pid 33676)
1025   mailpit (pid 33762)
8025   mailpit (pid 33762)
```

### Liberar un puerto de dev colgado

```bash
lsof -nP -iTCP:3000 -sTCP:LISTEN -t | xargs kill
```

Cambiá `3000` por `3001` para `api/`. **Nunca** apliques esto a 5432, 1025 ni
8025: esos son servicios gestionados, y se paran con `brew services stop`, que
además desregistra el LaunchAgent.

:::caution[Falso positivo al buscar procesos]
Si buscás procesos con `pgrep -fl aquazaku` van a aparecer varios
`Cursor Helper`. No son servidores: matchean solo porque el workspace del editor
se llama así. Fijate en los puertos, no en el nombre del proceso.
:::

## Versiones de librerías

Las versiones de npm se fijan en el `package.json` de cada repo, no acá. El
criterio del proyecto es **stable actual al momento de arrancar el módulo**, no
la última versión de cada semana: se actualiza deliberadamente entre módulos,
nunca en medio de uno.

Ver [ADR-0001](/decisiones/0001-stack-m0) para el stack y su justificación.

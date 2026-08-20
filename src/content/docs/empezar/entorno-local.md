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
el ciclo de dev y evita el overhead del contenedor en cada arranque. La
**paridad con CI** no se pierde: el workflow de GitHub Actions usa la imagen
`postgres:16`, la misma línea de versión que fija Homebrew con `postgresql@16`.

Si preferís contenedor, corré `postgres:16` mapeado a `5432` y pará el servicio
de brew — el resto de la documentación aplica igual.
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

## Provisionar las bases de datos

Se crean dos: una para desarrollo y otra que los tests truncan y recrean.

```bash
psql -d postgres -c "CREATE ROLE aquazaku LOGIN PASSWORD 'aquazaku' CREATEDB;"
createdb -O aquazaku aquazaku_dev
createdb -O aquazaku aquazaku_test

for db in aquazaku_dev aquazaku_test; do
  psql -d $db -c 'CREATE EXTENSION IF NOT EXISTS citext;'
  psql -d $db -c 'CREATE EXTENSION IF NOT EXISTS pgcrypto;'
done
```

`citext` es obligatoria: la columna `users.email` es `citext` para que el login
sea case-insensitive sin `LOWER()` en cada query. `pgcrypto` la usa Postgres
para generar UUIDs.

## Cómo se conecta cada cosa

| Servicio | URL / DSN |
|---|---|
| Postgres dev | `postgres://aquazaku:aquazaku@localhost:5432/aquazaku_dev` |
| Postgres test | `postgres://aquazaku:aquazaku@localhost:5432/aquazaku_test` |
| Mailpit SMTP | `smtp://localhost:1025` |
| Mailpit web UI | <http://localhost:8025> |
| `api/` | <http://localhost:3001> |
| `web/` | <http://localhost:3000> |

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

## Parar los servicios

```bash
brew services stop postgresql@16
brew services stop mailpit
```

## Versiones de librerías

Las versiones de npm se fijan en el `package.json` de cada repo, no acá. El
criterio del proyecto es **stable actual al momento de arrancar el módulo**, no
la última versión de cada semana: se actualiza deliberadamente entre módulos,
nunca en medio de uno.

Ver [ADR-0001](/decisiones/0001-stack-m0) para el stack y su justificación.

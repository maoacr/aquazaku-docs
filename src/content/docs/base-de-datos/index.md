---
title: Base de datos
description: Modelo de datos, migraciones y decisiones de modelado de Aquazaku.
sidebar:
  order: 1
---

## Qué documentar acá

- **Modelo de datos** — diagrama entidad-relación y qué representa cada tabla
  en términos del [dominio](/dominio/).
- **Migraciones** — cómo se crean, cómo se aplican, cómo se revierte.
- **Índices y consultas críticas** — las consultas que tienen que ser rápidas sí o sí.
- **Datos semilla** — qué necesita una instalación limpia para arrancar.

## El punto delicado

El modelo tiene que distinguir **producto** de **envase retornable**. Una paca sale
y no vuelve; un botellón sale, se espera que vuelva, y a veces no vuelve. Son dos
ciclos de vida distintos y un solo campo `stock` no los representa.

Esa decisión, cuando se tome, va documentada como
[ADR](/decisiones/) — es de las caras de revertir.

## Estado actual

**M0 — Auth + RBAC: ✅ implementado** (20-ago-2026).
**M1 — Productos: 🚧 en curso** — la tabla y sus invariantes ya están.

Ocho tablas, tres migraciones, sobre PostgreSQL 16.

### Tablas

| Tabla | Para qué |
|---|---|
| `users` | Identidad. `email` es `citext`: el login es case-insensitive **en la base**, sin depender de que cada query recuerde un `LOWER()` |
| `accounts` | **Acá vive el hash de la contraseña**, no en `users`. Better-Auth separa identidad de credencial para poder sumar OAuth sin tocar usuarios |
| `sessions` | Con `roles[]` congelados al iniciar sesión (RN-ACC-01) |
| `verifications` | Tokens de un solo uso para recuperar la contraseña |
| `roles` | Catálogo cerrado de los cuatro |
| `user_roles` | N:M, con quién otorgó cada rol |
| `audit_log` | Bitácora **append-only** |
| `productos` | Catálogo. Precios con piso garantizado por `CHECK` y litros como **columna generada** |

### `productos`: los invariantes viven en la base

La tabla del catálogo (M1) apoya tres reglas del dominio en Postgres y no en la
capa de servicio.

| Mecanismo | Qué garantiza |
|---|---|
| `CHECK productos_precio_minimo_es_piso` | [RN-CAT-04](/dominio/productos/) — el piso nunca supera un precio de lista |
| `GENERATED ALWAYS AS` en `litros` | [RN-PRD-01](/dominio/produccion/) — el derivado no puede desincronizarse de `contenido_ml × unidades` |
| `REVOKE DELETE` a `aquazaku_app` | [RN-CAT-02](/dominio/productos/) — un producto se desactiva, no se borra |

El servicio **igual** valida el piso, pero para otra cosa: para que el error diga
qué corregir en vez de escupir un mensaje de Postgres. La base es la que impide
el dato malo aunque un endpoint se olvide.

:::tip[El `CHECK` no perdona ni al dueño]
Verificado a mano: un `UPDATE` que baja el precio residencial por debajo del
piso **falla incluso ejecutado con el rol dueño**, el mismo que corre las
migraciones.

El `GRANT` solo limita al rol de la aplicación. El `CHECK` aplica a todo el
mundo — por eso hacen falta los dos, igual que en `audit_log`.
:::

:::caution[Los privilegios por defecto conceden `DELETE`]
La migración `0001` dejó un `ALTER DEFAULT PRIVILEGES` que otorga
`SELECT, INSERT, UPDATE, DELETE` sobre **toda tabla nueva**, para que nadie
tenga que acordarse de un `GRANT` por migración.

Consecuencia: `productos` nació con permiso de borrado heredado, y hubo que
**revocarlo explícitamente**. Toda tabla futura que deba ser append-only o
solo-desactivable tiene que hacer lo mismo — el default juega en contra.
:::

### `audit_log` es inmutable de verdad

Dos mecanismos independientes, porque ninguno alcanza solo —
[ADR-0004](/decisiones/0004-audit-log-inmutable):

1. **Triggers** que rechazan `UPDATE`, `DELETE` y `TRUNCATE`. Son
   `FOR EACH STATEMENT`: un `DELETE` que no matchea ninguna fila nunca
   dispararía uno por fila y pasaría en silencio.
2. **El rol de la aplicación** (`aquazaku_app`) no es dueño de las tablas y
   sobre `audit_log` solo tiene `SELECT` e `INSERT`.

Al dueño lo frena el trigger; al trigger lo podría desactivar el dueño. Juntas,
adulterar la bitácora exige credenciales del rol dueño **y** un `ALTER TABLE`
explícito.

`audit_log` **no tiene foreign key** a `users`, a propósito: si un usuario se
borra, su rastro tiene que sobrevivir. Un log que se borra en cascada no es un
log.

### Dos roles, no uno

| Rol | Lo usa | Puede |
|---|---|---|
| `aquazaku` | drizzle-kit y el runner de migraciones | Dueño de las tablas |
| `aquazaku_app` | el servidor en runtime | CRUD sobre datos; sobre `audit_log`, solo leer e insertar |

Se traduce en dos variables: `DATABASE_URL` y `DATABASE_MIGRATION_URL`. El
servidor nunca abre una conexión con la segunda. Provisionamiento en
[Entorno local](/empezar/entorno-local/).

### Migraciones y seed

```bash
pnpm db:migrate        # base de desarrollo
pnpm db:migrate:test   # base de tests
pnpm db:seed           # catálogo de roles + primer admin
```

| Migración | Qué trae |
|---|---|
| `0000_m0_initial` | Las siete tablas de M0 |
| `0001_audit_append_only` | Triggers de `audit_log` + permisos de `aquazaku_app` |
| `0002_productos` | Catálogo de productos, sus `CHECK` y el `REVOKE DELETE` |

Las migraciones son SQL explícito de Drizzle Kit, nunca auto-generadas contra
producción. Verificado: corren sobre una base **virgen** sin pasos manuales y son
**idempotentes**.

El seed también es idempotente: si ya hay un administrador activo no hace nada y
**termina con éxito**, así puede vivir en el pipeline de deploy. En producción
exige `SEED_CONFIRM=yes`.

### Decisiones de modelado

Las reglas de negocio viven en [`/dominio/`](/dominio/) y no se duplican acá.

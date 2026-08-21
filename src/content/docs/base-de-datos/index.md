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
**M1 — Productos y catálogo: ✅ implementado** (22-ago-2026).
**M2 — Stock: 🚧 en curso** — las tablas y sus invariantes ya están.

Diez tablas, cuatro migraciones, sobre PostgreSQL 16.

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
| `lotes` | Producto empacado un día, **con su saldo encima**. FIFO por vencimiento |
| `movimientos_stock` | El libro que explica el saldo. **Append-only**, igual que `audit_log` |

### `productos`: los invariantes viven en la base

La tabla del catálogo (M1) apoya tres reglas del dominio en Postgres y no en la
capa de servicio.

El criterio general está en
[ADR-0006](/decisiones/0006-invariantes-en-la-base/): la base impide el dato
malo aunque un endpoint se olvide, y el servicio existe para que el error sea
legible. No son dos validaciones de lo mismo — son dos responsabilidades.

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

### `lotes` y `movimientos_stock`: el saldo y el libro que lo explica

El saldo vive **en el lote**, no en una tabla aparte: un lote ya es "producto +
fecha", y una tabla de saldos solo repetiría esa clave para agregar un número.

Los dos se escriben en la **misma transacción**. Si el saldo baja y el
movimiento no queda, el libro deja de explicar el saldo — es la primera forma de
descuadre, y la más difícil de rastrear meses después.

| Mecanismo | Qué garantiza |
|---|---|
| `CHECK cantidad_disponible >= 0` | [RN-STK-03](/dominio/stock/) — no hay stock negativo |
| `REVOKE UPDATE, DELETE` en `movimientos_stock` | [RN-STK-02](/dominio/stock/) — un libro editable no es un libro |
| `REVOKE DELETE` en `lotes` | Un lote no se borra, se queda en cero. Borrarlo dejaría movimientos huérfanos y ventas sin trazabilidad |
| `CHECK` condicionales de motivo y causa | [RN-STK-02](/dominio/stock/) y [RN-STK-06](/dominio/stock/) — exigen el dato **solo** en ajuste y descarte |

:::danger[`fecha_vencimiento` NO es una columna generada, y `litros` sí]
Las dos las calcula el sistema y ninguna se tipea a mano. Parecen el mismo caso
y son opuestas:

- **`litros` es una definición.** 12 L es lo que una paca **es**. Si cambian sus
  entradas, debe recalcularse — por eso es `GENERATED ALWAYS AS`.
- **`fecha_vencimiento` es un hecho de un momento.** Este lote vence este día.

Si fuera generada, cambiar la regla a 45 días **recalcularía el vencimiento de
todos los lotes del pasado**, incluidos los ya vendidos. Es lo mismo que
[RN-CAT-07](/dominio/productos/) prohíbe para los precios: una regla nueva no
reescribe lo que ya pasó.
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
pnpm db:seed           # roles, primer admin y catálogo de productos
```

| Migración | Qué trae |
|---|---|
| `0000_m0_initial` | Las siete tablas de M0 |
| `0001_audit_append_only` | Triggers de `audit_log` + permisos de `aquazaku_app` |
| `0002_productos` | Catálogo de productos, sus `CHECK` y el `REVOKE DELETE` |
| `0003_stock` | Lotes con saldo, libro de movimientos append-only y sus `REVOKE` |

Las migraciones son SQL explícito de Drizzle Kit, nunca auto-generadas contra
producción. Verificado: corren sobre una base **virgen** sin pasos manuales y son
**idempotentes**.

El seed también es idempotente: si ya hay un administrador activo no hace nada y
**termina con éxito**, así puede vivir en el pipeline de deploy. En producción
exige `SEED_CONFIRM=yes`.

:::caution[Las pacas se siembran desactivadas, a propósito]
De los tres productos, solo el precio del botellón está confirmado
([RN-CAT-08](/dominio/productos/)): $10.000.

Las dos pacas entran con precio `0` **y desactivadas**. No es un dato a medio
cargar: es la única forma de que el faltante no pase inadvertido. Un precio
inventado se confunde con uno real; un `0` activo deja vender a $0 y el problema
recién aparece en el cierre.

Desactivadas, la venta se bloquea hasta que un `admin` cargue el precio y las
active. El seed lo avisa en cada corrida:

```
⚠ 2 producto(s) esperando precio, desactivados:
    P20U_600ML
    P50U_300ML
```
:::

### Decisiones de modelado

Las reglas de negocio viven en [`/dominio/`](/dominio/) y no se duplican acá.

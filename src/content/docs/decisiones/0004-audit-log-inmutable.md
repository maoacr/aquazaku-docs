---
title: ADR-0004 — audit_log inmutable con dos capas independientes
description: La bitácora se protege con triggers append-only y con un rol de aplicación de privilegio mínimo. Ninguna de las dos capas alcanza sola.
---

**Estado:** Aceptado
**Fecha:** 2026-08-20
**Deciden:** Mao (product owner), asistente AI

## Contexto

RN-ACC-04 exige que toda acción sensible quede registrada y que ese registro sea
**inmutable**. Es la regla que sostiene la confianza en el sistema: si la
bitácora se puede editar, no sirve como evidencia de nada.

El [spec de M0](/arquitectura/roadmap/) pedía triggers que rechacen `UPDATE` y
`DELETE`, más un `REVOKE UPDATE, DELETE ON audit_log FROM app_user`. Al ir a
implementarlo aparecieron dos problemas concretos:

1. **El rol `app_user` no existía.** La aplicación se conectaba con `aquazaku`,
   que es el **dueño** de las tablas. Y a un dueño no se le puede revocar nada
   de forma efectiva: siempre puede volver a otorgarse el permiso. El `REVOKE`,
   tal como estaba escrito, no protegía absolutamente nada.
2. **Los triggers solos tampoco alcanzan.** El dueño de una tabla puede correr
   `ALTER TABLE audit_log DISABLE TRIGGER ALL` y después borrar lo que quiera.

O sea: las dos medidas del spec, aplicadas como estaban, dejaban la bitácora
tan editable como si no hubiera nada.

## Alternativas evaluadas

### Opción A — Solo triggers, la aplicación sigue conectándose como dueña

- ✅ Cero cambios en el entorno: una sola conexión, un solo rol
- ✅ Cumple literalmente el criterio del spec ("los triggers rechazan UPDATE y DELETE")
- ❌ Un `ALTER TABLE ... DISABLE TRIGGER` desde el código de la API desarma todo
- ❌ Una inyección SQL con permisos de dueño puede borrar la evidencia de la propia inyección

### Opción B — Solo permisos, sin triggers

- ✅ Simple y declarativo
- ❌ No protege nada de lo que se ejecute con el rol dueño: migraciones, scripts de mantenimiento, una consola de psql abierta por error contra producción
- ❌ El día que alguien corra un "arreglito" a mano, no hay nada que lo frene

### Opción C — Las dos capas, con roles separados *(elegida)*

- ✅ Cada capa cubre exactamente el hueco de la otra
- ✅ Adulterar la bitácora pasa a requerir credenciales del rol dueño **y** un `ALTER TABLE` explícito. Deja de ser algo que puede pasar por accidente o por un bug
- ✅ Es el patrón estándar de producción: migraciones con rol privilegiado, aplicación con rol mínimo
- ❌ Dos DSN en la configuración en vez de uno
- ❌ Limpiar `audit_log` en los tests exige un ritual (desactivar triggers, truncar, reactivar)

## Decisión

Se implementan **las dos capas**, con dos roles de Postgres separados.

| Rol | Lo usa | Privilegios |
|---|---|---|
| `aquazaku` | drizzle-kit y el runner de migraciones | Dueño de las tablas. DDL completo |
| `aquazaku_app` | el servidor de `api/` en runtime | CRUD sobre las tablas de datos. Sobre `audit_log`, **solo `SELECT` e `INSERT`** |

En `api/` eso se traduce en dos variables de entorno: `DATABASE_URL` (aplicación)
y `DATABASE_MIGRATION_URL` (migraciones). El servidor nunca abre una conexión con
la segunda.

Los triggers son **`FOR EACH STATEMENT`** y no `FOR EACH ROW`, y hay uno también
para `TRUNCATE`. La razón es un caso borde que un trigger por fila deja pasar en
silencio: un `DELETE FROM audit_log WHERE ...` que no matchea ninguna fila nunca
dispararía un `FOR EACH ROW`. Tiene que fallar ruidosamente igual — el intento
importa tanto como el resultado.

Los roles se crean al provisionar el entorno, no en una migración: son objetos de
cluster, no de base. Los `GRANT` sobre tablas sí van en la migración
`0001_audit_append_only`, porque dependen del schema.

## Consecuencias

**Se vuelve fácil:**

- Confiar en la bitácora como evidencia real, no como una convención que todos
  prometen respetar
- Acotar el daño de una inyección SQL: aunque comprometa el proceso de la API, no
  llega a la auditoría
- Sumar tablas en M1+ sin acordarse de correr `GRANT`: un
  `ALTER DEFAULT PRIVILEGES` ya deja los permisos listos, y `audit_log` queda
  fuera porque ya existía

**Se vuelve difícil / costoso:**

- Hay que provisionar dos roles, no uno. Está documentado en
  [Entorno local](/empezar/entorno-local/)
- Limpiar `audit_log` entre tests requiere desactivar y reactivar los triggers
  desde el rol dueño. Lo encapsula `resetDb()` en `api/src/test/db.ts`
- Cualquier corrección legítima sobre la bitácora (que no debería existir) exige
  un procedimiento deliberado y visible. Eso es intencional

**Riesgo aceptado:** un `UPDATE` sobre `audit_log` ya no falla silenciosamente,
falla con excepción. Si algún día se agrega código que intente modificar la
bitácora, va a romper en vez de degradar. Es el comportamiento que queremos.

## Verificación

La garantía está cubierta por tests automáticos en
`api/src/db/__tests__/audit-immutability.test.ts`, no por una comprobación manual
hecha una sola vez. Los tests distinguen **qué capa** frenó cada intento: al rol
de aplicación lo detiene el `GRANT` faltante (`permission denied`), al rol dueño
lo detiene el trigger (`append-only: … rechazado`).

Una garantía que solo se verificó a mano una vez no es una garantía: es un
recuerdo.

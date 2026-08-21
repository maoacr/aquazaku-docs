---
title: ADR-0006 — Los invariantes de negocio viven en la base
description: "Por qué un CHECK de Postgres y no solo una validación de servicio, y qué se duplica a propósito."
---

**Estado:** Aceptado
**Fecha:** 2026-08-21
**Deciden:** Mao (product owner), asistente AI

## Contexto

M1 trajo el primer invariante duro del sistema:
[RN-CAT-04](/dominio/productos/) dice que el precio mínimo de un producto nunca
puede superar sus precios de lista. Si se rompe, un código de descuento puede
dejar una venta por debajo del piso y nadie se entera hasta el cierre.

Habrá muchos más. M2 necesita que el stock no quede negativo, M3 que un insumo
no se consuma más de lo que hay, M4 que el balance de agua cierre. La decisión
que se tome acá se repite en cada módulo.

Hay además una restricción concreta del proyecto: existen **dos roles de
Postgres** ([ADR-0004](/decisiones/0004-audit-log-inmutable/)). El de la
aplicación no es dueño de las tablas, y el dueño corre las migraciones. Una
garantía puede aplicar a uno, al otro, o a los dos.

## Alternativas evaluadas

### Opción A — Validar solo en la capa de servicio

- ✅ Un solo lugar, en TypeScript, fácil de testear y de leer.
- ✅ El mensaje de error se escribe para una persona.
- ❌ **Se saltea con un `UPDATE` directo.** Una migración, un script de
  corrección, un `psql` a las once de la noche: ninguno pasa por el servicio.
- ❌ Depende de que cada endpoint nuevo se acuerde de llamarla. El día que
  alguien agregue una ruta y se olvide, el invariante deja de existir sin que
  ningún test lo note.

### Opción B — Validar solo con un `CHECK` en la base

- ✅ Aplica a **todos**: la aplicación, el dueño, un script suelto.
- ✅ No depende de la disciplina de quien escribe la query.
- ❌ El error que llega es de Postgres: `violates check constraint
  "productos_precio_minimo_es_piso"`. Ilegible para quien está cargando un
  precio.
- ❌ Llega tarde: el usuario ya mandó el formulario.

### Opción C — Las dos, con roles distintos ← **elegida**

- ✅ La base **impide** el dato malo; el servicio **explica** qué corregir.
- ✅ Cada capa hace lo que la otra no puede.
- ❌ La regla se escribe dos veces.

## Decisión

Elegimos **la Opción C**, y la parte que importa es *por qué no es duplicación*:

> La base impide el dato malo aunque un endpoint se olvide.
> El servicio existe para que el error sea legible.

No son dos validaciones de lo mismo: son **dos responsabilidades distintas**
que casualmente comparten una condición. Quitar cualquiera de las dos pierde
algo real.

Se aplica con tres mecanismos, según qué se quiera garantizar:

| Mecanismo | Garantiza | Ejemplo en M1 |
| --- | --- | --- |
| `CHECK` | Una condición sobre la fila, para todo el mundo | `precio_minimo <= ` los dos precios de lista |
| `GENERATED ALWAYS AS` | Que un derivado no pueda desincronizarse | `litros` = contenido × unidades |
| `REVOKE` al rol de app | Que una operación entera no exista | sin `DELETE` sobre `productos` |

:::danger[El `ALTER DEFAULT PRIVILEGES` juega en contra]
La migración `0001` dejó privilegios por defecto que conceden
`SELECT, INSERT, UPDATE, DELETE` sobre **toda tabla nueva**, para que nadie
tenga que acordarse de un `GRANT` por migración.

Consecuencia: una tabla nueva **nace con permiso de borrado**. Para que
`productos` no lo tuviera hubo que **revocarlo explícitamente** — agregar un
`GRANT` sin `DELETE` no quita nada.

Toda tabla futura que deba ser append-only o solo-desactivable tiene que hacer
lo mismo. El default es cómodo y silencioso, y esa combinación es peligrosa.
:::

## Consecuencias

**Se vuelve fácil:**

- Confiar en los datos sin auditar todo el código que los escribe.
- Corregir datos a mano sin miedo: la base rechaza lo que no corresponde.
- Que un módulo nuevo herede la garantía sin leer el código del anterior.

**Se vuelve difícil / costoso:**

- Cambiar un invariante exige una migración, no un deploy.
- Un `CHECK` mal escrito bloquea escrituras legítimas hasta que se migre.
- Hay que acordarse de escribir las dos mitades.

**Lo que aceptamos pagar:** la condición escrita dos veces, y una migración
cada vez que un invariante cambie.

**Lo que exige el ADR:** que cada invariante tenga un **test de integración que
lo verifique contra la base**, no solo contra el servicio. Sin ese test, el
`CHECK` podría faltar en la migración y nadie se enteraría — el servicio
seguiría validando y todo parecería bien.

## Verificado

Un `UPDATE` que baja el precio residencial por debajo del piso **falla incluso
ejecutado con el rol dueño**, el mismo que corre las migraciones. El `GRANT`
solo limita al rol de la aplicación; el `CHECK` no perdona a nadie.

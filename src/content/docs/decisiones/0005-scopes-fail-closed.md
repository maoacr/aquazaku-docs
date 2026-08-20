---
title: ADR-0005 — Los alcances fallan cerrados
description: Si un alcance no se puede traducir a un filtro, el código revienta. Nunca devuelve la consulta sin filtrar.
---

**Estado:** Aceptado
**Fecha:** 2026-08-20
**Deciden:** Mao (product owner), asistente AI

## Contexto

RN-ACC-03 exige que el alcance se aplique en **una sola capa de datos**. Esa capa
es `scopedCondition()` en `api/src/modules/authz/`: recibe el usuario, el recurso
y la acción, y devuelve la condición `WHERE` que recorta las filas que le
corresponden.

Los alcances no son todos iguales:

- `todo` no filtra nada.
- `propio`, `ruta` y `BODEGA` filtran filas, y cada uno necesita que la tabla
  tenga una columna concreta (`created_by`, `ruta_id`, `ubicacion`).
- `prep` y `operativos` **no filtran filas**: acotan qué categoría de reporte se
  puede ver. No hay columna por la cual filtrar.

Entonces aparece la pregunta que decide el diseño: **¿qué hace el código cuando
le piden un alcance que no puede aplicar?** Por ejemplo, alcance `propio` sobre
una tabla que no tiene columna de autor, o un alcance categórico sobre una
consulta de tabla.

El plan original de M0 respondía esto sin darse cuenta. Sus filtros eran, textual,
"stubs mínimos intencionales":

```ts
export const SCOPES = {
  todo:   { apply: (q) => q },
  propio: { apply: (q, ctx) => q },   // ← devuelve la consulta sin tocar
  ruta:   { apply: (q, ctx) => q },
  BODEGA: { apply: (q) => q },
}
```

Cada alcance devolvía la consulta **sin filtrar**. Un vendedor pidiendo "mis
ventas" habría recibido las ventas de toda la empresa, sin ningún error, sin
ninguna traza, sin que nadie se entere.

## Alternativas evaluadas

### Opción A — Devolver la consulta sin filtrar cuando el alcance no aplica

- ✅ Nunca rompe: ningún endpoint tira 500
- ❌ Falla **abierto**: ante la duda, muestra de más
- ❌ El bug es invisible. No hay excepción, no hay log, no hay síntoma. Se
  descubre cuando alguien nota que ve datos que no debería — o cuando no lo nota
- ❌ El caso más probable (una tabla nueva de M1+ que olvida declarar su columna)
  es justo el que produce la fuga

### Opción B — Devolver una condición que no matchea nada

- ✅ Falla **cerrado**: ante la duda, no muestra nada
- ✅ Sin excepciones en el camino del request
- ❌ El bug sigue siendo silencioso, solo que al revés: una pantalla vacía se
  confunde con "no hay datos" y puede convivir meses con el error

### Opción C — Lanzar una excepción *(elegida para el error de programación)*

- ✅ Falla cerrado y **ruidoso**: el error aparece en el primer test que toque
  ese camino, no en producción
- ✅ El mensaje puede decir exactamente qué columna falta y cómo declararla
- ❌ Si se escapa a producción, ese endpoint tira 500

## Decisión

Se combinan B y C según **de qué tipo es el problema**:

| Situación | Qué hace | Por qué |
|---|---|---|
| Alcance `todo` | Devuelve `undefined` (sin filtro) | Es el único caso donde no filtrar es la respuesta correcta |
| La tabla no declaró la columna que el alcance necesita | **Lanza** `ScopeNoAplicableError` | Es un error de programación. Tiene que explotar en el primer test |
| Alcance categórico (`prep`, `operativos`) sobre una consulta de tabla | **Lanza** `ScopeNoAplicableError` | Idem: nadie debería pedirlo |
| El usuario no tiene el permiso | **Lanza** `SinPermisoError` | Significa que alguien se salteó `can()` o `requirePermission()` |
| Alcance `ruta` y el usuario no tiene rutas abiertas | Devuelve "ninguna fila" | **No** es un error: es la respuesta correcta. Sin ruta abierta, no hay nada que ver |
| No quedó ninguna condición para combinar | Devuelve "ninguna fila" | Red de seguridad. Nunca `undefined` |

La regla que ordena todo:

> `undefined` significa "mostrale todo", así que **solo** puede salir del alcance
> `todo`. Nunca puede ser el resultado de que algo salió mal.

### Un bug que esta regla ya atrapó

Al implementar la combinación de varios alcances, el código quedó así:

```ts
const definidas = condiciones.filter((c) => c !== undefined)
if (definidas.length === 1) return definidas[0]
return or(...definidas)   // ← con lista vacía, `or()` devuelve undefined
```

El comentario que lo acompañaba decía "ante la duda preferimos filtrar de más".
El código hacía exactamente lo contrario: con la lista vacía devolvía `undefined`,
o sea **sin filtro**. Comentario y comportamiento en contradicción, en la función
que decide quién ve qué.

Se corrigió devolviendo la condición vacía, y hay un test que lo fija. La regla
sirvió justamente para lo que se escribió: hacer evidente una contradicción que
de otro modo pasaba desapercibida.

## Consecuencias

**Se vuelve fácil:**

- Agregar tablas en M1+: si una olvida declarar su columna de alcance, el test
  del módulo falla de inmediato con un mensaje que dice qué agregar
- Razonar sobre seguridad leyendo una sola regla, en vez de auditar cada endpoint
- Distinguir "no hay datos" de "algo se rompió": son caminos distintos del código

**Se vuelve difícil / costoso:**

- Un módulo mal configurado tira 500 en vez de degradar. Es intencional: preferimos
  un endpoint caído a uno que filtra datos
- Hay que declarar explícitamente las columnas de alcance en cada consulta. Más
  verboso que un filtro automático, y a propósito: lo automático es lo que se
  olvida en silencio

**Riesgo aceptado:** los alcances categóricos (`prep`, `operativos`) no tienen
implementación todavía porque el módulo de reportes es M13. Hoy lanzan si alguien
los usa contra una tabla. Cuando llegue M13 tendrán su propia resolución, fuera de
la capa de datos.

## Verificación

`api/src/modules/authz/__tests__/scopes.test.ts` incluye una invariante explícita:
para todo alcance que no sea `todo`, el resultado **nunca** es `undefined` — o
devuelve una condición, o lanza. Y con las columnas vacías, todos lanzan.

Los tests de `scoped-query.test.ts` van más lejos: ejecutan la condición generada
contra Postgres y verifican que las filas que vuelven son las que corresponden.
Una condición SQL que nunca se ejecutó no está probada: está escrita.

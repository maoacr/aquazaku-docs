---
title: Plan de M7 — Retornables
description: "Las 10 tasks de M7, con la ley de conservación primero: sin ID individual, esa igualdad es lo único que avisa que un botellón se perdió."
---

**Objetivo:** implementar M7 según la
[spec de diseño](/superpowers/specs/2026-08-26-m7-retornables-design/) — el
saldo de botellones por cliente, las bases con su ID y su historial, el recargo
por daño como venta que no ensucia la deuda, y las tres cuentas que faltaban en
la ficha.

**Dominio:** [Botellones y bases](/dominio/botellones-y-bases/) — 19 reglas.

**Estado:** ✅ **Terminado** (27-ago-2026) — las 10 tasks cerradas.

---

## La compuerta la eligió el dominio

`RN-ENV-02` viene con la instrucción incluida: *«este invariante es un test.
Escribilo temprano, corrélo seguido, y hacelo fallar ruidosamente»*.

```
Σ(saldos de todos los tenedores)  =  Σ compras − Σ descartes
```

Es la compuerta porque **sin ID individual, esa igualdad es lo único que avisa
que algo se perdió**. Un botellón que desaparece no deja hueco en ninguna tabla
—no hay fila que quede huérfana— solo deja la suma descuadrada.

```
T1 schema e invariantes ──┬── T2 la ley de conservación ── T3 movimientos de botellón ──┐
                          │                                                              ├── T7 endpoints ── T8 pantalla ── T9 la ficha completa
                          └── T4 bases y su ID ── T5 préstamo y retorno ── T6 daño ──────┘
                                                                                            T10 bruno + docs
```

- **T2** va antes que cualquier operación: es el test que las demás no pueden
  romper sin que se note.
- **T6** depende de M6: el recargo es una venta.
- **T9** es la que hace que la ficha del cliente deje de tener huecos.

## Restricciones globales

Las mismas de M4 a M6, más una que M6 dejó aprendida:

- **Las carpetas de Bruno llevan cero adelante.** `bru` ordena
  alfabéticamente y `"10" < "2"`. La carpeta nueva es `10-Retornables` y
  `Sesion` pasa a `11-`.
- **Leer la matriz antes de tocar permisos.** `botellones` y `bases` ya están.
- Correr la colección contra `aquazaku_test`, nunca contra desarrollo, y mover
  `BETTER_AUTH_URL` con el puerto.
- Migraciones a las DOS bases. `REVOKE` explícito en toda tabla nueva.

---

## Task 1 — Schema e invariantes

`movimientos_botellon`, `bases`, `movimientos_base`, y la columna `tipo` en
`ventas`.

Los invariantes que van a la base:

1. `CHECK (cantidad <> 0)` en los movimientos de botellón: un movimiento de cero
   no movió nada.
2. `UNIQUE (id_sticker)` — `RN-BAS-01`.
3. `CHECK` de que una venta `dano_base` no tenga líneas y una de `producto` sí.
   Se sostiene con un trigger porque cruza dos tablas.
4. `REVOKE UPDATE, DELETE` sobre los dos libros de movimientos: son append-only,
   como todos los demás del sistema.

## Task 2 — La ley de conservación

Una función que la calcula y un test que la corre. **No es una validación que se
llama antes de escribir**: es una verificación que se corre después de cada
operación en los tests, y que en producción alimenta un aviso.

Se prueba rompiéndola a mano —escribiendo una entrega de una sola fila— y
confirmando que el test se pone rojo.

## Task 3 — Movimientos de botellón

Compra, entrega, retorno, descarte y ajuste. **La entrega escribe dos filas** en
una transacción.

El saldo de un cliente se deriva; no hay columna editable (`RN-ENV-04`).

## Task 4 — Bases y su identificador · Task 5 — Préstamo y retorno

Una base está en **exactamente un lugar** (`RN-BAS-04`): prestar una que ya está
prestada se rechaza. Entregarla a un cliente sin verificar, también
(`RN-BAS-07`).

Cada movimiento queda en el historial (`RN-BAS-05`).

## Task 6 — El daño genera un recargo

Marcar `danada` crea una venta `tipo = 'dano_base'` con su motivo. Esa venta:

- **NO** suma a la deuda — `deudaDe` filtra por tipo.
- **SÍ** suma a los cargos pendientes.

Es la resolución de la contradicción entre `RN-BAS-08` y `RN-CLI-06`, y el
filtro es un invariante nuevo: un `deudaDe` que se lo olvide le cobra al cliente
un daño como si fuera producto.

## Task 7 — Endpoints · Task 8 — Pantalla · Task 9 — La ficha completa

15 endpoints, la pantalla de retornables con el estado del parque arriba de
todo, y las cuatro cuentas de la ficha del cliente con números reales.

La pantalla pone la ley de conservación en el lugar más visible **a propósito**.
Un botellón perdido no deja fila huérfana ni ID faltante: lo único que cambia en
todo el sistema es que la suma deja de cerrar. Un test lo detecta una vez al día
en CI; la pantalla lo detecta cuando alguien la abre.

## Task 10 — Bruno, documentación y cierre

`10-Retornables`: 42 requests, 107 asserts. `Sesion` pasó a `11-`, aplicando la
regla de M6 —`bru` ordena alfabéticamente, así que los números van con cero
adelante—.

Los dos traps de la base de prueba que costaron dos corridas en falso quedaron
en [Explorar la API](/backend/exploracion-api/): el ledger de migraciones vive
en el esquema `drizzle` y **sobrevive** a un `DROP SCHEMA public`, y los GRANTS
del rol de la aplicación viven en las migraciones —restaurarlos «a ojo» aplana
la garantía append-only—.

---

## Definition of Done de M7

La [de la spec](/superpowers/specs/2026-08-26-m7-retornables-design/#definition-of-done),
más los tres puntos de abajo. Los tres **verificados por ablación**: se borra el
mecanismo y se confirma que algo se pone rojo. Un test que pasa igual sin el
código que dice probar no prueba nada.

1. **Los tests de M1–M6 siguen en verde sin haberlos tocado.** 929 en verde,
   exit 0.
2. **Romper la ley de conservación a mano pone un test en rojo.** Sacando
   `'ajuste'` del filtro de `registrados`, la colección cae a 403/405: el
   request 14 falla con `expected 97 to equal 99`. El 13 sigue verde —a esa
   altura todavía no hay ajustes—, que es la señal de que los tests son
   específicos y no ruido.
3. **Quitar el filtro de tipo en `deudaDe` también.** Sin
   `and ventas.tipo = 'producto'` caen exactamente 2 de 929, y son los dos que
   guardan la regla: *«NO suma a la deuda, y SÍ a los cargos pendientes»* y
   *«no aparece en la deuda del cliente»*.

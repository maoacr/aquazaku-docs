---
title: Plan de M7 — Retornables
description: "Las 9 tasks de M7, con la ley de conservación primero: sin ID individual, esa igualdad es lo único que avisa que un botellón se perdió."
---

**Objetivo:** implementar M7 según la
[spec de diseño](/superpowers/specs/2026-08-26-m7-retornables-design/) — el
saldo de botellones por cliente, las bases con su ID y su historial, el recargo
por daño como venta que no ensucia la deuda, y las tres cuentas que faltaban en
la ficha.

**Dominio:** [Botellones y bases](/dominio/botellones-y-bases/) — 19 reglas.

**Estado:** 📝 Planificado — por implementar.

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

## Task 10 — Bruno, documentación y cierre

---

## Definition of Done de M7

La [de la spec](/superpowers/specs/2026-08-26-m7-retornables-design/#definition-of-done),
más:

1. Los tests de M1–M6 siguen en verde sin haberlos tocado.
2. Romper la ley de conservación a mano pone un test en rojo.
3. Quitar el filtro de tipo en `deudaDe` también.

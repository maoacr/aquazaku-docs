---
title: Spec de M7 — Retornables
description: Dos activos con modelos opuestos, una ley de conservación que el propio dominio pide escribir como test, y una contradicción entre dos reglas confirmadas que hay que resolver antes de escribir código.
---

**Dominio:** [Botellones y bases](/dominio/botellones-y-bases/) — 19 reglas, 13
confirmadas.

**Estado:** 📝 Diseñado — por planificar.

---

## M7 llena las tres cuentas que faltan

La ficha del cliente lleva cuatro saldos (`RN-CLI-06`). M6 llenó la deuda; las
otras tres —**botellones en su poder**, **bases prestadas** y **cargos
pendientes**— siguen diciendo «sin registrar todavía». Las tres son de acá.

---

## El milestone es un contraste

Dos activos retornables, **dos modelos opuestos**, y la diferencia no es un
detalle de implementación: es la razón de ser de cada uno.

| | Botellón | Base |
| --- | --- | --- |
| Identidad | **Ninguna** (`RN-ENV-01`) | ID único en un sticker (`RN-BAS-01`) |
| Se rastrea por | **Cantidad** | **Unidad** |
| Saldo a nivel | **Cliente** (`RN-ENV-04`) | **Dirección** (`RN-BAS-03`) |
| Si se daña | Nada — sin depósito ni recargo | **Recargo** (`RN-BAS-08`) |

**Por qué el botellón no tiene ID**: el intercambio tiene que seguir siendo de
baja fricción. Identificar cada envase agregaría un paso a cada visita sin
responder ninguna pregunta nueva — para reclamar ocho botellones no hace falta
saber cuáles ocho.

**Por qué la base sí**: hay que ir a buscarla a un lugar concreto. Sin saber en
cuál de los tres locales está la base `A-0913`, el préstamo deja de ser
reclamable.

:::caution[La tentación es unificarlos]
Son «cosas que se prestan y vuelven», y un solo modelo con `id_opcional` parece
más limpio. Sería peor: obligaría a decidir en cada consulta si el ID importa, y
la respuesta *depende del activo*. Dos tablas dicen la verdad; una con un campo
que a veces está miente sobre el modelo.
:::

---

## La compuerta es la ley de conservación

`RN-ENV-02` no es una regla más — es **el** invariante del módulo, y el propio
dominio dice qué hacer con él:

> «Este invariante es un test. Escribilo temprano, corrélo seguido, y hacelo
> fallar ruidosamente.»

```
Σ(saldos de todos los tenedores)  =  Σ compras − Σ descartes
```

Sin ID individual, **esa igualdad es lo único que avisa que algo se perdió**. Un
botellón que desaparece no deja hueco en ninguna tabla: deja la suma
descuadrada, y nada más.

Por eso el libro es de **deltas con signo sobre un tenedor**, y una entrega
escribe **dos filas** —una que resta de la bodega y otra que suma al cliente— en
la misma transacción. Así el invariante se verifica con una consulta, y una
transferencia mal escrita lo rompe de inmediato en vez de esconderse.

:::tip[Por qué dos filas y no una con origen y destino]
Una fila con `desde`/`hasta` obligaría a cada consulta de saldo a mirar las dos
columnas y sumar en un sentido o en otro según de quién se pregunte. Con deltas,
el saldo de cualquiera es siempre `SUM(cantidad) WHERE tenedor = X` — la misma
consulta para la bodega y para un cliente.
:::

---

## La contradicción entre dos reglas confirmadas

`RN-BAS-08` dice que el recargo por daño **es una venta** —para preservar la
auditoría unificada— y que puede ser **a crédito**.

`RN-CLI-06` dice que los cargos pendientes son **distintos de la deuda**,
*«porque no nacen de una venta a crédito»*.

Las dos están confirmadas y se contradicen: si el recargo es una venta a crédito,
cae en la deuda; si es un cargo aparte, no es una venta.

### Cómo se resuelve

**Las dos cosas a la vez, y se puede.** El recargo se registra como una venta con
`tipo = 'dano_base'`, así que hereda toda la auditoría del módulo de ventas: es
inmutable, se anula con motivo, queda con su autor. Y `deudaDe` **excluye ese
tipo**, mientras una consulta nueva lo cuenta como cargos pendientes.

Cada regla obtiene lo que pedía:

- `RN-BAS-08` quería auditoría unificada → la tiene, es una venta de verdad.
- `RN-CLI-06` quería que no se mezcle con la deuda → no se mezcla, porque el
  saldo filtra por tipo.

Lo que se agrega es una columna `tipo` en `ventas`, y **la obligación de que
todas las consultas de deuda la respeten**. Eso lo vuelve un invariante nuevo:
un `deudaDe` que se olvide del filtro le cobraría al cliente un daño como si
fuera producto.

:::danger[La venta de daño NO tiene líneas]
Una venta normal tiene líneas atadas a un lote — es producto que salió. Un
recargo por daño no mueve inventario: no hay lote del que salga una base rota.

`lineas_de_venta` seguirá siendo obligatorio para `tipo = 'producto'` y vacío
para `dano_base`, sostenido por la base con un `CHECK`. Sin eso, el día que
alguien registre una venta de producto sin líneas, el total no tendría de dónde
salir y nadie lo notaría hasta el arqueo.
:::

---

## El modelo

```
movimientos_botellon                    bases
  id                                      id
  cliente_id → clientes NULL              id_sticker            UNIQUE
    (NULL = bodega de la empresa)         estado  sana|danada
  cantidad   ± enteros, nunca 0           direccion_id → direcciones NULL
  tipo  compra|entrega|retorno|             (NULL = en la bodega)
        descarte|ajuste                   danada_por / danada_en
  motivo                                  recargo_venta_id → ventas NULL
  documento_id → ventas NULL
  registrado_por                        movimientos_base   (historial, RN-BAS-05)
                                          base_id → bases
ventas                                    tipo  prestamo|retorno|dano|descarte
  + tipo  producto|dano_base              direccion_id NULL
  CHECK: dano_base ⟹ sin líneas           motivo · registrado_por
```

### El botellón no tiene tabla propia, y es correcto

No hay una tabla `botellones`. **No hay nada que guardar de un botellón**: no
tiene identidad, no tiene estado, no tiene historia propia. Lo único que existe
son los movimientos, y los saldos se derivan de ellos.

Crear una tabla con una fila por botellón físico sería inventar la identidad que
`RN-ENV-01` decidió no tener.

---

## Lo que M7 NO construye

- **Estado lleno/vacío del botellón.** `RN-ENV-07` lo pone explícitamente fuera
  de alcance: *«no se modela»*. Adelantarlo es el error que la propia
  documentación cita como ejemplo cuando descarta otras cosas.
- **Tope de botellones por cliente.** `RN-BAS-11`: sin tope duro; el `admin`
  aprueba casos atípicos. Sin un número que el negocio haya decidido, no hay con
  qué bloquear.
- **Rutas.** El `direccion_id` de una base ya existe desde M5; qué ruta la visita
  es M8.

---

## Definition of Done

1. La ley de conservación es un test que corre en cada suite y **falla
   ruidosamente**: `Σ saldos = Σ compras − Σ descartes`.
2. Entregar botellones escribe **dos filas** y el invariante sigue cerrando.
3. El saldo de botellones de un cliente sale de sus movimientos, nunca de una
   columna editable.
4. Una base está en **exactamente un lugar**: prestarla mientras ya está
   prestada se rechaza.
5. Un `id_sticker` no se repite.
6. Entregar una base a un cliente **sin verificar** se rechaza (`RN-BAS-07`).
7. Marcar una base como dañada genera una venta `dano_base` con su motivo.
8. Esa venta **no aparece en la deuda** y **sí** en los cargos pendientes.
9. Una venta `dano_base` no puede tener líneas, y una de `producto` no puede
   estar sin ellas — las dos sostenidas por la base.
10. La ficha del cliente muestra las tres cuentas que faltaban, con números.

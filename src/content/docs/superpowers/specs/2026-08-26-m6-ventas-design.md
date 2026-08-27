---
title: Spec de M6 — Ventas
description: La venta como documento inmutable que mueve cuatro cosas a la vez, por qué el piso de precio es un CHECK y no una validación, y la única pieza del dominio que este milestone decide NO construir.
---

**Dominio:** [Ventas](/dominio/ventas/) — 13 reglas, 9 confirmadas.

**Estado:** ✅ **Implementado** (26-ago-2026) — ver el [plan](/superpowers/plans/2026-08-26-m6-ventas/).

---

## M6 es el que le da números a los saldos

Hasta acá los módulos movían inventario. Este mueve **plata**, y es el primero
cuyo error se cobra en pesos.

También es el que despierta a M5: las cuatro cuentas de la ficha del cliente
—deuda, botellones, bases, cargos— hoy dicen «sin registrar todavía». M6 llena
**la primera**. Las otras tres siguen esperando a M7.

---

## La pieza que M6 decide NO construir

`RN-VEN-09` describe una **reserva de stock** de cinco minutos para que dos
`seller` no vendan la misma unidad a la vez:

```
stock_reservado = { cliente_id, sku_cantidad, expires_at: now() + 5min }
```

**No se construye, y la razón no es el costo: es que no hace falta para que la
venta sea correcta.**

El descuento de stock ya es atómico desde M2:

```sql
UPDATE lotes SET cantidad_disponible = cantidad_disponible - :n
 WHERE id = :lote AND cantidad_disponible >= :n
```

Cero filas afectadas significa «no alcanzaba», y **no se escribe el movimiento**.
Dos vendedores contra la última unidad ya están serializados por la base: uno
gana, el otro recibe un rechazo con el número real. La reserva no agrega
corrección — agrega *un mensaje más temprano*.

Y cuesta más de lo que parece: una tabla con vencimiento necesita limpieza,
semántica de expiración, y una respuesta para las reservas huérfanas de alguien
que abrió la pantalla y se fue a almorzar. Cada una es una decisión nueva, y
ninguna protege nada que el `UPDATE` condicional no proteja ya.

:::note[Qué se hace en su lugar]
- **Al escribir la cantidad**, la pantalla compara contra el saldo y avisa. Es
  informativo y puede quedar viejo — se dice así.
- **Al confirmar**, decide el descuento atómico. Es la única fuente de verdad.
- Si perdió la carrera, el mensaje dice cuántas unidades quedaban de verdad.

Es el mismo criterio con el que el dominio descartó la pantalla de fusión de
duplicados en `RN-CLI-11`: resuelve un caso improbable con el volumen actual, y
construirlo hoy es adelantar estado. Si con más `seller` en calle empieza a
aparecer, se reevalúa.
:::

---

## Las tres decisiones que definen el milestone

### 1 · La venta congela cuatro números, no uno

`RN-VEN-04` y `RN-VEN-12` piden congelar el precio. Pero congelar solo el precio
final deja el comprobante sin poder explicarse a sí mismo dentro de seis meses.

Cada **línea** de venta guarda:

| Campo | Por qué se guarda y no se busca |
| --- | --- |
| `precio_lista_aplicado` | El precio de lista cambia. Sin esto no se puede saber si hubo descuento |
| `tipo_cliente_al_momento` | Un cliente pasa de residencial a comercial (`RN-CLI-16`) |
| `descuento_monto` | Los códigos vencen y se desactivan |
| `precio_minimo_aplicado` | El piso también cambia, y es lo que hace verificable el punto 2 |

Es la cuarta vez que el proyecto aplica la misma regla —`fecha_vencimiento` en
M2, `equivalencia` en M3, `caudal_gpm` en M4— y la razón sigue siendo la misma:
**un hecho de un momento se almacena, nunca se regenera**.

### 2 · El piso absoluto es un `CHECK`, no una validación

`RN-VEN-13`: un código mal definido no puede dejar una venta en cero o negativa.

Con `precio_minimo_aplicado` congelado en la línea, el invariante queda **entre
dos columnas de la misma fila** y la base puede sostenerlo sola:

```sql
CHECK (precio_final >= precio_minimo_aplicado)
```

Eso importa por lo que protege: el descuento se aplica al calcular, y una
validación en el servicio cubre el camino que el servicio conoce. El `CHECK`
cubre también el script de migración, la corrección manual por consola y el
endpoint que alguien agregue el año que viene sin acordarse de la regla.

Cuando el descuento perforaría el piso, **se cobra el piso y se avisa que el
código se aplicó parcialmente** — no se rechaza la venta. El cliente ya está
ahí con el botellón en la mano.

### 3 · Anular no es editar, y el cobro no es un campo

**Anular** cambia el estado y revierte los efectos: devuelve el producto al
lote de origen, ajusta el saldo si fue a crédito, y libera los insumos si los
consumió. La venta no desaparece. Exige comentario, **también para el `admin`**
— quien tiene más permisos deja más rastro.

Quién puede anular ya está en la matriz y es más fino de lo que uno escribiría
de memoria: `pos` y `seller` tienen `anular` con alcance **`propio`**, `admin`
con alcance `todo`. El chequeo va sobre el `user_id` del autor, no sobre el rol
—los roles se suman (`RN-ACC-01`)— y eso es exactamente lo que `scopedCondition`
resuelve desde M0.

**El cobro es un documento aparte** (`RN-VEN-07`). Modelarlo como un campo de la
venta haría imposible un pago parcial, y un pago que cubre tres ventas.

---

## El modelo

```
ventas                                  lineas_de_venta
  id                                      venta_id     → ventas
  cliente_id      → clientes NULL           producto_id  → productos
  tipo_cliente_al_momento                   lote_id      → lotes
  medio_de_pago                             cantidad
  estado          confirmada|anulada        precio_lista_aplicado
  requiere_factura_electronica              descuento_monto
  descuento_codigo_id → codigos NULL        precio_minimo_aplicado
  total                                     precio_final
  registrado_por  → users
  anulada_por / anulada_en / motivo       CHECK (precio_final >= precio_minimo_aplicado)
                                          CHECK (cantidad > 0)

cobros                                  codigos_de_descuento
  cliente_id      → clientes              codigo UNIQUE
  monto                                   tipo  porcentaje|monto_fijo
  medio_de_pago                           valor · vigencia · usos_maximos
  registrado_por  → users
```

### La venta sin cliente existe, y es la normal

`cliente_id` es **nullable**. La mayoría de las ventas de mostrador son a
alguien que compra un botellón y se va: exigir un cliente obligaría a inventar
uno, o a cargar mal el del anterior.

Una venta **a crédito** sí lo exige — no hay a quién cobrarle si no. Eso lo
sostiene un `CHECK`: `medio_de_pago = 'credito'` implica `cliente_id NOT NULL`.

### El saldo del cliente es derivado

`RN-CLI-03`: `deuda = ventas a crédito − cobros`. No hay columna de saldo y no
hay «editar saldo» — se corrige con un documento.

A diferencia del stock, acá **no hace falta materializarlo**: no hay un
descuento atómico que defender. Dos cobros simultáneos suman, no compiten.

---

## Lo que M6 NO construye

- **La reserva de stock** — arriba, con su razón.
- **La integración con Factus.** `RN-VEN-11` es explícita: MVP captura la
  *intención* (`requiere_factura_electronica`), la integración es post-MVP.
- **Pedidos por WhatsApp** como canal automatizado. Se registra el `canal` de
  la venta; leer WhatsApp es otro proyecto.
- **Ruta del día** (`RN-VEN-06`). Es M8.
- **Botellones y bases.** M7. La venta de una recarga sí consume tapa y sello,
  que es de insumos y ya existe.

---

## Definition of Done

1. Una venta confirmada no se puede editar: no existe el endpoint.
2. Anular devuelve el producto **al mismo lote** y exige comentario, también
   para el `admin`.
3. Un `pos` no puede anular la venta de un `seller`, y al revés. El `admin` sí.
4. Vender a crédito a un cliente sin verificar se rechaza.
5. Vender a crédito por encima del límite se rechaza — **solo si hay límite**.
6. Un descuento que perforaría el piso cobra el piso y avisa; no rechaza.
7. El `CHECK` del piso rechaza la fila aunque se esquive el servicio.
8. Vender más de lo que hay se rechaza **con el número real**, sin reserva.
9. Vender una recarga descuenta una tapa y un sello.
10. Un cobro parcial reduce la deuda sin cerrar la venta.
11. El `contador` ve ventas y cobros, y no registra ninguno.

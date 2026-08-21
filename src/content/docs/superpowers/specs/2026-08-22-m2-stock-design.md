---
title: Spec de M2 — Stock de producto terminado
description: "Diseño del libro de movimientos, los lotes con vencimiento y la concurrencia sobre un saldo que dos pantallas descuentan a la vez."
---

**Fecha:** 2026-08-22
**Estado:** 📝 Diseñado — por implementar
**Módulo:** M2 del [Roadmap Aquazaku](/arquitectura/roadmap/)
**Autores:** Mao (product owner) + AI (asistente de diseño)

---

## 1. Contexto

M2 es donde el sistema empieza a llevar cuentas que tienen que cuadrar. M1 dijo
*qué se vende*; M2 dice *cuánto hay*, y esa respuesta la van a consumir M4
(producción suma), M6 (venta resta) y M12 (alertas miran).

Las reglas están en [Stock](/dominio/stock/) — **RN-STK-01, 02, 03, 05, 06, 07 y
08**. La 04 es de insumos y pertenece a M3.

Dos correcciones del dominio, hechas el 22-ago-2026 antes de escribir esta spec,
cambian el punto de partida:

- **El stock no lleva ubicación.** Hay una sola bodega y se decidió no modelarla
  ([RN-STK-01](/dominio/stock/)). Una columna con un único valor posible no se
  puede ni testear: no hay contra qué comprobar que el filtrado discrimine.
- **`RN-STK-04` estaba duplicada.** La regla de lote y vencimiento pasó a
  **RN-STK-08**.

## 2. Objetivos

1. Libro de movimientos: el stock **nunca** se edita, se mueve
   ([RN-STK-02](/dominio/stock/)).
2. Lotes con vencimiento automático a 30 días y trazabilidad por venta.
3. Saldo que **no puede quedar negativo**, garantizado bajo concurrencia real.
4. FIFO por vencimiento y bloqueo automático de vencidos.
5. Ajuste de inventario con motivo obligatorio.
6. Descarte selectivo por unidad con causa obligatoria.
7. **Cerrar la deuda de M1**: un producto con stock no se puede desactivar.

## 3. Fuera de alcance (M2)

| Queda fuera | Va en | Por qué |
| --- | --- | --- |
| Insumos: tapas, sellos, bolsas | M3 | Otra unidad, otro ciclo ([RN-STK-04](/dominio/stock/)) |
| Cierre de producción que genera el lote | M4 | M2 provee la tabla y la operación; M4 la llama |
| Descuento de stock al vender | M6 | M6 llama al servicio de M2; la venta es suya |
| Reposición al cliente por falla | M6 | Genera una venta, no un movimiento de stock |
| Panel y notificación de alertas | M12 | M2 expone el dato; M12 decide a quién avisar |
| Ubicaciones múltiples, rutas | M8 · post-MVP | [RN-STK-01](/dominio/stock/) |

:::caution[La alerta de stock crítico necesita un umbral que nadie definió]
El [roadmap](/arquitectura/roadmap/) lista "alertas de stock crítico" dentro de
M2, pero **ninguna regla del dominio define un stock mínimo para producto
terminado**. Las preguntas abiertas de [Stock](/dominio/stock/) solo mencionan un
mínimo para tapas y sellos, que es de M3.

M2 **no inventa el umbral**. Entrega la consulta —cuánto hay de cada producto, y
cuánto vence pronto— y el umbral se define cuando Aquazaku lo confirme. Ver
[§14](#14-riesgos-y-preguntas-abiertas).
:::

## 4. Decisiones arquitectónicas

| # | Decisión | Por qué |
| --- | --- | --- |
| 1 | **Libro de movimientos + saldo materializado**, no saldo derivado de un `SUM()` | El `SUM()` es correcto pero no resuelve la concurrencia sin bloquear la tabla entera. Con el saldo en una fila, `UPDATE … WHERE cantidad >= n` decide y descuenta en una sola operación atómica |
| 2 | **`fecha_vencimiento` se guarda, no se genera** | Es un hecho de un momento, no una definición. Ver abajo |
| 3 | El saldo vive **en el lote**, no en una tabla aparte | Un lote ya es "producto + fecha"; agregarle la cantidad evita una tabla que solo existiría para repetir su clave |
| 4 | `CHECK (cantidad_disponible >= 0)` | [ADR-0006](/decisiones/0006-invariantes-en-la-base/). "No hay venta con stock negativo" ([RN-STK-03](/dominio/stock/)) es exactamente lo que un `CHECK` garantiza aunque un endpoint nuevo se olvide |
| 5 | Los movimientos son **append-only** | Un libro que se puede editar no es un libro. Mismo criterio que `audit_log` ([ADR-0004](/decisiones/0004-audit-log-inmutable/)) |

### La decisión que más se presta a copiar mal

En M1, `litros` es una **columna generada**: se recalcula sola si cambian sus
entradas, y eso es correcto porque *12 L es lo que una paca **es***.

`fecha_vencimiento` parece el mismo caso —`empaque + 30 días`, calculado por el
sistema, nunca tipeado— pero **no lo es**:

> `litros` es una **definición**. `fecha_vencimiento` es un **hecho de un
> momento**.

Si mañana Aquazaku cambia el vencimiento a 45 días y la columna fuera generada,
**todos los lotes del pasado recalcularían su fecha**. Una venta de marzo pasaría
a decir que aquel producto vencía en otro día. Es exactamente lo que
[RN-CAT-07](/dominio/productos/) prohíbe para los precios: cambiar una regla hoy
no puede reescribir lo que ya pasó.

Por eso se **calcula una vez al crear el lote y se guarda**. La constante de 30
días vive en el código, con su regla citada, y el día que cambie solo afecta a
los lotes nuevos.

## 5. Modelo de datos

Dos tablas.

```ts
export const tipoMovimientoEnum = pgEnum('tipo_movimiento', [
  'produccion',   // M4 — entra producto
  'ajuste',       // M2 — inventario físico, carga inicial
  'descarte',     // M2 — sale y no vuelve
  'venta',        // M6 — sale
  'devolucion',   // M6 — vuelve al mismo lote (RN-STK-05)
])

export const causaDescarteEnum = pgEnum('causa_descarte', [
  'falla_produccion',
  'mal_manejo_cliente',
  'vencido',
  'otro',
])

export const lotes = pgTable('lotes', {
  id: uuid('id').primaryKey().defaultRandom(),
  productoId: uuid('producto_id').notNull().references(() => productos.id),

  /** `YYYY-MM-DD-L1`. Se imprime en la bolsa física — RN-STK-08. */
  codigo: text('codigo').notNull(),

  fechaEmpaque: date('fecha_empaque').notNull(),
  /**
   * Guardada, NO generada. Es un hecho del momento en que se empacó: si la
   * regla de los 30 días cambia, los lotes viejos conservan su fecha.
   */
  fechaVencimiento: date('fecha_vencimiento').notNull(),

  cantidadInicial: integer('cantidad_inicial').notNull(),
  /** El saldo. Lo mueven los documentos; nadie lo edita a mano. */
  cantidadDisponible: integer('cantidad_disponible').notNull(),

  createdAt: tstz('created_at').notNull().defaultNow(),
}, (t) => [
  uniqueIndex('lotes_codigo_key').on(t.codigo),
  // FIFO consulta por producto ordenando por vencimiento: el índice es el orden.
  index('lotes_fifo_idx').on(t.productoId, t.fechaVencimiento),

  check('lotes_saldo_no_negativo', sql`${t.cantidadDisponible} >= 0`),
  check('lotes_cantidad_inicial_positiva', sql`${t.cantidadInicial} > 0`),
  check('lotes_vence_despues_de_empacar', sql`${t.fechaVencimiento} > ${t.fechaEmpaque}`),
])

export const movimientosStock = pgTable('movimientos_stock', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  loteId: uuid('lote_id').notNull().references(() => lotes.id),

  /** Positivo entra, negativo sale. Nunca cero. */
  cantidad: integer('cantidad').notNull(),
  tipo: tipoMovimientoEnum('tipo').notNull(),

  /** Obligatorio en ajuste y descarte — RN-STK-02 y RN-STK-06. */
  motivo: text('motivo'),
  causa: causaDescarteEnum('causa'),

  /** La venta o el cierre que lo originó. Null en ajuste manual. */
  documentoId: uuid('documento_id'),

  registradoPor: uuid('registrado_por').references(() => users.id, { onDelete: 'set null' }),
  createdAt: tstz('created_at').notNull().defaultNow(),
}, (t) => [
  index('movimientos_lote_idx').on(t.loteId),
  index('movimientos_fecha_idx').on(t.createdAt),

  check('movimientos_cantidad_no_cero', sql`${t.cantidad} <> 0`),
  // RN-STK-02: un ajuste sin motivo es un UPDATE disfrazado.
  check('movimientos_ajuste_con_motivo',
    sql`${t.tipo} <> 'ajuste' OR ${t.motivo} IS NOT NULL`),
  // RN-STK-06: sin clasificar la causa, no se descarta.
  check('movimientos_descarte_con_causa',
    sql`${t.tipo} <> 'descarte' OR ${t.causa} IS NOT NULL`),
])
```

### Por qué el motivo y la causa son `CHECK` y no validación de servicio

[RN-STK-02](/dominio/stock/) dice que un ajuste sin motivo no existe, y
[RN-STK-06](/dominio/stock/) que sin clasificar la causa no se descarta. Son
invariantes, no validaciones de formulario: un ajuste sin motivo que entre por
un script deja el inventario descuadrado **sin nadie a quién preguntarle**.

El `CHECK` condicional (`tipo <> 'ajuste' OR motivo IS NOT NULL`) lo exige solo
donde corresponde, sin obligar a un motivo en una venta.

### Lo que estas tablas NO tienen

- **`ubicacion`** — una sola bodega, y no se modela ([RN-STK-01](/dominio/stock/)).
- **`costo`** — es de M9. El stock cuenta unidades, no plata.
- **Insumos** — otra unidad y otro ciclo; van en M3 con sus propias tablas.

## 6. Concurrencia: el problema real de este módulo

[RN-STK-01](/dominio/stock/) lo advierte: el mostrador vende y la preparación de
pedidos descuenta, **las dos contra el mismo saldo y al mismo tiempo**. Que haya
una sola bodega no lo elimina — lo concentra.

El camino ingenuo tiene una carrera clásica:

```
1. SELECT cantidad_disponible  → 10
2. ¿alcanza para 8? → sí
3. UPDATE cantidad = 10 - 8    → 2
```

Dos procesos que leen `10` a la vez venden 16 de 10. El `CHECK` los frena —esa
es su función— pero el segundo recibe un error de Postgres en vez de un mensaje
útil, y peor: **el primero pudo haber ganado por azar**.

La forma correcta decide y descuenta en una sola operación:

```sql
UPDATE lotes
   SET cantidad_disponible = cantidad_disponible - $cantidad
 WHERE id = $lote
   AND cantidad_disponible >= $cantidad
RETURNING cantidad_disponible;
```

Si devuelve una fila, el descuento ocurrió. Si devuelve **cero filas**, no había
suficiente — y eso es una respuesta, no un error. Postgres serializa los
`UPDATE` sobre la misma fila, así que no hay ventana entre la decisión y el
efecto.

:::danger[El test que no puede faltar]
Un test que lanza **N descuentos concurrentes** sobre el mismo lote y verifica
que la suma de los exitosos nunca supere el saldo inicial.

Sin él, la carrera no aparece en desarrollo —donde todo es secuencial— y
aparece el primer sábado con dos personas vendiendo. Es el equivalente en M2 del
test del `CHECK` en M1: verifica la promesa, no el camino feliz.
:::

## 7. FIFO y vencidos

[RN-STK-08](/dominio/stock/) pide dos cosas que se resuelven en la misma
consulta:

```sql
SELECT id, cantidad_disponible
  FROM lotes
 WHERE producto_id = $producto
   AND cantidad_disponible > 0
   AND fecha_vencimiento >= CURRENT_DATE   -- vencidos fuera
 ORDER BY fecha_vencimiento ASC            -- FIFO
```

El bloqueo de vencidos **no es un job nocturno**: es una condición de la
consulta. Un lote vence sin que nadie lo toque, y a la mañana siguiente
simplemente no aparece.

Una salida puede abarcar **varios lotes**: pedir 30 unidades cuando el lote más
viejo tiene 20 genera dos movimientos, 20 y 10. Cada uno guarda su `lote_id`,
que es lo que hace posible responder a un recall.

:::note[Vencido no es lo mismo que descartado]
Un lote vencido **sigue teniendo saldo**: no se puede vender, pero está ahí y
hay que descartarlo explícitamente ([RN-STK-05](/dominio/stock/): causa
`vencido`, sin clasificar).

Restarlo solo porque venció sería perder la cuenta de producto que físicamente
está en la bodega ocupando lugar. El descarte es un acto, no una consecuencia
del calendario.
:::

## 8. Cambios a la matriz de permisos

Hoy `stock` tiene `ver`, `cargar_ruta` y `ajustar`. M2 necesita dos cambios.

### `stock:descartar` no existe

[RN-STK-06](/dominio/stock/) es una regla confirmada sin permiso que la
represente. `descartar` ya es una acción del sistema —la usan `botellones` y
`bases`— así que solo falta la celda:

| Permiso | `admin` | `seller` | `pos` | `contador` |
| --- | :-: | :-: | :-: | :-: |
| `stock:descartar` | ✅ | ❌ | ✅ | ❌ |

El `pos` la tiene porque es quien manipula el producto y ve el daño. Es el mismo
criterio con el que ya puede descartar botellones y bases.

### El alcance `BODEGA` del `pos` se rompe

```ts
{ resource: 'stock', action: 'ver', scope: 'BODEGA' }   // pos, hoy
```

El alcance `BODEGA` **exige una columna `ubicacion`**. Sin ella,
`scopeCondition` lanza `ScopeNoAplicableError` —por diseño, es el fallo cerrado
de [ADR-0005](/decisiones/0005-scopes-fail-closed/)— y el `pos` **no vería
stock**: recibiría un error, no una lista vacía.

No es una falla del alcance: es el alcance haciendo exactamente lo que promete.
Se cambia la celda a `todo`, que con una sola bodega significa lo mismo y además
es lo honesto — el `pos` ve todo el stock, porque todo el stock está en el único
lugar que hay.

`BODEGA` queda en el modelo de alcances, sin usar, para el día que M8 traiga una
segunda ubicación.

:::danger[Se tocan tres archivos, siempre juntos]
`matrix.ts`, `matrix.test.ts` (que transcribe el doc a mano, para no ser
circular) y [Roles y permisos](/dominio/roles-y-permisos/). El test atrapa que
el código y su transcripción coincidan, pero **nadie verifica el documento**.
:::

## 9. De la regla al mecanismo

| Regla | Dónde se hace cumplir | Mecanismo |
| --- | --- | --- |
| RN-STK-01 — una sola bodega | — | Por omisión: no hay columna que pueda decir otra cosa |
| RN-STK-02 — todo movimiento con motivo y responsable | **Base** | `CHECK` condicional + `registrado_por`. El saldo solo se mueve insertando un movimiento |
| RN-STK-03 — no vender lo que no hay | **Base** | `CHECK (cantidad_disponible >= 0)` + el `UPDATE` condicional de [§6](#6-concurrencia-el-problema-real-de-este-módulo) |
| RN-STK-05 — devolución sana vuelve al mismo lote | Servicio | Movimiento `devolucion` con el `lote_id` original |
| RN-STK-06 — descarte con causa obligatoria | **Base** | `CHECK` condicional sobre `causa` |
| RN-STK-07 — una sola bodega | — | Ídem RN-STK-01 |
| RN-STK-08 — lote, vencimiento, FIFO, bloqueo | Base + consulta | Fecha guardada al crear; FIFO y bloqueo son condiciones del `SELECT` |
| **RN-CAT-02** — no desactivar con stock | Servicio de M1 | **Cierra la deuda de M1**, ver [§10](#10-la-deuda-de-m1-que-m2-cierra) |

## 10. La deuda de M1 que M2 cierra

[RN-CAT-02](/dominio/productos/) exige que un producto no se desactive si quedan
unidades en stock. M1 lo dejó escrito en el código citando la regla, porque la
tabla no existía.

Ahora existe. `desactivarProducto()` suma una verificación:

```ts
const enStock = await saldoTotalDe(producto.id)
if (enStock > 0) {
  throw new ErrorDeNegocio('PRODUCTO_CON_STOCK', 409,
    `quedan ${enStock} unidades en stock: descartalas o vendelas antes de desactivar`)
}
```

**Es criterio de aceptación de M2, no una mejora opcional.** Un producto
inactivo con stock es inventario que nadie puede vender ni descartar.

## 11. Endpoints

| Método | Ruta | Permiso |
| --- | --- | --- |
| `GET` | `/stock` | `stock:ver` — saldo por producto, con desglose por lote |
| `GET` | `/stock/:productoId/lotes` | `stock:ver` — lotes con saldo, en orden FIFO |
| `GET` | `/stock/movimientos` | `stock:ver` — libro con filtros y cursor |
| `POST` | `/stock/ajustes` | `stock:ajustar` — motivo obligatorio |
| `POST` | `/stock/descartes` | `stock:descartar` — causa obligatoria |

Sin `PUT` ni `PATCH` sobre el saldo: **el stock no se edita**
([RN-STK-02](/dominio/stock/)). Que esas rutas no existan es parte del contrato.

| Código | Status | Cuándo |
| --- | --- | --- |
| `STOCK_INSUFICIENTE` | 409 | Se pidió más de lo disponible |
| `LOTE_VENCIDO` | 409 | Se intentó mover un lote vencido a venta |
| `LOTE_NO_ENCONTRADO` | 404 | |
| `MOTIVO_REQUERIDO` | 422 | Ajuste sin motivo |
| `CAUSA_REQUERIDA` | 422 | Descarte sin clasificar |
| `PRODUCTO_CON_STOCK` | 409 | Desactivar un producto con saldo (RN-CAT-02) |

## 12. Estrategia de testing

| Capa | Qué verifica |
| --- | --- |
| Integración — **concurrencia** | N descuentos simultáneos sobre el mismo lote: la suma de los exitosos nunca supera el saldo |
| Integración — `CHECK` | Un `UPDATE` directo a saldo negativo **falla en Postgres** |
| Integración — motivo y causa | Un ajuste sin motivo y un descarte sin causa son rechazados por la base |
| Integración — FIFO | Con tres lotes, la salida consume primero el de vencimiento más próximo |
| Integración — vencidos | Un lote vencido no aparece para vender **y conserva su saldo** |
| Unit — matriz | La celda nueva y el cambio de alcance del `pos`, rol por rol |
| Integración — RN-CAT-02 | Desactivar un producto con stock devuelve 409 |
| Bruno | Contra servidor real, incluido un `seller` recibiendo 403 al ajustar |
| Manual | Ajuste desde la UI → verlo en el libro → descartar → cuadrar |

## 13. Criterios de éxito

1. Un ajuste inicial crea el lote y su saldo, con vencimiento a 30 días.
2. Un `UPDATE` directo que deje saldo negativo **es rechazado por Postgres**.
3. Un ajuste sin motivo y un descarte sin causa son rechazados **por la base**.
4. N descuentos concurrentes nunca venden más de lo que hay.
5. La salida consume el lote de vencimiento más próximo, y puede abarcar varios.
6. Un lote vencido desaparece de la venta y **conserva su saldo** hasta que se lo descarte.
7. `seller` y `contador` reciben **403** al ajustar o descartar.
8. Desactivar un producto con stock devuelve **409** — deuda de M1 cerrada.
9. `api/` y `web/` verdes; Bruno verde contra servidor real.
10. **Verificado en un browser real, con todos los servicios arriba.**

## 14. Riesgos y preguntas abiertas

| # | Riesgo | Mitigación |
| --- | --- | --- |
| 1 | **La concurrencia no se ve en desarrollo** | Test dedicado con descuentos simultáneos. Es el test más importante del módulo |
| 2 | RN-STK-01, 02 y 03 **cambiaron el 22-ago-2026** | Si Aquazaku corrige el modelo de nuevo, conviene que sea antes de que haya movimientos cargados |
| 3 | **`stock:cargar_ruta` sigue en la matriz** para un modelo descartado | Hoy es inerte: ningún endpoint lo chequea. Se decide junto con M8 |
| 4 | La constante de 30 días vive en el código | Es a propósito: cambiarla no debe reescribir el pasado. Cita la regla en el mismo lugar |

### Preguntas abiertas

| # | Pregunta | Por qué importa |
| --- | --- | --- |
| 30 | **¿Cuál es el stock mínimo de producto terminado que debería disparar alerta?** ¿Es por producto o uno solo? | El roadmap pone las alertas en M2, pero ninguna regla define el umbral. Sin respuesta, M2 entrega la consulta y M12 la usa cuando exista el número |
| 31 | **¿Cada cuánto se hace inventario físico?** Ya estaba abierta en [Stock](/dominio/stock/) | Define si el ajuste es excepcional o rutinario, y si conviene una pantalla de conteo o alcanza con el ajuste puntual |


---

## 15. Implementación

El desglose en tasks está en el
[plan de M2](/superpowers/plans/2026-08-22-m2-stock) — 9 tasks, **ordenadas por
costo de revertir** y no por comodidad de construcción.

La compuerta es **T3**: el test de concurrencia corre antes de que nada se
apoye en el saldo. Si el modelo no aguanta, conviene saberlo con dos tablas
construidas y no con nueve tasks encima.

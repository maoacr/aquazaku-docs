---
title: Spec de M3 — Insumos de empaque
description: Catálogo de insumos, saldo por unidad, alerta de mínimo y la conversión kilo → unidad.
---

**Fecha:** 2026-08-22
**Estado:** 📝 Diseñado — por implementar
**Módulo:** M3 del [Roadmap Aquazaku](/arquitectura/roadmap/)
**Autores:** Mao (product owner) + AI (asistente de diseño)

---

## 1. Contexto

Una planta sin tapas no produce, por más agua que tenga en los tanques. M3 mete
al sistema la otra mitad del inventario: lo que **se consume** al producir.

El dominio ya está definido en [Insumos](/dominio/insumos/), con cuatro reglas
confirmadas. Esta spec es cómo se construye.

**Lo que M3 hereda y no rediseña.** La fase de diseño dejó `<Estado>`, `<Vacio>`,
los esqueletos, el mapa de errores, el par fondo/texto y la voz de usted. Nada de
eso se vuelve a inventar — ver [El sistema, aplicado](/frontend/sistema-aplicado/).

**Lo que M3 hereda de M2 y sí importa.** El patrón de saldo atómico de
`movimientos_stock` resolvió el problema difícil —dos descuentos simultáneos— y
acá se repite. La lección de M2 fue que **el `CHECK` no detiene una actualización
perdida**: hace falta que el `UPDATE` sea condicional.

## 2. Objetivos

1. Catálogo de insumos con su unidad y su mínimo.
2. Saldo por insumo, movido por entradas y ajustes.
3. Alerta cuando el saldo cae al mínimo o por debajo.
4. La conversión kilo → unidad de las bolsas, **explícita y auditable**.

## 3. Fuera de alcance

| No entra | Por qué | Dónde entra |
| --- | --- | --- |
| **Descuento automático por producción** | No existe el cierre de producción todavía | M4 |
| **Compra a proveedor con documento** | Es el módulo de compras completo | M9 |
| **Alerta que llega sola** (correo, panel) | Requiere el motor de alertas | M12 |
| **Mínimo configurable desde la interfaz** | Ídem — hoy es constante | M12 |
| **Lotes o vencimiento de insumo** | Nadie lo pidió, y una tapa no vence | — |

:::note[El saldo se mueve a mano, y está bien]
Entre M2 y M4 el stock de producto se movió con ajustes manuales, porque el
cierre de producción no existía. Los insumos hacen lo mismo: entrada por compra y
ajuste con motivo. **Cuando llegue M4, el cierre descuenta solo** y estos
movimientos siguen siendo válidos — el libro no cambia, cambia quién escribe.
:::

## 4. La decisión que define la tabla

`RN-INS-02`: las bolsas se compran por **kilo** y se guardan por **unidad**.

**El saldo se guarda SIEMPRE en unidades**, para los tres insumos. El kilo no es
una segunda unidad de almacenamiento: es **cómo llega la compra**, y se convierte
al entrar.

### Por qué no hay una columna `unidad_de_medida` con dos valores

Es la tentación obvia y es una trampa. Con `unidad ∈ {unidad, kilo}` el saldo de
un insumo significaría una cosa u otra según la fila, y **toda consulta que sume,
compare con el mínimo o pregunte «cuánto queda» tendría que ramificar**.

El día que alguien olvide ramificar, va a comparar 3 kilos contra un mínimo de
200 unidades y concluir que hay que pedir.

En cambio: el saldo es siempre una cantidad de unidades. El kilo vive donde
corresponde —en el momento de la compra— y deja rastro de la conversión.

### Dónde queda la aproximación

| Momento | Entra como | Se guarda | Aproximación |
| --- | --- | --- | --- |
| Compra de bolsas | Kilos | Unidades | **Sí**, en el movimiento |
| Compra de tapas o sellos | Unidades | Unidades | No |
| Producción (M4) | Unidades | Unidades | No |
| Conteo físico | Kilos o unidades | Ajuste con motivo | **Sí**, ya exige motivo |

La conversión **se registra en el movimiento**, no solo su resultado: quedan los
kilos, la equivalencia usada y las unidades que salieron. Sin eso, un inventario
descuadrado es imposible de reconstruir — no se sabe si se pesó mal, si la
equivalencia estaba vieja o si faltaron bolsas de verdad.

## 5. Modelo de datos

### `insumos`

```ts
id             uuid        pk
codigo         text        único, MAYÚSCULAS_CON_GUION_BAJO — TAPA_20L, BOLSA_600
nombre         text
unidad         enum        'unidad' — hoy solo hay una; ver abajo
minimo         integer     > 0. El umbral de alerta (RN-INS-03)
                           ⚠️ CHECK: minimo > 0
saldo          integer     unidades en existencia. Lo mueve el UPDATE de §6
                           ⚠️ CHECK: saldo >= 0
activo         boolean     default true
created_at     timestamptz
updated_at     timestamptz
```

:::caution[Por qué existe `unidad` si hoy solo tiene un valor]
Parece una columna inútil, y casi lo es. Está por una razón: hace **explícito en
el esquema** que el saldo se cuenta en unidades, y que el kilo es de la compra.

Sin ella, alguien que llegue en seis meses y vea que las bolsas se compran por
kilo va a asumir que el saldo también, y va a tener razón en asumirlo — no habría
nada que diga lo contrario.

Si algún día aparece un insumo que de verdad se almacene por peso, esta columna
es donde se decide, y el que la agregue va a tener que resolver la ramificación
conscientemente en vez de heredarla.
:::

### `movimientos_insumo`

Mismo patrón que `movimientos_stock`, que ya resolvió este problema.

```ts
id                 bigserial   pk
insumo_id          uuid        fk → insumos
cantidad           integer     unidades. Positivo entra, negativo sale
                               ⚠️ CHECK: cantidad <> 0
tipo               enum        'compra' | 'ajuste' | 'descarte' | 'produccion'
motivo             text        ⚠️ CHECK: tipo <> 'ajuste' OR motivo IS NOT NULL
causa              enum        ⚠️ CHECK: tipo <> 'descarte' OR causa IS NOT NULL

/* Solo cuando la compra vino en kilos. Los tres o ninguno. */
kilos              numeric(10,3)
equivalencia       numeric(10,3)   unidades por kilo, al momento de convertir
                                   ⚠️ CHECK: los tres juntos o los tres nulos

documento_id       uuid        la compra o el cierre que lo originó
registrado_por     uuid        fk → users, ON DELETE SET NULL
created_at         timestamptz
```

### El saldo es columna **y** libro, igual que en M2

`insumos.saldo` guarda el número; `movimientos_insumo` guarda cómo llegó ahí. Los
dos se escriben en la **misma transacción** — si el saldo baja y el movimiento no
queda, el libro deja de explicar el saldo.

Parece redundante, y la tentación es derivar el saldo con `SUM(cantidad)`. Se
sigue el patrón de M2 por dos razones, y la segunda es la que decide.

**Una:** un solo patrón de inventario en el sistema. Dos mecanismos para el mismo
problema es el doble de código que mantener y una pregunta más para quien llegue.

**Y dos —la que manda—: un saldo derivado no se puede descontar atómicamente.**
Sin fila que actualizar hay que bloquear y recalcular; con columna, el `UPDATE`
condicional de §6 resuelve la carrera en una sentencia. La concurrencia es el
problema difícil de este módulo, y **la forma de la tabla es lo que lo hace fácil
o difícil**.

El riesgo de guardar el saldo —**dos verdades que se separan**— se cubre como en
M2: misma transacción, más un test que exige que la suma del libro explique el
saldo. Ya existe para stock, en `concurrencia.test.ts`: *«la suma del libro
explica el saldo, sin importar el orden»*. Si los dos se separan, la suite falla.

### Por qué `equivalencia` se guarda en el movimiento

Podría vivir en `insumos` como un dato del insumo. Está en el movimiento a
propósito: **es el valor que se usó ese día**, y va a cambiar.

Guardarla solo en el insumo haría que actualizar la equivalencia reescribiera la
historia — las compras viejas pasarían a significar otra cantidad. Es el mismo
error que M2 evitó con `fecha_vencimiento`
([spec de M2](/superpowers/specs/2026-08-22-m2-stock-design/)): un hecho de un
momento no se recalcula.

## 6. Concurrencia

El problema de M2 se repite y la solución también.

Dos personas registran una salida del mismo insumo a la vez. Las dos leen saldo
120, las dos restan 100, y el saldo queda en 20 con 200 unidades entregadas.

**El `CHECK` no lo detiene.** Está probado en M2: se implementó la versión
ingenua y 20 de 20 descuentos concurrentes pasaron, con el ledger en −150 y cero
errores. Un `CHECK` valida la fila que se escribe, no la suma de las que existen.

La solución es el `UPDATE` condicional, igual que en `lotes`: se descuenta solo
si hay saldo, y **cero filas afectadas significa «no alcanza»** — que es una
respuesta, no un error.

```sql
UPDATE insumos SET saldo = saldo - :cantidad
WHERE id = :id AND saldo >= :cantidad
RETURNING saldo
```

**Cero filas afectadas no es un error: es «no alcanza».** El servicio devuelve
`ok: false` con lo que había, y **no escribe movimiento** — un intento fallido no
pasó, y el libro solo cuenta lo que pasó.

El `UPDATE` y el `INSERT` del movimiento van en la misma transacción, en ese
orden. La condición `saldo >= :cantidad` es la que serializa: quien llega segundo
lee el saldo ya descontado.

:::note[El `CHECK saldo >= 0` no sobra, pero tampoco alcanza]
Es la red de abajo, para lo que entre por fuera del servicio —un script, una
migración—. **No es lo que resuelve la carrera**: se probó en M2 y 20 de 20
descuentos concurrentes pasaron igual, con el ledger en −150 y cero errores.

La verificación es **quitar la condición del `WHERE`** y confirmar que el test de
veinte salidas concurrentes falla. Un test de concurrencia que pasa con el
mecanismo quitado no está midiendo el mecanismo.
:::

## 7. Permisos

Ya están en la matriz y no cambian:

| Permiso | `admin` | `seller` | `pos` | `contador` |
| --- | :-: | :-: | :-: | :-: |
| `insumos:ver` | ✅ | ❌ | ✅ | 🟡 `todo` |
| `insumos:ajustar` | ✅ | ❌ | 🟡 `cantidades` (con motivo) | ❌ |

El `seller` **no ve insumos**, y tiene sentido: contacta clientes y registra
ventas, no toca la planta.

:::note[`insumos:crear` no existe, y es a propósito]
Dar de alta un insumo es configuración, no operación: pasa una vez y la hace un
admin. Se cubre con `insumos:ajustar` restringido a `admin`, igual que se resolvió
`stock:descartar` en M2 — un permiso que se usa tres veces al año no justifica
una fila más en la matriz que hay que mantener y auditar.
:::

## 8. Endpoints

| Método | Ruta | Permiso | Qué hace |
| --- | --- | --- | --- |
| `GET` | `/insumos` | `insumos:ver` | Catálogo con saldo y si está bajo el mínimo |
| `GET` | `/insumos/:id/movimientos` | `insumos:ver` | El libro del insumo |
| `POST` | `/insumos` | `insumos:ajustar` (admin) | Alta |
| `PATCH` | `/insumos/:id` | `insumos:ajustar` (admin) | Nombre, mínimo, activo |
| `POST` | `/insumos/:id/entrada` | `insumos:ajustar` | Compra — en unidades o en kilos |
| `POST` | `/insumos/:id/ajuste` | `insumos:ajustar` | Ajuste con motivo |
| `POST` | `/insumos/:id/descarte` | `insumos:ajustar` | Descarte con causa |

Toda escritura **audita antes de ejecutar** ([ADR-0007](/decisiones/)): una acción
sensible sin auditoría no se ejecuta.

## 9. De la regla al mecanismo

| Regla | Mecanismo | Dónde |
| --- | --- | --- |
| `RN-INS-01` — sale por producción, no por venta | El enum de tipo no tiene `venta` | Base |
| `RN-INS-02` — kilo al comprar, unidad al guardar | `cantidad` en unidades + los tres campos de conversión juntos | Base (`CHECK`) |
| `RN-INS-03` — mínimo avisa | `minimo > 0` y la consulta lo compara | Base + servicio |
| `RN-INS-04` — tratamiento es gasto | No se modela | — |
| `RN-STK-02` — ajuste con motivo | `CHECK` condicional | Base |

**El patrón es el de [ADR-0006](/decisiones/):** el invariante vive en la base, el
servicio explica el error. Un ajuste sin motivo que entre por un script deja el
inventario descuadrado sin nadie a quién preguntarle.

## 10. Interfaz

Una pantalla, `/modulos/insumos`, que reusa lo que ya existe:

- **Tabla** con las primitivas de M1/M2 — cifras en mono con `tabular-nums`.
- **`<Estado>`** para el nivel: `cubierto` sobre el mínimo, `justo` en el mínimo
  o cerca, `expuesto` en cero. Cuatro canales, como manda R40.
- **`<Vacio variante="primera-vez">`** cuando no hay insumos cargados.
- **Formularios** de entrada, ajuste y descarte, con el patrón de motivo mínimo
  de diez caracteres que ya usa stock.
- **`<SelloDeHora>`**: el saldo lo mueven varias personas.

**La entrada de bolsas pide kilos y muestra las unidades resultantes antes de
confirmar.** Convertir en silencio es lo que hace que un descuadre sea imposible
de explicar después.

## 11. Estrategia de testing

| Qué | Cómo |
| --- | --- |
| Los `CHECK` de la base | Intentar el `INSERT` inválido y esperar el rechazo |
| La condición del `UPDATE` | **Quitarla** y verificar que el test de concurrencia falle |
| El libro explica el saldo | La suma de movimientos iguala `saldo`, sin importar el orden |
| El intento fallido | Devuelve `ok: false`, no toca el saldo y **no deja movimiento** |
| La conversión | Que los tres campos viajen juntos, y que el saldo sea el esperado |
| La equivalencia histórica | Cambiarla y verificar que los movimientos viejos **no** cambian |
| El mínimo | Frontera exacta: en el mínimo ya avisa |
| Permisos | Que el `seller` reciba 403 y quede auditado |

## 12. Criterios de éxito

1. Un `pos` registra una compra de bolsas en kilos y el saldo sube en unidades,
   con la conversión visible en el movimiento.
2. Veinte salidas concurrentes del mismo insumo **nunca** dejan saldo negativo.
3. Un insumo bajo el mínimo se distingue en escala de grises.
4. Cambiar la equivalencia no altera ningún movimiento pasado.
5. Un `seller` que intente `POST /insumos/:id/ajuste` recibe 403 y queda en la
   auditoría.

## 13. Riesgos y preguntas abiertas

| Riesgo | Mitigación |
| --- | --- |
| 🔴 **Sin la equivalencia, las bolsas no se pueden cargar por kilo** | Tapas y sellos funcionan completos. Las bolsas se cargan en unidades a mano hasta tener la [pregunta 37](/empezar/pendientes/) |
| 🟠 **El saldo y su libro se separan** | Misma transacción + el test que exige que la suma explique el saldo. Es criterio de aceptación, no mejora |
| 🟠 **Escribir el movimiento del intento fallido** | Cero filas afectadas devuelve `ok: false` y no inserta nada. Cubierto por test |

### Preguntas abiertas

- **[37]** ¿Cuántas bolsas trae un kilo? Medición de planta. Bloquea la carga por
  kilo, no el módulo.
- ¿Las bolsas vienen en bultos de peso fijo? Cambiaría la entrada de «kilos
  sueltos» a «N bultos».

## 14. Implementación

El plan y las tasks van en un documento aparte, como en M1 y M2.

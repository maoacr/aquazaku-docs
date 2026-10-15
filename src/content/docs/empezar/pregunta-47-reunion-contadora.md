---
title: Pregunta 47 — Borrador para la reunión con la contadora
description: Las 10 decisiones que hay que tomar antes de construir el módulo de egresos. Adaptado a régimen simplificado.
sidebar:
  order: 11
---

# Pregunta 47 — Borrador para la reunión con la contadora

**Para llevar a la reunión con la contadora.**
**De:** Mao (desarrollo)
**Estado:** Borrador — sujeto a cambios después de la reunión.

---

## Contexto para la contadora

Aquazaku hoy **NO declara**. Los montos de venta están por debajo del umbral de régimen simplificado del Estatuto Tributario, y se está preparando todo para que, llegado el momento, se empiece a declarar en ese régimen.

Pero "no declarar hoy" no significa "no registrar hoy". El sistema tiene que poder responder, en cualquier momento:

- Cuánto entró en el mes.
- Cuánto salió, y en qué.
- Qué compré a cada proveedor.
- Cuánto pagué en nómina y a quién.
- Qué se gastó en servicios, mantenimiento, publicidad.

El régimen simplificado se acaba el día que las ventas brutas anuales superan las 4.800 UVT. Cuando eso pase, vamos a necesitar reconstruir todo lo que pasó. Si no lo tenemos registrado, vamos a estar mirando tres años de papelitos y WhatsApp.

Por eso el sistema tiene que **registrar como si ya estuviéramos en régimen común**, y la declaración en sí la armás vos en tu software. Acá no estamos haciendo contabilidad formal: somos la fuente de verdad operativa.

---

## Lo que el sistema ya hace (no preguntar)

| Capacidad | Dónde está |
|---|---|
| Registrar ventas, cobros, recargos, devoluciones, compras a proveedores | [RN-CON-04](/dominio/contador/#rn-con-04--el-extracto-trae-los-cinco-movimientos-de-plata) — el extracto del M11 |
| Extraer todo a CSV y PDF para tu software | [RN-CON-08](/dominio/contador/#rn-con-08--el-contador-elige-las-columnas-menos-una) |
| Cartera por edad (quién debe y hace cuánto) | [RN-CON-05](/dominio/contador/#rn-con-05--cartera-por-edad) |
| Inmutabilidad del pasado (un reporte de agosto da igual en diciembre) | [RN-CON-02](/dominio/contador/#rn-con-02--un-reporte-de-agosto-da-lo-mismo-corrido-en-diciembre) |
| Cierre de producción con descuente automático de agua e insumos | [M4 — Producción](/dominio/produccion/) |

## Lo que el sistema NO hace hoy (y por eso esta reunión)

Todo lo que **no es venta ni compra a proveedor** sale de la plata de la planta y no está en ningún lado. Un reporte de "gastos" con lo que hay sería falso. Esto es lo que hay que definir para construir el módulo.

---

## Las 10 decisiones

Están agrupadas en bloques. La numeración es la de la pregunta 47, no la del orden de la reunión.

---

### Bloque 1 — Qué ES y qué NO ES cada cosa

#### 1. ¿La nómina es gasto o costo, y cómo se separa por centro de costo?

**Por qué importa:** el operario que embotella está haciendo producto, su sueldo es COSTO (parte del botellón). El vendedor o el contador están sosteniendo el negocio, su sueldo es GASTO administrativo. Si los metemos todos en una bolsa, no sabemos cuánto nos cuesta producir.

**Opciones:**
- **a)** Forzar porcentaje fijo en el sistema: ej. 60 % producción, 20 % admin, 20 % ventas. Se carga una vez, se distribuye solo.
- **b)** Cada pago de nómina se carga con su distribución manual (planilla de horas por área).
- **c)** Tener dos nóminas separadas: una de "personal de planta" y otra de "personal administrativo". Más simple pero más rígido.

#### 2. ¿Los botellones son activo fijo, inventario, o gasto del mes?

**Por qué importa:** los botellones se compran, se prestan, vuelven, se rompen. Hoy no tienen tabla con costo, solo un contador de movimientos. Si los metemos como gasto del mes, un mes con reposición grande queda con pérdida falsa.

**Opciones:**
- **a) Activo fijo depreciable** — vida útil ~3-5 años, línea recta. Requiere agregar tabla con `costoAdquisicion` y `fechaCompra`. Más caro de implementar.
- **b) Inventario que rota** — se cargan al inventario al comprar, se imputan al gasto cuando se descartan. Coherente con cómo el sistema ya trata el parque.
- **c) Gasto del mes de compra** — el más simple. Cualquier mes con reposición grande queda con pérdida falsa. **No recomendado en régimen simplificado**, porque el parque se deprecia solo.

**Recomendación del sistema:** (b).

#### 3. ¿Y las bases — mismo tratamiento que los botellones?

**Por qué importa:** las bases tienen sticker físico y dirección actual. Sí tienen tabla en la base. Pero no tienen `costoAdquisicion` ni `fechaCompra`.

**Mismas tres opciones que los botellones (a, b, c).** La recomendación: (b) también, para mantener coherencia. Vida útil estimada de una base: 5 años.

---

### Bloque 2 — Cómo se VALÚA lo que hay en bodega

#### 4. ¿PEPS, promedio ponderado, o última compra?

**Por qué importa:** el sistema necesita saber cuánto vale el inventario de insumos en pesos. Si la tapa subió, el inventario de tapas en bodega vale más. La política define cómo se calcula ese "más".

**Opciones:**
- **a) PEPS** (primero en entrar, primero en salir) — el inventario se valora con el precio de la compra más vieja. Es el más usado para inventarios perecederos y el que mejor encaja con el FIFO que ya usa el sistema para los lotes de producto.
- **b) Promedio ponderado** — cada compra recalcula el costo unitario del inventario restante. Más estable en el tiempo.
- **c) Última compra** — el inventario siempre vale al último precio pagado. Más simple pero más volátil.

**Recomendación del sistema:** (a) PEPS, por coherencia con el FIFO de lotes y porque es lo que la DIAN suele esperar para inventarios perecederos.

#### 5. ¿A partir de qué monto un bien se ACTIVA en vez de gastarse?

**Por qué importa:** define la política de capitalización. En Colombia suele ser **medio salario mínimo mensual vigente** y el bien tiene que durar más de un año. Para 2026 eso son ~$812.000. Pero en simplificado el manejo es más laxo — lo importante es tener una política escrita, no que sea el número exacto.

**Opciones:**
- **a)** Un umbral único (ej. 1.300 UVT ~ $58M), todo lo de abajo se gasta, todo lo de arriba se activa.
- **b)** Sin umbral — se activa lo que dura más de un año, se gasta lo demás, independientemente del monto.
- **c)** Política mixta — un umbral más bajo en simplificado ($1M) que se sube automáticamente al pasar a régimen común.

**Recomendación del sistema:** (b), con el check de "dura más de un año". Es la política más coherente con un sistema preparado para crecer.

---

### Bloque 3 — Servicios y contratistas

#### 6. ¿Los servicios profesionales (desarrollo, contratistas, mantenimiento externo) van con RUT y retención?

**Por qué importa:** en régimen simplificado **NO se retiene en la fuente** sobre los pagos a personas naturales no declarantes. Pero cuando se pase a régimen común, sí. Si registramos desde ya con RUT del proveedor y columna de "valor antes de retención", el día del salto no hay que reconstruir.

**Pregunta concreta:** ¿querés que el sistema pida el RUT del proveedor de servicios desde ya, aunque no calcule retención? (Mi recomendación: sí. Es un campo más, no agrega complejidad, y deja la puerta abierta.)

#### 7. ¿Cómo se imputan los recibos públicos cuando vienen unificados (planta + oficina)?

**Por qué importa:** la factura de energía puede venir una sola con varios medidores, o una sola sin separación. La contadora necesita que la energía de la planta vaya al costo de producción, y la de la oficina al gasto administrativo.

**Opciones:**
- **a)** Registrar el recibo como un solo egreso, con prorrateo manual entre "costo" y "gasto".
- **b)** Cargar dos líneas: una para planta (costo), otra para oficina (gasto), con su consumo medido en kWh.
- **c)** Solo registrar la parte de la planta como costo y la oficina como gasto por separado, con su factura individual.

**Recomendación del sistema:** depende de cómo vienen las facturas hoy. Si vienen separadas, (c). Si vienen unificadas, (a) o (b) según el detalle que traigan.

---

### Bloque 4 — Impuestos y soporte

#### 8. ¿Los impuestos se registran como gasto o como línea separada?

**Por qué importa:** en P&L, los impuestos son una línea aparte. Si los metemos como "gasto", la utilidad operativa queda inflada y vos vas a desconfiar del número cuando empieces a declarar.

**Recomendación del sistema:** línea separada con tipo `impuesto`. Aunque hoy no haya declaración, el sistema tiene que poder filtrar "todo lo que fue impuesto" para cuando llegue el momento.

#### 9. ¿La factura electrónica bloquea el marcado como deducible?

**Por qué importa:** en simplificado hoy la factura electrónica no es obligatoria. Pero el Estatuto Tributario (Art. 771-2) dice que un gasto es deducible solo si tiene factura electrónica. Cuando se pase a régimen común, esa exigencia vuelve.

**Opciones:**
- **a)** En simplificado: el sistema deja registrar sin factura, marca `deducible = false` automáticamente. Cuando se pase a común, se exige la URL.
- **b)** Desde ya: el sistema pide la URL de factura para todo egreso. En simplificado se puede registrar con `sin_factura` como motivo.
- **c)** Híbrido: el campo `url_factura` es opcional, pero si está vacío el sistema marca `deducible = false`. Reportes futuros pueden filtrar por deducible.

**Recomendación del sistema:** (c). Es la política más flexible, registra el dato desde ya, y deja a la contadora decidir qué es deducible.

---

### Bloque 5 — Operación del módulo

#### 10. ¿Qué rol carga cada tipo de egreso?

**Por qué importa:** no todos los roles deberían poder registrar ciertos egresos. La nómina la registra el admin; un recibo de luz, el operario con permisos de inventario.

**Sugerencia inicial:**

| Tipo de egreso | Quién lo carga | Quién lo ve |
|---|---|---|
| Nómina | `admin` | `admin`, `contador` |
| Servicios públicos | operativo con permiso `insumos:ajustar` | `contador` |
| Impuestos | `admin` | `admin`, `contador` |
| Mantenimiento | operativo con permiso | `contador` |
| Publicidad / litografía | operativo con permiso | `contador` |
| Compras a proveedores | lo que ya está | lo que ya está |

¿Esto te sirve o necesitamos más granularidad por tipo?

---

## Lo que necesito de la reunión

Si contestamos las 10, tenemos todo lo necesario para diseñar el módulo. Si hay preguntas que no podés contestar en el momento, las dejamos marcadas y seguimos con las que sí.

**Tiempo estimado:** 60-90 min.

---

## Una vez que estén las respuestas

El plan de implementación está en [la página principal de la pregunta 47](/empezar/pregunta-47/#el-plan-si-se-cierran-las-10). El orden es:

1. Módulo `egresos` (la tabla con tipo enum).
2. Módulo `nomina` (con distribución por centro de costo).
3. Extender `insumos` para materializar el costo unitario en cada movimiento.
4. Extender `cierres_produccion` para registrar el costo de los insumos consumidos.
5. Extender `bases` y `movimientos_botellon` con `costoAdquisicion` y `fechaCompra`.
6. Pantalla `/modulos/egresos` en `web/`.
7. Extender `/reportes/extracto` para incluir los seis tipos de egreso.

Lo que se puede avanzar en paralelo sin esperar la reunión está en [la página principal de la pregunta 47](/empezar/pregunta-47/#lo-que-se-puede-hacer-ya-sin-esperar-la-reunión).

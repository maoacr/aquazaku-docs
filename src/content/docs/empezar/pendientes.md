---
title: Qué falta preguntar
description: Checklist consolidado de todo lo que hay que validar con Aquazaku antes de implementar.
sidebar:
  order: 3
---

Todo lo que el dominio da por supuesto y **todavía no está confirmado**, en una
sola lista. Sirve para llevarla a una reunión con Aquazaku y volver con respuestas.

Está ordenada por **cuánto duele equivocarse**, no por área.

:::tip[Cómo usarla]
Cuando una pregunta se responde: actualizá la regla correspondiente, cambiá su
estado de 🟡 a ✅, y borrá la línea de acá.

Esta página tiene que **encogerse** con el tiempo. Si crece, el proyecto está
avanzando sobre supuestos.
:::

---

## 🔴 Bloquean el modelo de datos

Sin esto no se puede diseñar el esquema. Equivocarse acá significa migrar datos
después.

:::tip[Bloque cerrado — 18 de agosto de 2026]
Las 3 preguntas de este bloque quedaron resueltas. Ver el bloque
"Resueltas — 18 de agosto de 2026" más abajo para el detalle de cada una.
:::

:::tip[Resueltas — 16 de agosto de 2026]
- Paca de 300 ml = **50 bolsas** → 15 L. Balance de agua cerrado.
- La ruta se asigna a la **dirección**, no al cliente ([RN-CLI-05](/dominio/clientes/)).
- El saldo de botellones va por **cliente** ([RN-ENV-04](/dominio/botellones-y-bases/)).
- Botellón lleno vs vacío: **fuera del alcance inicial**, se envasa bajo demanda
  ([RN-ENV-07](/dominio/botellones-y-bases/)).
- Identidad del cliente: **UUID** del sistema, documento como dato de búsqueda
  ([RN-CLI-01](/dominio/clientes/)).
- El documento **es único**: dos clientes nunca lo comparten ([RN-CLI-08](/dominio/clientes/)).
- Los dos tanques de 2000 L son **separados**, no un pozo único. El techo por
  tanda continua es 2.000 L, no 4.000 ([RN-PRD-02](/dominio/produccion/)).
- El documento es **obligatorio**, pero se puede tomar dictado. Lo que varía es
  su **estado de verificación** ([RN-CLI-10](/dominio/clientes/)).
- El `seller` **sí puede registrar clientes** en la calle ([RN-CLI-10](/dominio/clientes/)).
- La validación contra la **copia local** alcanza; **no** se construye pantalla de
  fusión de duplicados ([RN-CLI-11](/dominio/clientes/)).
:::

:::tip[Resueltas — 18 de agosto de 2026]
**🔴 Bloquean el modelo de datos** — todas:
- **#1**: ¿Existe venta a crédito? **Sí, opt-in por cliente.** Plazos 30/60/90
  disponibles siempre; tope opcional (default `null`); solo `admin` activa.
  ([RN-CLI-12](/dominio/clientes/)).
- **#2**: ¿Propuesta de `tipo_documento` + DV calculado? **Sí, aceptada.**
  Tipos = `CC | NIT` solamente; el DV se calcula para NIT y se deshabilita
  para CC. ([RN-CLI-09](/dominio/clientes/)).
- **#3**: ¿Cliente `PENDIENTE` con crédito? **No puede, sin override.**
  Invariante de backend obligatorio. ([RN-CLI-15](/dominio/clientes/)).
  Bonus: el chequeo de límite en ruta (#21) ahora se entiende contra
  `limite_monto` y solo bloquea si está seteado.

**🟡 Roles** — bloque completo cerrado:
- **#8**: ¿Quién registra cierre de producción? **`pos`** (en planta, hoy es la
  única persona que opera la planta).
- **#9**: ¿Quién anula? **Matriz por autor + fecha.** Ver
  [RN-VEN-08](/dominio/ventas/). `seller` y `pos` solo anulan lo propio y
  solo el día en curso; `admin` anula todo. **Comentario obligatorio** para
  todos.
- **#10**: ¿Quién carga la ruta del día? **El sistema la genera** con un
  modelo de predicción que ordena clientes por probabilidad de necesitar
  agua (incluido en el MVP).
- **#11**: ¿Quién autoriza el préstamo de base? **`pos` es autónoma**,
  único requisito = cliente verificado. Pos puede verificar Y entregar en
  una sola operación. ([RN-BAS-07](/dominio/botellones-y-bases/)).
- **#12**: ¿Cuántos `admin`, hace falta readonly? **4to rol `contador`**:
  solo lectura + descarga de reportes PDF para temas tributarios en Colombia.
  ([Roles y permisos](/dominio/roles-y-permisos/)).
- **#13**: ¿Una persona puede ser `seller` y `pos`? **Sí, multi-rol por
  usuario.** Hoy solo hay un usuario `pos`; el sistema soporta N roles
  asignables por `admin`. La UI esconde módulos según el contexto
  (mobile ≠ desktop), pero el backend autoriza por capacidad del rol.
  ([RN-ACC-01](/dominio/roles-y-permisos/)).

**Decisiones derivadas (fuera del 🔴/🟡 original) que se incorporaron:**
- La verificación del documento la pueden hacer **los tres roles** (`seller`,
  `pos`, `admin`), con métodos diferenciados. ([RN-CLI-14](/dominio/clientes/)).
- El `seller` **no** es repartidor en Aquazaku: contacta clientes a distancia
  (llamada/WhatsApp) y registra ventas. La planta prepara y los transportadores
  informales externos entregan (no son usuarios del sistema).
:::

---

## 🟠 Faltan mediciones en planta

No son decisiones: son números que hay que ir a tomar.

| # | Qué medir | Para qué |
| :-: | --- | --- |
| 4 | **Caudal en GPM** — y si la placa dice galón americano o imperial. Son 20% de diferencia. | [RN-PRD-18](/dominio/produccion/) |
| 5 | **Tiempo de llenado de un tanque de 2.000 L** → de ahí sale el caudal real. | [RN-PRD-18](/dominio/produccion/) |
| 6 | **Litros que consume lavar un botellón.** | [RN-PRD-05](/dominio/produccion/) |
| 7 | **Consumo diario promedio en litros.** *Se autocalcula a las semanas de registrar cierres de producción — un estimado inicial alcanza.* | [RN-PRD-13](/dominio/produccion/) |

---

## 🟡 Definen alcance y permisos

Cambian qué se construye y quién puede hacer qué.

:::tip[Roles — cerrado]
Las 6 preguntas de roles (#8–#13) quedaron resueltas en la sesión del
18-ago-2026. Ver el bloque de resueltas arriba. Las tres siguientes categorías
siguen abiertas.
:::

### Producción

| # | Pregunta |
| :-: | --- |
| 14 | ¿Los tanques de agua procesada se **alternan** o hay uno principal y otro de reserva? No cambia el modelo de datos, sí la interfaz: elegir tanque en cada operación vs. proponer uno por defecto. |
| 15 | Envasando bajo demanda, ¿el cierre de producción se registra **una vez al día** o **por cada tanda**? |

### Operación de ruta

| # | Pregunta |
| :-: | --- |
| 16 | ¿La ruta es fija por `seller` o se arma cada día? *(Nota: con la predicción para MVP, la "ruta" pasa a ser una lista priorizada de contactos, generada por el sistema. Aclarar si la dinámica de vendedor fijo / reasignable sigue vigente o se reemplaza.)* |
| 17 | ¿El `seller` puede vender a un cliente fuera de su ruta? *(Misma nota: ahora la pregunta pasa a "¿puede agregar manualmente a un cliente que el sistema no le surfaceó?".)* |
| 18 | ¿Quién autoriza un faltante? ¿Se le descuenta al `seller`? *(Hoy sin producto físico en la calle, "faltante" pasa a ser ventas registradas que la planta no pudo cumplir.)* |
| 19 | ¿Qué pasa si termina el día sin señal y no puede sincronizar? ¿La ruta queda abierta? |
| 20 | ¿Se hace seguimiento de ubicación del `seller`? *(Menos crítico ahora: el seller no hace recorrido físico. Pregunta a redefinir — ¿se geolocaliza la visita al cliente en el momento del contacto?)* |
| 22 | ¿Puede una dirección quedar sin ruta asignada? *(Hoy sí: compra en mostrador.)* |

### Activos retornables

| # | Pregunta |
| :-: | --- |
| 23 | ¿Se cobra depósito o garantía por la base prestada? ¿Y por el botellón no devuelto? |
| 24 | ¿Cómo se identifica físicamente una base — grabado, etiqueta, código de barras, QR? Define si el `seller` puede escanearla. |
| 25 | ¿Hay tipos o modelos distintos de base? |
| 26 | ¿Hay límite de botellones que un cliente puede tener? |
| 27 | ¿Puede haber una dirección con base pero sin botellones, o al revés? |

---

## 🟢 Refinan, no bloquean

Se pueden dejar para después sin frenar el diseño.

### Ventas

- ¿Se emite comprobante fiscal? ¿De qué tipo?
- ¿Hay descuentos o listas de precio por tipo de cliente?
- ¿Se distinguen clientes hogar y comercio?
- ¿Se aceptan devoluciones, o solo anulación de la venta completa?
- ¿El préstamo de una base va dentro de la venta o es una operación aparte?

### Stock y compras

- ¿Hay más de una bodega? ¿La planta y la bodega son el mismo lugar?
- ¿Hay más de un punto de venta?
- ¿Se controlan las bolsas como insumo, además de tapas y sellos?
- ¿Se define stock mínimo de tapas y sellos con alerta de reposición?
- ¿Se compran insumos de tratamiento de agua? ¿Se controlan o son gasto?
- ¿Se lleva cuenta corriente con proveedores o se paga contra entrega?
- ¿Hay control de lotes o vencimiento?
- ¿Cada cuánto se hace inventario físico?

### Producción

- ¿Quién registra el encendido y apagado de la planta, y cómo?
- ¿La producción se registra una vez al día, por turno o por lote?
- ¿El producto envasado se puede vender el mismo día, o hay reposo o control de calidad?
- ¿Se vende la bolsa suelta o siempre la paca completa?
- ¿Puede descartarse producto ya envasado por calidad?

---

## Propuestas a Aquazaku

No son preguntas: son recomendaciones que conviene plantear antes de escribir código.

| Propuesta | Por qué |
| --- | --- |
| **Regleta graduada en el tanque de 13.000 L** | Es el último punto ciego del balance de agua. Cuesta casi nada y cierra el cálculo. Los tanques de 2000 L ya no la necesitan. Ver [la especificación](/dominio/produccion/). |
| **Registrar el tiempo de cada corrida de procesamiento** | El caudal se mide después de los filtros: si el tiempo sube mes a mes, los filtros se están tapando. Mantenimiento predictivo gratis. |

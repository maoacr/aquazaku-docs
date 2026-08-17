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

| # | Pregunta | Impacta |
| :-: | --- | --- |
| 1 | **¿Existe venta a crédito o todo es de contado?** Si no hay crédito, se cae medio módulo de clientes. | Ventas, clientes |
| 2 | **¿Se acepta la propuesta de `tipo_documento` explícito + DV calculado?** Es una propuesta nuestra, falta el visto bueno. | [RN-CLI-09](/dominio/clientes/) |
| 3 | **¿Un cliente con documento `PENDIENTE` puede acceder a crédito?** Lo natural es que no. Documentado como supuesto. | [RN-CLI-10](/dominio/clientes/) |

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

### Roles

| # | Pregunta | Impacta |
| :-: | --- | --- |
| 8 | **¿Quién registra el cierre de producción?** Los tres roles no incluyen a nadie de planta. Si el operario no es `admin`, **falta un rol**. | [Roles](/dominio/roles-y-permisos/) |
| 9 | ¿`pos` puede anular una venta del día, o siempre depende de `admin`? Es la fricción operativa más probable. | Ventas |
| 10 | ¿Quién carga la ruta por la mañana? | Rutas |
| 11 | ¿Quién autoriza el préstamo de una base? | Bases |
| 12 | ¿Cuántas personas van a tener rol `admin`? ¿Hace falta un `admin` de solo lectura para un contador? | Auditoría |
| 13 | ¿Una misma persona puede ser `seller` unos días y `pos` otros? | [RN-ACC-01](/dominio/roles-y-permisos/) |

### Producción

| # | Pregunta |
| :-: | --- |
| 14 | ¿Los tanques de agua procesada se **alternan** o hay uno principal y otro de reserva? No cambia el modelo de datos, sí la interfaz: elegir tanque en cada operación vs. proponer uno por defecto. |
| 15 | Envasando bajo demanda, ¿el cierre de producción se registra **una vez al día** o **por cada tanda**? |

### Operación de ruta

| # | Pregunta |
| :-: | --- |
| 16 | ¿La ruta es fija por `seller` o se arma cada día? |
| 17 | ¿El `seller` puede vender a un cliente fuera de su ruta? |
| 18 | ¿Quién autoriza un faltante? ¿Se le descuenta al `seller`? |
| 19 | ¿Qué pasa si termina el día sin señal y no puede sincronizar? ¿La ruta queda abierta? |
| 20 | ¿Se hace seguimiento de ubicación del `seller`? |
| 21 | ¿Qué pasa si un cliente supera su límite de crédito en plena ruta? ¿Se bloquea o se permite? |
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

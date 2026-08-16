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
| 1 | **¿Cuántas bolsas trae la paca de 300 ml?** Asumimos 50, pero ese número venía de cuando la presentación era de 200 ml y no se reconfirmó. | Todo el balance de agua |
| 2 | **¿La ruta se asigna al cliente o a la dirección?** Un cliente con locales en zonas distintas rompe la regla actual. | [RN-CLI-05](/dominio/clientes/), rutas |
| 3 | **¿El saldo de botellones va por cliente o por dirección?** | [RN-ENV-04](/dominio/botellones-y-bases/) |
| 4 | **¿Un botellón se distingue lleno de vacío en el inventario?** Hoy el sistema no lo sabría, y un vacío no se puede vender. | [RN-ENV-07](/dominio/botellones-y-bases/) |
| 5 | **¿Cuál es la clave única de un cliente?** ¿Documento, teléfono, dirección? | [RN-CLI-01](/dominio/clientes/) |
| 6 | **¿Existe venta a crédito o todo es de contado?** Si no hay crédito, se cae medio módulo de clientes. | Ventas, clientes |
| 7 | ¿Los dos tanques de 2000 L se controlan por separado o como un pozo único? | [RN-PRD-02](/dominio/produccion/) |

---

## 🟠 Faltan mediciones en planta

No son decisiones: son números que hay que ir a tomar.

| # | Qué medir | Para qué |
| :-: | --- | --- |
| 8 | **Caudal en GPM** — y si la placa dice galón americano o imperial. Son 20% de diferencia. | [RN-PRD-18](/dominio/produccion/) |
| 9 | **Tiempo de llenado de un tanque de 2.000 L** → de ahí sale el caudal real. | [RN-PRD-18](/dominio/produccion/) |
| 10 | **Litros que consume lavar un botellón.** | [RN-PRD-05](/dominio/produccion/) |
| 11 | **Consumo diario promedio en litros.** *Se autocalcula a las semanas de registrar cierres de producción — un estimado inicial alcanza.* | [RN-PRD-13](/dominio/produccion/) |

---

## 🟡 Definen alcance y permisos

Cambian qué se construye y quién puede hacer qué.

### Roles

| # | Pregunta | Impacta |
| :-: | --- | --- |
| 12 | **¿Quién registra el cierre de producción?** Los tres roles no incluyen a nadie de planta. Si el operario no es `admin`, **falta un rol**. | [Roles](/dominio/roles-y-permisos/) |
| 13 | ¿`pos` puede anular una venta del día, o siempre depende de `admin`? Es la fricción operativa más probable. | Ventas |
| 14 | ¿`seller` puede dar de alta clientes en la calle? | Clientes |
| 15 | ¿Quién carga la ruta por la mañana? | Rutas |
| 16 | ¿Quién autoriza el préstamo de una base? | Bases |
| 17 | ¿Cuántas personas van a tener rol `admin`? ¿Hace falta un `admin` de solo lectura para un contador? | Auditoría |
| 18 | ¿Una misma persona puede ser `seller` unos días y `pos` otros? | [RN-ACC-01](/dominio/roles-y-permisos/) |

### Operación de ruta

| # | Pregunta |
| :-: | --- |
| 19 | ¿La ruta es fija por `seller` o se arma cada día? |
| 20 | ¿El `seller` puede vender a un cliente fuera de su ruta? |
| 21 | ¿Quién autoriza un faltante? ¿Se le descuenta al `seller`? |
| 22 | ¿Qué pasa si termina el día sin señal y no puede sincronizar? ¿La ruta queda abierta? |
| 23 | ¿Se hace seguimiento de ubicación del `seller`? |
| 24 | ¿Qué pasa si un cliente supera su límite de crédito en plena ruta? ¿Se bloquea o se permite? |

### Activos retornables

| # | Pregunta |
| :-: | --- |
| 25 | ¿Se cobra depósito o garantía por la base prestada? ¿Y por el botellón no devuelto? |
| 26 | ¿Cómo se identifica físicamente una base — grabado, etiqueta, código de barras, QR? Define si el `seller` puede escanearla. |
| 27 | ¿Hay tipos o modelos distintos de base? |
| 28 | ¿Hay límite de botellones que un cliente puede tener? |
| 29 | ¿Puede haber una dirección con base pero sin botellones, o al revés? |

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

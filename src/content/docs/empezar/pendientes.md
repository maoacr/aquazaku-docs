---
title: Qué falta preguntar
description: Checklist consolidado de lo que hay que validar con Aquazaku antes de implementar.
sidebar:
  order: 3
---

Esta página tiene **únicamente las preguntas que siguen abiertas**. Lo que ya
quedó resuelto está documentado en su `RN-*` correspondiente dentro de las
secciones de dominio ([Clientes](/dominio/clientes/),
[Ventas](/dominio/ventas/), [Producción](/dominio/produccion/),
[Botellones y bases](/dominio/botellones-y-bases/),
[Roles y permisos](/dominio/roles-y-permisos/), etc.).

Está ordenada por **cuánto duele equivocarse**, no por área.

:::tip[Cómo usarla]
Cuando una pregunta se responde: actualizá la regla correspondiente (cambiá
`🟡 Supuesto` por `✅ Confirmada` en el `RN-*` que corresponda) y borrá la
línea de acá.

Esta página tiene que **encogerse** con el tiempo. Si crece, el proyecto está
avanzando sobre supuestos.
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

## 🟢 Refinan, no bloquean

Se pueden dejar para después sin frenar el diseño.

### Ventas

- ¿Se emite comprobante fiscal? ¿De qué tipo?
- ¿Hay descuentos o listas de precio por tipo de cliente?
- ¿Se distinguen clientes hogar y comercio?
- ¿Se aceptan devoluciones de producto, o solo anulación de la venta completa?
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

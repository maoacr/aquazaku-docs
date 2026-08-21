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
[Productos](/dominio/productos/),
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

## 🔴 Bloquean M1 — Productos y catálogo

Son **decisiones de negocio**, no mediciones. Ninguna frena el modelo de datos,
pero sí la carga del catálogo real: sin respuesta no se puede sembrar un
producto de verdad. Contexto completo en
[Productos y catálogo](/dominio/productos/).

| # | Pregunta | Para qué |
| :-: | --- | --- |
| 9 | **¿Los precios se cargan con IVA incluido o se discrimina aparte?** Si se discrimina, el producto necesita su tarifa y la venta dos totales. Bloquea M11 (Contador). | [RN-CAT-03](/dominio/productos/) |
| 10 | **¿El código de producto lo define Aquazaku o lo genera el sistema?** Si ya usan códigos en su operación, el catálogo tiene que respetarlos. | [RN-CAT-01](/dominio/productos/) |
| 11 | **¿Se venden bolsas sueltas o solo pacas completas?** Cambia la unidad de venta y el descuento de stock. Hoy el modelo asume paca completa. | [RN-CAT-01](/dominio/productos/) |

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

*(A la fecha de la última sesión de planning, todas las preguntas 🟢 cerradas.
Solo quedan las 4 mediciones 🟠 que requieren ir a la planta.)*

---

## Propuestas a Aquazaku

No son preguntas: son recomendaciones que conviene plantear antes de escribir código.

| Propuesta | Por qué |
| --- | --- |
| **Regleta graduada en el tanque de 13.000 L** | Es el último punto ciego del balance de agua. Cuesta casi nada y cierra el cálculo. Los tanques de 2000 L ya no la necesitan. Ver [la especificación](/dominio/produccion/). |
| **Registrar el tiempo de cada corrida de procesamiento** | El caudal se mide después de los filtros: si el tiempo sube mes a mes, los filtros se están tapando. Mantenimiento predictivo gratis. |

---
title: Glosario del negocio
description: Vocabulario compartido entre negocio y código. El lenguaje ubicuo de Aquazaku.
sidebar:
  order: 2
---

Este glosario es el **lenguaje ubicuo** del sistema: los términos que usa el
negocio son los mismos que usa el código. Si en la calle se dice "botellón",
la entidad se llama `Botellon`, no `WaterContainer`.

Cuando aparezca un término nuevo en una conversación con el cliente, se agrega acá
antes de escribir la clase.

## Producto y activos

Tres cosas distintas. Confundirlas es el error más caro de este dominio —
ver [Botellones y bases](/dominio/botellones-y-bases/).

| Término | Se vende | Trazabilidad | Definición |
| --- | --- | --- | --- |
| **Paca** | Sí | Por producto | Paquete de bolsas de agua. Sale y no vuelve. |
| **Botellón** | **No** | **Solo cantidad** | Envase retornable de **20 L**. Se recarga y se intercambia sin trámite. |
| **Base** | **No** | **ID individual** | Soporte del botellón. Se entrega en **préstamo** a una dirección. |
| **Tapa** | No | Por cantidad | Insumo. Se consume al sellar un botellón. |
| **Sello termoencogible** | No | Por cantidad | Insumo. Se consume al sellar un botellón. |
| **Recarga** | — | — | Entregar un botellón lleno a cambio de uno vacío. |

### Presentaciones y su equivalencia en agua

| Presentación | Unidades | Volumen unitario | **Litros** |
| --- | --- | --- | --- |
| Paca de 600 ml | 20 bolsas | 600 ml | 12 L |
| Paca de 300 ml | 50 bolsas | 300 ml | 15 L |
| Botellón | — | 20 L | 20 L |

Cada botellón llenado consume además **1 tapa + 1 sello**.
Ver [Producción y agua](/dominio/produccion/) para el balance completo.

:::tip[La regla de trazabilidad]
Se rastrea por **ID** lo que hay que reclamar individualmente (la base).
Se rastrea por **cantidad** lo que se intercambia (el botellón).
:::

## Roles

Los tres roles del sistema. Confirmados por Aquazaku — ver
[Roles y permisos](/dominio/roles-y-permisos/).

| Término | Identificador | Definición |
| --- | --- | --- |
| **Admin** | `admin` | Administración. Supervisa, corrige y configura. Opera en web. |
| **Seller** | `seller` | Vendedor de ruta. Va al cliente, opera desde la app mobile, sin señal. |
| **POS** | `pos` | Punto de venta fijo. El cliente viene al mostrador. |

:::tip[Por qué Seller y POS son roles distintos]
No es jerarquía, es **contexto de operación**. `seller` vende contra la carga de
su vehículo y sin conexión; `pos` vende contra el stock de bodega y con conexión.
Esa diferencia atraviesa stock, modo offline y rendición.
:::

## Producción

| Término | Definición |
| --- | --- |
| **Planta de empaque** | Donde el agua se procesa y se convierte en producto. Está en Campo de la Cruz. |
| **Agua cruda** | Agua de la red municipal, sin procesar. Almacenamiento: **13.000 L**. |
| **Agua procesada** | Agua ya filtrada, lista para envasar. **Dos tanques de 2000 L**, aparte del almacenamiento crudo. |
| **Rechazo** | El **30%** del flujo que descartan los filtros. No se puede envasar. |
| **Rendimiento** | Proporción de agua cruda que queda utilizable: **70%**. Si baja, los filtros necesitan mantenimiento. |
| **Autonomía** | Días que la planta puede producir sin que llegue agua de la red. Objetivo: **≥ 5 días**, el peor corte conocido. |
| **Cierre de producción** | Registro diario de qué se envasó y cuántos botellones se llenaron. |
| **Agua de lavado** | Litros que consume alistar un botellón antes de rellenarlo. Se gasta y no genera producto. |
| **Merma** | Diferencia entre el consumo calculado y la realidad del tanque. Hoy **no es cuantificable**: la medición es a ojo. |
| **Banda de nivel** | Estimación visual del tanque en cuartos: vacío, ¼, ½, ¾, lleno. La única medición disponible. |
| **Saldo calculado** | Litros deducidos de la aritmética de producción. Es la fuente de verdad, no el tanque. |

## Operación

| Término | Definición |
| --- | --- |
| **Ruta** | Recorrido asignado a un `seller` para visitar clientes. |
| **Carga** | Producto y envases que salen con el `seller` al iniciar la ruta. |
| **Rendición** | Cierre de ruta: qué se vendió, qué volvió, cuánto se cobró. |
| **Punto de venta** | Lugar fijo donde opera un `pos`. |

:::caution[Pendiente de validar con el cliente]
Los términos de **Productos**, **Operación** y **Comercial** son una primera
aproximación nuestra. Hay que confirmarlos con Aquazaku antes de modelar las
entidades — cambiar un nombre de dominio después de tener código escrito cuesta caro.

Los **Roles** sí están confirmados.
:::

## Comercial

| Término | Definición |
| --- | --- |
| **Cliente** | Quien compra. Puede ser hogar o comercio (a definir si se distinguen). |
| **Dirección** | Ubicación física de un cliente. Un cliente puede tener **varias**, y cada base prestada se asigna a una. Es una entidad, no un campo de texto. |
| **Proveedor** | Quien vende insumos a Aquazaku. |
| **Saldo** | Un cliente tiene **tres**: deuda en dinero, botellones en su poder (cantidad) y bases prestadas (por dirección). |

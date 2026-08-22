---
title: Insumos de empaque
description: Tapas, sellos y bolsas — lo que se consume al producir, y qué pasa cuando se acaba.
sidebar:
  order: 4
---

Una planta sin tapas no produce, por más agua que tenga en los tanques. Los
insumos de empaque son la otra mitad del inventario: no se venden, **se
consumen**, y si el sistema no los ve, nadie se entera de que se están acabando
hasta que se acabaron.

Que son stock ya está confirmado en
[RN-STK-04](/dominio/stock/#rn-stk-04--los-insumos-de-empaque-son-stock-y-se-consumen-por-producción).
Este documento define **cuáles son**, **cómo se cuentan** y **cuándo avisan**.

## Los tres insumos

| Insumo | Se consume al | Se compra por |
| --- | --- | --- |
| **Tapa** para botellón | Llenar y sellar un botellón | Unidad |
| **Sello** termoencogible | Llenar y sellar un botellón | Unidad |
| **Bolsa** de 600 ml y de 300 ml | Envasar una paca | **Kilo** |

El cloro y los filtros **no entran acá**: ver
[RN-INS-04](#rn-ins-04--el-tratamiento-de-agua-es-gasto-no-inventario).

---

## RN-INS-01 — El insumo sale por producción, nunca por venta

**Estado:** ✅ Confirmada

Un insumo no se despacha a un cliente: desaparece cuando se convierte en
producto. La única salida legítima es el **cierre de producción**
([RN-PRD-09](/dominio/produccion/)), más el **ajuste** y el **descarte**, que
son excepciones y exigen motivo.

**Por qué importa la distinción:** el producto terminado tiene una salida
esperada —la venta— y una excepcional. El insumo solo tiene la de producción. Si
aparece una salida de insumo que no viene de un cierre, o alguien la registró
mal, o hay una pérdida que hay que explicar.

## RN-INS-02 — Las bolsas se compran por kilo, se guardan por unidad

**Estado:** ✅ Confirmada (22-ago-2026)

Las bolsas llegan por peso, pero el inventario las guarda **en unidades**.

| Momento | Unidad natural | Qué hace el sistema |
| --- | --- | --- |
| Compra | Kilos | Convierte a unidades al recibir |
| Producción | Unidades (20 por paca de 600, 50 por paca de 300) | Descuenta exacto |
| Conteo físico | Kilos — nadie cuenta cinco mil bolsas | Se pesa, se convierte y se **ajusta con motivo** |

### Por qué la unidad y no el kilo

La conversión es **siempre aproximada**: el grosor de la bolsa varía entre
lotes, así que un kilo no trae siempre la misma cantidad. La pregunta no es si
hay error, es dónde ponerlo.

Se elige la unidad por tres razones:

**La pregunta que importa está en unidades.** «¿Cuántas pacas más puedo envasar
antes de quedarme sin bolsas?» no se responde en kilos.

**El consumo tiene que ser exacto.** Una producción que gasta 20 bolsas gasta 20
bolsas. Guardando kilos, cada cierre restaría una fracción y el saldo se llenaría
de decimales que no significan nada.

**Los dos momentos en kilos ya son puntos de ajuste.** Recibir una compra y hacer
un conteo físico son operaciones donde el sistema ya exige motivo
([RN-STK-02](/dominio/stock/)). Meter ahí la aproximación es honesto: queda
registrada, con quién la hizo y por qué.

:::caution[La equivalencia es una medición, no una constante]
Cuántas bolsas trae un kilo **hay que ir a medirlo en planta**, y es distinto
para la de 600 y la de 300. Es la [pregunta 37](/empezar/pendientes/).

Hasta tenerla, el sistema **no puede** convertir kilos a unidades solo. Y no
debería inventar un número: una equivalencia mal puesta descuadra el inventario
en silencio y se descubre el día que faltan bolsas para envasar.
:::

## RN-INS-03 — El stock mínimo avisa antes de frenar la planta

**Estado:** ✅ Confirmada (22-ago-2026)

Cada insumo tiene un **stock mínimo**. Cuando el saldo cae a ese número o por
debajo, el sistema avisa.

| Insumo | Mínimo inicial |
| --- | --- |
| Tapas | 200 |
| Sellos | 200 |
| Bolsas 600 ml | *pendiente de la equivalencia — [pregunta 37](/empezar/pendientes/)* |
| Bolsas 300 ml | *ídem* |

**Es un valor inicial, no una constante del negocio.** Tiene que poder ajustarse
desde la administración sin tocar código, igual que el aviso de vencimiento
([RN-STK-11](/dominio/stock/)). Va con los umbrales configurables de
[M12 · Alertas](/arquitectura/roadmap/).

**Por qué configurable:** el mínimo correcto es «lo que consumo mientras llega el
pedido», y eso depende del ritmo de producción y de cuánto tarda el proveedor.
Ninguno de los dos está medido todavía. Un mínimo muy bajo avisa cuando ya es
tarde; uno muy alto avisa siempre y entrena a ignorar la alerta.

## RN-INS-04 — El tratamiento de agua es gasto, no inventario

**Estado:** ✅ Confirmada (22-ago-2026)

El **cloro** y los **filtros** no se controlan como stock. Se compran y se
registran como costo.

**Por qué:** un insumo en inventario existe para responder «¿cuánto me queda y
cuándo pido más?». Para el cloro esa pregunta se responde mirando el bidón, y
para el filtro no aplica — no se consume por unidades, se reemplaza por horas de
uso, que es mantenimiento y vive en
[producción](/dominio/produccion/).

Meterlos al inventario agregaría dos cosas que hay que mantener a mano sin que
nadie mire el número.

---

## Lo que M3 deja listo y lo que no

**Sí:** el catálogo de insumos, su saldo, la entrada por compra, el ajuste con
motivo y la alerta de mínimo.

**No:** el descuento automático por producción. Eso llega con
[M4](/arquitectura/roadmap/), que es donde existe el cierre de producción. Hasta
entonces el saldo se mueve a mano, con motivo — que es exactamente como se movió
el stock de producto entre M2 y M4.

## Preguntas abiertas

- **[37]** ¿Cuántas bolsas trae un kilo, para la de 600 y para la de 300? Es una
  medición de planta y bloquea la conversión de [RN-INS-02](#rn-ins-02--las-bolsas-se-compran-por-kilo-se-guardan-por-unidad).
- ¿Las bolsas se compran en presentaciones fijas —bultos de X kilos— o a granel?
  Cambia si la compra se registra en kilos sueltos o en bultos.
- ¿Hay más de un proveedor por insumo? Afecta a [proveedores](/dominio/proveedores/),
  no a este módulo.

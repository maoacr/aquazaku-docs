---
title: Un hecho de un momento se guarda; una función se recalcula
description: La regla que este proyecto aplicó en cinco milestones, y la única vez que decidió romperla.
---

Aparece en cada milestone y siempre con la misma forma: **hay un número que se
podría recalcular, y hay que decidir si guardarlo**.

La respuesta no es «guardar todo por las dudas» ni «no duplicar nunca». Es una
pregunta concreta:

> **¿El valor depende de un momento que ya pasó?**
>
> Si sí, se guarda. Si es una función de datos que ya están guardados, se
> recalcula.

---

## Las cinco veces que se guardó

| Milestone | Qué se guarda | Qué pasaría si se recalculara |
| --- | --- | --- |
| M2 · Stock | `fecha_vencimiento` del lote | Cambiar la vida útil de 30 a 45 días **reescribiría el pasado**: lotes que ya se descartaron pasarían a estar vigentes |
| M3 · Insumos | `equivalencia` en el movimiento | Corregir cuántas unidades trae un kilo reinterpretaría compras viejas con la medición nueva |
| M4 · Producción | `caudal_gpm` en el cierre | Medir bien el caudal cambiaría cuántos litros se procesaron **todos los días del pasado** |
| M6 · Ventas | `precio_lista_aplicado`, `tipo_cliente_al_momento`, `descuento_monto`, `precio_minimo_aplicado` | Una venta de hace seis meses se leería con la lista de precios de hoy y con el cliente convertido en comercial |
| M6 · Ventas | `litros_consumidos` del cierre | `productos.litros` es una columna generada; recalcular ataría el pasado a la definición actual del producto |

En los cinco casos el patrón es idéntico: **alguien midió, decidió o cobró algo
en un momento**, y ese acto no cambia porque después cambie el parámetro.

:::tip[La prueba que los distingue]
Preguntá: *«si mañana corrijo el parámetro, ¿los registros viejos tienen que
cambiar?»*

Si la respuesta es **no**, el valor es un hecho de un momento y se guarda.
:::

---

## Las cuatro veces que se derivó

| Qué | Por qué no es un hecho de un momento |
| --- | --- |
| `productos.litros` | Es contenido × unidades, una **definición**: 12 L es lo que una paca *es* |
| Litros de un tanque | Suma del libro. El libro es el hecho; el saldo es su total |
| Deuda de un cliente | Ventas menos cobros. Los documentos son los hechos |
| Botellones de un cliente | Igual, y además la [ley de conservación](/dominio/botellones-y-bases/) se apoya en que no haya una segunda copia |

Cuándo un saldo se materializa igual —y por qué el criterio es otro— está en
[ADR-0008](/decisiones/0008-saldo-derivado-o-materializado/).

---

## La única excepción: el dígito de verificación

M5 rompió la regla, y vale la pena entender por qué.

El DV de un NIT **parece** un hecho de un momento —está impreso en el documento
del cliente— pero no lo es: es aritmética sobre un número que ya está guardado,
definida por la Orden Administrativa 4 de 1989. **Mismo número, mismo dígito,
siempre.**

La prueba lo confirma: si mañana se corrigiera algo, ¿los registros viejos
tendrían que cambiar? No hay nada que corregir — la norma no tiene versiones por
fila.

Y el dominio lo cerró antes: `RN-CLI-09` dice que **no hace falta pedirlo**. Si
no se pide, tampoco hay un valor dictado por el cliente que preservar.

:::caution[Guardarlo habría sido peor]
Dos copias del mismo dígito pueden decir cosas distintas. Una calculada no.
:::

---

## Dónde se rompe en silencio

Los dos casos donde equivocarse **no falla**, solo miente:

- **Un DV mal calculado** devuelve un dígito. Se imprime en una factura y
  aparece cuando la DIAN rechaza algo.
- **Un precio mal congelado** cobra bien hoy y explica mal dentro de seis meses,
  cuando alguien pregunte por qué esa venta costó eso.

Por eso los dos son **compuertas** en sus milestones: van primero, son funciones
puras sin base de datos, y se prueban
[borrando el mecanismo](/convenciones/como-verificar/) antes de que algo dependa
de ellos.

---
title: Contador
description: Qué necesita ver quien lleva la contabilidad, y qué NO es este módulo.
sidebar:
  order: 8
---

El `contador` no opera el negocio: lo lee. Este módulo existe para que pueda
sacar por su cuenta lo que hoy tiene que pedir por WhatsApp.

:::danger[Aquazaku NO es un software contable, y no debería intentar serlo]
Un software contable lleva **partida doble**: plan de cuentas, asientos, libro
mayor, balance de prueba, estados financieros. En Colombia eso además está
regulado.

Construirlo acá significaría duplicar mal lo que el contador ya tiene y ya sabe
usar, para un módulo que **no bloquea la operación**.

Y hay una razón más concreta: **el sistema no tiene la materia prima fiscal**.
[RN-CAT-09](/dominio/productos/) dice que hoy no se retiene IVA ni se declara
nada, y [RN-VEN-11](/dominio/ventas/) difiere la factura electrónica a post-MVP
con Factus. Sin impuestos ni numeración autorizada, no hay reporte fiscal
posible — solo uno que parezca serlo.
:::

## Lo que sí es: el mejor alimentador posible

Aquazaku es la **fuente de verdad de lo que pasó en la operación**. Cada venta,
cada costo, cada cobro, con su fecha, su monto y quién lo registró.

La meta no es parecerse al software del contador. Es que **nunca más tenga que
pedir un dato**.

---

## RN-CON-01 — El contador lee y no escribe

**Estado:** ✅ Confirmada — está en la matriz desde M0.

`reportes:operativos`, `reportes:financieros` y `reportes:descargar_pdf` existen
desde el diseño de M0, junto con `ver` sobre casi todos los recursos. Este
módulo no agrega permisos: **construye los endpoints que la matriz ya preveía**.

Que sea de solo lectura no es una limitación del rol: es lo que hace que se le
pueda dar acceso sin riesgo de que una consulta cambie algo.

---

## RN-CON-02 — Un reporte de agosto da lo mismo corrido en diciembre

**Estado:** ✅ Confirmada — es una propiedad que el sistema ya tiene.

No hace falta «cerrar el período» ni congelar nada: **ya está congelado**.

- Una venta confirmada no se edita ([RN-VEN-02](/dominio/ventas/)); solo se
  anula, y la anulación queda como un hecho aparte con su motivo.
- El precio se guarda **aplicado**, no referenciado: cambiar la lista hoy no
  reescribe una venta de agosto.
- El costo de compra se congela igual ([RN-PRO-04](/dominio/proveedores/)).
- Los libros de movimientos son append-only por triggers **y** por permisos
  ([ADR-0004](/decisiones/0004-audit-log-inmutable/)).

Esa es la propiedad que hace que un reporte contable valga algo. Un sistema
donde el pasado se puede editar produce reportes que hay que volver a sacar
«por las dudas».

---

## RN-CON-03 — El reporte cuadra, o dice que no cuadra

**Estado:** ✅ Confirmada (28-ago-2026).

Todo total viene con su descomposición, y la suma se verifica:

```
ventas del período = efectivo + transferencia + crédito
```

Si no cierra, el reporte **lo dice en la cara** en vez de mostrar un número que
parece bien.

Es el mismo criterio que la ley de conservación de botellones
([RN-ENV-02](/dominio/botellones-y-bases/)): un descuadre que nadie ve es peor
que uno ruidoso, porque se descubre meses después y ya no se puede reconstruir.

---

## RN-CON-04 — El extracto trae los cinco movimientos de plata

**Estado:** ✅ Confirmada (28-ago-2026).

| Movimiento | Qué es | Signo |
| --- | --- | :-: |
| **Venta** de producto | Lo que se vendió | + |
| **Recargo por daño** | Base rota, `tipo = dano_base` | + |
| **Cobro** | Pago contra deuda | + |
| **Devolución** | Producto que volvió, con su crédito | − |
| **Compra** | Lo que se le pagó a un proveedor | − |

Van **juntos en una sola vista**, no en cinco pantallas. Quien concilia un mes
necesita ver el movimiento completo; cinco listas separadas lo obligan a
reconstruirlo a mano, que es exactamente lo que hace hoy.

:::note[La venta y el cobro son DOS movimientos, no uno]
Una venta a crédito registra el ingreso el día que se vendió. El cobro es otro
hecho, otro día, y puede ser parcial.

Sumarlos como si fueran lo mismo daría el doble. Y separarlos es lo que permite
la única pregunta que importa de la cartera: **cuánto se vendió** contra
**cuánto se cobró**.
:::

---

## RN-CON-05 — Cartera por edad

**Estado:** 🟡 Supuesto — los tramos esperan confirmación del contador.

Quién debe, cuánto, y **hace cuánto**. La deuda ya se deriva
([ADR-0008](/decisiones/0008-saldo-derivado-o-materializado/)) y cada venta a
crédito tiene su fecha, así que la antigüedad sale de los datos que ya están.

Tramos propuestos: **0–30, 31–60, 61–90, más de 90 días**.

:::caution[Por qué esto es un supuesto y no una regla]
Son los tramos habituales, pero «habitual» no es «el que este negocio usa».
Confirmar con el contador antes de que alguien tome una decisión de cobranza
mirando una columna que no significa lo que cree.
:::

---

## RN-CON-06 — De cualquier fila se llega al documento

**Estado:** ✅ Confirmada (28-ago-2026).

Cada línea del extracto lleva el ID de su documento y **quién lo registró**.

No es adorno: cuando un número no cuadra, la pregunta siguiente es siempre
«¿de dónde salió esto?». Sin esa columna, la respuesta es abrir la base de datos
— y el contador no tiene ni debería tener acceso a eso.

---

## RN-CON-07 — CSV con columnas estables

**Estado:** 🟡 Supuesto — el formato espera confirmación del contador.

Un PDF se lee; un CSV **se usa**. Si el contador va a digitar en su software,
un PDF bonito lo obliga a copiar a mano, que es el trabajo que este módulo
viene a eliminar.

Las columnas se fijan y **no cambian de orden entre versiones**: alguien va a
construir una plantilla encima, y una columna que se mueve rompe su trabajo sin
avisar.

El PDF llega después, para revisar e imprimir — pero el CSV primero.

---

## Preguntas abiertas

Estas no las puede contestar el sistema ni quien lo construye. Van al contador:

| # | Pregunta | Bloquea |
| :-: | --- | --- |
| 40 | ¿Qué software contable usa? | El formato de salida |
| 41 | ¿CSV para importar, o PDF para revisar? | [RN-CON-07](#rn-con-07--csv-con-columnas-estables) |
| 42 | ¿Qué columnas necesita por movimiento? | El diseño del extracto |
| 43 | ¿Con qué periodicidad — mensual, quincenal? | Los rangos por defecto |
| 44 | ¿Qué tramos de cartera usa? | [RN-CON-05](#rn-con-05--cartera-por-edad) |
| 45 | **¿Qué le pide hoy a Mao a mano?** | Todo el módulo |

:::tip[La 45 es la que más vale]
Lo que hoy pide por WhatsApp es exactamente lo que el módulo tiene que resolver.
Y es información que **ya existe** en el sistema — solo que él no puede
alcanzarla.

Las otras cinco refinan; esa define.
:::

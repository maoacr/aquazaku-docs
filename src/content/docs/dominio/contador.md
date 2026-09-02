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

## RN-CON-07 — El resumen mensual va por meses enteros

**Estado:** ✅ Confirmada

Una fila por mes, con lo vendido, cobrado, comprado, devuelto y recargado, más
el neto. Cada mes enlaza a su propio extracto.

El extracto contesta «qué pasó en agosto». Este contesta **«cómo viene el año»**,
y esa pregunta hoy se responde pidiendo doce extractos y sumando a mano.

### Entra en meses y sale en meses

El endpoint acepta `2026-08`, no `2026-08-15`. Un rango de fechas sueltas
—del 15 de enero al 20 de marzo— devolvería tres filas mensuales de las cuales
dos son **pedazos de mes con pinta de meses completos**.

Nadie compara «enero» contra «medio enero» a sabiendas. Se compara sin mirar, y
ahí nace la conclusión falsa.

### El mes vacío aparece, en cero

Un mes ausente se lee como «no lo consulté». Uno en cero dice «no pasó nada» — y
en una planta que factura todos los días, eso no es un mes tranquilo: es un mes
que nadie cargó.

Por eso el neto en cero se marca en rojo, no se muestra como `0.00`.

:::caution[El año en curso se corta en el mes actual]
Diciembre en cero, mirado en septiembre, no dice «no pasó nada»: dice «no pasó
**todavía**». Pedir el año entero llenaría el reporte de alarmas falsas, que es
la forma más rápida de que se dejen de mirar todas.
:::

### Sale del mismo cálculo que el extracto

Se pide el rango una vez y se agrupa por mes, reusando la misma función que
totaliza el extracto. SQL propio que agregara por mes sería más rápido y
peligroso: el día que cambie qué cuenta como plata, una consulta se actualiza y
la otra no.

**Dos reportes del mismo negocio que no coinciden es peor que no tener el
segundo** — obligan a desconfiar de los dos, y nadie sabe de cuál más.

---

## RN-CON-08 — El contador elige las columnas, menos una

**Estado:** ✅ Confirmada (1-sep-2026)

Las columnas del extracto se eligen desde la pantalla y viajan en la URL junto
con el rango. Lo que se ve es lo que se baja.

| Columna | Por defecto |
| --- | :-: |
| Fecha | ✅ |
| Movimiento | ✅ |
| Con quién | ✅ |
| Medio de pago | ✅ |
| Detalle | — |
| **Monto** | ✅ **fija** |
| Documento | — |

`Detalle` y `Documento` quedan afuera por defecto: sirven cuando un número no
cuadra y hay que rastrearlo, no para leer el mes. Están a un clic.

### El monto no se puede quitar

Un extracto sin montos no es un extracto más corto: es **una lista de fechas con
aspecto de reporte financiero**. La regla vive en el código que decide las
columnas, no en el botón — así el CSV tampoco puede salir sin ella.

### El CSV, con tres detalles que deciden si sirve

| Detalle | Sin él |
| --- | --- |
| BOM (`EF BB BF`) | Excel abre «Panadería» como «PanaderÃ­a» |
| Separador `;` | Las cinco columnas entran en una sola |
| Coma decimal | `80000.00` entra como texto: la columna no se puede sumar |

Los tres suponen un **Excel en español**, que es lo que corre una oficina
colombiana. Si el contador usa otra cosa, se ajusta — pregunta 46.

El signo va **pegado al monto**, no en columna aparte: separarlos deja que una
hoja de cálculo sume una columna de números todos positivos, y el total daría la
plata movida en vez de la ganada.

### El PDF lo hace el navegador

«Imprimir → Guardar como PDF» sobre los estilos de impresión de la pantalla.

Una librería de PDF en el servidor sería una dependencia pesada para redibujar a
mano una tabla que ya existe, y ese dibujo empezaría a separarse de la pantalla
desde el primer cambio. Así el PDF es, literalmente, lo que el contador está
viendo.

:::danger[Lo que rompe una impresión sin que nadie lo note]
El armazón de la aplicación usa `h-dvh` con un `<main>` que tiene scroll propio.
**Un contenedor con `overflow` imprime solo lo que se ve.**

El resto no sale cortado con una advertencia: sale **ausente**, en una hoja con
pinta de estar completa. Por eso la hoja de impresión desarma el armazón antes
que ninguna otra cosa.
:::

---

## RN-CON-09 — Lo que sale de caja NO son todos los gastos

**Estado:** 🔴 Hueco conocido — **no es una limitación del reporte, es del dato**

Aquazaku registra **compras a proveedores**. No registra gastos. Y la propia
documentación ya nombra dos que existen y no están en ninguna tabla:

| Gasto | Dónde está dicho | Dónde está registrado |
| --- | --- | --- |
| Tarifa de agua | [RN-PRD-10](/dominio/produccion/) | En ningún lado |
| Cloro y filtros | [RN-INS-04](/dominio/insumos/) | En ningún lado |
| Nómina de 8 personas | — | En ningún lado |
| Energía, combustible | — | En ningún lado |

:::danger[Por qué esto no se resuelve renombrando la columna]
Un reporte de «gastos» construido con lo que hay hoy diría que en agosto la
planta gastó lo que le pagó a los proveedores.

Eso **no es incompleto: es falso**. Y la diferencia importa porque el número va
a manos de un contador, que lo va a usar sin poder saber qué le falta.

Por eso el extracto habla de **compras**, nunca de gastos, y el resumen mensual
tampoco tiene una columna que se llame así.
:::

Cerrarlo pide una decisión de negocio, no una tabla: qué se considera gasto, qué
categorías, y si la nómina entra. Va como pregunta 47.

## Preguntas abiertas

Estas no las puede contestar el sistema ni quien lo construye. Van al contador:

| # | Pregunta | Bloquea |
| :-: | --- | --- |
| 40 | ¿Qué software contable usa? | El formato de salida |
| ~~41~~ | ~~¿CSV o PDF?~~ ✅ **Se hacen las dos** (1-sep-2026) | — |
| ~~42~~ | ~~¿Qué columnas necesita?~~ ✅ **Las elige él** — [RN-CON-08](#rn-con-08--el-contador-elige-las-columnas-menos-una) | — |
| 43 | ¿Con qué periodicidad — mensual, quincenal? | Los rangos por defecto |
| 44 | ¿Qué tramos de cartera usa? | [RN-CON-05](#rn-con-05--cartera-por-edad) |
| 45 | **¿Qué le pide hoy a Mao a mano?** | Todo el módulo |
| 46 | ¿En qué abre los archivos — Excel en español, otro? | El formato del CSV ([RN-CON-08](#rn-con-08--el-contador-elige-las-columnas-menos-una)) |
| 47 | **¿Qué cuenta como gasto, y entra la nómina?** | [RN-CON-09](#rn-con-09--lo-que-sale-de-caja-no-son-todos-los-gastos) |

:::tip[La 45 es la que más vale]
Lo que hoy pide por WhatsApp es exactamente lo que el módulo tiene que resolver.
Y es información que **ya existe** en el sistema — solo que él no puede
alcanzarla.

Las otras cinco refinan; esa define.
:::

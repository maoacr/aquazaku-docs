---
title: Pregunta 47 — Definición de gastos
description: Estado y roadmap de la pregunta 47 — qué cuenta como gasto, si la nómina entra, y cómo se cierra.
sidebar:
  order: 10
---

# Pregunta 47 — Definición de gastos y costos

**Estado:** 🔴 Abierta — bloquea cualquier reporte financiero real.

## Por qué importa

Esta pregunta ya está documentada como el hueco más importante del área financiera, en [RN-CON-09](/dominio/contador/#rn-con-09--lo-que-sale-de-caja-no-son-todos-los-gastos):

> Un reporte de «gastos» construido con lo que hay hoy diría que en agosto la planta gastó lo que le pagó a los proveedores. Eso **no es incompleto: es falso**.

El sistema hoy registra **compras a proveedores** y nada más. Lo que la planta gasta hoy —nómina, servicios públicos, mantenimiento, publicidad, impuestos— no está en ninguna tabla.

## El contexto que cambia todo: régimen simplificado

Aquazaku **NO está declarando nada hoy**. Los montos de venta son bajos y se está preparando todo para que, llegado el momento, se empiece a declarar en **régimen simplificado** del Estatuto Tributario colombiano.

Eso significa dos cosas:

1. **No hay urgencia fiscal inmediata.** No se necesita un módulo contable con plan de cuentas, partida doble ni asientos. No se retiene en la fuente, no se cobra IVA desglosado, y la factura electrónica no es obligatoria (salvo que se venda a responsables de IVA).

2. **Pero los datos SÍ se necesitan limpios desde ya.** El régimen simplificado se acaba el día que las ventas brutas anuales superan las 4.800 UVT. Cuando eso pase, el sistema tiene que poder responder "cuánto entró, cuánto salió, qué compré a quién, qué pagué en nómina" sin tener que reconstruir tres años de papelitos.

:::tip[La regla práctica]
**No declarar hoy ≠ no registrar hoy.** El sistema tiene que registrar todo como si ya estuviera en régimen común, y la contadora es quien decide qué muestra o no muestra en la declaración. Si registramos flojo, el día del salto a régimen común vamos a estar mirando tres años de WhatsApp para reconstruir la información.
:::

## Lo que ya sabemos (no hay que decidirlo)

| Decisión | Por qué ya está |
|---|---|
| Las compras a proveedores siguen funcionando como hoy | El módulo M9 ya registra la compra, su línea de detalle con costo unitario, y el movimiento de inventario, todo en la misma transacción. |
| El agua de la planta es costo, no gasto | El cierre diario ya descuenta agua por `botellonesLlenados` y `botellonesLavados`. La fórmula está en `RN-PRD-12`. |
| Las pacas no consumen insumos rastreados | Confirmado por Aquazaku 26-ago-2026, en `RN-PRD-09`. |
| La energía del cierre es proporcional al agua procesada | El cierre ya la calcula; falta medir el caudal (preguntas 4 y 5) pero la fórmula existe. |
| El extracto es SOLO de movimientos de caja | Por diseño, [RN-CON-04](/dominio/contador/#rn-con-04--el-extracto-trae-los-cinco-movimientos-de-plata). Lo que NO sale de caja tampoco aparece. |
| El sistema NO lleva contabilidad formal | Es deliberado. [El módulo de Contador](/dominio/contador/) es la **fuente de verdad operativa** que alimenta al software contable de la contadora, no un reemplazo de ese software. |

## Lo que falta decidir

Son **10 decisiones agrupadas en 5 bloques**. Las críticas tienen que contestarse en la reunión; las demás se pueden ir resolviendo por chat.

El detalle de cada pregunta está en [el borrador para la reunión con la contadora](/empezar/pregunta-47-reunion-contadora/).

### Bloque 1 — Qué ES y qué NO ES cada cosa

1. ¿La nómina es gasto o costo, y cómo se separa por centro de costo?
2. ¿Los botellones son activo fijo, inventario que rota, o gasto del mes?
3. ¿Y las bases — mismo tratamiento que los botellones?

### Bloque 2 — Cómo se VALÚA lo que hay en bodega

4. ¿PEPS, promedio ponderado, o última compra?
5. ¿A partir de qué monto un bien se ACTIVA en vez de gastarse?

### Bloque 3 — Servicios y contratistas

6. ¿Los servicios profesionales van con RUT y retención?
7. ¿Cómo se imputan los recibos públicos cuando vienen unificados (planta + oficina)?

### Bloque 4 — Impuestos y soporte

8. ¿Los impuestos se registran como gasto o como línea separada?
9. ¿La factura electrónica bloquea el marcado como deducible?

### Bloque 5 — Operación del módulo

10. ¿Qué rol carga cada tipo de egreso?

## El plan si se cierran las 10

1. **Módulo `egresos`** en `api/` — tabla única con tipo enum: `costo | gasto_personal | gasto_operacional | gasto_comercial | activo_fijo | impuesto`. Con campo nullable para URL de factura (obligatorio para marcar deducible).

2. **Módulo `nomina`** — empleados, contratos, distribución por centro de costo, devengados, deducciones, seguridad social.

3. **Extender `insumos`** — materializar `costoUnitarioVigente` (política PEPS) en cada `movimiento_insumo` para que el reporte no tenga que JOINear.

4. **Extender `cierres_produccion`** — guardar el costo de los insumos consumidos en el cierre, o tener una vista materializada que lo calcule.

5. **Extender `bases` y `movimientos_botellon`** — agregar `costoAdquisicion` y `fechaCompra` para soportar depreciación o imputación.

6. **Pantalla `/modulos/egresos`** en `web/` — registro y consulta. No pretende reemplazar el software contable; es la fuente de datos que lo alimenta.

7. **Extender `/reportes/extracto`** — agregar los seis tipos de egreso para que la contadora pueda bajar el movimiento completo de un mes.

## Lo que se puede hacer YA sin esperar la reunión

Aunque la pregunta 47 esté abierta, hay trabajo que no depende de las decisiones políticas:

- Revisar si los campos nullable de `costoUnitario` y `fechaCompra` en `bases` y `movimientos_botellon` se pueden agregar sin romper nada.
- Validar que la columna de factura pueda ser nullable en el módulo `egresos` (es lo correcto: en simplificado no es obligatoria, pero en común sí lo va a ser).
- Documentar el mapeo entre el sistema actual y la declaración de renta de simplificado, para saber qué le falta al sistema cuando llegue el momento de saltar.

Esas son las tareas que avanzan en paralelo, sin tocar las decisiones de la contadora.

## Referencias cruzadas

- [RN-CON-09 — Lo que sale de caja NO son todos los gastos](/dominio/contador/#rn-con-09--lo-que-sale-de-caja-no-son-todos-los-gastos) — la regla que describe el hueco
- [Pendientes — pregunta 47](/empezar/pendientes/#47-qué-cuenta-como-gasto-y-entra-la-nómina) — el listado maestro
- [Borrador para la reunión con la contadora](/empezar/pregunta-47-reunion-contadora/) — el documento a llevar
- [Documentación de Contador](/dominio/contador/) — el módulo M11 que va a consumir todo esto

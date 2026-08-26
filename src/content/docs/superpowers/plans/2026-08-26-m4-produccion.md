---
title: Plan de M4 — Producción y cierre del día
description: "Las 7 tasks de M4, con la atomicidad como compuerta: el cierre escribe en cuatro tablas y o quedan las cuatro o no queda ninguna."
---

**Objetivo:** implementar M4 según la
[spec de diseño](/superpowers/specs/2026-08-26-m4-produccion-design/) — el cierre
diario como documento único que mueve agua, insumos y stock en una sola
transacción.

**Dominio:** [Producción](/dominio/produccion/) — 21 reglas confirmadas de 24.

**Estado:** 📝 Planificado — por implementar.

---

## La compuerta de M4 no es la concurrencia: es la ATOMICIDAD

M2 y M3 tuvieron el mismo riesgo de fondo —dos personas moviendo el mismo
saldo— y lo resolvieron con el `UPDATE` condicional. **M4 tiene otro.**

El cierre escribe en **cuatro tablas**: el documento, el libro del agua, el libro
de insumos y el lote con su movimiento de stock. Una sola operación de negocio
repartida en cuatro escritos.

Si falla el tercero, lo que queda es peor que nada: **un cierre que dice que se
envasaron 200 botellones, con el agua descontada y las tapas intactas.** La
planta cree que tiene insumos que ya gastó, y lo descubre el día que no puede
envasar.

**Un cierre parcial no es un cierre a medias — es una mentira consistente**, que
es la clase de dato que nadie sospecha hasta que ya causó daño.

Por eso **T2 llega antes que todo lo demás**, y se verifica al revés: forzando el
fallo del último escrito y confirmando que no quedó ninguno.

## El orden es por costo de revertir

| Riesgo | Qué pasa si se descubre tarde | Task |
| --- | --- | :-: |
| 🔴 **Transacción parcial** | Un cierre que miente de forma consistente. Se descubre contando tapas | **T2** |
| 🔴 **`caudal_gpm` referenciado y no copiado** | Corregir el caudal recalcula un mes de historia | T1 |
| 🔴 **Un campo «litros ingresados»** | Fabrica precisión que no existe. Sacarlo después obliga a decidir qué hacer con los valores ya cargados | T1 |
| 🟠 **Dos tanques procesados en el enum** | Cada escritura duplicada para que las dos filas digan lo mismo | T1 |
| 🟠 **Saldo negativo de insumos permitido** | Devuelve por la puerta de atrás lo que M2 y M3 impidieron | T2 |
| 🟢 Reconciliación visual | Aditiva, se puede afinar después | T4 |

:::danger[Una task no termina porque sus tests pasen]
En M3 esa regla encontró una pantalla rota con **460 tests en verde**: la
migración se había aplicado solo a la base de test.

Acá lo que está en juego es que el sistema mienta sobre el agua, las tapas y el
producto **a la vez**, y con un documento que parece perfectamente normal.
:::

## M4 tiene que abrir el servicio de M2 — y eso es una task

`descontar()` e `ingresar()` de stock e insumos **ya aceptan un ejecutor
externo** (`Ejecutor = DB | Transaccion`). Ese parámetro se agregó pensando en
este momento y no hay que tocarlo.

**Pero `registrarEntrada()` de stock NO lo acepta.** Usa `db` directo, abre su
propia transacción, y adentro hace tres cosas que M4 necesita enteras:

1. Calcula el código de lote consultando los del día (`codigoDeLote`).
2. Deriva la fecha de vencimiento (`vencimientoDe`, 30 días — `RN-STK-08`).
3. Crea el lote en cero y lo sube con un movimiento, para que el libro explique
   el saldo desde la primera unidad.

M4 **no puede reimplementar eso**: sería una segunda fuente de códigos de lote y
de vencimientos, y el día que la regla de 30 días cambie habría que acordarse de
los dos lugares.

**T3 abre `registrarEntrada` para que acepte un ejecutor**, igual que ya lo hacen
sus vecinas. Es un cambio chico y de un solo tipo, pero toca código de M2 en
producción, así que va en su propia task con sus tests.

## Grafo de dependencias

```
T1 schema ── T2 la transacción ──┬── T3 abrir registrarEntrada ── T5 endpoints ── T6 pantalla
                                 │
                                 └── T4 balance y reconciliación ─┘
                                                                   
                                                          T7 bruno + docs
```

- **T2** es la compuerta: nada se construye encima hasta que la atomicidad esté
  probada, aunque en esa etapa el lote se cree con SQL directo.
- **T3** reemplaza ese SQL directo por la función de M2, ya abierta.
- **T7** cierra.

## Restricciones globales

- Convención del proyecto: 2 espacios, comillas simples, sin punto y coma.
- Conventional commits, sin `Co-Authored-By`. **Nunca buildear.**
- Cada commit deja el proyecto en verde: tests + typecheck, **verificado por
  código de salida**.
- Migraciones en SQL explícito, escritas a mano.
- **`REVOKE` explícito en toda tabla nueva** ([ADR-0006](/decisiones/)).
- **Aplicar la migración a las DOS bases**: `db:migrate` y `db:migrate:test`. En
  M3 la pantalla quedó rota con la suite en verde por saltarse la primera.
- `/bin/rm` para artefactos de drizzle-kit: `rm` está aliaseado a `trash`.

---

## Task 1 — Schema, migración e invariantes

**Archivos**
- Modificar: `api/src/db/schema.ts`, `api/src/test/db.ts`
- Crear: `api/src/db/migrations/0005_produccion.sql`
- Crear: `api/src/db/__tests__/produccion-schema.test.ts`

**Qué se construye**

`cierres_produccion` con `UNIQUE(fecha)` —un cierre por día, `RN-PRD-22`— y
`movimientos_agua` como libro append-only.

**Los `CHECK`**

```sql
CHECK (pacas_600 >= 0 AND pacas_300 >= 0)
CHECK (botellones_llenados >= 0 AND botellones_lavados >= 0)
CHECK (minutos_procesando > 0)
CHECK (litros >= 0)                        -- en movimientos_agua: nunca negativo
CHECK (litros <> 0)
CHECK (tipo <> 'ajuste' OR motivo IS NOT NULL)
```

**Lo que este esquema NO tiene, y es lo importante**

- **No hay `litros_ingresados`.** El ingreso de la red no se mide (`RN-PRD-11`).
  Se registra el hecho con `tipo = 'ingreso_red'` y el saldo sube hasta la banda
  observada.
- **No hay `procesado_a` / `procesado_b`.** Los tanques se operan en paralelo
  (`RN-PRD-21`).
- **No hay `PATCH` posible**: `REVOKE UPDATE, DELETE` sobre las dos tablas.

**Verificación**
- Cada `CHECK` probado con el `INSERT` inválido.
- El segundo cierre de la misma fecha rechazado por el `UNIQUE`.
- **Un test que verifique que la columna `litros_ingresados` NO existe.** Suena
  raro y es el más valioso: es la única forma de que alguien no la agregue «para
  completar el formulario».

---

## Task 2 — La transacción, y la prueba de que es atómica

**Archivos**
- Crear: `api/src/modules/produccion/cierre.ts`
- Crear: `api/src/modules/produccion/__tests__/atomicidad.test.ts`

**El mecanismo**

```ts
await db.transaction(async (tx) => {
  const cierre = await insertarCierre(tx, datos)
  await descontarAgua(tx, cierre)          // envasado + lavado
  await descontarInsumos(tx, cierre)       // tapa + sello por botellón
  await ingresarProducto(tx, cierre)       // lote + movimiento
})
```

Los cuatro reciben `tx`. **Ninguno abre su propia transacción** — `enTransaccion`
de `saldo.ts` ya lo resuelve: abre solo si el ejecutor no es una.

**Los insumos que no alcanzan cortan el cierre**

`descontar()` devuelve `{ ok: false, disponible }`. Acá eso **lanza**, para que
la transacción revierta. Es el único lugar del sistema donde ese `false` se
convierte en excepción, y con razón: en M3 «no alcanza» era una respuesta porque
la operación era una sola; acá hay tres escritos más que deshacer.

**Verificación — la que hace que esta task exista**
1. Forzar el fallo del **cuarto** escrito y verificar que **no quedó ninguno**:
   ni cierre, ni movimiento de agua, ni de insumo.
2. Ídem forzando el fallo del segundo y del tercero.
3. Con insumos insuficientes: se rechaza, con el faltante en el mensaje, y **el
   agua no se descontó**.
4. **Quitar la transacción** —dejar los cuatro escritos sueltos— y confirmar que
   los tests de arriba fallan. Una prueba de atomicidad que pasa sin transacción
   no está midiendo nada.

---

## Task 3 — Abrir `registrarEntrada` de M2

**Archivos**
- Modificar: `api/src/modules/stock/service.ts`
- Modificar: `api/src/modules/produccion/cierre.ts`

**Qué se cambia**

`registrarEntrada(entrada, contexto)` pasa a
`registrarEntrada(entrada, contexto, ejecutor = db)`, y usa `enTransaccion` como
ya hacen `descontar` e `ingresar`. La consulta de códigos del día también tiene
que ir por el ejecutor: leer fuera de la transacción vería un estado viejo.

**Por qué es una task y no un renglón de T2**

Toca código de M2 que está en producción y lo usan otras dos rutas. El riesgo no
es el cambio —es de un solo tipo— sino **que nadie note que ahora se puede
llamar desde adentro de una transacción ajena** y alguien vuelva a abrir una
propia.

**Verificación**
- Los tests de M2 siguen en verde **sin tocarlos**. Si hay que tocarlos, el
  cambio no fue compatible.
- Un test nuevo: llamarla dentro de una transacción que después revierte, y
  verificar que **el lote no quedó**.

---

## Task 4 — El balance del agua y la reconciliación

**Archivos**
- Crear: `api/src/modules/produccion/agua.ts`
- Crear: `api/src/modules/produccion/__tests__/agua.test.ts`

**Los dos saldos**

Procesado (4.000 L) con balance cerrado; crudo (13.000 L) con un término sin
medir. El consumo sale de las cuatro cifras del cierre — `RN-PRD-06`.

**La reconciliación — `RN-PRD-14`**

El operario reporta el nivel en cuartos. El sistema compara contra su saldo:
dentro de la banda **cuadra**; fuera, marca la discrepancia y ofrece un ajuste
con motivo.

:::caution[Nunca sobrescribir el saldo con la lectura]
«Medio tanque» es un rango de 500 litros. Reemplazar un número calculado por el
centro de ese rango **pierde información y encima parece más preciso** —
exactamente lo que `RN-PRD-15` prohíbe.
:::

**Verificación**
- Las cinco bandas, en sus dos fronteras cada una.
- Un saldo justo en el límite entre dos cuartos: no puede marcar discrepancia.
- El ajuste exige motivo, y lo exige el `CHECK` además del servicio.

---

## Task 5 — Endpoints

**Archivos**
- Crear: `api/src/modules/produccion/routes.ts`, `validation.ts`
- Crear: `api/src/modules/produccion/__tests__/routes.test.ts`

Las rutas de la spec §10. **Los permisos ya están declarados** en la matriz —
`produccion:ver`, `produccion:registrar_cierre`, `tanques:ver`,
`tanques:registrar_reposicion` y `tanques:ajustar`.

:::note[Leer la matriz ANTES de escribir las rutas]
La primera versión de la spec propuso `produccion:registrar`, que no existe, y
afirmó que no había permisos declarados. Los había, y más finos: `tanques` es un
recurso propio, y **el `pos` puede registrar que llegó agua pero no ajustar un
saldo que no cuadra** — quien opera no debería poder tapar su propia
discrepancia.
:::

**Verificación**
- El `seller` recibe 403 en todas, y queda auditado.
- El `pos` puede reponer pero **no ajustar**: es la separación que da sentido a
  tener dos permisos.
- No existen `PATCH` ni `DELETE` sobre un cierre.

---

## Task 6 — Pantalla en `web/`

**Archivos**
- Crear: `web/src/app/(app)/modulos/produccion/` y `web/src/components/produccion/`
- Modificar: `web/src/lib/modules.ts`

**El formulario del cierre es una sola pantalla**, y muestra **lo que va a pasar
antes de confirmar**: cuántos litros se van a descontar, cuántas tapas y sellos,
y qué lote se va a generar.

Es la misma decisión que la vista previa de la conversión en M3. Un cierre mueve
tres saldos de una vez y **no se puede deshacer** (`RN-PRD-08`): confirmarlo a
ciegas es lo que hace que un error se descubra tres días después.

Se reusa todo: `<Estado>`, `<Vacio>`, `.aq-campo`, `.aq-boton*`, `<SelloDeHora>`.

---

## Task 7 — Bruno, documentación y cierre

- Colección `7-Produccion` con los casos que definen el módulo, no el CRUD.
- El roadmap pasa M4 a ✅.
- Las [preguntas 4, 5 y 6](/empezar/pendientes/) quedan marcadas con lo que
  bloquean: sin caudal no se calcula el procesamiento, sin litros de lavado un
  término del balance queda en cero.

---

## Definition of Done de M4

1. Un `pos` registra el cierre y los **cuatro** escritos quedan, o **ninguno**.
2. Forzar el fallo de cualquiera de los cuatro no deja rastro de los otros.
3. Con insumos insuficientes se rechaza **con el faltante**, y el agua no se tocó.
4. Un segundo cierre de la misma fecha se rechaza.
5. Corregir el caudal no altera ningún cierre pasado.
6. El sistema **nunca** pide «litros ingresados».
7. Una lectura que cuadra no genera ajuste; una que no, sí.
8. Los tests de M2 siguen en verde sin haberlos tocado.

## Notas de ejecución

- A partir de M4, mover stock o insumos **a mano vuelve a ser una excepción**. El
  ajuste con motivo sigue existiendo porque la realidad física siempre difiere,
  pero ya no es el camino normal.
- La autonomía en días (`RN-PRD-13`) y «hacen falta más tanques» (`RN-PRD-17`)
  son de M12: necesitan la historia que M4 recién empieza a generar.

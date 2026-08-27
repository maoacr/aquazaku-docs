---
title: Spec de M5 — Clientes
description: Un documento que no se pide dos veces, un dígito que no se guarda, y el único invariante de este milestone que la base tiene que sostener sola — crédito exige verificación.
---

**Dominio:** [Clientes](/dominio/clientes/) — 16 reglas, 13 confirmadas.

**Estado:** ✅ **Implementado** (26-ago-2026) — ver el [plan](/superpowers/plans/2026-08-26-m5-clientes/).

---

## Qué puede entregar M5 hoy, y qué no

La ficha del cliente lleva **cuatro saldos** (`RN-CLI-06`), y los cuatro dependen
de módulos que todavía no existen:

| Saldo | De dónde sale | Milestone |
| --- | --- | :-: |
| Deuda | ventas a crédito − cobros | M6 |
| Botellones en su poder | entregas y devoluciones | M7 |
| Bases prestadas | préstamos por dirección | M7 |
| Cargos pendientes | daño a una base | M7 |

Eso **no bloquea M5**, pero sí define su alcance honesto: M5 entrega la
**identidad** del cliente —quién es, si su documento está comprobado, qué lista
de precios le corresponde, dónde está y si tiene crédito— y deja los saldos
diciendo que todavía no hay de dónde calcularlos.

:::caution[La ficha no va a mostrar cuatro ceros]
Un cero dice «este cliente no debe nada». La verdad es «todavía no existe el
módulo que registra deudas». Son cosas distintas, y es el mismo criterio que
hizo que el caudal sin medir vaya en `null` y no en cero (`RN-PRD-18`).
:::

---

## Las tres decisiones que definen el milestone

### 1 · El dígito de verificación NO se guarda

Es la excepción a la regla que este proyecto viene aplicando desde M2.

En M2 la fecha de vencimiento se **guarda** en vez de calcularse desde el
empaque; en M3 la equivalencia kilo→unidad se **guarda** en el movimiento; en M4
el caudal se **guarda** en el cierre. Tres veces la misma regla: *un hecho de un
momento se almacena, nunca se regenera*.

El DV no es un hecho de un momento. **No tiene momento.** Es aritmética sobre un
número que ya está guardado, definida por la Orden Administrativa 4 de 1989 —
mismo número, mismo dígito, siempre. Guardarlo sería duplicar un dato derivable y
abrir la puerta a que las dos copias digan cosas distintas.

Y el dominio ya lo resolvió: `RN-CLI-09` dice que **no hace falta pedirlo**. Si
no se pide, tampoco hay un valor dictado que preservar.

:::danger[La trampa de los diez dígitos]
La norma tabula **nueve** pesos. Las cédulas colombianas actuales tienen **diez**,
y el NIT de una persona natural se basa en su cédula.

Con nueve pesos el primer dígito queda sin multiplicar. Verificado: para
`1010101010` la suma truncada da **84** contra **127** de la completa — DV
distinto, y ninguna de las dos formas falla ruidosamente.

La implementación toma primos consecutivos **de derecha a izquierda**, tantos
como dígitos tenga el número:

```
3, 7, 13, 17, 19, 23, 29, 37, 41, 43, 47, 53, 59, 67, 71
```

Leída al revés para nueve dígitos da exactamente la tabla de la norma. Los tres
vectores del dominio —`123456789`→6, `900123456`→8, `79123456`→0— se verificaron
contra esta implementación antes de escribir código.
:::

### 2 · Crédito exige verificación, y lo sostiene la base

`RN-CLI-15` es el único invariante de M5 que puede romperse en silencio, y el
dominio ya pide **guard de backend obligatoria, no solo en UI**.

```
credito_habilitado = true  ⟹  verificacion_estado = 'verificado'
```

Es una condición entre dos columnas de la **misma fila**, así que se expresa como
`CHECK` y vive en la base ([ADR-0006](/decisiones/)). El servicio explica el
error; la base lo hace imposible.

Que esté en la base y no solo en el servicio importa por el orden de las
operaciones: habilitar crédito y después *des*verificar al cliente dejaría la
misma fila inconsistente por el otro lado. Un `CHECK` cubre los dos caminos sin
que nadie tenga que acordarse del segundo.

:::tip[Por qué este invariante y no otros]
«El que más necesita crédito es el que más urgente tiene saltarse la
verificación» — lo dice el dominio. Es exactamente la forma de un invariante que
hay que hacer imposible en vez de pedir por favor.
:::

### 3 · La dirección es una entidad desde el primer día

`RN-CLI-07`: `Cliente 1—N Dirección`. Hoy Aquazaku atiende sin rutas armadas, así
que la tentación es un campo de texto y listo.

No, y el dominio ya hizo la cuenta: modelar por dirección hoy cuesta *una tabla
más*; migrar después cuesta *partir clientes que ya tienen deuda y botellones*.

**Pero `ruta_id` no entra todavía.** Las rutas son M8. Agregar hoy una columna
que apunta a una tabla que no existe es la clase de andamio que el proyecto
evita: la columna se suma en M8, cuando haya a qué apuntar, y no cuesta más
entonces que ahora — porque `direcciones` ya va a existir.

---

## El modelo

```
clientes
  id                      uuid PK
  nombre                  text NOT NULL
  tipo                    'residencial' | 'comercial'   -- RN-CLI-16
  tipo_documento          'CC' | 'NIT'                  -- RN-CLI-09
  numero_documento        text NOT NULL                 -- sin DV, sin puntos
  verificacion_estado     'pendiente' | 'verificado'    -- RN-CLI-10
  verificado_por          uuid → users NULL
  verificado_en           timestamptz NULL
  verificacion_metodo     'seller_manual' | 'pos_manual' | 'admin_oficial' NULL
  credito_habilitado      boolean NOT NULL DEFAULT false
  credito_limite          numeric NULL                  -- null = sin tope
  activo                  boolean NOT NULL DEFAULT true -- RN-CLI-02
  ...

  UNIQUE (tipo_documento, numero_documento)             -- RN-CLI-08
  CHECK  (NOT credito_habilitado OR verificacion_estado = 'verificado')
  CHECK  (los cuatro campos de verificación van juntos o los cuatro nulos)

direcciones
  id          uuid PK
  cliente_id  uuid → clientes NOT NULL                  -- RN-CLI-07
  ...
```

### Por qué la unicidad va sobre el PAR y no sobre el número

`RN-CLI-08` dice que un número pertenece a una sola persona. Pero el NIT de una
persona natural **se basa en su cédula**: `CC 79123456` y `NIT 79123456` son la
misma persona escrita de dos formas.

Con unicidad sobre el número solo, registrar el NIT de alguien que ya está como
CC sería imposible — y el caso es legítimo.

Con unicidad sobre el par, el duplicado real —dos filas con el mismo tipo y
número— sigue siendo imposible, y el cruce entre tipos se atiende como lo pide el
dominio: **el sistema advierte y pide confirmar** si es la misma persona. Es un
aviso del servicio, no un rechazo de la base: la base no puede saber si son la
misma persona, y adivinarlo sería peor que preguntar.

---

## Lo que M5 NO construye

- **Fusión de duplicados.** El dominio la evaluó y la descartó
  (`RN-CLI-11`): resuelve un caso que casi no va a ocurrir con el volumen
  actual. Se reevalúa cuando aparezca.
- **`ruta_id`.** M8.
- **Los cuatro saldos.** M6 y M7.
- **Sincronización offline.** El comportamiento ante rechazo del sync
  (`RN-CLI-11`) es del ADR de sincronización y del módulo del `seller` (M8). Lo
  que M5 sí deja listo es la restricción que hace que ese rechazo ocurra.

---

## Definition of Done

1. El DV se calcula, nunca se pide ni se guarda, y coincide con los tres
   vectores del dominio.
2. Una cédula de **diez** dígitos da el mismo DV que daría con la tabla
   completa de primos — no el de nueve pesos.
3. Registrar un cliente sin documento se rechaza (`RN-CLI-13`).
4. Dos clientes con el mismo tipo y número no pueden coexistir.
5. Registrar un NIT cuyo número base ya existe como CC **advierte** sin
   bloquear.
6. Habilitar crédito a un cliente `pendiente` se rechaza, **y también** falla si
   se intenta desverificar a un cliente con crédito activo.
7. Un cliente no se borra: se desactiva y deja de aparecer en operaciones nuevas.
8. `contador` ve clientes y no puede crear ni verificar.
9. Los cuatro saldos dicen que todavía no hay de dónde calcularlos, y **no**
   muestran cero.

---
title: Spec de M4 — Producción y cierre del día
description: El cierre diario como documento único que mueve agua, insumos y stock a la vez, y por qué el saldo de agua cruda es el único que el sistema no puede medir.
---

**Fecha:** 2026-08-26
**Estado:** 📝 Diseñado — por implementar
**Módulo:** M4 del [Roadmap Aquazaku](/arquitectura/roadmap/)
**Autores:** Mao (product owner) + AI (asistente de diseño)

---

## 1. Contexto

M4 es **la bisagra del sistema**. Es el único evento que convierte litros en
producto, y por eso toca tres módulos a la vez: descuenta agua, descuenta
insumos (M3) e ingresa stock (M2).

Hasta hoy el stock y los insumos se mueven **a mano, con motivo**. M4 es lo que
hace que se muevan solos, y a partir de acá un ajuste manual vuelve a ser lo que
debería haber sido siempre: una excepción.

**El dominio está en [Producción](/dominio/produccion/)** — 21 reglas
confirmadas de 24 declaradas.

## 2. La decisión que define el módulo

`RN-PRD-19`: **procesar y envasar son dos mediciones del MISMO documento.**

Esta regla estuvo escrita al revés hasta el 26-ago-2026 —decía que eran eventos
que no necesariamente coinciden— y de ella colgaba la forma de todas las tablas.

| Si fueran dos eventos | Como son de verdad |
| --- | --- |
| Dos flujos de documentos, cada uno con fecha y responsable | **Un** cierre diario con las dos mediciones |
| Un saldo de agua procesada que cruza días | El saldo de tanques se resuelve **dentro** del día |
| Dos pantallas, dos rutas, dos permisos | Una |

**Modelar dos eventos «por si acaso» habría sido maquinaria que nadie usa.** Y
no era diferible como la equivalencia de las bolsas en M3: ahí se podía dejar un
`NULL` y seguir; acá no hay forma de construir la tabla sin decidir.

:::note[Que sobre agua en los tanques no rompe el modelo]
El cierre registra con cuánto se termina, y el día siguiente arranca de ahí. Lo
que no hace falta es un evento aparte para el agua que se procesó y no se envasó.
:::

## 3. Objetivos

1. Un cierre de producción diario que registre procesamiento y envasado.
2. Que ese cierre mueva los **tres** saldos en una sola transacción.
3. El balance de agua con sus cuatro términos, y el hueco declarado como hueco.
4. La reconciliación contra la lectura visual del tanque, sin fingir precisión.

## 4. Fuera de alcance

| No entra | Por qué | Dónde |
| --- | --- | --- |
| **La autonomía en días** | `RN-PRD-13` sigue supuesta y necesita consumo real medido | M12 |
| **«Hacen falta más tanques»** | `RN-PRD-17`, ídem: se calcula con historia | M12 |
| **Mantenimiento de filtros por horas** | Necesita el histórico de corridas que M4 recién empieza a generar | M12 |
| **Costeo del agua** | `RN-PRD-10`: es costo fijo. No hay nada que prorratear | — |

## 5. Modelo de datos

### `cierres_produccion`

Un documento por día. **Append-only** — `RN-PRD-08`.

```ts
id                    uuid        pk
fecha                 date        único: un cierre por día — RN-PRD-22
                                  ⚠️ UNIQUE(fecha)

/* ── El procesamiento — RN-PRD-18 ── */
minutos_procesando    integer     del encendido al apagado, que registra el pos
caudal_gpm            numeric     el caudal usado ese día. Se COPIA, no se referencia
litros_procesados     integer     caudal × minutos × 3,785 × 0,70 — RN-PRD-12

/* ── El envasado — RN-PRD-04 ── */
pacas_600             integer     ⚠️ CHECK: >= 0
pacas_300             integer     ⚠️ CHECK: >= 0
botellones_llenados   integer     ⚠️ CHECK: >= 0
botellones_lavados    integer     consume agua sin generar producto — RN-PRD-05

/* ── El cierre del balance ── */
litros_consumidos     integer     derivado de las cuatro cifras de arriba
saldo_tanques_final   integer     con cuánto se termina el día
nivel_observado       enum        'vacio'|'un_cuarto'|'medio'|'tres_cuartos'|'lleno'
                                  la lectura visual — RN-PRD-11. NULL si no se miró

registrado_por        uuid        fk → users, ON DELETE SET NULL
created_at            timestamptz
```

### Por qué `caudal_gpm` se copia en el cierre

Es exactamente el mismo caso que la `equivalencia` de M3 y la
`fecha_vencimiento` de M2: **es el valor que se usó ese día**.

El caudal se va a corregir cuando se mida bien —hoy ni siquiera existe
([preguntas 4 y 5](/empezar/pendientes/))— y con una referencia viva, corregirlo
recalcularía cuántos litros se procesaron **todos los días del pasado**. Un mes
de historia cambiaría de significado sin que nadie tocara un cierre.

Es la tercera vez que este patrón aparece. Ya no es una decisión: es la regla.

### `movimientos_agua`

El libro del agua. Mismo patrón que `movimientos_stock` y `movimientos_insumo`.

```ts
id              bigserial   pk
tanque          enum        'crudo' | 'procesado'
litros          integer     positivo entra, negativo sale
                            ⚠️ CHECK: <> 0
tipo            enum        'ingreso_red' | 'procesamiento' | 'envasado'
                          | 'lavado' | 'ajuste'
motivo          text        ⚠️ CHECK: tipo <> 'ajuste' OR motivo IS NOT NULL
cierre_id       uuid        el cierre que lo originó. NULL en ingreso y ajuste
registrado_por  uuid        fk → users, ON DELETE SET NULL
created_at      timestamptz
```

### Los tres saldos son tres, no uno — `RN-PRD-02`

Agua cruda (13.000 L), tanque procesado A y B (2.000 L cada uno). Pero
`RN-PRD-21` confirma que **los dos procesados se operan en paralelo**: se llenan
juntos y se vacían juntos.

**Por eso el enum tiene `procesado` y no `procesado_a` / `procesado_b`.** Modelar
dos tanques que siempre se mueven juntos duplicaría cada escritura para que las
dos filas digan siempre lo mismo. La capacidad es 4.000 L y punto.

Si algún día se operan por separado, ahí se parte el enum — y quien lo haga va a
tener que decidir conscientemente cómo se reparte, en vez de heredar una
respuesta que nadie pensó.

## 6. El balance, y el hueco que se declara como hueco

```
AGUA PROCESADA (4.000 L)              ← balance CERRADO
  saldo inicial                         con lo que cerró ayer
  + procesamiento del día               caudal × tiempo × 0,70   ✅ medido
  − litros consumidos                   pacas y botellones       ✅ calculado
  = saldo final

AGUA CRUDA (13.000 L)                 ← un término SIN medir
  saldo inicial
  + ingreso de la red municipal         ❌ NO HAY MEDIDOR
  − litros crudos consumidos            procesamiento ÷ 0,70     ✅ derivado
  = saldo final
```

**De los cuatro términos, tres son exactos.** El único que no se puede medir es
el ingreso de la red al almacenamiento crudo: no hay medidor ni regleta
(`RN-PRD-11`).

:::danger[El ingreso de agua NO es un dato que el sistema reciba]
Y esto es lo que más se presta a construir mal. La tentación es poner un campo
«litros ingresados» y dejar que alguien lo llene a ojo.

Eso **fabrica precisión que no existe** —`RN-PRD-15`— y convierte un hueco
conocido en un número que parece medido. El día que el saldo no cuadre, nadie va
a saber si el problema fue el consumo, la merma o esa estimación.

Lo que sí se registra es **el hecho**: «llegó agua y se llenó el tanque», sin
cantidad. El saldo calculado sube hasta la banda observada. Es una
**recalibración con motivo**, no una medición.
:::

## 7. La reconciliación — `RN-PRD-14`

El saldo calculado manda. La lectura visual **reconcilia**, no corrige.

El operario reporta el nivel en **cuartos** (`RN-PRD-11`) porque eso es lo que se
puede ver. El sistema compara contra su saldo y:

- Si cae dentro de la banda del cuarto reportado → **cuadra**, no pasa nada.
- Si cae fuera → se marca la discrepancia y se ofrece un ajuste **con motivo**.

**Nunca se sobrescribe el saldo con la lectura.** «Medio tanque» es un rango de
500 litros: reemplazar un número calculado por el centro de ese rango pierde
información y encima parece más preciso.

## 8. Los tres efectos, en una transacción — `RN-PRD-04`

| Efecto | Sobre | Cómo |
| --- | --- | --- |
| ➖ Litros | `movimientos_agua` | Envasado + lavado |
| ➖ Insumos | `movimientos_insumo` | Una tapa y un sello por botellón — `RN-PRD-09` |
| ➕ Producto | `lotes` + `movimientos_stock` | Un lote con vencimiento a 30 días — `RN-PRD-23` |

**Los cuatro escritos van en la MISMA transacción.** Si el cierre queda y los
insumos no, la planta cree que tiene tapas que ya gastó — y lo descubre el día
que no puede envasar.

:::caution[Acá es donde M3 y M2 se pagan]
`descontar()` de insumos y de stock ya existen, ya son atómicos y ya aceptan un
ejecutor externo (`Ejecutor = DB | Transaccion`). **Ese parámetro se agregó
pensando en este momento.**

M4 no reimplementa el descuento: abre la transacción y se los pasa.
:::

### Qué pasa si no alcanzan los insumos

Un cierre que consume 200 tapas cuando hay 150 **no puede quedar a medias**. Las
dos salidas posibles:

1. **Rechazar el cierre** con el faltante — obliga a ajustar el inventario antes.
2. **Registrarlo igual** y dejar el saldo en negativo.

Se elige **rechazar**, y con el número real en el mensaje. El saldo negativo es
lo que M2 y M3 se pasaron dos tasks impidiendo; permitirlo acá lo devolvería por
la puerta de atrás.

Que la planta haya envasado de verdad y el sistema diga que no había tapas
significa que **el inventario estaba mal antes del cierre** — y eso se arregla
con un ajuste que deja constancia, no ignorándolo.

## 9. Permisos

**Ya están declarados** en `api/src/modules/authz/matrix.ts`, y son **más finos
de lo que este documento propuso en su primera versión**: `produccion` y
`tanques` son recursos SEPARADOS.

| Permiso | `admin` | `seller` | `pos` | `contador` |
| --- | :-: | :-: | :-: | :-: |
| `produccion:ver` | ✅ | ❌ | ✅ | 🟡 solo lectura |
| `produccion:registrar_cierre` | ✅ | ❌ | ✅ | ❌ |
| `tanques:ver` | ✅ | ❌ | ✅ | ❌ |
| `tanques:registrar_reposicion` | ✅ | ❌ | ✅ | ❌ |
| `tanques:ajustar` | ✅ | ❌ | ❌ | ❌ |

El `pos` registra el cierre: es quien opera la planta (`RN-PRD-24`). El
`contador` mira y no toca — es testigo, no operador.

**Y la separación entre los dos recursos importa**, porque distingue dos cosas
que se parecen y no son iguales:

- **`tanques:registrar_reposicion`** lo tiene el `pos`: «llegó agua y se llenó el
  tanque» es un HECHO que observa quien está en la planta.
- **`tanques:ajustar`** es solo del `admin`: corregir un saldo que no cuadra es
  otra cosa, y quien opera no debería poder tapar su propia discrepancia.

Igual que en M3, **no hace falta una task de matriz.**

## 10. Endpoints

| Método | Ruta | Permiso |
| --- | --- | --- |
| `GET` | `/produccion` | `produccion:ver` |
| `GET` | `/produccion/:fecha` | `produccion:ver` |
| `POST` | `/produccion/cierres` | `produccion:registrar_cierre` |
| `GET` | `/tanques` | `tanques:ver` |
| `POST` | `/tanques/reposicion` | `tanques:registrar_reposicion` |
| `POST` | `/tanques/ajuste` | `tanques:ajustar` (solo admin) |

**No hay `PATCH` ni `DELETE` sobre un cierre** — `RN-PRD-08`. Que no existan es
parte del contrato, y un test lo verifica.

## 11. Estrategia de testing

| Qué | Cómo |
| --- | --- |
| La transacción | **Forzar el fallo del último escrito** y verificar que no quedó ninguno |
| Insumos insuficientes | El cierre se rechaza con el faltante, y no deja NADA escrito |
| Un cierre por día | El `UNIQUE(fecha)` se prueba intentando el segundo |
| El caudal histórico | Cambiarlo y verificar que los cierres viejos no cambian |
| La reconciliación | Dentro de banda no marca; fuera de banda sí |
| Inmutabilidad | `UPDATE` y `DELETE` rechazados por el `REVOKE`, no por el servicio |

## 12. Criterios de éxito

1. Un `pos` registra el cierre y los **tres** saldos se mueven en una operación.
2. Si los insumos no alcanzan, **no queda nada escrito** y el mensaje dice cuánto
   falta.
3. Un segundo cierre para la misma fecha se rechaza.
4. Corregir el caudal no altera ningún cierre pasado.
5. El sistema **nunca** pide «litros ingresados»: registra el hecho, no el número.
6. Una lectura de «medio tanque» que cuadra no genera ajuste; una que no, sí.

## 13. Riesgos y preguntas abiertas

| Riesgo | Mitigación |
| --- | --- |
| 🔴 **La transacción parcial** | Los cuatro escritos o ninguno. Se prueba forzando el fallo del último |
| 🔴 **Un campo «litros ingresados»** | No existe. Es el hueco declarado como hueco |
| 🟠 **Sin caudal medido, `litros_procesados` no se calcula** | Mismo patrón que M3: se pide el dato y se rechaza en vez de estimar |
| 🟠 **Modelar dos tanques procesados** | Se operan en paralelo. Un enum, no dos |
| 🟢 **Proponer permisos que ya existen** | Pasó al escribir esta spec: se propuso `produccion:registrar` cuando la matriz ya tenía `registrar_cierre`, y separaba `tanques` como recurso propio. **Leer la matriz antes de diseñar permisos**, no después |

### Preguntas abiertas

- **[4] y [5]** — el caudal en GPM y el tiempo de llenado de un tanque. Sin
  ellos, el cierre acepta el envasado pero **no puede calcular el procesamiento**.
  Mismo tratamiento que la [pregunta 37](/empezar/pendientes/) en M3: se carga
  desde la pantalla cuando exista.
- **[6]** — litros que consume lavar un botellón. Sin esto, un término del
  balance queda en cero y el consumo sale subestimado.

## 14. Implementación

El plan y las tasks van en un documento aparte, como en M1, M2 y M3.

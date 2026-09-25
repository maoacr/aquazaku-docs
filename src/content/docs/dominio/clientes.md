---
title: Clientes
description: Identidad, saldo, crédito y asignación a ruta de los clientes de Aquazaku.
sidebar:
  order: 6
---

### RN-CLI-01 — La identidad del cliente es un UUID, no su documento

**Estado:** ✅ Confirmada

Cada cliente tiene un **UUID generado por el sistema** como identificador
interno. El **número de documento** es un atributo de búsqueda, no la clave.

| | UUID | Documento |
| --- | --- | --- |
| Rol | Identidad interna | Dato de negocio |
| Lo genera | El sistema | Lo trae el cliente |
| ¿Puede faltar? | Nunca | Sí |
| ¿Puede cambiar? | Nunca | Sí (corrección de carga) |

**Por qué:** en venta a hogares muchas veces no hay documento a mano. Si el
documento fuera la clave, no podrías registrar al cliente hasta conseguirlo —
y el `seller` en la calle necesita registrar la venta ahora.

El saldo de deuda y el de botellones se acumulan por cliente: duplicar el
cliente parte el saldo en dos y ninguno de los dos es real.

### RN-CLI-08 — El documento es único: dos clientes nunca lo comparten

**Estado:** ✅ Confirmada — obligatorio y único.

Un número de documento pertenece a una sola persona. El documento es
**obligatorio**: no se registra un cliente sin él. Y el sistema **impide**
registrar dos clientes con el mismo.

La restricción va sobre **`(tipo_documento, numero)`**, no sobre el número suelto
— ver [RN-CLI-09](#rn-cli-09--el-tipo-de-documento-es-explícito-el-dígito-de-verificación-se-calcula).

**Por qué:** es la defensa contra el duplicado. Sin esta restricción, el mismo
cliente cargado dos veces parte su deuda y su saldo de botellones en dos, y
ninguno de los dos es real.

:::tip[Obligatorio no significa que haya que ver el documento físico]
El `seller` en la calle puede registrar al cliente con el número **dictado de
viva voz**. Lo que cambia no es si el dato está: es su **estado de verificación**
— ver [RN-CLI-10](#rn-cli-10--el-documento-tiene-estado-de-verificación).

Esa distinción es la que permite no frenar la venta y a la vez no dar por cierto
lo que nadie comprobó.
:::

---

### RN-CLI-09 — El tipo de documento es explícito; el dígito de verificación se calcula

**Estado:** ✅ Confirmada — el modelo fue aceptado, con los detalles del campo CC y NIT.

En Colombia conviven dos identificadores:

| Tipo | Quién | Número base | Formato |
| --- | --- | --- | --- |
| **CC** | Persona natural | Cédula | `79123456` |
| **NIT** | Contribuyente | Cédula (natural) o asignado por DIAN (empresa) | `900123456-8` |

El guion del NIT **no separa dos datos**: separa el número de su **dígito de
verificación (DV)**, que DIAN calcula con un algoritmo módulo 11 de pesos fijos
sobre el número base.

#### Cómo se calcula el DV

El algoritmo está definido en la **Orden Administrativa 4 de 1989 de la DIAN**.
No es una convención nuestra ni una elección de diseño: es norma.

El DV es una **función del número base** — mismo número, mismo dígito, siempre.
Por eso no hace falta pedirlo.

1. Se toman los **9 dígitos** del NIT, completando con ceros a la izquierda si
   hace falta.
2. Se multiplica cada dígito por su peso, **de izquierda a derecha**:

   ```
   41, 37, 29, 23, 19, 17, 13, 7, 3
   ```

3. Se suman los productos.
4. `resto = suma mod 11`.
5. Si el resto es **0 o 1**, el DV **es** el resto. Si es **2 o más**,
   `DV = 11 − resto`.

```
NIT base 900123456

  dígito   peso   producto
       9     41        369
       0     37          0
       0     29          0
       1     23         23
       2     19         38
       3     17         51
       4     13         52
       5      7         35
       6      3         18
                      ────
  suma                 586

  586 mod 11 = 3   →   DV = 11 − 3 = 8   →   900123456-8
```

| NIT base | Suma | Resto | DV |
| --- | --- | --- | --- |
| `123456789` | 665 | 5 | **6** |
| `900123456` | 586 | 3 | **8** |
| `79123456` | 737 | 0 | **0** |

*(La última fila muestra el caso `resto = 0`: ahí el DV **es** cero, no `11 − 0`.)*

:::danger[Las cédulas de 10 dígitos no entran en la tabla de 9 pesos]
La norma describe el cálculo sobre **nueve** dígitos. Pero las cédulas
colombianas actuales tienen **diez**, y el NIT de una persona natural se basa en
su cédula ([RN-CLI-09](#rn-cli-09--el-tipo-de-documento-es-explícito-el-dígito-de-verificación-se-calcula)).

Con nueve pesos, un número de diez dígitos deja el primero sin multiplicar — y el
DV sale mal.

**La secuencia completa** son primos consecutivos, aplicados de **derecha a
izquierda**, tomando tantos como dígitos tenga el número:

```
3, 7, 13, 17, 19, 23, 29, 37, 41, 43, 47, 53, 59, 67, 71
```

Leída al revés, para nueve dígitos da exactamente `41, 37, 29, 23, 19, 17, 13,
7, 3` — la tabla de la norma. Para diez, entra además el `43`.

**Implementar siempre sobre la secuencia larga y recorrer de derecha a
izquierda.** Así funciona para cédulas de 8, 9 o 10 dígitos sin casos especiales.

Es el error más probable de esta implementación: se prueba con NIT de empresa
—que son de 9— funciona, y falla con las cédulas de los clientes.
:::

**Para qué sirve realmente:** el DV no es seguridad, es **detección de errores de
transcripción**. La secuencia de pesos son números primos justamente para eso:
cambiar un dígito, o intercambiar dos vecinos, casi siempre produce un DV
distinto.

Eso es lo que lo convierte en una validación: si alguien dicta un NIT completo y
el dígito no coincide con el calculado, **hay un número mal tomado** — y se
detecta en el momento, no cuando la factura electrónica rebota.

:::note[Fuentes]
- [Número de Identificación Tributaria (Colombia) — Wikipedia](https://es.wikipedia.org/wiki/N%C3%BAmero_de_Identificaci%C3%B3n_Tributaria_(Colombia))
- [Dígito de verificación del NIT — Actualícese](https://actualicese.com/guia-consulta-digito-de-verificacion-nit/)

Norma de origen: Orden Administrativa 4 de 1989, DIAN. Conviene contrastar contra
el texto oficial antes de liberar a producción.
:::

#### El modelo

```
tipo_documento   CC | NIT      ← explícito, elegido por el usuario
numero           string        ← sin DV
dv               derivado      ← calculado, nunca capturado (solo NIT)
```

**El DV no se almacena como dato de entrada.** Se calcula. Si el usuario tiene el
NIT completo a mano y escribe el dígito, se usa para **validar** — si no coincide
con el calculado, hubo un error de tipeo y se avisa en el momento.

#### El DV solo aplica a NIT

Para cédulas (CC) no se calcula ni se captura un DV: el sistema lo trata como
dato irrelevante y el campo queda `disabled` en el form. La cédula ya trae su
último dígito embebido en el número — pedirlo aparte solo agregaría confusión.

Para NIT, sí se calcula (algoritmo de arriba). La diferencia es por diseño, no
por descuido: cada tipo tiene su forma de validación natural.

:::danger[Por qué el tipo NO se infiere de un campo vacío]
Una alternativa considerada era usar dos campos y deducir el tipo según si el
segundo tiene valor. Se descarta: la falla es **silenciosa**.

| Situación | Se registraría como | Debería ser |
| --- | --- | --- |
| Persona natural que conoce su DV y lo escribe | NIT | CC |
| Comercio cuyo dueño no recuerda el DV | CC | NIT |

Si un cliente es persona o empresa **es un hecho del negocio** —afecta precios,
crédito y facturación—, no una consecuencia de qué campo se llenó. Los hechos
del negocio se declaran, no se adivinan.
:::

:::caution[La trampa del duplicado por la puerta de atrás]
Para una persona natural, **el número base del NIT ES su cédula**. Entonces el
mismo humano puede entrar dos veces:

```
CC  79123456      ← se registró como hogar
NIT 79123456-0    ← después abrió un negocio
```

Con unicidad sobre `(tipo, numero)` esos son **dos registros válidos y distintos**,
y [RN-CLI-08](#rn-cli-08--el-documento-es-único-dos-clientes-nunca-lo-comparten)
no lo impide: el duplicado entra por la puerta de atrás.

**Mitigación:** al registrar un NIT cuyo número base coincide con una CC ya
existente —o al revés— el sistema **advierte** y pide confirmar si es la misma
persona. No lo bloquea: puede ser legítimo que un cliente tenga cuenta personal
y comercial separadas. Pero que sea una decisión, no un accidente.
:::

:::danger[Los pesos de arriba hay que verificarlos contra DIAN]
La secuencia `3, 7, 13, 17, 19, 23, 29, 37, 41, 43, 47, 53, 59, 67, 71` está acá
como referencia, **no como fuente**. Contrastala con la especificación oficial de
DIAN antes de llevarla a producción.

**Por qué insistir:** un peso equivocado no rompe todo de golpe. Produce dígitos
correctos para muchos números e incorrectos para otros. El bug no aparece en
desarrollo — aparece meses después, con un cliente puntual que no se puede
registrar, y nadie entiende por qué.

Armá una batería de casos con NIT reales conocidos —de proveedores, por ejemplo—
y que sea parte de los tests desde el primer día.
:::

:::note[Para el diseño de base de datos]
Si el UUID va a ser clave primaria, conviene **UUIDv7** en vez de v4: es
ordenable por tiempo y no fragmenta el índice. Es gratis elegirlo bien ahora y
molesto cambiarlo después — merece un [ADR](/decisiones/).
:::

---

### RN-CLI-10 — El documento tiene estado de verificación

**Estado:** ✅ Confirmada

Registrar el número y **comprobar que sea cierto** son dos cosas distintas. El
sistema las separa:

| Estado | Cómo se llega | Qué significa |
| --- | --- | --- |
| 🟡 `PENDIENTE` | El cliente dictó el número | Nadie vio el documento físico |
| ✅ `VERIFICADO` | Quien registró marcó que **cotejó contra el documento físico** | Alguien puso su nombre detrás del dato |

El estado por defecto es `PENDIENTE`. Pasar a `VERIFICADO` es una acción
deliberada del `seller` o del `pos`, y queda registrada con **quién** y **cuándo**.

**Por qué:** obliga a elegir entre frenar la venta y creerle a cualquiera. El
`seller` registra y vende ahora; el sistema sabe que ese dato todavía no está
comprobado y puede tratarlo distinto.

:::tip[Marcar "verificado" es asumir responsabilidad]
No es un checkbox de trámite. Al marcarlo, alguien queda registrado afirmando
que tuvo la cédula en la mano.

Si después aparece un documento equivocado, se sabe quién lo dio por bueno. Esa
trazabilidad es la que hace que el flag signifique algo — si nadie responde por
él, todos lo marcan siempre y deja de servir.
:::

Ver [RN-CLI-14](#rn-cli-14--cualquiera-de-los-cuatro-roles-operativos-puede-verificar-el-código-de-verificación-queda-auditado)
para quién puede llevar a un cliente de `PENDIENTE` a `VERIFICADO`.

---

### RN-CLI-11 — La copia local alcanza; el choque al sincronizar solo se registra

**Estado:** ✅ Confirmada — alcance definido por Aquazaku.

El `seller` valida contra la **copia local** de documentos que trae de su última
sincronización. La lista es liviana —solo números— así que la app la lleva
completa y valida al instante, sin señal.

**Eso alcanza.** El `seller` sincroniza en su casa antes de salir y al mediodía;
la ventana en que su copia queda vieja es de pocas horas. Y con el volumen actual
de clientes, que dos `seller` registren la misma cédula el mismo día es
suficientemente improbable como para no construir nada alrededor.

:::note[Decisión de alcance: no hay funcionalidad de fusión]
Se evaluó una pantalla para que un `admin` revisara y fusionara duplicados. **Se
descarta**: resuelve un caso que casi no va a ocurrir, y construirlo hoy es el
mismo error que adelantar el estado del botellón
([RN-ENV-07](/dominio/botellones-y-bases/)).

Si con más `seller` en calle el caso empieza a aparecer, se reevalúa.
:::

#### Pero el rechazo hay que atenderlo igual

Esto **no es una funcionalidad**: es qué hace el sync cuando la base le dice que
no. Y va a decir que no, porque
[RN-CLI-08](#rn-cli-08--el-documento-es-único-dos-clientes-nunca-lo-comparten)
pone una restricción de unicidad que se aplica lo hayamos previsto o no.

```
El sync intenta crear el cliente  →  la base: "ese documento ya existe"
   → NO se crea un cliente nuevo
   → la venta se asocia al cliente que YA estaba
   → la discrepancia queda en el log
```

El documento es la clave natural para reconciliar, así que la venta encuentra
sola a su dueño. Sin pantallas, sin decisiones manuales.

:::danger[Lo único innegociable: la venta no se pierde]
Cuando el sync choca, **la venta ya ocurrió**. El producto salió, la plata se
cobró.

Si el rechazo del cliente arrastra la venta, el sistema borra una operación real
— y nadie se entera hasta que el arqueo no cuadra.

El registro del cliente puede descartarse. **La venta, nunca.**
:::

**Por qué:** es la primera consecuencia concreta del modo offline. El
comportamiento ante rechazo va en el [ADR](/decisiones/) de sincronización, junto
con las otras tres decisiones ([RN-RUT-05](/dominio/rutas/)).

---

### RN-CLI-02 — Un cliente no se borra, se desactiva

**Estado:** 🟢 Confirmada — sesión del 21-sep-2026.

Un cliente con historial nunca se elimina. Se marca como inactivo y deja de
aparecer en las operaciones nuevas.

**Por qué:** borrarlo rompe el historial de ventas y deja envases sin dueño.

#### Desactivar también devuelve el stock físico

Desactivar no es solo escribir `activo = false`: el cliente suele tener bases
prestadas y botellones a su nombre, y dejarlos «colgados» de un cliente
inactivo es stock que nadie puede reclamar. El endpoint `POST /clientes/:id/desactivar`
hace las dos cosas en una sola transacción:

1. Marca `activo = false` y exige motivo escrito (mínimo 10 caracteres, mismo
   piso que [RN-VEN-08](/dominio/ventas/#rn-ven-08--anulación-de-venta-solo-el-autor-comentario-obligatorio)).
2. Devuelve las bases prestadas a sus direcciones a bodega, con una fila
   `tipo='retorno'` en `movimientos_base` por cada una.
3. Inserta una transferencia `tipo='retorno'` en `movimientos_botellon` que
   devuelve los botellones del cliente a la bodega (dos filas con signo
   opuesto, como toda transferencia).
4. Audita con `clientes:desactivar` registrando los conteos — los que el
   modal de web muestra antes de confirmar y los que el cliente ve en el
   mensaje de éxito.

`PATCH /:id/estado` queda como toggle puro: sirve para **reactivar** un
cliente ya desactivado y para cambios manuales que no tocan stock. Quien
necesita desactivar con devolución de stock usa el endpoint nuevo.

---

### RN-CLI-03 — El saldo del cliente es derivado, no editable

**Estado:** 🟡 Supuesto

```
saldo de deuda = ventas a crédito − cobros registrados
```

No existe "editar el saldo". Se corrige con un documento: un cobro, una
anulación o un ajuste con motivo.

**Por qué:** un saldo editable a mano hace que la cobranza deje de ser auditable.
Es el mismo principio que [RN-STK-02](/dominio/stock/).

---

### RN-CLI-04 — El crédito es una habilitación explícita con límite

**Estado:** 🟡 Supuesto

Un cliente no tiene crédito por defecto. Se le habilita, con un límite, y alguien
queda registrado como responsable de esa habilitación.

**Por qué:** sin límite explícito la deuda crece hasta que alguien la nota, y
para entonces ya es incobrable. Ver [RN-VEN-05](/dominio/ventas/).

---

### RN-CLI-05 — La ruta se asigna a la dirección, no al cliente

**Estado:** ✅ Confirmada — modelo objetivo definido por Aquazaku.

Lo que pertenece a una ruta es la **dirección**. Un cliente con locales en zonas
distintas puede tener cada uno en una ruta diferente.

```
Cliente "Panadería del Centro"
├── Sucursal Norte  → Ruta A
├── Sucursal Sur    → Ruta B
└── Depósito        → sin ruta (compra en mostrador)
```

**Por qué:** el `seller` visita lugares, no razones sociales. Si la ruta colgara
del cliente, un cliente con tres locales en tres zonas obligaría a partirlo en
tres registros — y ahí se parten también su deuda y su saldo de botellones.

:::note[Hoy no hay rutas, y aún así se modela así]
Aquazaku atiende hoy a todos los clientes sin rutas armadas, por el volumen bajo.
Igual el modelo va por dirección desde el principio.

No es sobre-ingeniería, es aritmética de costos:

| | Modelar por dirección hoy | Migrar después |
| --- | --- | --- |
| Costo | Una FK en otra tabla | Migración de datos con rutas ya en uso |

Con pocos clientes, todas las direcciones en una sola ruta funciona igual de
bien. Cuando haga falta separar, ya está.
:::

---

### RN-CLI-06 — Un cliente tiene cuatro saldos distintos

**Estado:** ✅ Confirmada — granularidades verificadas con Aquazaku.

La ficha del cliente lleva cuatro cuentas que **no se mezclan**:

| Saldo | Unidad | Granularidad |
| --- | --- | --- |
| Deuda | Dinero | Cliente |
| Botellones en su poder | Cantidad | **Cliente** |
| Bases prestadas | Lista de IDs | **Dirección** |
| **Cargos pendientes** *(NUEVO)* | Dinero | **Cliente** |

El cuarto saldo nace de [RN-BAS-08](/dominio/botellones-y-bases/) — recargos
generados por daño a una base. Son **distintos de la deuda** porque no nacen
de una venta a crédito, sino de un daño evidenciado a un activo retornable.

:::tip[Por qué cada uno va a un nivel distinto]
No es inconsistencia, es que cada cosa se reclama distinto:

- El **botellón** es fungible. Alcanza con saber que el cliente tiene ocho; no
  importa en cuál de sus locales están.
- La **base** hay que ir a buscarla a un lugar concreto. Sin dirección, el
  préstamo no es reclamable.
- La **ruta** también va por dirección, porque el `seller` visita lugares.
- Los **cargos por daño** son por cliente, no por dirección — el daño es
  responsabilidad del cliente, sin importar en cuál de sus locales esté la
  base dañada.
:::

**Por qué:** son cuatro deudas distintas. Un cliente puede estar al día con la
plata, deberte quince botellones, tener dos bases sin devolver y un cargo
pendiente por base dañada. Un solo campo "estado de cuenta" no dice nada útil.

#### Cómo se reconstruye el saldo de botellones

`enPoderDelCliente` se reconstruye como `SUM(movimientos_botellon.cantidad)
WHERE clienteId = ?` — sin importar el tipo (`entrega`, `retorno`, `ajuste`)
ni el documento origen (venta original, corrección, o anulación). Cada
evento del libro aporta con su signo; el saldo es la integral.

- **Venta** — inserta filas `tipo='entrega'` (`+entregados`) y/o
  `tipo='retorno'` (`-recibidos`), vinculadas a la venta por `documentoId`.
- **Corrección** — la nueva venta puede mover los dos campos e inserta
  movimientos compensatorios `tipo='ajuste'` con el delta contra la
  original. Los originales **no se tocan**: la corrección nunca duplica ni
  resta del original.
- **Anulación** — inserta movimientos de reversión (ver
  [RN-ENV-09](/dominio/botellones-y-bases/)) que cancelan el efecto de los
  originales sin tocarlos.

Es la versión «event sourcing» aplicada al parque del cliente: el libro
contable es la fuente de verdad, el saldo es derivado.

Ver [Botellones y bases](/dominio/botellones-y-bases/) y
[RN-VEN-17](/dominio/ventas/#rn-ven-17--botellones-entregados-y-recibidos).

---

### RN-CLI-07 — La dirección es una entidad, no un campo de texto

**Estado:** ✅ Confirmada — se deriva de [RN-BAS-03](/dominio/botellones-y-bases/).

Un cliente tiene **una o varias direcciones**. Cada base prestada se asigna a una
dirección concreta, no al cliente.

```
Cliente
├── Dirección A  → base #A-0412
├── Dirección B  → base #0913
└── Dirección C  → base #B-0027
```

**Por qué:** si la dirección fuera un campo de texto en la ficha del cliente, no
podrías responder "¿a cuál de sus tres locales voy a buscar la base #0913?".
El préstamo deja de ser reclamable.

:::danger[Impacto en el modelo]
Esto es una relación `Cliente 1—N Dirección`, y `Dirección 1—N Base`.
No es un detalle de UI: cambia el esquema de la base de datos, el flujo de visita
del `seller` y la asignación de clientes a rutas.
:::

---

## Crédito

### RN-CLI-12 — El crédito es opt-in por cliente; plazos 30/60/90 días

**Estado:** ✅ Confirmada — modelo cerrado con Aquazaku.

El crédito **no es default**. La mayoría de los clientes paga al contado
(efectivo al repartidor o transferencia bancaria). Solo clientes seleccionados
lo tienen.

Cuando un cliente tiene crédito habilitado, el sistema permite registrar
ventas con **pago a 30, 60 o 90 días**, y los tres plazos están disponibles
siempre (no se eligen individualmente por cliente).

```
cliente.credito = {
  habilitado:        boolean,           // solo admin lo prende/apaga
  limite_monto:      number | null,     // null = sin tope (default)
  plazos_permitidos: [30, 60, 90],      // siempre los 3
}
```

**Por qué sin tope por defecto:** en la operación actual de Aquazaku, pocos
clientes tienen crédito y los que lo tienen son confiables. Forzar un tope
numérico ahora implica inventar el número. **Default `null`, admin
configura cuando quiera.** El bloqueo de ruta
([RN-VEN-08](/dominio/ventas/) — antes pregunta #21) solo aplica cuando
`limite_monto != null`.

### RN-CLI-13 — El documento se exige al registrar, sin excepciones

**Estado:** ⛔ **Reemplazada** el 23-sep-2026 por
[RN-CLI-20](#rn-cli-20--un-cliente-se-registra-con-lo-que-quiso-dar).

Decía: no se registra un cliente sin documento. El `seller` puede tomar el
número dictado de viva voz, pero el dato existe desde el primer momento.

**Por qué se escribió:** confundir «dato presente» con «dato verificado» lleva
a clientes registrados sin documento que después nadie sabe a qué número
apuntar. Para eso existe
[RN-CLI-10](#rn-cli-10--el-documento-tiene-estado-de-verificación) — el
documento se exige, la verificación puede esperar.

**Por qué se cayó:** el razonamiento era correcto y la conclusión no aguantó el
mostrador. Mucha gente no quiere dar el documento, y la regla no los convirtió
en clientes identificados: los mandó a un **cliente-tacho**. Queda acá porque
entender por qué existía es lo que impide volver a escribirla.

---

## Verificación

### RN-CLI-14 — Cualquiera de los cuatro roles operativos puede verificar; el código de verificación queda auditado

**Estado:** ✅ Confirmada — ampliado desde RN-CLI-10.

Pasar un cliente de `PENDIENTE` a `VERIFICADO` lo pueden hacer `seller`, `pos`
o `admin`. El sistema registra `verificado_por: user_id` (el rol se infiere
del usuario en la tabla `usuarios`) y deja en el log **quién, cuándo y con
qué método**.

```
cliente.verificacion = {
  estado:         "pendiente" | "verificado",
  verificado_por: user_id | null,
  verificado_en:  timestamp | null,
  metodo:         "seller_manual" | "pos_manual" | "admin_oficial" | null,
}
```

**Métodos según el rol:**

| Método | Quién | Cuándo |
| --- | --- | --- |
| `seller_manual` | `seller` | Cotejó el documento físico en la calle |
| `pos_manual` | `pos` | Cotejó el documento físico en el mostrador |
| `admin_oficial` | `admin` | Validó contra documento oficial o comunicación posterior |

La diferencia entre los primeros y el último es de **confianza**: los primeros
son verificación inmediata/fáctica en el momento, el tercero es ratificación
formal diferida.

**`pos` puede verificar Y entregar la base en una sola operación** — ver
[RN-BAS-07](/dominio/botellones-y-bases/) sobre el préstamo de bases. Esa
combinación es el camino de menor fricción para nuevos clientes y un
diferenciador de Aquazaku.

### RN-CLI-15 — El crédito exige verificación; sin estado no se puede activar

**Estado:** ✅ Confirmada.

Un cliente con `cliente.verificacion.estado == "pendiente"` **no puede tener**
`cliente.credito.habilitado == true`. No hay override de admin que valga: el
toggle de crédito aparece bloqueado hasta que el cliente esté verificado.

**Guard de backend obligatoria** (no solo en UI): cualquier endpoint que
habilite crédito o registre una venta a plazo debe chequear la condición
compuesta:

```
cliente.credito.habilitado == true
    AND
cliente.verificacion.estado == "verificado"
```

Si cualquiera falla, el backend rechaza — sin importar lo que la UI haya
permitido.

**Por qué:** extender crédito a una identidad sin comprobar es justamente el
riesgo que el crédito intenta acotar. Sin este invariante, la verificación
pierde todo su valor: el que más necesita crédito es el que más urgente tiene
saltarse la verificación.

---

### RN-CLI-16 — El cliente tiene un tipo con lista de precios propia

**Estado:** ✅ Confirmada — cerrá las preguntas 🟢
"¿Hay descuentos o listas de precio por tipo de cliente?" y
"¿Se distinguen clientes hogar y comercio?" de
[Qué falta preguntar](/empezar/pendientes/).

Cada cliente pertenece a uno de dos tipos:

| Tipo | Lista de precios aplicable |
| --- | --- |
| `residencial` | `precio_residencial` por SKU |
| `comercial` | `precio_comercial` por SKU |

```
cliente = {
  ...,
  tipo: "residencial" | "comercial",   // NUEVO - atributo persistente del cliente
  ...
}
```

El tipo se setea al crear el cliente y **se puede cambiar después** (un cliente
pasa de residencial a comercial cuando abre un negocio, por ejemplo). Pero el
tipo **vigente al momento de la venta** se congela en la venta misma como
snapshot — ver [RN-VEN-12](/dominio/ventas/) sobre precios segmentados.

**Por qué importa**:
- Sin el atributo, la segmentación de precios no es posible.
- Congelar el tipo al momento de la venta protege reportes y arqueos históricos
  ante cambios retroactivos.

**Precios mínimos absolutos**: cada SKU tiene además un `precio_minimo` que es
el piso que cualquier código de descuento puede alcanzar — ver
[RN-VEN-13](/dominio/ventas/).

---

### RN-CLI-17 — El nombre del cliente se guarda partido, y el que se muestra lo genera la base

**Estado:** ✅ Confirmada (9-sep-2026, salió de la primera demo).

El registro pedía **un** campo «nombre», y ahí entraba todo: `Rosa Elena Padilla
Gómez`, `rosa padilla`, `Doña Rosa`, `Rosa (la de la esquina)`. Cuatro formas de
escribir a la misma persona, ninguna ordenable por apellido y ninguna buscable
por él.

#### Las partes

| Campo | ¿Obligatorio? | Para qué |
| --- | :-: | --- |
| `primer_nombre` | sí, si es persona | |
| `segundo_nombre` | no | Falta seguido, y no pasa nada |
| `apellidos` | sí, si es persona | Los dos juntos: partirlos en paterno y materno obliga a decidir un orden que no siempre se sabe |
| `apodo` | no | **Cómo se la conoce**, que no es cómo se llama |
| `nombre_libre` | sí, si es negocio | La razón social |

:::tip[El apodo no es folklore]
En Campo de la Cruz a la gente se la ubica por el apodo. Quien atiende el
mostrador escucha *«vengo de parte de la Cuca»* mucho antes que un apellido.

Sin un campo propio ese dato se metía **dentro** del nombre —«Rosa (la de la
esquina)»— y ensuciaba el nombre que va en una factura. Por eso el apodo se
guarda aparte y **no entra** en `nombre`.
:::

#### Dos caminos, uno por cliente

«Panadería del Centro» no tiene nombre de pila. Pedirle apellidos a un negocio
sería inventar un dato — y lo que pasa de verdad es que alguien escribe
«Panadería» en primer nombre y «del Centro» en apellidos.

Así que una **persona** se nombra por partes y un **negocio** por su nombre
libre. El formulario hace una sola pregunta —¿persona o negocio?— y de ahí sale
qué campos muestra.

Un CHECK prohíbe tener las dos formas a la vez. Sin él, partirle el nombre a un
negocio dejaba la razón social vieja colgando: invisible, y aparentemente
vigente para el próximo que lea la tabla.

#### `nombre` es una columna GENERADA

No la escribe la aplicación. La compone Postgres:

```sql
nombre text GENERATED ALWAYS AS (
  COALESCE(
    NULLIF(btrim(regexp_replace(
      COALESCE(primer_nombre,'') || ' ' || COALESCE(segundo_nombre,'') || ' ' ||
      COALESCE(apellidos,''), '\s+', ' ', 'g')), ''),
    nombre_libre
  )
) STORED NOT NULL
```

**Por qué**: el invariante es que el nombre que se muestra **siempre concuerde
con sus partes**. Si lo compusiera el servicio, un `UPDATE` a mano —una
corrección, un script de migración— podría dejar `nombre` diciendo «Rosa
Padilla» mientras `apellidos` dice «Gómez». Y eso no falla ruidosamente: se ve
bien en un lado y mal en el otro, y nadie sabe cuál creer.

Es [ADR-0006](/decisiones/0006-invariantes-en-la-base/) aplicado: el invariante
vive en la base, el servicio explica.

:::caution[`concat_ws` no sirve en una columna generada]
Postgres la considera **no inmutable** y rechaza la columna con *«generation
expression is not immutable»*. Se comprobó. Por eso la expresión usa operadores
de texto y un `regexp_replace`, que sí lo son — y ese `regexp_replace` es además
lo que colapsa el hueco que deja un segundo nombre ausente.
:::

#### Lo que la base garantiza

| Restricción | Qué impide |
| --- | --- |
| `NOT NULL` sobre `nombre` | Un cliente sin ninguna forma de nombre |
| `clientes_nombre_partido_completo` | Un apellido suelto, o un nombre de pila sin apellidos |
| `clientes_segundo_nombre_necesita_primero` | Un segundo nombre huérfano |
| `clientes_una_sola_forma_de_nombre` | Las dos formas conviviendo |
| `clientes_partes_sin_vacios` | Cadenas vacías disfrazadas de dato |

El servicio valida lo mismo **antes**, y no para reemplazar a la base sino para
dar un mensaje que sirva: el error crudo de un CHECK no le dice nada a quien
está llenando un formulario. Hay un test que los cruza — cada nombre imposible
se prueba contra el servicio *y* contra la base, porque si divergen el usuario
recibe un 500 en vez de una explicación.

#### Editar reemplaza el nombre entero

Un cambio parcial no se puede interpretar: si llega solo `apellidos`, ¿el primer
nombre se conserva, o la persona pasó a llamarse solo por apellido? Así que
mencionar cualquier campo del nombre reemplaza los cinco. Como los ausentes
viajan en `NULL`, borrar un segundo nombre o un apodo se hace omitiéndolo, sin
un verbo aparte para «borrar».

---

### RN-CLI-18 — Una DIRECCIÓN que hace días que no recibe se muestra para llamar

**Estado:** ⚠️ Supuesto — los números esperan confirmación (pregunta 48).

Un botellón de 20 L de una casa dura alrededor de una semana. Pasada esa semana
el cliente no «está por pedir»: **ya se le acabó**, y o llamó a otra planta o
está aguantando. En los dos casos Aquazaku se enteró tarde.

La fecha de la última venta siempre estuvo en la base. Esto no agrega
información al sistema: agrega la pregunta que nadie estaba haciendo.

#### La unidad es la puerta, no el cliente

El agua no se entrega a un cliente: se entrega a una **dirección**. Un cliente
con casa y local tiene dos relojes independientes.

La primera versión contaba por cliente y mostraba el más RECIENTE de los dos.
Con eso, un local podía llevar veinte días seco **escondido detrás de una casa
que pidió ayer** — y el error no se veía, porque la lista se leía perfecta y le
faltaba una fila.

Hoy cada dirección **activa** saca su propia cuenta, así que un cliente con dos
direcciones aparece **dos veces**. Consecuencias:

| Caso | Qué pasa |
| --- | --- |
| Dirección **desactivada** | No aparece: ya no se entrega ahí |
| Venta a una dirección desactivada | No cuenta para las direcciones vivas — darle su reloj a otra puerta sería inventar una entrega |
| Cliente **sin ninguna dirección cargada** | Aparece igual, con «Sin dirección cargada». Desaparecer sería esconder trabajo: el trabajo es cargarle la dirección |

#### Dos canales, porque son dos cadencias

Un botellón de 20 L se acaba en una semana. Una paca de 80 bolsas de 100 ml no
se consume con ese reloj. Un contador solo los mezclaba y no servía para
ninguno: **el botellón de hace tres días tapaba la paca de hace veinte**.

La lista tiene dos pestañas, y **cada una cuenta solo sus propias ventas**:

| Pestaña | Qué ventas cuenta |
| --- | --- |
| **Recarga de botellones** | Las que incluyeron al menos una línea con `presentacion = 'botellon'` |
| **Otros productos** | Las que incluyeron al menos una línea que **no** es botellón |

Una venta **mixta** cae en las dos: el cliente se llevó de las dos cosas y las
dos se le van a acabar. Así que un mismo cliente puede estar al día en
botellones y atrasado en pacas, y aparecer en las dos listas. No es una
inconsistencia: son dos preguntas distintas.

:::note[Se pregunta por lo que NO es botellón, a propósito]
El corte es `presentacion <> 'botellon'` y no `= 'paca'`. El día que entre una
presentación nueva cae en «Otros» sin que nadie se acuerde de tocar el módulo.
:::

Los dos canales **comparten** `dias_recompra_aviso` / `dias_recompra_urgente`.
Es un supuesto abierto: si la operación confirma que la paca tiene otra
cadencia, la respuesta es un segundo par de parámetros — no un número escrito
en el código.

#### Las ventas anteriores a la migración 0022

`ventas.direccion_id` nació en la migración `0022`. Todo lo anterior no dice a
qué puerta se entregó, y en la base de desarrollo eso eran **28 de 30** ventas
con cliente.

Esas ventas cuentan para **todas** las direcciones activas de su cliente, y la
fila queda marcada con un **asterisco**: el conteo es del cliente, no de esa
puerta.

:::caution[El asterisco cuelga del NÚMERO, no de la dirección]
Hubo un badge «sin asignar» al lado de la etiqueta de la dirección, y era
confuso con razón: se leía como «esta dirección no está asignada», que es falso
— la dirección existe y es del cliente. Lo que no se registró es a cuál de sus
puertas fue **la venta**. La duda es sobre el conteo, así que la marca vive en
el conteo.
:::

Se apaga sola: cada venta nueva registra su dirección
([RN-VEN-18](/dominio/ventas/)). Y no se puede «arreglar» con un `UPDATE`: el
trigger `solo_anulacion_en_ventas` rechaza cualquier cambio que deje la venta en
`confirmada` (RN-VEN-02). El camino es **corregir la venta**, que crea una nueva
con la misma fecha y la dirección puesta.

#### El lápiz de la fila, y lo que cuesta

Cada fila ofrece asignarle la dirección a la venta que fijó su reloj. Por
detrás es una **corrección**, la misma que usa Ventas para editar: se anula la
vieja y se registra una nueva. El diálogo lo dice antes de que alguien apriete,
porque quien mañana mire la bitácora va a encontrar una venta anulada y otra
creada, y tiene que poder reconocer que fue esto y no el error de alguien.

Está medido en `api/src/modules/ventas/__tests__/asignar-direccion.test.ts`, con
dos lotes de vencimientos distintos para que FEFO tenga de dónde equivocarse:

| Queda idéntico | Por qué se prueba |
| --- | --- |
| El stock **por lote** | El total puede cuadrar mientras las unidades vuelven a un lote y salen de otro. El inventario diría la verdad y el lote una mentira |
| El saldo de **botellones** del cliente | Un `botellonesRecibidos` perdido no es un dato faltante: es el saldo de envases movido sin que nadie lo pidiera |
| La **fecha** de la venta | Con la de hoy, se arreglaría la dirección y el cliente saldría de esta lista como si hubiera comprado recién |
| El **total** | Se completó un dato, no se editó una venta |

:::caution[`ocurrioEn` no es opcional en esta corrección]
`registrarVentaEn` evalúa los lotes contra `ocurrioEn ?? hoy`, y los lotes viven
30 días ([`DIAS_DE_VENCIMIENTO`](/dominio/stock/)). Una venta de 43 días está
sobre un lote **vencido**, que `asignarFifo` ya no reparte.

Sin `ocurrioEn`, la corrección rebota con `STOCK_INSUFICIENTE` justo en las
ventas que esto viene a arreglar. Con la fecha de la venta, FEFO evalúa los
lotes como se evaluaban ese día y el stock vuelve exactamente a donde estaba.
:::

#### Tres razones por las que el lápiz no va a funcionar

| Bloqueo | Qué se hace |
| --- | --- |
| La venta tiene **devoluciones** | Nada desde acá: corregirla reemplazaría la venta entera y la devolución quedaría colgando de líneas que dejarían de existir |
| La venta pasó los **90 días** ([RN-VEN-14](/dominio/ventas/)) | Un ajuste contable. El tope no es un obstáculo a sortear: es lo que impide reescribir un trimestre cerrado |
| El cliente no tiene **direcciones activas** | Cargarle una en su ficha primero |

Los tres se explican con su motivo. Un 422 crudo dejaría a quien aprieta el
botón sin saber si el problema tiene arreglo.

:::note[El tope de 90 días corre contra el calendario]
Se mide desde **hoy**, no desde que se cargó la venta. Una venta que hoy tiene
85 días queda fuera de alcance en cinco. Medido en producción el 25-sep-2026:
203 ventas sin dirección, **ninguna** fuera de alcance y ninguna bloqueada por
devoluciones — pero 3 con menos de diez días de margen y 13 más dentro del mes.
:::

#### Dos franjas, porque son dos conversaciones

| Días sin comprar | Franja | Qué es esa llamada |
| --- | --- | --- |
| menos de `dias_recompra_aviso` | — | No aparece |
| desde `dias_recompra_aviso` | **Aviso** | Una oferta: «¿le mandamos uno?» |
| desde `dias_recompra_urgente` | **Urgente** | Una recuperación: ya compró en otro lado |

Quien atiende el teléfono no las hace igual, y una lista sola no deja priorizar
cuando no hay tiempo de llamar a todos.

Los dos umbrales son **parámetros**, no constantes: arrancan en 5 y 8 días y se
cambian desde **Alertas** en la administración, igual que el aviso de
vencimiento — la regla general está en
[RN-STK-11](/dominio/stock/). Un número que alguien va a querer mover no puede
exigir un despliegue.

:::caution[El aviso tiene que ser MENOR que el urgente]
Con `aviso >= urgente` no queda ninguna franja intermedia: el panel muestra a
todos como urgentes, o a nadie. Es un error de configuración que se ve como un
sistema que dejó de avisar.

Lo sostiene un **trigger** de la migración `0017`, no solo el servicio. La regla
cruza dos filas de una tabla clave-valor y un `CHECK` solo ve la suya — y va en
la base porque un `psql` a las once de la noche no pasa por el servicio
([ADR-0006](/decisiones/0006-invariantes-en-la-base/)).

**Consecuencia práctica**: para mover los dos umbrales hacia arriba hay que
cambiar primero el urgente. Al revés, el primer `UPDATE` rebota.
:::

#### Qué cuenta como haber comprado

Solo las ventas **confirmadas de producto**, y cada exclusión tiene su motivo:

| No cuenta | Por qué |
| --- | --- |
| Una venta **anulada** | El cliente figuraría como atendido sin haberse llevado nada — y justamente quien tuvo un problema con su pedido es a quien más hay que llamar |
| Un **recargo por daño** de base | Es una deuda, no agua que se acaba. Cobrarle el daño a alguien lo sacaría de la lista justo cuando más razón hay para llamarlo |
| Una venta **de mostrador sin cliente** | No hay a quién llamar |
| Quien **nunca compró** | No es una recompra, es un cliente nuevo. Si entrara, cada alta figuraría como urgente el mismo día de registrarse |

#### El botón de WhatsApp no aparece sobre un fijo

Los teléfonos se guardan como texto libre, y conviven celulares con fijos en el
mismo cliente. Colombia renumeró en 2022: **los fijos quedaron con diez dígitos
igual que un celular**, así que ya no se distinguen por largo — solo por el
primer dígito, que en un celular es `3`.

`wa.me` con un fijo abre WhatsApp y contesta que ese número no existe. Un botón
que a veces lleva a una pared obliga a comprobar cada vez, y termina siendo un
botón en el que nadie confía — tampoco donde sí funciona.

El número llega armado desde `api`, igual que `legible` en las direcciones: la
regla que decide qué es un celular vive de un solo lado. El fijo **se sigue
mostrando**, porque se puede llamar aunque no se pueda escribir.

:::danger[No se toman «los últimos diez dígitos»]
Es la tentación obvia para que cualquier número entre, y convierte uno de
México en uno colombiano que le pertenece a **otra persona**. El mensaje sale
igual, con el nombre de tu cliente adentro.

Un indicativo que no es el de Colombia se rechaza en vez de recortarse.
:::

#### Dónde vive la lista

La lista completa vive en el módulo **Seguimientos**
(`/modulos/seguimientos`), como una **tabla densa** con el encabezado fijo: días,
cliente, dirección y teléfonos. La pestaña activa viaja en la URL (`?canal=otros`)
y no en estado de cliente, así que la pantalla sigue siendo Server Component y el
link se puede compartir. Abajo de 768 px la tabla **se apila** en vez de
scrollear en horizontal — cuarenta llamadas no se hacen barriendo de lado.

El tablero conserva solo el **recordatorio**: si hay N **direcciones** a las que
hay que llamar —sumando los dos canales— lo dice como un pendiente con la
cantidad exacta y un link «Ir a Seguimientos →». Misma regla que cualquier otro
pendiente del tablero: número sin acción al lado es decoración.

:::note[La urgencia es relleno contra contorno, no dos colores]
La píldora del número va **rellena** cuando es urgente y **hueca** cuando es
aviso. Medidos, los dos tonos de fondo contrastan entre sí **1.14:1** en escala
de grises (1.016:1 en modo claro): quien no separa rojo de ámbar no habría visto
ninguna diferencia. La palabra «urgente» salió de la pantalla porque era larga y
le robaba protagonismo al número, pero **sigue en el documento** para el lector
de pantalla.
:::

Los cuatro roles tienen `clientes:ver`, que es lo que pide el endpoint
`/clientes/a-llamar`, así que los cuatro ven el módulo.

---

### RN-CLI-19 — El alta captura todo lo que el `pos` no va a poder agregar después

**Estado:** ✅ Confirmada — se deriva de [RN-ACC-02](/dominio/roles-y-permisos/) y [RN-BAS-03](/dominio/botellones-y-bases/).

`POST /clientes` acepta, **en la misma transacción**, el cliente, uno o varios
teléfonos y una dirección. No es una comodidad de pantalla: es la única puerta
que tiene el `pos` para cargar esos datos.

| Endpoint | Permiso que pide | ¿Lo tiene el `pos`? |
| --- | --- | :-: |
| `POST /clientes` | `clientes:crear` | ✅ |
| `POST /clientes/:id/telefonos` | `clientes:editar` | ❌ |
| `POST /clientes/:id/direcciones` | `clientes:editar` | ❌ |

El `pos` es quien atiende el mostrador: puede **crear** clientes, no
modificarlos. Si el teléfono y la dirección no entran en el alta, no entran
nunca — y entonces:

- Se registra a alguien que se llevó un botellón sin devolver el vacío
  (RN-ENV-09) y **no queda a quién llamar**.
- [RN-BAS-07](/dominio/botellones-y-bases/) le da autonomía al `pos` para
  prestarle una base a un cliente verificado, pero **una base se presta a una
  DIRECCIÓN** (RN-BAS-03). Sin esto puede prestar la base y no puede crear la
  dirección a la que se presta: ese cliente queda sin dónde ir a buscarla.

#### Varios teléfonos, porque no son intercambiables

Un comercial tiene **el celular del dueño y el fijo del local**, y el sistema ya
distingue uno de otro: el botón de WhatsApp no se dibuja sobre un fijo
([RN-CLI-18](#rn-cli-18--un-cliente-que-hace-días-que-no-compra-se-muestra-para-llamar)).
Capturar uno solo tira información que el sistema sabe usar.

`telefono` en singular **sigue existiendo** junto al plural. Ya tenía
consumidores —la colección de Bruno y el alta del mostrador— y romper un
contrato en uso para agregar uno nuevo sería cambiarles la puerta sin que lo
pidieran. `api` los junta.

#### Todo o nada

Un teléfono inválido o una dirección que no ubica **rechazan el alta entera**.
Con escrituras sueltas, un fallo en la segunda dejaría un cliente a medio cargar
y quien atiende no sabría qué quedó guardado — que es exactamente el registro
inútil que esto vino a evitar.

:::danger[Una dirección a medias AVISA, no se descarta]
`api` exige la **etiqueta** de la dirección —«la casa», «el local»—: es lo que
distingue una de otra cuando el cliente tiene tres.

La pantalla del alta armaba la dirección **solo si venía la etiqueta**, y si no,
la tiraba. Quien llenaba vía, placa, municipio y departamento sin ponerle nombre
daba «Registrar cliente», veía el alta salir bien, y abría la ficha **sin
dirección**: ocho campos perdidos sin una palabra. Pasó con un cliente real.

Frenar y pedir el nombre es lo único honesto. Poner una etiqueta por defecto
sería inventarle un nombre a la casa de otra persona, y seguir de largo es el
defecto.
:::

---

### RN-CLI-20 — Un cliente se registra con lo que quiso dar

**Estado:** ✅ Confirmada el 23-sep-2026 — reemplaza a
[RN-CLI-13](#rn-cli-13--el-documento-se-exige-al-registrar-sin-excepciones).

**Ningún campo del registro es bloqueante, salvo el nombre.** Documento,
teléfono, dirección y tipo de cliente son todos opcionales.

#### El cliente-tacho, que es el problema que esto resuelve

Con el documento obligatorio, quien no lo quería dar no se convertía en un
cliente identificado: se convertía en una venta colgada de **«POS Aquazaku»**,
un cliente genérico que la planta creó para poder seguir cobrando.

Eso no es un cliente. Es un tacho, y adentro conviven cientos de personas
distintas:

| Lo que se pierde en el tacho | Por qué importa |
| --- | --- |
| La cartera | No le pertenece a nadie: es la suma de deudas de gente que no se conoce entre sí |
| El historial | «Cuándo compró por última vez» no tiene respuesta |
| El teléfono | No hay a quién llamar |
| El panel de recompra | Lo ve como una persona que compra todos los días, así que **nunca lo muestra** ([RN-CLI-18](#rn-cli-18--un-cliente-que-hace-días-que-no-compra-se-muestra-para-llamar)) |

Registrar a alguien con el nombre y el teléfono que **sí** dio es mejor que eso
aunque falte el documento. Lo que se pierde —el identificador estable, el aviso
de cruce CC/NIT— dentro del tacho ya estaba perdido, y encima se perdían las
otras tres cosas.

:::note[El tacho no desaparece, encuentra su lugar]
Sigue existiendo para lo que de verdad es: quien no quiere dar **ni el nombre**.
Ese caso ni siquiera necesita un cliente — `ventas.cliente_id` es nullable desde
siempre, y una venta de mostrador anónima es exactamente eso.
:::

#### El nombre es el único piso

`clientes.nombre` es una columna **generada** `NOT NULL`: sale de las partes
—`primer_nombre` + `apellidos`— o de `nombre_libre`.

No es un capricho del esquema. Un cliente sin nombre **no se puede volver a
encontrar**: el buscador busca por nombre, apellidos, apodo y documento. Sin
ninguno de los cuatro, la ficha existe y nadie la va a hallar nunca — que es el
tacho otra vez, en versión individual.

#### El nombre se acomoda a lo que escribieron

La base guarda el nombre de dos formas y **no acepta mezclas**: partido
—`primer_nombre` y `apellidos` van juntos o no van
(`clientes_nombre_partido_completo`)— o libre.

Quien atiende no sabe eso, y no tiene por qué. Escribe «Rosa» porque es lo único
que le dijeron:

| Lo que escriben | Cómo se guarda |
| --- | --- |
| Rosa + Padilla | **Partido** — el mejor dato, deja buscar por apellido |
| Solo «Rosa» | Nombre libre |
| Solo los apellidos | Nombre libre |
| Solo el apodo | Nombre **y** apodo — el buscador mira los dos |
| Nada | Venta sin cliente |

Exigir la forma partida completa era pedirle a quien registra que **invente un
apellido**.

#### El documento, cuando viene

Los dos campos van **juntos o ninguno** (`clientes_documento_completo`): un tipo
sin número no identifica nada, y un número sin tipo no se puede leer —`79123456`
puede ser una cédula o el NIT de esa misma persona, y no son lo mismo
([RN-CLI-08](#rn-cli-08--el-documento-es-único-dos-clientes-nunca-lo-comparten)).

Y **verificar exige documento** (`clientes_verificar_exige_documento`):
verificar significa que alguien lo tuvo a la vista y lo afirma con su nombre
([RN-CLI-14](#rn-cli-14--cualquiera-de-los-cuatro-roles-operativos-puede-verificar-el-código-de-verificación-queda-auditado)).
Sobre un cliente sin documento sería una afirmación sobre nada — y arrastra el
crédito, que exige verificación
([RN-CLI-15](#rn-cli-15--el-crédito-exige-verificación-sin-estado-no-se-puede-activar)).

:::caution[Ningún botón se apaga]
La pantalla **no deshabilita** el botón de avanzar. Un botón gris no dice por
qué está gris: quien atiende lo ve apagado, no sabe qué falta, y **termina
inventando un número para encenderlo** — que es exactamente el dato basura que
esta regla vino a evitar.

Lo que falte se dice al apretar, con el nombre del campo. Y el aviso de
documento duplicado sigue a la vista ofreciendo la ficha de quien ya existe:
**avisa, no traba**.
:::

---

## Preguntas abiertas

- ¿Se cobra depósito o garantía por la base prestada? *(Cerrada — no se cobra;
  ver [RN-BAS-08](/dominio/botellones-y-bases/)).*
- ¿Puede una dirección quedar sin ruta asignada? (Hoy sí: compra en mostrador.)
- **48.** ¿A los cuántos días sin comprar hay que llamar a un cliente, y a
  partir de cuántos es urgente? Hoy están en **5 y 8** como supuesto
  ([RN-CLI-18](#rn-cli-18--un-cliente-que-hace-días-que-no-compra-se-muestra-para-llamar)).
  El número correcto depende de cuánto dura un botellón en una casa de la zona,
  y eso lo sabe quien reparte.

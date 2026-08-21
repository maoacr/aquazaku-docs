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

**Estado:** 🟡 Supuesto

Un cliente con historial nunca se elimina. Se marca como inactivo y deja de
aparecer en las operaciones nuevas.

**Por qué:** borrarlo rompe el historial de ventas y deja envases sin dueño.

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

Ver [Botellones y bases](/dominio/botellones-y-bases/).

---

### RN-CLI-07 — La dirección es una entidad, no un campo de texto

**Estado:** ✅ Confirmada — se deriva de [RN-BAS-03](/dominio/botellones-y-bases/).

Un cliente tiene **una o varias direcciones**. Cada base prestada se asigna a una
dirección concreta, no al cliente.

```
Cliente
├── Dirección A  → base #A-0412
├── Dirección B  → base #A-0913
└── Dirección C  → base #B-0027
```

**Por qué:** si la dirección fuera un campo de texto en la ficha del cliente, no
podrías responder "¿a cuál de sus tres locales voy a buscar la base #A-0913?".
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

**Estado:** ✅ Confirmada.

No se registra un cliente sin documento. El `seller` puede tomar el número
**dictado de viva voz** y la app lo acepta — pero el dato existe desde el
primer momento, no se rellena después.

**Por qué:** confundir "dato presente" con "dato verificado" lleva a clientes
registrados sin documento que después nadie sabe a qué número apuntar. Para
eso existe [RN-CLI-10](#rn-cli-10--el-documento-tiene-estado-de-verificación)
(estado de verificación) — el documento se exige, la verificación puede
esperar.

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

## Preguntas abiertas

- ¿Se cobra depósito o garantía por la base prestada? *(Cerrada — no se cobra;
  ver [RN-BAS-08](/dominio/botellones-y-bases/)).*
- ¿Puede una dirección quedar sin ruta asignada? (Hoy sí: compra en mostrador.)

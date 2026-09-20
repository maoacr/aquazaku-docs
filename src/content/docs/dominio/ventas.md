---
title: Ventas
description: Reglas de negocio de ventas, anulación, precios y crédito en Aquazaku.
sidebar:
  order: 5
---

Reglas que gobiernan el registro, cobro y anulación de una venta.

## Qué es una venta

Una venta es el registro de que un producto salió del control de Aquazaku hacia
un cliente, a cambio de un pago inmediato o de una deuda.

Puede ocurrir en dos contextos, y esa diferencia define los roles del sistema:

| Contexto | Rol | Cómo opera |
| --- | --- | --- |
| **Punto de venta** — el cliente viene | `pos` | Con conexión, contra stock de bodega |
| **En ruta** — el vendedor va | `seller` | Sin señal, contra la carga de su vehículo. Ver [Rutas](/dominio/rutas/) |

---

### RN-VEN-01 — Toda venta registra qué, a quién, cuándo, quién y cómo se pagó

**Estado:** 🟡 Supuesto

Una venta sin responsable identificado no se puede registrar. El medio de pago
es parte de la venta, no un dato posterior.

**Por qué:** sin responsable no hay a quién preguntarle cuando la rendición no
cuadra. Es la base de toda la trazabilidad del sistema.

---

### RN-VEN-02 — Una venta confirmada no se edita

**Estado:** ✅ Confirmada — regla consolidada.

Una vez confirmada, una venta es inmutable. Si está mal, se **anula** y se
registra una nueva. No existe "editar venta".

**Por qué:** una venta editable destruye la auditoría. Si el monto de ayer puede
cambiar hoy, ningún reporte, arqueo ni rendición es confiable. Esta es la regla
que más se pide romper por comodidad y la que más caro sale romper.

:::danger[No negociable]
Si el cliente pide "poder corregir la venta", la respuesta es anular y rehacer.
El costo de un campo editable es que nunca más vas a poder responder
"¿qué pasó realmente ese día?".
:::

**Actualización del 18-sep-2026.** La regla sigue intacta y el sistema sigue sin
tener un `PATCH` de venta: el trigger de la base rechaza cualquier `UPDATE` que
toque el monto, el cliente o la fecha. Lo que cambió es que "anular y rehacer"
dejó de ser **dos actos** a cargo del operador y pasó a ser uno solo, atómico y
con las dos ventas enlazadas — ver
[RN-VEN-16](#rn-ven-16--corregir-una-venta-es-reemplazarla-no-editarla).

El pedido de "poder corregir la venta" era legítimo; lo que había que negarse a
hacer era la **edición**, no la corrección.

---

### RN-VEN-03 — Anular una venta revierte todos sus efectos

**Estado:** ✅ Confirmada — base consolidada, reglas complementarias abajo.

Anular devuelve el producto al stock de la ubicación de origen, revierte el
movimiento de envases y ajusta el saldo del cliente si fue a crédito.

La anulación exige **motivo obligatorio** y queda registrada con su responsable
y fecha. La venta anulada no desaparece: cambia de estado.

**Por qué:** una anulación que no revierte el inventario genera faltantes
fantasma que después nadie puede explicar.

---

### RN-VEN-04 — El precio se congela en el comprobante

**Estado:** 🟡 Supuesto

La venta guarda el precio unitario aplicado al momento de registrarse. Un cambio
posterior en la lista de precios **no** modifica ventas ya hechas.

**Por qué:** si el precio se lee por referencia, subir la lista reescribe el
historial y los reportes de meses cerrados cambian solos.

---

### RN-VEN-05 — Solo se vende a crédito a clientes habilitados

**Estado:** ✅ Confirmada — modelo cerrado en [RN-CLI-12](/dominio/clientes/).

Una venta a crédito requiere que el cliente tenga crédito habilitado **y** esté
verificado ([RN-CLI-15](/dominio/clientes/)). Si cualquiera de las dos
condiciones falla, la venta es de contado o no procede.

La verificación compuesta que el backend tiene que chequear es:

```
cliente.credito.habilitado == true
  AND
cliente.verificacion.estado == "verificado"
  AND (
    cliente.credito.limite_monto == null
    OR  saldo_deuda + monto_venta <= cliente.credito.limite_monto
  )
```

**Por qué:** es el control que evita que la cobranza se vuelva incobrable. Ver
[RN-CLI-12](/dominio/clientes/) y [RN-CLI-15](/dominio/clientes/).

:::note[Sobre el bloqueo en ruta — pregunta #21]
La pregunta original de "¿qué pasa si el cliente supera el límite de crédito en
plena ruta?" está ahora RESPONDIDA por construcción: el chequeo es contra
`limite_monto` (que puede ser `null` = sin tope). Si `limite_monto == null`,
no hay forma de bloquear — el sistema no tiene un número con el cual bloquear.

Hoy, con la operación chica y los pocos clientes con crédito, se arranca con
`null` en todos. Cuando un admin configure un tope para alguien específico,
ese cliente sí queda sujeto al chequeo.
:::

---

### RN-VEN-06 — Una venta en ruta pertenece a la ruta del día

**Estado:** 🟡 Supuesto

Toda venta registrada por un `seller` desde la app mobile queda asociada a él y a
su ruta abierta. No se puede registrar una venta en ruta sin ruta abierta.

**Por qué:** es lo que hace posible que la rendición cuadre al cierre.
Ver [RN-RUT-03](/dominio/rutas/).

---

### RN-VEN-07 — El cobro es un hecho separado de la venta

**Estado:** 🟡 Supuesto

Una venta a crédito genera deuda. El cobro es un documento distinto, con su
propia fecha y responsable, que reduce el saldo del cliente.

**Por qué:** modelar el cobro como un campo de la venta hace imposible registrar
pagos parciales o un pago que cubre varias ventas.

---

### RN-VEN-08 — Anulación de venta: solo el autor, comentario obligatorio

**Estado:** ✅ Confirmada — cerrá la pregunta #9 de
[Qué falta preguntar](/empezar/pendientes/).

La anulación tiene **dos invariantes** además del comentario obligatorio que
ya estaba en [RN-VEN-03](#rn-ven-03--anular-una-venta-revierte-todos-sus-efectos):

1. **Solo el autor de la venta puede anularla** (entre `seller` y `pos`).
   - `pos` **no** anula ventas hechas por `seller`.
   - `seller` **no** anula ventas hechas por `pos`.
   - El chequeo va sobre el `user_id` del autor original, sin importar bajo qué
     rol se hizo la venta (los usuarios pueden tener más de un rol —
     [RN-ACC-01](/dominio/roles-y-permisos/)).
2. **`admin` puede anular cualquier venta**, sin importar el autor ni la fecha.

**Matriz efectiva:**

| Caso | Quién puede anular | Comentario obligatorio |
| --- | --- | :-: |
| Venta del día en curso, autor = `pos` | `pos` (autor) | ✅ |
| Venta del día en curso, autor = `seller` | `seller` (autor) | ✅ |
| Venta del día en curso, autor = `admin` | `admin` | ✅ |
| Venta de día anterior, autor = `pos` | `admin` | ✅ |
| Venta de día anterior, autor = `seller` | `admin` | ✅ |
| Cualquier día, cualquier autor | `admin` | ✅ |

**El comentario NO es un campo opcional.** Sin texto, la anulación no se puede
guardar. Esto aplica igual para `admin` — quien tiene más permisos, también deja
más rastro.

**Por qué:** el comentario obligatorio es lo que hace que cualquier reversión
quede en el log con motivo legible. Si en tres meses hay que responder
"¿por qué desapareció esta venta del día?", la respuesta está en una fila del
log, no en la memoria de alguien.

---

### RN-VEN-09 — Stock validado en tiempo real al escribir la cantidad; faltante nunca es responsabilidad del `seller`

**Estado:** ✅ Confirmada — cerrá la pregunta #18 de
[Qué falta preguntar](/empezar/pendientes/).

Hay tres capas, en orden de prevención → contingencia → último recurso:

| Capa | Mecanismo |
| --- | --- |
| **Prevención** | Alertas de stock bajo → `pos` arranca producción con margen para no caer. |
| **Validación en tiempo real** | Al escribir la cantidad en la venta, comparar contra stock disponible. Si excede, **bloquear** con `Danger`. |
| **Resolución (raro)** | Si igual pasó: llamar al cliente y reprogramar entrega. |
| **Cancelación (último recurso)** | Solo si el cliente no acepta reprogramar. Generar reembolso. |
| **Devolución de fondos** | Outcome posible al anular: registra el reembolso (medio-dependiente). |

:::danger[La reserva de stock NO se construyó — decisión de M6]
La reserva de cinco minutos que describe esta regla **no existe en el sistema**,
y no es una deuda pendiente: es una decisión con razón escrita.

El descuento de stock ya es atómico desde M2 —`UPDATE … WHERE cantidad >= :n`
sobre lotes bloqueados en orden de vencimiento—, así que dos vendedores contra
la última unidad **ya están serializados por la base**: uno gana y el otro
recibe un rechazo con el número real. La reserva no agrega corrección; adelanta
el mensaje.

Y cuesta más de lo que parece: una tabla con vencimiento necesita limpieza,
semántica de expiración y una respuesta para las reservas huérfanas de alguien
que abrió la pantalla y se fue a almorzar.

En su lugar: la pantalla compara contra el saldo y avisa —informativo, y se dice
que puede estar viejo—, y al confirmar decide el descuento atómico.

Es el mismo criterio con el que esta misma documentación descartó la pantalla de
fusión de duplicados en [RN-CLI-11](/dominio/clientes/). **Si con más `seller` en
calle el caso empieza a aparecer, se reevalúa.**

Ver la [spec de M6](/superpowers/specs/2026-08-26-m6-ventas-design/#la-pieza-que-m6-decide-no-construir).
:::

#### Validación al escribir

El sistema debe **reservar** el stock por algunos minutos cuando un `seller` o
`pos` empieza a registrar una venta, para evitar race conditions entre dos
vendedores escribiendo a la vez.

```
stock_reservado = {
  cliente_id, sku_cantidad,
  expires_at: now() + 5min,
  ...
}
```

Mientras la reserva está vigente, el segundo `seller` que intente vender la
misma unidad recibe el `Danger` por stock insuficiente. Esto convierte la
concurrencia en serialización transparente.

#### Refund como outcome

La anulación de venta ahora puede tener el outcome "reembolso" además de los
existentes. La implementación depende del medio de pago:

| Medio de pago | Refund |
| --- | --- |
| **Efectivo** | Manual — se devuelve la plata; el sistema registra el movimiento |
| **Transferencia** | Integración futura con banco (no MVP) |
| **Crédito** | Automático — revierte el saldo pendiente del cliente |

#### Accountability

**`seller` NO responde por faltante.** Es un riesgo operativo del sistema de
stock, no del vendedor. La prevención es responsabilidad:
- Del **sistema**: alertas de stock que funcionen.
- Del **`pos`**: arrancar producción a tiempo.

Castigar al seller no resuelve la causa — solo esconde el síntoma.

:::tip[Catalogo de alertas]
Una página `/admin/alertas` muestra los SKUs bajo umbral con acción directa
(arrancar producción / contactar proveedor). Esto es lo que evita llegar a la
capa de validación.
:::

---

### RN-VEN-10 — Devoluciones aceptadas sin cargo al cliente

**Estado:** ✅ Confirmada — cerrá la pregunta 🟢
"¿Se aceptan devoluciones de producto, o solo anulación de la venta completa?"
de [Qué falta preguntar](/empezar/pendientes/).

Devolución y anulación son **dos flujos distintos**. La anulación
([RN-VEN-08](#rn-ven-08--anulación-de-venta-solo-el-autor-comentario-obligatorio))
cancela una venta entera; la devolución **no** la cancela — solo ajusta
inventario (y opcionalmente, el saldo deudor).

```
devolucion = {
  id: uuid,
  venta_origen_id: venta_id,
  unidades: [{ sku, lote_id, cantidad }, ...],
  motivo: string,                          // descripción libre del cliente
  registrado_por: user_id,                 // pos
  registrado_en: timestamp,
  estado_producto: "sano" | "danado" | "vencido",
  // si "vencido": descarte automático
  // si "sano": vuelve al stock del mismo lote (FIFO)
  // si "danado": dispara flujo de descarte (clasificar causa)
}
```

**Qué pasa con cada estado**:

| Estado del producto devuelto | Acción del sistema |
| --- | --- |
| `sano` | Vuelve al stock del mismo lote. Sigue su vida normal hasta vencimiento. |
| `vencido` | Descarte directo sin clasificar causa (el vencimiento es objetivo). |
| `danado` | Dispara la clasificación de causa ya existente (`falla_produccion` / `mal_manejo_cliente`) — ver [RN-STK-XX](#) sobre descarte. |

**Política de costo**: el cliente **no paga nada** por la devolución — sin
recargo, sin costo de envío, sin fee de re-stock. La operación asume el costo
interno como parte del costo de venta.

**Por qué importa distinguir de la anulación**:

- Una anulación [RN-VEN-08] es un evento único que cancela la venta entera.
- Una devolución es un evento que **no cancela la venta** — solo ajusta
  inventario y, opcionalmente, el saldo deudor (si la venta fue a crédito).
- Una venta puede tener **múltiples devoluciones parciales** sobre sus unidades,
  hasta que todas vuelvan o se decida no más.

---

### RN-VEN-11 — Factura electrónica: capturar intención desde MVP, integración con Factus post-MVP

**Estado:** ✅ Confirmada — cerrá la pregunta 🟢
"¿Se emite comprobante fiscal?" de
[Qué falta preguntar](/empezar/pendientes/).

Hoy no se emite factura electrónica. El sistema captura desde el día uno
la intención del cliente; la integración con un proveedor DIAN se difiere a
post-MVP. El usuario eligió **Factus** (plataforma colombiana de facturación
electrónica) como proveedor preferido.

```
venta = {
  ...,
  requiere_factura_electronica: bool,        // NUEVO - en la venta, no después
  factura_electronica_id: string | null,    // NUEVO - id del proveedor DIAN
  factura_electronica_pdf_url: url | null,  // NUEVO - link al PDF
  factura_electronica_cufe: string | null,  // NUEVO - código único de firma
  ...
}
```

**MVP**:
- El campo `requiere_factura_electronica` se pregunta al cliente al registrar
  la venta (o el `pos` lo pregunta por WhatsApp).
- Si es `true`, el sistema persiste el deseo en la venta.
- **No hay integración con proveedor DIAN en MVP**.

**Post-MVP — integración con Factus**:

Para activarla harán falta:
1. Registro en Factus (cuenta comercial, ambiente de pruebas + producción).
2. Obtener **Resolución de Facturación DIAN** (autorización oficial para numerar).
3. Certificar el sistema en ambiente de pruebas DIAN antes de producción.
4. Definir cómo se manda el JSON de la venta a la API de Factus.
5. Manejar reintentos (la API puede estar caída).
6. Almacenar el `cufe` resultante (código único de firma electrónica) por venta.

Alternativas si Factus no funciona: Carvajal, Siigo, Alegra, World Office.

**Por qué capturar desde MVP**: sin el campo, perdemos la información de qué
ventas querían factura. Con el campo, basta con procesar los `true`
históricos cuando llegue la integración. El `contador` también se beneficia
desde el día uno: cuando llegue el reporte de "facturas pendientes de
emitir", ya tiene los datos.

---

### RN-VEN-12 — Precios segmentados por tipo de cliente

**Estado:** ✅ Confirmada — cerrá la pregunta 🟢
"¿Hay descuentos o listas de precio por tipo de cliente?" de
[Qué falta preguntar](/empezar/pendientes/).

Cada SKU tiene **dos precios**, uno por tipo de cliente:

```
producto_sku = {
  ...,
  precio_residencial: number,
  precio_comercial: number,
  precio_minimo: number,                    // piso absoluto - ver RN-VEN-13
  ...
}

venta = {
  ...,
  tipo_cliente_al_momento: "residencial" | "comercial",  // snapshot al vender
  precio_lista_aplicado: number,            // según el tipo al momento de la venta
  ...
}
```

El precio aplicado se elige según `cliente.tipo` **al momento de la venta**.
Se congela en la venta como snapshot — si después se cambia el tipo del
cliente, las ventas históricas no se reescriben (mismo principio que
[RN-VEN-04](#rn-ven-04--el-precio-se-congela-en-el-comprobante)).

Ver [RN-CLI-16](/dominio/clientes/) sobre el atributo `cliente.tipo`.

---

### RN-VEN-13 — Códigos de descuento administrativos con piso absoluto

**Estado:** ✅ Confirmada — cerrá la pregunta 🟢
"¿Hay descuentos o listas de precio por tipo de cliente?" de
[Qué falta preguntar](/empezar/pendientes/).

Además de los precios segmentados ([RN-VEN-12](#rn-ven-12--precios-segmentados-por-tipo-de-cliente)),
hay un sistema de **códigos de descuento** administrados por `admin` que se
aplican al registrar la venta:

```
codigo_descuento = {
  codigo: string,                       // "VERANO2026"
  tipo_descuento: "porcentaje" | "monto_fijo",
  valor: number,
  aplica_a_skus: [sku] | null,          // null = todos
  puede_bajar_a_minimo: bool,
  fecha_vigencia_desde: date,
  fecha_vigencia_hasta: date,
  usos_maximos: number | null,          // null = ilimitado
  usos_realizados: number,
  creado_por: user_id,                  // admin
  ...
}

venta = {
  ...,
  descuento_codigo_id: codigo_id | null,
  descuento_monto: number,              // monto descontado al precio de lista
  precio_final: number,                 // respetando precio_minimo del SKU
  ...
}
```

**Cálculo del precio en una venta**:

```
1. precio_lista = SKU.precio_residencial o SKU.precio_comercial
                  (según cliente.tipo al momento de la venta)
2. descuento = 0 (sin código) o el valor que aplique
3. precio_final = max(precio_lista - descuento, SKU.precio_minimo)
```

**El piso absoluto** (`precio_minimo`) es la red de seguridad: un código mal
definido no puede dejar una venta a $0 o negativa. Si un cliente tiene un
código válido pero el resultado caería por debajo del piso, se cobra el piso
y el sistema avisa al `pos` que el código fue aplicado parcialmente.

**Módulo admin** (`/admin/promociones`):

- Crear / listar / desactivar códigos.
- Definir SKUs aplicables (o todos).
- Definir vigencia temporal.
- Definir uso máximo (por código o por cliente).
- Ver contador de usos en tiempo real.

**Por qué el piso y no un toggle "puede llegar a 0"**:

- El piso es explícito y auditable. Configurarlo requiere decisión humana.
- Un toggle es silencioso y propenso a olvidarse.

:::note[El piso frena descuentos, no precios escritos a mano]
[RN-VEN-15](#rn-ven-15--el-precio-se-puede-escribir-a-mano-y-entonces-es-su-propio-piso)
deja escribir el precio de una línea, y ese número pasa a ser el piso de esa
línea. No es un agujero en esta regla: el piso existe para que un código **mal
definido** no deje una venta en cero, y un precio tecleado no es un código mal
definido — es una afirmación de alguien, con su nombre en la bitácora.

Lo que sí cambia es quién sostiene la promesa. Acá la sostenía un `CHECK`, que
frena solo. Allá la sostiene una fila de auditoría, que hay que leer.
:::

:::caution[Hoy el piso está anulando todos los descuentos]
El seed carga el botellón con `precio_minimo = precio_residencial = 10000`. Con
el piso igual a la lista, el cálculo de arriba da
`max(10000 − descuento, 10000) = 10000` **siempre**: todo código descuenta $0 y
devuelve «aplicado parcialmente».

Es un dato mal cargado, no un bug — se corrige bajando `precio_minimo` en el
catálogo. Queda anotado acá porque un reporte de promociones que da cero se lee
como «nadie usó códigos» y no como «los códigos no funcionan».
:::

---

### RN-VEN-14 — Una venta se registra con la fecha del día en que ocurrió

**Estado:** ✅ Confirmada — decisión del 17-sep-2026.

La planta vende todo el día y no siempre hay alguien cargando el sistema. Con esas
ventas pasaba una de dos cosas: se cargaban con la fecha de hoy —y entonces el
reporte de agosto quedaba corto y el de septiembre inflado— o no se cargaban
nunca.

El alta acepta `ocurrioEn` en `AAAA-MM-DD`. Ausente significa hoy, que es el caso
del mostrador.

#### La fecha va a `createdAt`, no a una columna nueva

El contador, los reportes y el panel «a llamar» ya filtran por
`diaEnLaPlanta(ventas.createdAt)`. Poniendo la fecha real ahí, el reporte de
agosto incluye la venta de agosto **sin una línea de cambio** en el contador. Una
columna paralela habría obligado a decidir, en cada consulta del sistema, cuál de
las dos fechas mira — y a equivocarse en alguna.

#### Manda también sobre vencimientos y vigencias

Una venta del 31 de agosto tiene que poder salir de un lote que venció el 2 de
septiembre: ese día el producto estaba bueno. Y cobrarse con un código que vencía
el 31. Evaluar contra el reloj de quien la carga convertiría la carga tardía en un
rechazo que nadie puede explicar.

#### El stock se descuenta igual

Si la venta nunca se registró, el descuento nunca ocurrió. Hacerlo al cargarla no
cuenta dos veces: corrige lo que faltaba.

#### El día se ancla al mediodía de la planta

Un día sin hora tiene que volverse un instante. La medianoche queda a un minuto
del borde y cualquier lectura en otra zona lo corre al día anterior —el error que
[`dia.ts`](/arquitectura/) existe para evitar—. Al mediodía sobran doce horas para
cada lado.

La hora no se pide: nadie recuerda si vendió a las 14:20 o a las 15:40 de hace
tres días, y un campo que se llena con un dato inventado es peor que no tenerlo.

#### Dos guardas

| Guarda | Por qué |
| --- | --- |
| No se acepta fecha futura | Una venta que no ocurrió, con el stock descontado, es producto que sale de la bodega por algo que no pasó |
| Tope de 90 días hacia atrás | Ataja el dedazo que mandaría una venta a un ejercicio ya reportado |

El tope es una **constante**, no un parámetro: una perilla que nadie va a mover es
una perilla que puede quedar mal puesta.

#### Qué le pasa a RN-CON-02

[RN-CON-02](/dominio/contador/) dice que un reporte de agosto da lo mismo corrido
en diciembre. Esta regla la matiza: una venta cargada tarde **sí** cambia un
reporte ya emitido.

Se aceptó a propósito. RN-CON-02 asumía que toda venta se registra el día que
ocurre, y esa asunción ya era falsa en la operación real: el reporte «estable»
estaba congelando datos incompletos. Un reporte que refleja lo que de verdad se
vendió vale más que uno que no se mueve. El tope de 90 días y el registro en la
bitácora son lo que acota el costo.

---

### RN-VEN-15 — El precio se puede escribir a mano, y entonces es su propio piso

**Estado:** ✅ Confirmada — decisión del 18-sep-2026.

Aquazaku vendió durante años antes de que este software existiera, a precios que
hoy no están en ninguna tabla: $3.800, $5.500, $9.600. [RN-VEN-14](#rn-ven-14--una-venta-se-registra-con-la-fecha-del-día-en-que-ocurrió)
ya deja fechar esas ventas hacia atrás, pero se cobrarían con la lista de **hoy**
— y una venta de agosto por $10.000 que en realidad fue por $3.800 es un reporte
de agosto inventado, con la autoridad de estar en la base.

Cada producto en el mostrador lleva una casilla **«Cobré otro precio»**. Tildada,
quien registra escribe el precio por unidad que de verdad cobró, y ese número
gana sobre el catálogo.

#### El manual pasa a ser el piso de SU línea

La línea se escribe con los cuatro números congelados así:

```
precio_lista_aplicado  = 3800
descuento_monto        =    0
precio_minimo_aplicado = 3800   ← el precio pactado ES el piso de esta línea
precio_final           = 3800
precio_manual          = true
```

Los dos `CHECK` de `lineas_de_venta` se cumplen sin excepciones: `final >= mínimo`
por igualdad, y `final = lista − descuento` porque el descuento es cero.

**Por qué así y no borrando el piso:** `lineas_respetan_el_piso` es lo único que
impide una línea negativa. **No existe** un `precio_final >= 0` en la tabla — la
no-negatividad sale por transitividad de `productos_precios_no_negativos`. Sin el
piso, un código `monto_fijo` mal cargado escribe una línea en negativo sin que
nada chille. Ver [RN-VEN-13](#rn-ven-13--códigos-de-descuento-administrativos-con-piso-absoluto).

El piso del catálogo sigue cubriendo a todas las demás líneas.

#### El código de descuento no toca una línea manual

El manual es el precio que **ya se cobró**, no una lista sobre la cual negociar.
Un descuento encima lo movería a un número que nunca ocurrió. El código sigue
aplicando a las otras líneas de la misma venta.

#### La bitácora se escribe por ítem y guarda el precio de lista al lado

Una fila `ventas:precio_manual` por venta, con `{ productoId, cantidad,
precioDeLista, precioCobrado, subtotal }` de cada ítem.

Guarda el precio de lista porque lo que se audita es el **delta**: «se vendió a
3.800» ya lo dice la venta; «se vendió a 3.800 cuando la lista decía 10.000» es
lo que alguien puede mirar y preguntar.

Va por **ítem** y no por línea porque FIFO parte un pedido de 120 en una línea
por lote, y el acto humano fue uno: una casilla y un número. Una bitácora que
multiplica los hechos es peor que ninguna.

#### Lo puede hacer cualquiera que registre ventas

El permiso es `ventas:crear` — admin, `pos` y `seller` por igual. Fue una
decisión tomada a sabiendas de que un `seller` puede cobrar $10.000 y registrar
$3.800; lo que acota el costo es la fila de bitácora, no el permiso.

:::caution[Este es el control, y hay que leerlo]
A diferencia del piso, que frenaba solo, esta regla no frena nada: registra. Si
nadie mira `ventas:precio_manual`, el control no existe.
:::

#### El mostrador solo acepta pesos enteros

La card pinta «$10.000» con separador de miles, así que quien quiere poner tres
mil ochocientos escribe **«3.800»** — es lo que tiene enfrente. Contra el
`^\d+(\.\d{1,2})?$` del sistema, «3.5» **pasa** como $3,50 cuando se quería
$3.500. No falla: registra. Y [RN-VEN-02](#rn-ven-02--una-venta-confirmada-no-se-edita)
prohíbe editar una venta confirmada.

El campo descarta todo lo que no sea dígito y muestra el separador mientras se
escribe. Cuesta no poder cargar centavos desde el mostrador, que en pesos
colombianos no es un caso.

---

### RN-VEN-16 — Corregir una venta es reemplazarla, no editarla

**Estado:** ✅ Confirmada — sesión del 18-sep-2026.

Un **admin** puede corregir una venta ya registrada: el cliente, las cantidades,
los productos, el precio por unidad, el medio de pago. Lo hace desde el mismo
formulario con el que se cobró, precargado con la venta.

Al guardar, el sistema ejecuta **en una sola transacción**:

1. devuelve el producto a sus lotes de origen, como en una anulación;
2. registra una venta **nueva** con los datos corregidos, que hereda el
   **instante exacto** de la original;
3. pasa la original a estado `corregida`, con responsable, fecha y motivo
   obligatorio, y guarda el **enlace** a la que la reemplaza.

La venta vieja **no se modifica**: su total, sus líneas y sus precios congelados
quedan exactamente como estaban. Lo único que se le agrega es el hecho de haber
sido reemplazada.

**Por qué no es una edición.** Porque no hay ningún número que cambie de valor.
Hay una fila que deja de contar y otra que empieza a contar, y las dos quedan
escritas. La pregunta "¿qué pasó realmente ese día?" se sigue pudiendo
responder — ahora además se puede responder "¿y por qué esto se cargó dos
veces?", que antes no tenía respuesta.

**Por qué un estado propio y no `anulada`.** "Cuántas ventas anulamos este mes"
es una alarma operativa: mide errores de mostrador y plata devuelta. Si cada
tipeo corregido la hiciera subir, en un mes nadie la miraría.

**Por qué hereda el instante — y por qué un admin puede ajustarlo.** Por
**default** la corrección hereda el instante exacto de la venta original: corregir
el lunes una venta del sábado no puede mover esa plata al lunes, y arreglar un
tipeo no puede reescribir un reporte ya emitido, que es el costo exacto que
[RN-VEN-02](#rn-ven-02--una-venta-confirmada-no-se-edita) existe para evitar.

Pero hay un caso que la regla no quería cubrir: la venta se cargó con la fecha
equivocada en primer lugar, y la corrección es la única oportunidad de
encuadrar la plata en el día real del hecho. Por eso la corrección —y **solo**
la corrección— puede llevar un `ocurrioEn` que pasa el mismo piso de 90 días y
el mismo rechazo de futuro que [RN-VEN-14](#rn-ven-14--una-venta-se-registra-con-la-fecha-del-día-en-que-ocurrió)
le pone a una venta nueva. No esquiva el tope: lo hereda.

:::note[El override vive en el INSERT de la sucesora, no en el UPDATE de la original]
[RN-VEN-02](#rn-ven-02--una-venta-confirmada-no-se-edita) sigue intacta: la fila
original **no recibe** ningún `UPDATE` sobre `created_at`. Lo que cambia es la
fila NUEVA —su `created_at` sale de `exigirFechaRegistrable(ocurrioEn)`— y la
original pasa a `corregida` con el enlace a la sucesora. La inmutabilidad es
del registro; la corrección es de la relación entre dos.
:::

**Por qué solo el admin.** `pos` y `seller` anulan lo propio
([RN-VEN-08](#rn-ven-08--anulación-de-venta-solo-el-autor-comentario-obligatorio)),
y eso está bien. Pero corregir además **escribe una venta con la fecha de otra**,
y eso esquiva el tope de 90 días de
[RN-VEN-14](#rn-ven-14--una-venta-se-registra-con-la-fecha-del-día-en-que-ocurrió).
Colgarlo de `ventas:anular` convertiría la corrección en una puerta de atrás a
ese tope. Es una acción propia en la matriz: `ventas:corregir`.

#### Lo que la corrección NO hace

| Caso | Qué pasa | Por qué |
| --- | --- | --- |
| Venta con **devoluciones** | Se rechaza | La devolución cuelga de una línea que dejaría de contar: la deuda se descontaría dos veces. Primero se revierte la devolución. |
| **Recargo por daño** (`dano_base`) | Se rechaza | No tiene productos que rehacer ([RN-BAS-08](/dominio/bases/)). Se anula. |
| Cambiar el **cliente** de una venta que despachó botellones sin vacío o prestó una base | Se rechaza | El activo quedó a nombre del cliente original y la corrección no lo trae de vuelta: la venta quedaría a nombre de una persona y el envase a cargo de otra. |
| **Botellones y bases** de la venta corregida | No se re-emiten | Son movimientos **físicos**. El envase salió una vez y sigue afuera; volver a descontarlo del parque inventaría un envase que nunca salió. |
| Venta ya **anulada** o ya **corregida** | Se rechaza | Lo vigente es la venta que la reemplazó. Se corrige esa. |
| Override de fecha al **futuro** | Se rechaza con 422 `VENTA_EN_EL_FUTURO` | El piso de [RN-VEN-14](/dominio/ventas/) sigue valiendo dentro de la corrección. |
| Override de fecha a **más de 90 días** | Se rechaza con 422 `VENTA_DEMASIADO_VIEJA` | Mismo piso. Quien crea que hace falta un ajuste más viejo va por el camino contable, no por una venta. |
| Override de fecha en la **anulación** (`POST /ventas/:id/anulacion`) | No se acepta | Anular no lleva `ocurrioEn`. El override es exclusivo del flujo de corrección. |

Corregir una venta corregida **encadena**: cada una apunta a la anterior, y el
historial completo se puede recorrer en los dos sentidos.

:::note[RN-VEN-16-AUDIT — el payload lleva las dos fechas y los dos campos de botellones]
La acción `ventas:corregir` registra en el payload de la bitácora:

- **Ambas fechas** —`ocurrioEnAnterior` y `ocurrioEnNuevo`, ISO 8601 con offset—
  para reconstruir qué cambió sin cruzar dos filas de `ventas`. Si la
  corrección no trajo override, ambos campos valen el mismo instante.
- **Los dos campos de botellones** —`botellonesEntregados.anterior` /
  `.nuevo` y `botellonesRecibidos.anterior` / `.nuevo`— para que la auditoría
  no tenga que sumar los compensatorios `tipo='ajuste'` de
  `movimientos_botellon` para reconstruir el cambio.

La UI de auditoría los muestra hoy con `JSON.stringify` (renderer genérico,
visualmente ruidoso pero semánticamente correcto). Un renderer específico para
esta acción queda como follow-up.
:::

---

## Preguntas abiertas

*Todas las preguntas 🟢 de Ventas quedaron cerradas en la sesión del
18-ago-2026. Las nuevas reglas son RN-VEN-10 (devoluciones),
RN-VEN-11 (factura electrónica), RN-VEN-12 (precios segmentados) y
RN-VEN-13 (códigos de descuento).*

*RN-VEN-14 (ventas con fecha anterior) salió de la sesión del 17-sep-2026.*

*RN-VEN-15 (precio escrito a mano) salió de la sesión del 18-sep-2026, como la
otra mitad de RN-VEN-14: fechar la venta hacia atrás sin poder cobrar el precio
de entonces dejaba el reporte del mes igual de inventado.*

*RN-VEN-16 (corregir una venta) salió de la sesión del 18-sep-2026. Es la otra
mitad de RN-VEN-02: la regla siempre dijo cuál era la salida —anular y
rehacer— pero el sistema la dejaba en manos del operador, en dos pantallas y
sin nada que uniera las dos ventas.*

*RN-VEN-17 (botellones entregados y recibidos) salió de la sesión del 20-sep-2026.
El campo único `botellonesSinVacio` preguntaba cuántos envases salían SIN
contrapartida, y por su forma binaria escondía la verdad más común: el cliente
típico trae varios vacíos y se lleva la misma cantidad de llenos — un
intercambio que no mueve saldo. Los dos campos explícitos hacen explícito lo
que el formulario asumía.*

---

### RN-VEN-17 — Botellones entregados y recibidos

**Estado:** ✅ Confirmada — sesión del 20-sep-2026.

Toda venta que incluya líneas de producto con `presentacion='botellon'`
registra explícitamente dos cantidades en la fila de `ventas`:

- **`botellonesEntregados`** — cuántos botellones se llevan de la planta
  (cliente recibe de la empresa). Default en el formulario = total de
  botellones del carrito. Rango válido: `>= 0`.
- **`botellonesRecibidos`** — cuántos botellones devuelve el cliente en esta
  transacción. Default en el formulario = `botellonesEntregados` (caso común:
  intercambio uno a uno). Rango válido: `>= 0`.

Ambos campos son editables: el operador los ajusta cuando el caso no es
intercambio (cliente nuevo que compra sin traer vacíos, cliente que devuelve
más de lo que compra, etc.). La validación `BOTELLONES_SIN_RESPALDO` se
mantiene para `botellonesEntregados > totalBotellonesEnCarrito` — si de verdad
hacen falta envases sueltos, van por su propio camino en Retornables.

**Movimientos resultantes** (`movimientos_botellon`):

- Si `entregados > 0`: dos filas `tipo='entrega'` con `cantidad=±entregados`
  (cliente recibe `+entregados`, bodega entrega `-entregados`).
- Si `recibidos > 0`: dos filas `tipo='retorno'` con `cantidad=±recibidos`
  (cliente devuelve `-recibidos`, bodega recibe `+recibidos`).

**Corrección** (RN-VEN-16): si la corrección mueve estos dos campos, inserta
movimientos compensatorios `tipo='ajuste'` con el delta contra la original.
Los originales quedan intactos.

**Anulación** (ver `RN-ENV-09` en `botellones-y-bases`): la anulación revierte
TODAS las transacciones de la venta: `entregados` (con `tipo='retorno'`),
`recibidos` (con `tipo='entrega'`, devolviendo al cliente lo que había
traído), y la base prestada si la había. Ventas `tipo='dano_base'` se
excluyen.

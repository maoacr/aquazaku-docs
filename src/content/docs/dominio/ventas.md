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

---

## Preguntas abiertas

*Todas las preguntas 🟢 de Ventas quedaron cerradas en la sesión del
18-ago-2026. Las nuevas reglas son RN-VEN-10 (devoluciones),
RN-VEN-11 (factura electrónica), RN-VEN-12 (precios segmentados) y
RN-VEN-13 (códigos de descuento).*

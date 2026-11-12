---
title: Catálogo de módulos
description: Índice rápido de los 18 módulos que componen el sistema Aquazaku, con propósito, roles y dependencias.
sidebar:
  order: 2
---

Catálogo compacto. Para el orden de construcción, dependencias entre módulos
y estado actual, ver el [Roadmap de desarrollo](/arquitectura/roadmap/). Para
las reglas de negocio de cada módulo, ver [Dominio](/dominio/).

---

## M0 — Auth + RBAC

- **Propósito:** identidad del usuario, login, permisos por rol y por alcance
  (`todo` / `propio` / `ruta` / `BODEGA` / read-only).
- **Roles:** todos (`admin`, `seller`, `pos`, `contador`).
- **Depende de:** —
- **Doc de dominio:** [Roles y permisos](/dominio/roles-y-permisos/) — RN-ACC-01 a 07.
- **Spec de diseño:** [`/superpowers/specs/2026-08-19-auth-rbac-design.md`](/superpowers/specs/2026-08-19-auth-rbac-design)
- **Estado:** ✅ **implementado** (20-ago-2026). Las 15 tasks del plan cerradas y
  verificadas de punta a punta en el browser.
- **Qué quedó construido:**
  - `api/` — 349 tests. Schema con `audit_log` inmutable, matriz de permisos con
    alcances, middleware de sesión y permisos, Better-Auth sobre schema propio,
    recuperación de contraseña con Resend y Mailpit, rate limit, ABM de usuarios
    y consulta de auditoría con paginación por cursor.
  - `web/` — 176 tests. Helper BFF, login, recuperación y cambio de contraseña,
    shell con menú por rol, y los módulos de usuarios y auditoría.
  - Colección Bruno versionada: 12 requests, 32 aserciones, corriendo en CI
    contra un servidor real.
- **Reglas de negocio descubiertas al implementar:**
  [RN-ACC-06](/dominio/roles-y-permisos/) (siempre queda un admin activo) y
  [RN-ACC-07](/dominio/roles-y-permisos/) (un cambio de roles hace efecto en el
  acto).
- **ADR nuevos:** [ADR-0004](/decisiones/0004-audit-log-inmutable) (bitácora
  inmutable con dos capas) y [ADR-0005](/decisiones/0005-scopes-fail-closed)
  (los alcances fallan cerrados).
- **Notas:**
  - Multi-rol por usuario sin switch — todos los roles asignados están activos simultáneamente.
  - Matriz de permisos resuelta (sesión M0 del 19-ago-2026) — ver [ADR-0003](/decisiones/0003-roles-permisos-matriz).
  - Patrón BFF-native en web/ desde el inicio — ver [ADR-0002](/decisiones/0002-bff-pattern).
  - Stack: Node 22 + Fastify + Drizzle + Postgres + Better-Auth + Next.js — ver [ADR-0001](/decisiones/0001-stack-m0).
  - Defensa en profundidad: skill del proyecto + helper module + ESLint rule.
  - Alcance se aplica en una sola capa de datos (no repetido por endpoint).
  - La UI oculta módulos, la API prohíbe.
  - Auditoría consultable desde M0 (`/admin/auditoria`, `/contador/auditoria`).

## M1 — Productos y catálogo

- **Propósito:** qué se vende — pacas 600ml/300ml y botellón — con sus
  unidades por paca y conversiones a litros como dato configurable.
- **Roles:** `admin` (edita), `pos` / `seller` / `contador` (leen).
- **Depende de:** M0.
- **Doc de dominio:** [Productos y catálogo](/dominio/productos/) — RN-CAT-01 a 11.
- **Spec de diseño:** [`/superpowers/specs/2026-08-21-m1-productos-design.md`](/superpowers/specs/2026-08-21-m1-productos-design)
- **Plan de tasks:** [`/superpowers/plans/2026-08-21-m1-productos.md`](/superpowers/plans/2026-08-21-m1-productos) — 8 tasks.
- **Estado:** ✅ **implementado** (22-ago-2026). Las 8 tasks cerradas y
  verificadas contra un servidor real.
- **Notas:**
  - Una sola tabla nueva (`productos`). El precio vive ahí, no en M10.
  - El piso de precio es un `CHECK` en la base, no una validación de servicio.
  - `litros` es columna generada: no se puede desincronizar de sus entradas.
  - Extiende la matriz de permisos con `crear`, `editar` y `desactivar`.
  - RN-CAT-02 exige stock en cero para desactivar: **cerrado en M2**
    (22-ago-2026), cuando existió la tabla contra la cual verificarlo.

## M2 — Stock de producto terminado

- **Propósito:** stock por ubicación (`BODEGA` única), lotes con vencimiento
  automático a 30 días desde empaque, FIFO, bloqueo de vencidos, alertas de
  stock crítico.
- **Roles:** `admin`, `pos`, `seller` (consulta), `contador` (consulta).
- **Depende de:** M0, M1.
- **Doc de dominio:** [Stock](/dominio/stock/) — RN-STK-01, 02, 03, 05, 06, 07 y 08.
  La 04 es de insumos y pertenece a M3.
- **Spec de diseño:** [`/superpowers/specs/2026-08-22-m2-stock-design.md`](/superpowers/specs/2026-08-22-m2-stock-design)
- **Plan de tasks:** [`/superpowers/plans/2026-08-22-m2-stock.md`](/superpowers/plans/2026-08-22-m2-stock) — 9 tasks, ordenadas por costo de revertir.
- **Estado:** ✅ **implementado** (22-ago-2026). Las 9 tasks cerradas y
  verificadas contra la base: el libro explica el saldo y la cadena de auditoría
  no tiene huecos.
- **Notas:**
  - **Sin columna de ubicación**: una sola bodega y no se modela (RN-STK-01).
  - Libro de movimientos + saldo materializado en el lote. El saldo no se edita.
  - `fecha_vencimiento` se **guarda**, no se genera: cambiar la regla no puede
    reescribir el pasado.
  - La concurrencia es el problema real: dos pantallas descuentan del mismo saldo.
  - Cierra la deuda de RN-CAT-02 que dejó M1: **hecho** (22-ago-2026).

## M3 — Insumos

- **Propósito:** control de tapas, sellos termoencogibles y bolsas como
  stock. Stock mínimo configurable con default 200/200. Alerta de
  reposición.
- **Roles:** `admin`, `pos`.
- **Depende de:** M0.
- **Doc de dominio:** [Insumos](/dominio/insumos/) — RN-INS-01 a 04 (todas ✅
  confirmadas el 22-ago-2026).
- **Spec de diseño:** [`/superpowers/specs/2026-08-22-m3-insumos-design.md`](/superpowers/specs/2026-08-22-m3-insumos-design)
- **Estado:** ✅ **implementado**. El código vive en `api/src/modules/insumos`
  desde el 26-ago-2026, con su pantalla en `web/`.
- **Notas:**
  - Las bolsas se compran por kilo y se guardan por unidad
    ([RN-INS-02](/dominio/insumos/)). La conversión la hace el sistema al
    recibir la compra o al conteo físico, **no** en producción.
  - El cloro y los filtros **NO** entran al inventario — son gasto, no stock
    ([RN-INS-04](/dominio/insumos/)).
  - El stock mínimo es **configurable** desde la administración, igual que el
    aviso de vencimiento de stock ([RN-STK-11](/dominio/stock/))
    ([RN-INS-03](/dominio/insumos/)).
  - Falta la equivalencia kg→unidades para bolsas
    ([pregunta 37](/empezar/pendientes/)): hasta tenerla, el sistema no
    convierte kilos a unidades solo.

## M4 — Producción y cierre del día

- **Propósito:** tandas de procesamiento, corrida medida por caudal × tiempo,
  cierre diario que genera lote, mermas, descartes con causa obligatoria,
  mantenimiento de filtros (sedimentos, carbón, UV).
- **Roles:** `admin`, `pos`.
- **Depende de:** M0, M1, M2, M3.
- **Doc de dominio:** [Producción y agua](/dominio/produccion/) — RN-PRD-01 a 24.
- **Estado:** ✅ **implementado**. El código vive en `api/src/modules/produccion`
  desde el 26-ago-2026, con su pantalla en `web/`.
- **Notas:**
  - Tanques separados: 13.000 L cruda + 2 × 2000 L procesada.
  - Procesamiento rinde 70% (configurable).
  - Cierre diario, no por tanda (decisión del 18-ago-2026).
  - Tres efectos atómicos: − agua, − insumos, + producto.

## M5 — Clientes

- **Propósito:** alta con declaración de verificación de documento (no se
  guarda foto), ficha con saldo, segmento residencial/comercial, crédito
  opcional, bloqueo de baja con cifras (deuda, botellones, base).
- **Roles:** `admin`, `pos`, `seller`, `contador` (consulta).
- **Depende de:** M0.
- **Doc de dominio:** [Clientes](/dominio/clientes/) — RN-CLI-08, RN-CLI-12, RN-CLI-15, RN-CLI-16.
- **Estado:** ✅ **implementado**. El código vive en `api/src/modules/clientes`
  desde el 26-ago-2026, con su pantalla en `web/`. M14 lo extendió después con
  direcciones y contacto.
- **Notas:**
  - Documento único por persona (RN-CLI-08).
  - Verificación como declaración personal, no consulta externa.
  - Tipo `residencial` / `comercial` define lista de precios (RN-VEN-12).

## M6 — Ventas

- **Propósito:** venta de mostrador (POS), pedidos por WhatsApp, devoluciones
  con motivo, descuentos con código y piso absoluto, captura de intención de
  factura electrónica (emisión post-MVP con Factus).
- **Roles:** `admin`, `pos`, `seller`, `contador` (consulta).
- **Depende de:** M0, M1, M2, M5 (y M10 si se modela precio flexible desde el inicio).
- **Doc de dominio:** [Ventas](/dominio/ventas/) — RN-VEN-01 a 16.
- **Estado:** ✅ **implementado**. El código vive en `api/src/modules/ventas`
  desde el 26-ago-2026, con su pantalla en `web/`.
- **Notas:**
  - Venta confirmada es inmutable (RN-VEN-02). Anular siempre — no hay `PATCH`.
  - Corregir (RN-VEN-16) NO es editar: anula y registra una nueva, atómico y
    enlazado, y solo lo hace un admin.
  - Anulación: solo el autor, motivo obligatorio ≥ 10 caracteres (RN-VEN-08).
  - Devolución NO cancela la venta — ajusta inventario y opcionalmente saldo.

## M7 — Retornables (botellones y bases)

- **Propósito:** entrega de botellón como recarga o primera entrega, devolución,
  daño con tarifa fija como venta de concepto `dano_base`, préstamo y traza de
  bases por `id_sticker` asociado a cliente + dirección.
- **Roles:** `admin`, `pos`, `contador` (consulta).
- **Depende de:** M0, M5.
- **Doc de dominio:** [Botellones y bases](/dominio/botellones-y-bases/) — RN-ENV-* y RN-BAS-*.
- **Estado:** ✅ **implementado**. El código vive en `api/src/modules/retornables`
  desde el 26-ago-2026, con su pantalla en `web/`.
- **El nombre se resolvió construyéndolo:** es `retornables` en los dos repos
  —`api/src/modules/retornables` y `web/src/app/(app)/modulos/retornables`—.
  `entrega` quedó como nombre de los mockups de `claude-design/`.

## M8 — Rutas y seller mobile ⏸ POST-MVP

- **Propósito:** app nativa del seller con offline-first, carga de ruta,
  ventas en ruta, cierre de ruta con cuadre (producto, envases, dinero).
- **Roles:** `seller`, `admin`, `contador` (consulta).
- **Depende de:** M0, M5, M6, M7.
- **Doc de dominio:** [Rutas](/dominio/rutas/) — RN-RUT-* (referencia para el día que se implemente).
- **Estado:** ⏸ POST-MVP — diferido por decisión `estrategia/mvp-scope-web-first`.
- **Notas:**
  - En el MVP, el `seller` opera desde la web con su rol.
  - Si el seller también tiene rol `pos`, opera indistintamente desde la web
    del POS.

## M9 — Proveedores y compras

- **Propósito:** registro de proveedores y compras de insumos, con pago
  mixto contado / transferencia / crédito (raro). Sin módulo de cuentas por
  pagar completo.
- **Roles:** `admin`, `pos` (registra), `contador` (consulta).
- **Depende de:** M0, M3.
- **Doc de dominio:** [Proveedores](/dominio/proveedores/) — RN-PRO-01 a 07.
- **Estado:** ✅ **implementado**. El código vive en `api/src/modules/proveedores`
  desde el 28-ago-2026, con su pantalla en `web/`.

## M10 — Precios y promociones

- **Propósito:** dos listas de precios por SKU (`residencial` /
  `comercial`) con piso absoluto, códigos de descuento administrativos con
  vigencia, motivo y piso absoluto.
- **Roles:** `admin`, `pos`, `seller`, `contador` (consulta).
- **Depende de:** M0, M1.
- **Doc de dominio:** [Ventas §RN-VEN-12 y §RN-VEN-13](/dominio/ventas/) — precio segmentado y códigos.
- **Estado:** ✅ **entregado dentro de M1 y M6** — nunca tuvo módulo propio. El
  precio vive en el producto (M1) y el piso y los códigos de descuento se
  validan al vender (M6).
- **Notas:**
  - Piso absoluto se valida en servidor, no en UI (RN-ACC-02).
  - Cambios de lista NO reescriben ventas históricas (RN-VEN-04).

## M11 — Contador

- **Propósito:** panel de solo lectura para el `contador`: cartera por edad,
  facturas sin emitir, ventas por concepto, descargas CSV/PDF.
- **Roles:** `contador`, `admin`.
- **Depende de:** M0 + datos reales de M5, M6, M7, M9, M10.
- **Doc de dominio:** [Contador](/dominio/contador/) — RN-CON-01 a 09.
- **Estado:** ✅ **implementado**. El código vive en `api/src/modules/contador`
  desde el 30-ago-2026, con su pantalla en `web/`.
- **Notas:**
  - NO hereda permisos del `admin`.
  - Cada descarga queda en el log de auditoría (RN-ACC-04).

## M12 — Alertas

- **Propósito:** catálogo de alertas operativas (stock crítico, reposición de
  insumos, vencimiento próximo, autonomía de planta, mantenimiento de
  filtros). Alimenta al panel de planta y al panel admin.
- **Roles:** `admin` (configura umbrales), `pos` (consume y dispara).
- **Depende de:** M0, M2, M3, M4.
- **Doc de dominio:** *(a documentar)* — referencia: RN-PRD-17.
- **Estado:** ✅ **implementado**. El código vive en `api/src/modules/alertas`
  desde el 6-sep-2026, y los umbrales se configuran desde la administración.

## M13 — Auditoría

- **Propósito:** log transversal de **quién hizo qué cuándo** — toda acción
  sensible (anulación, ajuste, descarte, préstamo, cambio de precio, anulación
  con faltante, descarga de PDF) queda registrada con `user_id`, `rol_ejercido`,
  `device_type` y `timestamp`.
- **Roles:** `admin` (consulta).
- **Depende de:** M0 + transversal a todos los módulos.
- **Doc de dominio:** [Roles y permisos §RN-ACC-04](/dominio/roles-y-permisos/).
- **Estado:** ✅ **entregado dentro de M0** — `api/src/modules/audit` desde el
  20-ago-2026. Es transversal: cada módulo escribe su fila dentro de la misma
  transacción que hace el cambio ([ADR-0007](/decisiones/0007-auditoria-bloqueante)).
- **Notas:**
  - Es transversal — se implementa como middleware/log de la capa de datos.
  - Con `admin` concentrando todo el poder de corrección, la auditoría es el
    único control real (ver [Roles y permisos](/dominio/roles-y-permisos/)).

## M14 — Clientes ubicables

- **Propósito:** direcciones estructuradas en la nomenclatura colombiana
  (`CL 45 A # 12 B - 34`), municipio/departamento del DANE con ortografía
  correcta, pin arrastrable en mapa para coordenadas, y al menos un canal de
  contacto por cliente (teléfono obligatorio, dirección que **ubique**).
- **Roles:** `admin`, `pos`, `seller`, `contador` (consulta).
- **Depende de:** M0, M5.
- **Doc de dominio:** [Clientes §RN-CLI-08 a §RN-CLI-19](/dominio/clientes/).
- **Estado:** ✅ **implementado** (post-demo, 10-sep-2026). Salió de la primera
  demo con el cliente, no estaba en el roadmap.
- **Notas:**
  - `direcciones_ubicable`: la base exige **al menos uno** entre estructura,
    línea libre, indicaciones o coordenadas. Ningún campo de ubicación es
    obligatorio individualmente.
  - El pin **lo pone la persona**, no un servicio de geocodificación: las
    coordenadas son la base de M8.
  - Municipio y departamento vienen del DANE (33 / 1122), en minúscula. Las
    veredas —que el DANE no lista— se aceptan igual.

## M15 — Seguimientos

- **Propósito:** vista dedicada con la lista de **direcciones** a las que hay
  que llamar —días sin recibir, dirección, teléfonos con etiqueta, botón de
  WhatsApp. La lista completa salió del tablero; el tablero avisa con un
  pendiente que cuenta cuántas hay y lleva a la vista.
- **Roles:** `admin`, `seller`, `pos`, `contador`.
- **Depende de:** M0, M5.
- **Doc de dominio:** [Clientes §RN-CLI-18](/dominio/clientes/).
- **Estado:** ✅ **implementado** (21-sep-2026). Es el primer caso del patrón
  «sección pesada del tablero migra a módulo propio».
- **Notas:**
  - **Replanteado el 24-sep-2026.** La fila dejó de ser el cliente y pasó a ser
    la **dirección**, y la lista se partió en dos canales —botellones y otros
    productos— con un reloj cada uno. Las dos razones son la misma: la cuenta
    por cliente y el contador único **escondían filas**. El detalle está en
    RN-CLI-18.
  - `GET /clientes/a-llamar` conserva la ruta y los permisos (`clientes:ver`)
    pero **cambió de forma**: contesta `{ botellones, otros }`.
  - La vista pasó de tarjetas a **tabla densa con encabezado fijo**: 110 px por
    tarjeta contra 37 px por fila en escritorio, y con una columna de dirección
    que antes no existía. Quien la usa venía de un Excel y tenía razón en
    extrañarlo: para recorrer cuarenta filas eligiendo a quién llamar, una
    planilla es mejor herramienta que cuarenta tarjetas.
  - Abajo de 768 px la tabla **se apila** (`.aq-tabla-apilada`) en vez de
    scrollear en horizontal. Es lo contrario de lo que hace Auditoría con
    `Th fija`, y a propósito: allá la fila se lee comparándola con la de arriba,
    acá se lee sola.
  - El tablero conserva el recordatorio: `N direcciones para llamar → Ir a
    Seguimientos`, sumando los dos canales. Sin él, el tablero pierde una señal
    clara de «hay alguien a quien llamar» y el módulo queda invisible hasta que
    alguien lo abra por curiosidad.

## M16 — Alta de cliente en pasos

- **Propósito:** el alta de un cliente como un recorrido —documento primero,
  después teléfonos, después dirección— en una sola transacción.
- **Roles:** `admin`, `pos`.
- **Depende de:** M0, M5, M14.
- **Doc de dominio:** [Clientes §RN-CLI-19](/dominio/clientes/).
- **Estado:** ✅ **implementado**. El código vive en
  `web/src/components/clientes/alta-en-pasos.tsx` y en `api/src/modules/clientes`.
- **Notas:**
  - `POST /clientes` acepta el cliente, sus teléfonos y una dirección **en la
    misma transacción**: es la única puerta que tiene el `pos` para cargar esos
    datos, porque no tiene permiso sobre los endpoints sueltos (RN-CLI-19).
  - **Este catálogo lo tenía sin registrar.** Estaba documentado en
    [cómo verificar](/convenciones/como-verificar/), en el
    [checklist de despliegue](/empezar/checklist-de-despliegue/) y en el sistema
    de diseño, pero no acá — y por eso el módulo siguiente casi nace con el
    mismo número. El catálogo es el lugar donde se reserva un número; si un
    módulo no pasa por acá, el número queda libre para que alguien lo repita.

## M17 — Gastos y tesorería

- **Propósito:** registrar **todo** el dinero que entra y sale del negocio y que
  no es una venta ni una compra de mercadería: recibos públicos, arriendo,
  nómina, software, servicios, repuestos, mantenimiento, litografía, impuestos,
  equipos, muebles, transporte y comisiones bancarias. Con las cuentas donde esa
  plata vive —caja menor, caja mayor y N cuentas bancarias— y su saldo.
- **Roles:** `admin` únicamente (ver
  [Roles y permisos](/dominio/roles-y-permisos/) para el por qué).
- **Depende de:** M0. Nada más — y es deliberado: no depende de M11 ni del rol
  `contador`, ni de ninguna norma tributaria.
- **Doc de dominio:** [Gastos y tesorería](/dominio/gastos/) — RN-GAS-01 a 10.
- **Estado:** 🚧 **tramo 1 en construcción** (12-nov-2026). El código vive en
  `api/src/modules/gastos`, con su pantalla en `web/`.
- **Notas:**
  - **Un solo libro.** `movimientos_de_dinero` es la única forma de mover plata.
    No hay tabla de gastos ni de ingresos: un gasto no tiene líneas —si moviera
    inventario sería una compra— así que una tabla aparte solo agregaría una
    segunda copia del monto. Es la ley de conservación de los botellones
    aplicada al dinero.
  - **El saldo se deriva**, por [ADR-0008](/decisiones/0008-saldo-derivado-o-materializado/):
    nadie se pelea por el último peso de la caja. El sobregiro lo frena un
    `FOR UPDATE` sobre la cuenta, que serializa sin materializar nada.
  - **El signo es columna generada.** Anular pone el efecto en cero, así que el
    movimiento sale del saldo por aritmética — sin escribir en ninguna otra
    tabla y sin poder quedar a medias.
  - **El doble conteo con M9 es imposible por construcción**: el enum de tipos de
    gasto no incluye insumos, bases ni botellones (RN-GAS-07). No se evita con
    disciplina — no hay dónde escribirlo.
  - **El tipo registra el hecho, no la clasificación contable.** `clasificacion`
    existe y nace en `NULL`: registrar el hueco en vez de inventar la respuesta
    de una contadora es lo que permite construir el módulo hoy (RN-GAS-06).
  - Desbloquea los **ocho tipos de gasto que no tenían dónde entrar**. El cloro
    y los filtros son el caso más claro: [RN-INS-04](/dominio/insumos/) dice que
    son gasto y no inventario, y hasta ahora eso era cierto porque no había
    dónde registrarlos.
  - **Tramo 2 (pendiente):** traslados entre cajas y arqueo. Los cuatro tipos de
    movimiento que usan están declarados en el enum desde el primer día, con sus
    `CHECK` y su índice único, para que el tramo 2 sea puramente aditivo.

---

## Resumen de dependencias

```
M0 ─┬─▶ M1 ─┬─▶ M2 ──┐
    │       ├─▶ M3 ──┼─▶ M4
    │       └─────────┘
    ├─▶ M5 ──┬─▶ M6 (necesita M1, M2, M10)
    │        └─▶ M7
    └─▶ M10 (necesita M1)

M8 (POST-MVP) ◀── M0, M5, M6, M7
M9 ◀── M0, M3
M11 ◀── M0 + datos de M5, M6, M7, M9, M10
M12 ◀── M0, M2, M3, M4
M13 ◀── M0 (transversal)
M17 ◀── M0 (autónomo: no depende de M11 ni del rol contador)
```

Para el orden exacto de construcción y los criterios de cadencia, ver el
[Roadmap de desarrollo](/arquitectura/roadmap/).

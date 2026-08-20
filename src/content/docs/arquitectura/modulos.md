---
title: Catálogo de módulos
description: Índice rápido de los 14 módulos que componen el sistema Aquazaku, con propósito, roles y dependencias.
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
- **Doc de dominio:** [Roles y permisos](/dominio/roles-y-permisos/) — RN-ACC-01 a 05.
- **Spec de diseño:** [`/superpowers/specs/2026-08-19-auth-rbac-design.md`](/superpowers/specs/2026-08-19-auth-rbac-design)
- **Estado:** ✅ diseñado (pendiente implementación).
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
- **Doc de dominio:** *(a documentar)* — base en RN-PRD-01.
- **Estado:** 🔲 pendiente.

## M2 — Stock de producto terminado

- **Propósito:** stock por ubicación (`BODEGA` única), lotes con vencimiento
  automático a 30 días desde empaque, FIFO, bloqueo de vencidos, alertas de
  stock crítico.
- **Roles:** `admin`, `pos`, `seller` (consulta), `contador` (consulta).
- **Depende de:** M0, M1.
- **Doc de dominio:** [Stock](/dominio/stock/) — RN-STK-01 a 07.
- **Estado:** 🔲 pendiente.

## M3 — Insumos

- **Propósito:** control de tapas, sellos termoencogibles y bolsas como
  stock. Stock mínimo configurable con default sugerido 200/200. Alerta de
  reposición.
- **Roles:** `admin`, `pos`.
- **Depende de:** M0.
- **Doc de dominio:** *(a documentar)* — base en RN-STK-04 y RN-PRD-09.
- **Estado:** 🔲 pendiente.
- **Pendiente:** confirmar default 200/200 con Aquazaku.

## M4 — Producción y cierre del día

- **Propósito:** tandas de procesamiento, corrida medida por caudal × tiempo,
  cierre diario que genera lote, mermas, descartes con causa obligatoria,
  mantenimiento de filtros (sedimentos, carbón, UV).
- **Roles:** `admin`, `pos`.
- **Depende de:** M0, M1, M2, M3.
- **Doc de dominio:** [Producción y agua](/dominio/produccion/) — RN-PRD-01 a 24.
- **Estado:** 🔲 pendiente.
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
- **Estado:** 🔲 pendiente.
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
- **Doc de dominio:** [Ventas](/dominio/ventas/) — RN-VEN-01 a 13.
- **Estado:** 🔲 pendiente.
- **Notas:**
  - Venta confirmada es inmutable (RN-VEN-02). Anular siempre.
  - Anulación: solo el autor, motivo obligatorio ≥ 10 caracteres (RN-VEN-08).
  - Devolución NO cancela la venta — ajusta inventario y opcionalmente saldo.

## M7 — Retornables (botellones y bases)

- **Propósito:** entrega de botellón como recarga o primera entrega, devolución,
  daño con tarifa fija como venta de concepto `dano_base`, préstamo y traza de
  bases por `id_sticker` asociado a cliente + dirección.
- **Roles:** `admin`, `pos`, `contador` (consulta).
- **Depende de:** M0, M5.
- **Doc de dominio:** [Botellones y bases](/dominio/botellones-y-bases/) — RN-ENV-* y RN-BAS-*.
- **Estado:** 🔲 pendiente.
- **Nombre pendiente:** ¿`retornables` o `entrega`? Coexisten en el repo;
  unificar antes de la spec.

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
- **Doc de dominio:** [Proveedores](/dominio/proveedores/) — RN-PRO-* (a documentar).
- **Estado:** 🔲 pendiente.

## M10 — Precios y promociones

- **Propósito:** dos listas de precios por SKU (`residencial` /
  `comercial`) con piso absoluto, códigos de descuento administrativos con
  vigencia, motivo y piso absoluto.
- **Roles:** `admin`, `pos`, `seller`, `contador` (consulta).
- **Depende de:** M0, M1.
- **Doc de dominio:** [Ventas §RN-VEN-12 y §RN-VEN-13](/dominio/ventas/) — precio segmentado y códigos.
- **Estado:** 🔲 pendiente.
- **Notas:**
  - Piso absoluto se valida en servidor, no en UI (RN-ACC-02).
  - Cambios de lista NO reescriben ventas históricas (RN-VEN-04).

## M11 — Contador

- **Propósito:** panel de solo lectura para el `contador`: cartera por edad,
  facturas sin emitir, ventas por concepto, descargas CSV/PDF.
- **Roles:** `contador`, `admin`.
- **Depende de:** M0 + datos reales de M5, M6, M7, M9, M10.
- **Doc de dominio:** *(a documentar)*.
- **Estado:** 🔲 pendiente.
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
- **Estado:** 🔲 pendiente.

## M13 — Auditoría

- **Propósito:** log transversal de **quién hizo qué cuándo** — toda acción
  sensible (anulación, ajuste, descarte, préstamo, cambio de precio, anulación
  con faltante, descarga de PDF) queda registrada con `user_id`, `rol_ejercido`,
  `device_type` y `timestamp`.
- **Roles:** `admin` (consulta).
- **Depende de:** M0 + transversal a todos los módulos.
- **Doc de dominio:** [Roles y permisos §RN-ACC-04](/dominio/roles-y-permisos/).
- **Estado:** 🔲 pendiente.
- **Notas:**
  - Es transversal — se implementa como middleware/log de la capa de datos.
  - Con `admin` concentrando todo el poder de corrección, la auditoría es el
    único control real (ver [Roles y permisos](/dominio/roles-y-permisos/)).

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
```

Para el orden exacto de construcción y los criterios de cadencia, ver el
[Roadmap de desarrollo](/arquitectura/roadmap/).

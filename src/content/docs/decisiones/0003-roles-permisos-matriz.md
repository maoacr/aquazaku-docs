---
title: ADR-0003 — Matriz de permisos resuelta y multi-rol sin switch
description: Las celdas ⚠️ de la matriz quedan resueltas, se agregan permisos nuevos para ventas y auditoría, y se elimina el switch-role.
---

**Estado:** Aceptado
**Fecha:** 2026-08-19
**Deciden:** Mao (product owner), asistente AI

## Contexto

El documento `/docs/dominio/roles-y-permisos.md` tenía la matriz de permisos
marcada como "borrador nuestro" con **4 celdas ⚠️** que requerían revisión
antes de implementar:

- `ventas:anular` (ventas y cobros)
- `stock:cargar_ruta` (stock de producto)
- `bases:prestar` (bases)
- `compras:recibir` (proveedores y compras)

Durante la sesión de diseño de M0 (19-ago-2026) se resolvió cada celda. Además:

1. Apareció la necesidad de un **state machine de ventas** que reemplaza la
   restricción "mismo día en curso" (que falla en bordes temporales).
2. Se agregó el permiso **`auditoria:ver`** para que el `contador` pueda
   consultar la auditoría (read-only) para temas DIAN.
3. Se confirmó que **no existe switch-role** — todos los roles asignados
   están activos simultáneamente.

## Decisiones

### 1. Multi-rol sin switch

**Un usuario con N roles ve y opera todos los módulos correspondientes sin
elegir uno.** No existe `active_role`, no hay selector de rol, no hay
`POST /auth/switch-role`.

- En backend: `sessions.roles` es `text[]` (todos los roles asignados).
- En frontend: la sidebar muestra todos los módulos para los que el usuario
  tiene al menos un rol con permiso.
- En auditoría: `rol_ejercido` es `text[]` (los roles bajo los que se
  ejecutó la acción específica, no un único rol "activo").

### 2. State machine de ventas (forward-looking, M2)

Reemplaza la regla "mismo día en curso" por una basada en estado de la venta:

```
REGISTRADA
  ├─ pago total  →  status=pendiente_verificacion_pago (+ payment_method)
  └─ pago parcial → status=abono_pendiente_por_verificar (+ saldo)
                          ↓ (verificador confirma recepción)
                    status=parcial_verificado / pago_verificado
                          ↓ (>7 días sin verificar)
                    status=vencida (+ alerta al admin)
                          ↓ (admin anula con motivo)
                    status=anulada_con_devolucion
```

Quién puede hacer qué:
- Mientras `pendiente_*`: mismo userId que registró o admin puede modificar/anular
- Una vez `pago_verificado`: solo admin puede anular, motivo obligatorio,
  registra devolución
- `parcial_verificado`: saldo queda visible hasta cancelación total

**Quiénes pueden verificar el pago:**
- Admin: cualquier venta (separación de funciones cuando se necesita)
- Seller/Pos: ventas que ellos mismos registraron (operación normal)
- Pago parcial NO se puede anular — queda como crédito a favor

**Job nocturno:** ventas pendientes >7 días → marca `vencida` + alerta al admin.

### 3. Resolución de celdas ⚠️

| Permiso | Antes | Ahora |
|---|---|---|
| `ventas:anular` | `seller`/`pos`: `propio + día_en_curso` | `seller`/`pos`: `propio + status=pendiente`. Admin: todo. |
| `stock:cargar_ruta` | Sin detalles sobre seller | Confirmado: `seller` ❌, `pos` ✅, admin ✅. Un seller sin rol pos no puede cargar stock a ruta. |
| `bases:prestar` | Pos con `cliente verificado` (constraint) | Sin cambios en la regla; documentado que la verificación es prerrequisito. |
| `compras:recibir` | Pos sin restricciones | Pos solo si compra=pendiente Y proveedor=activo. Admin sin restricción. |

### 4. Permisos nuevos

| Permiso | admin | seller | pos | contador |
|---|---|---|---|---|
| `ventas:anular_verificada` | ✅ todo (motivo obligatorio) | ❌ | ❌ | ❌ |
| `ventas:verificar_pago` | ✅ todo | 🟡 propio | 🟡 propio | ❌ |
| `ventas:gestionar_cuentas_pendientes` | ✅ todo | ❌ | ❌ | ❌ |
| `auditoria:ver` | ✅ todo | ❌ | ❌ | ✅ todo (read-only) |

### 5. RN-ACC-04 confirmada

La regla "toda acción sensible queda auditada" pasa de `🟡 Supuesto` a
`✅ Confirmada`. La implementación incluye **consulta UI** (no solo el log
interno): `/admin/auditoria` para admin, `/contador/auditoria` para contador
read-only.

## Consecuencias

**Se vuelve fácil:**
- Modificar ventas propias sin pedir admin (UX amable)
- Tener un contador externo que ve la auditoría sin poder modificar nada
  (separa funciones para DIAN)
- Auditar "qué hizo este usuario como seller" filtrando el log
- Cambiar la matriz sin tocar 50 endpoints (la UNA capa `scopedQuery`)

**Se vuelve difícil / costoso:**
- El state machine de ventas requiere M2 completo (no es M0)
- El módulo `/admin/cuentas-pendientes` también es M2
- Job nocturno de ventas vencidas es M2

**Lo que aceptamos pagar:**
- Mayor complejidad del dominio `ventas` (state machine con 5 estados)
- La auditoría consultable es UI que entra en M0 (no se difiere)

## Referencias

- Matriz completa actualizada: [`/dominio/roles-y-permisos.md`](/dominio/roles-y-permisos/)
- Spec de M0 con detalles de implementación: [`/superpowers/specs/2026-08-19-auth-rbac-design.md`](/superpowers/specs/2026-08-19-auth-rbac-design)
- Stack y patrones: [ADR-0001](/decisiones/0001-stack-m0), [ADR-0002](/decisiones/0002-bff-pattern)

---
title: Permisos por módulo
description: Matriz de permisos por rol y módulo, citando ADR-0003.
sidebar:
  order: 2
---

# Permisos por módulo

Quién puede hacer qué. Cita las decisiones clave del
[ADR-0003](/decisiones/0003-roles-permisos-matriz/), que resolvió las
cuatro celdas `⚠️` del documento original.

[Ver diagrama en pantalla completa →](/diagramas/aquazaku-permisos.html){target="\_blank"}

<iframe src="/diagramas/aquazaku-permisos.html" width="100%" height="640" style="border: 0;"></iframe>

## Permisos clave resueltos

| Permiso | Quién | Quién **no** | ADR-0003 |
| --- | --- | --- | --- |
| `ventas:anular` | POS | seller (para que no anule sus propias ventas) | ✅ |
| `stock:cargar_ruta` | seller | admin (es territorial, no global) | ✅ |
| `bases:prestar` | POS, seller | admin (no presta bases) | ✅ |
| `compras:recibir` | admin, POS | seller (no hace compras en la calle) | ✅ |
| `auditoria:ver` | contador (read-only) | cualquiera que pueda mutar | ✅ |

:::note[Por qué `ventas:anular` no es para el seller]
Si el seller pudiera anular sus propias ventas, podría cobrar y
desaparecer la transacción antes de que cierre el día. El POS tiene
ese permiso porque ve la transacción desde la planta, donde la auditoría
está presente. El seller anula desde la calle solo si la app lo permite
explícitamente — y en la primera versión, no.
:::

:::caution[El state machine de ventas reemplaza "mismo día en curso"]
La regla original "solo se puede anular el mismo día en curso" fallaba
en bordes temporales (un pago a las 23:59 contra una venta de ayer
parecía inválido aunque no lo fuera). El state machine
(REGISTRADA → PENDIENTE_PAGO → COMPLETADA) la reemplaza: las anulaciones
están atadas al estado, no al reloj. Ver [ciclo de venta](./ciclo-de-venta).
:::

## Multi-rol sin switch

Un usuario con N roles ve y opera todos los módulos correspondientes **sin
elegir uno**. No existe `active_role`, no hay selector de rol, no hay
`POST /auth/switch-role`.

- En backend: `sessions.roles` es `text[]` (todos los roles asignados).
- En frontend: la sidebar muestra todos los módulos para los que el
  usuario tiene al menos un rol con permiso.
- En auditoría: `rol_ejercido` es `text[]` (los roles bajo los que se
  ejecutó la acción específica, no un único rol "activo").

## Cómo se implementa

Cada endpoint del backend declara sus permisos requeridos. El middleware
de authz valida que el usuario tenga **al menos uno** de los roles con el
permiso. Si no, devuelve 403 con detalle del permiso faltante. La
auditoría registra qué permisos se ejercieron, no solo el rol.

---
title: Flujos por rol
description: Qué hace cada rol en Aquazaku — admin, seller, POS, contador.
sidebar:
  order: 1
---

# Flujos por rol

Cuatro roles. Multi-rol sin switch (un usuario con varios roles ve y opera
todos los módulos que le tocan, sin elegir uno).

[Ver diagrama en pantalla completa →](/diagramas/aquazaku-roles.html){target="\_blank"}

<iframe src="/diagramas/aquazaku-roles.html" width="100%" height="640" style="border: 0;"></iframe>

## Quién hace qué

| Rol | Opera | No opera |
| --- | --- | --- |
| **Admin** | Configura el sistema: usuarios, productos, alertas, parámetros. | No vende ni opera la planta. |
| **Seller** | Visita clientes en la calle. Registra con documento 'dictado' (no inventado), vende recargas, asigna bases a su ruta. | No anula ventas, no accede a la auditoría. |
| **POS** | Opera la planta. Cobra, entrega/devuelve botellones, anula ventas (con permiso `ventas:anular`). | No configura el sistema, no asigna stock a rutas. |
| **Contador** | Extrae reportes (CSV/PDF), abre la auditoría si hay discrepancia, consulta stock y proveedores. | No vende, no opera, no anula. |

:::note[Multi-rol sin switch (ADR-0003)]
Un usuario con N roles ve y opera todos los módulos que le tocan, sin elegir
uno. No existe `active_role`, no hay selector de rol.

- En backend, `sessions.roles` es `text[]` (todos los roles asignados).
- En frontend, la sidebar muestra todos los módulos accesibles.
- En auditoría, `rol_ejercido` es `text[]` (los roles bajo los que se
  ejecutó la acción, no un único rol "activo").
:::

## La diferencia entre seller y POS

El seller **visita clientes en la calle**. Registra con documento dictado
(no inventado) y vende botellones. Sincroniza antes de salir y al mediodía
— la verificación de duplicados es local hasta que vuelva a la planta.
La verificación oficial queda pendiente hasta que el cliente vuelva.

El POS **opera la planta**. Registra clientes con documento cotejado,
ventas con stock fresco, devoluciones que revierten stock. La auditoría
guarda el método (`seller_manual`, `pos_manual`, `admin_oficial`) y el
rol ejercido.

:::caution[¿Por qué no se mezclan?]
Si un seller pudiera también operar la planta, su propia venta podría
ser anulada por sí mismo (mismo rol). La separación seller/POS es la
garantía de que un vendedor no aprueba sus propias excepciones.
:::

Ver también: [Permisos por módulo](./permisos).

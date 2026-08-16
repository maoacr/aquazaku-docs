---
title: Backend
description: API, autenticación y permisos del sistema Aquazaku.
sidebar:
  order: 1
---

Documentación del proyecto `api/`: contratos, endpoints, autenticación y el
esquema de permisos por rol.

## Qué documentar acá

- **Referencia de API** — endpoints, request/response, códigos de error.
  Un endpoint sin documentar no está terminado.
- **Autenticación** — cómo se emite y renueva el token, cómo se cierra sesión.
- **Autorización** — cómo se implementa el modelo de permisos.

  :::note[Fuente única de verdad]
  La matriz de roles × permisos **no se duplica acá**. Vive en
  [Dominio → Roles y permisos](/dominio/roles-y-permisos/), porque es una regla
  de negocio, no una decisión de implementación.

  Esta sección documenta *cómo* se aplica esa matriz: middleware, claims del
  token y dónde se resuelve el filtro de alcance
  ([RN-ACC-03](/dominio/roles-y-permisos/)).
  :::
- **Errores** — catálogo de códigos y qué significa cada uno para el cliente.

:::note[Proyecto no iniciado]
El proyecto `api/` todavía no existe. Esta sección se llena cuando arranque.
:::

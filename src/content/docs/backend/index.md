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

## Estado actual

**M0 — Auth + RBAC: ✅ implementado** (20-ago-2026). 349 tests, verificado de
punta a punta contra `web/` en un browser real.

Repositorio: [`aquazaku-api`](https://github.com/maoacr/aquazaku-api).

### Qué expone hoy

| Endpoint | Quién puede | Notas |
|---|---|---|
| `GET /health` | cualquiera | Señal de vida |
| `POST /api/auth/sign-in/email` | cualquiera | Better-Auth. Límite: 5 intentos / 15 min |
| `POST /api/auth/request-password-reset` | cualquiera | Límite: 3 / 15 min |
| `POST /api/auth/reset-password` | con token | Cierra todas las sesiones |
| `GET /auth/me` | con sesión | Perfil + roles + permisos resueltos |
| `POST /auth/sign-out` | con sesión | |
| `POST /auth/change-password` | con sesión | Exige la contraseña actual |
| `GET /users`, `GET /users/:id` | `usuarios:ver` | Incluye los roles |
| `POST /users` | `usuarios:crear` | |
| `PATCH /users/:id` | `usuarios:editar` | Desactivar cierra sus sesiones |
| `PUT /users/:id/roles` | `usuarios:editar` | Idempotente; hace efecto en el acto |
| `GET /audit` | `auditoria:ver` | Filtros + paginación por cursor |
| `GET /productos` | `productos:ver` | `?estado=activos\|inactivos\|todos`, por defecto `activos` |
| `GET /productos/:id` | `productos:ver` | |
| `POST /productos` | `productos:crear` | El código lo genera el sistema (RN-CAT-11) |
| `PATCH /productos/:id` | `productos:editar` | Solo el nombre — **no toca precios** |
| `PATCH /productos/:id/precios` | `productos:editar_precios` | Los tres juntos. Audita antes y después |
| `POST /productos/:id/desactivar` | `productos:desactivar` | |
| `POST /productos/:id/reactivar` | `productos:desactivar` | |

:::note[Por qué el catálogo no tiene `DELETE`]
Un `DELETE /productos/:id` diría que el producto desaparece, y eso es justo lo
que [RN-CAT-02](/dominio/productos/) prohíbe. El verbo tiene que contar la
verdad de lo que pasa, así que desactivar es un `POST` a su propia ruta.

Está garantizado en tres capas: la base le revocó el privilegio al rol de la
aplicación, el servicio no expone el método y la ruta no existe.
:::

:::caution[Precios: ruta aparte, permiso aparte]
Cambiar precios **no** entra en el `PATCH` general. Si entrara,
`productos:editar` daría acceso a lo que `productos:editar_precios` protege, y
la matriz de permisos dejaría de significar lo que dice.

Los tres precios viajan juntos y ninguno es opcional: permitir cambiar uno solo
obligaría a leer los otros dos de la base para verificar el piso, y abriría una
ventana entre esa lectura y el `UPDATE`.
:::

Todos menos los tres primeros pasan por `requireAuth` y `requirePermission`.

### Módulos

- **`modules/authz/`** — matriz de permisos ejecutable, alcances, `can()`,
  `scopedCondition()`, middleware y emisión de auditoría. La matriz es una
  transcripción 1-a-1 de [Roles y permisos](/dominio/roles-y-permisos/), y un
  test la verifica celda por celda contra una lista derivada del documento.
- **`modules/auth/`** — Better-Auth sobre el schema propio, transportes de
  correo (Resend y Mailpit) y límite de intentos.
- **`modules/users/`** — ABM con la protección del último administrador.
- **`modules/audit/`** — consulta de la bitácora.

### Códigos de error

| Código | Status | Cuándo |
|---|---|---|
| `UNAUTHENTICATED` | 401 | No vino cookie de sesión |
| `SESSION_EXPIRED` | 401 | Vino una que el servidor ya no acepta |
| `USER_INACTIVE` | 401 | La cuenta fue desactivada (RN-ACC-05) |
| `FORBIDDEN` | 403 | Autenticado, sin permiso. Queda auditado |
| `AUDIT_UNAVAILABLE` | 500 | No se pudo auditar una acción sensible, así que no se ejecutó — [ADR-0007](/decisiones/0007-auditoria-bloqueante/) |
| `RATE_LIMITED` | 429 | Trae `retry-after` y `reintentarEn` |
| `VALIDATION_ERROR` | 400 | Con detalle por campo |
| `ULTIMO_ADMIN` | 409 | Dejaría el sistema sin administrador (RN-ACC-06) |
| `EMAIL_EN_USO` | 409 | El email ya existe (`citext`: choca sin importar el case) |
| `PRODUCTO_NO_ENCONTRADO` | 404 | |
| `PRECIO_MINIMO_INVALIDO` | 422 | El piso superaría un precio de lista (RN-CAT-04) |
| `PRODUCTO_YA_INACTIVO` | 409 | Desactivar uno que ya lo estaba |
| `PRODUCTO_YA_ACTIVO` | 409 | Reactivar uno que ya lo estaba |

### Cómo explorarlo

Hay una colección de Bruno versionada en el repo:
[Explorar la API con Bruno](/backend/exploracion-api/).

### Decisiones que salieron de implementar

- [ADR-0004](/decisiones/0004-audit-log-inmutable) — `audit_log` inmutable con
  dos capas independientes.
- [ADR-0005](/decisiones/0005-scopes-fail-closed) — los alcances fallan cerrados.
- [RN-ACC-06](/dominio/roles-y-permisos/) y
  [RN-ACC-07](/dominio/roles-y-permisos/) — dos reglas de negocio que aparecieron
  construyendo.

### Referencias de diseño

- [Spec de M0](/superpowers/specs/2026-08-19-auth-rbac-design) — el **plan**
  tiene además notas de ejecución task por task, con lo que hubo que corregir.
- [ADR-0001](/decisiones/0001-stack-m0) — stack.
- [ADR-0003](/decisiones/0003-roles-permisos-matriz) — matriz y multi-rol.

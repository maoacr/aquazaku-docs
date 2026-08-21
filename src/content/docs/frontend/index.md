---
title: Frontend
description: Panel de administración web de Aquazaku.
sidebar:
  order: 1
---

Documentación del proyecto `web/`: el panel de administración que usa la oficina.

## Qué documentar acá

- **Stack y estructura de carpetas** — y la razón de esa estructura.
- **Sistema de diseño** — componentes, tokens, criterios de composición.
- **Manejo de estado y datos** — cómo se consume la API y dónde vive el estado.
- **Rutas y permisos en UI** — qué ve cada rol. La UI oculta; la API prohíbe.
  Las dos capas, siempre.

## Estado actual

**M0 — Auth + RBAC: ✅ implementado** (20-ago-2026). 176 tests, verificado en el
browser contra `api/` real.

Repositorio: [`aquazaku-web`](https://github.com/maoacr/aquazaku-web).

### Pantallas

| Ruta | Quién entra | Qué hace |
|---|---|---|
| `/login` | cualquiera | Ingreso. Distingue credenciales inválidas de cuenta desactivada y de límite de intentos |
| `/forgot-password` | cualquiera | Pide el correo de recuperación |
| `/reset-password?token=…` | con token | Destino del link del correo |
| `/change-password` | con sesión | Primer ingreso forzado (spec §7.2) |
| `/` | con sesión | Dashboard |
| `/modulos/usuarios` | `admin` | Alta, roles y estado |
| `/modulos/auditoria` | `admin` | Bitácora con filtros |
| `/contador/auditoria` | `contador` | La misma vista, por su propia puerta |

Todo lo que requiere sesión vive bajo el route group `(app)`, que no agrega
segmento a la URL. El guard está en su layout: **una pantalla nueva nace
protegida** sin que su autor tenga que acordarse de nada.

### Estructura

```
src/
├── app/
│   ├── (auth)/          ← sin sesión: login, recuperación, cambio
│   └── (app)/           ← con sesión: guard + shell + módulos
│       ├── layout.tsx   ← sesión, primer ingreso y sidebar
│       └── error.tsx    ← distingue 403 de 5xx
├── components/
└── lib/
    ├── api-server.ts    ← el ÚNICO lugar donde se llama fetch()
    ├── api-types.ts     ← las formas que devuelve api/
    └── modules.ts       ← qué módulos ve cada rol
```

### Las tres capas del patrón BFF

Ninguna alcanza sola; ver [Patrón BFF](/frontend/bff-pattern/):

1. **Skill del proyecto** — atrapa al asistente antes de que escriba el
   anti-patrón.
2. **`apiServerFetch()`** — reenvía cookies, propaga `x-request-id`, declara el
   `Origin` y nunca cachea datos de sesión.
3. **Regla de ESLint** — prohíbe `fetch()` directo, `localStorage` y
   `sessionStorage`. Corre en CI: si no corriera, la capa no existiría.

### Manejo de errores

`apiServerFetch` lanza `ApiError` con el status. El boundary de `(app)` lee el
`digest` —lo único que sobrevive a producción, porque Next borra `message` y
`stack`— y distingue:

- **401** → el layout manda a `/login`.
- **403** → pantalla de "no tenés acceso", no un redirect silencioso.
- **5xx** → aviso genérico con el código para pasarle a soporte.

### Sin TanStack Table todavía

Está en el stack y en M1+ se gana el lugar: las tablas de ventas y stock van a
ordenar y filtrar del lado del cliente. Las de M0 no hacen ninguna de las dos
cosas —los filtros los resuelve `api/` y la paginación es por cursor—, así que
usarlo solo mandaría la librería al browser para renderizar celdas estáticas.

### Referencias de diseño

- [Spec de M0](/superpowers/specs/2026-08-19-auth-rbac-design)
- [ADR-0001](/decisiones/0001-stack-m0) — stack.
- [ADR-0002](/decisiones/0002-bff-pattern) — patrón BFF.
- [Brief de diseño](/frontend/brief-de-diseno/).

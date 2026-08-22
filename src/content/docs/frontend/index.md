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

**Al 22-ago-2026:**

- **M0 — Auth + RBAC**: ✅ implementado (20-ago-2026)
- **M1 — Productos y catálogo**: ✅ implementado (22-ago-2026)
- **M2 — Stock de producto terminado**: ✅ implementado (22-ago-2026)
- **Fase de diseño**: ✅ aplicada (22-ago-2026) — marca real, vidrio y agua,
  semáforo de estados, vacíos diferenciados, errores sin jerga, voz de usted,
  accesibilidad medida (anillo de foco y objetivos táctiles).

**434 tests** en `web/`, verificados en el browser contra `api/` real.

Repositorio: [`aquazaku-web`](https://github.com/maoacr/aquazaku-web).

### Pantallas

| Ruta | Quién entra | Qué hace |
|---|---|---|
| `/login` | cualquiera | Ingreso. Distingue credenciales inválidas de cuenta desactivada y de límite de intentos |
| `/forgot-password` | cualquiera | Pide el correo de recuperación |
| `/reset-password?token=…` | con token | Destino del link del correo |
| `/change-password` | con sesión | Primer ingreso forzado (spec §7.2) |
| `/` | con sesión | Dashboard |
| `/modulos/productos` | **los cuatro roles** | Catálogo en lectura: código, litros y precios |
| `/modulos/stock` | **los cuatro roles** | Total, vendible y vencido por producto |
| `/modulos/stock/[productoId]` | **los cuatro roles** | Lotes en orden FIFO; formularios según permiso |
| `/modulos/productos/gestion` | `admin` | Alta, precios y activación |
| `/modulos/usuarios` | `admin` | Alta, roles y estado |
| `/modulos/auditoria` | `admin` | Bitácora con filtros |
| `/contador/auditoria` | `contador` | La misma vista, por su propia puerta |

Todo lo que requiere sesión vive bajo el route group `(app)`, que no agrega
segmento a la URL. El guard está en su layout: **una pantalla nueva nace
protegida** sin que su autor tenga que acordarse de nada.

:::tip[El catálogo es la primera pantalla que ven `pos` y `seller`]
Hasta M0 esos dos roles entraban a un menú vacío. `productos:ver` lo tienen los
cuatro ([RN-CAT-06](/dominio/productos/)) porque un `pos` que no ve precios no
puede vender, y el `contador` los necesita para leer un comprobante.

El link a **Gestionar catálogo** aparece solo si el usuario tiene
`productos:editar_precios`, pero eso es cosmética: quien entre a la URL a mano
igual recibe **403** de `api/` ([RN-ACC-02](/dominio/roles-y-permisos/)).
:::

:::caution[El aviso mira si el producto se puede vender, no si le falta el precio]
Salió de verificar el flujo real, no de un test. Al cargarle el precio a una
paca sembrada desactivada, el aviso de "esperando precio" **se apagaba** y el
producto seguía sin poder venderse — con la sola etiqueta gris de "desactivado"
como pista.

Un aviso que se apaga antes de que el problema esté resuelto es peor que no
tenerlo: convence de que terminaste.

Ahora la pantalla cuenta los **no vendibles** y distingue los dos motivos, que
piden acciones distintas:

- *esperando precio* → cargarlo
- *ya tiene precio, falta activarlo* → un click

Cargar el precio y activar son dos decisiones separadas a propósito
([T6](/superpowers/plans/2026-08-21-m1-productos)): que la pantalla lo diga es
lo que faltaba.
:::

:::tip[El sistema de diseño está aplicado en `web/` desde M2]
`claude-design/` no son mockups: es un **sistema de diseño con tokens finales**
—`tokens.css` y `tokens.json`— más trece pantallas de referencia en HTML y las
48 reglas de negocio escritas como casos ejecutables.

**`web/` lo adoptó entero el 22-ago-2026.** `docs/` todavía no.

`tokens.css` se **copia** a `web/src/app/`: el original vive fuera del repo —el
workspace lo ignora— así que el build no puede leerlo. La copia **no se edita**;
si el sistema cambia, se vuelve a copiar entera. Editarla crearía una segunda
verdad sobre los colores de la marca, y ganaría la que alguien tocó último.

`globals.css` es solo el **puente**: expone los tokens como utilidades de
Tailwind (`bg-tarjeta`, `text-principal`, `border-sutil`). Nadie escribe un hex
en un componente.

Lo que el sistema ya fija y no hay que volver a decidir:

| | |
|---|---|
| Paleta | `#1D78B3` primaria · `#5CD9CC` acento (agua y retornables) · `#33BD73` **reservado** |
| Tipografía | IBM Plex Sans y Mono. Mono con `tabular-nums` en **toda** cantidad, ID, lote y dinero |
| Iconos | Lucide, trazo 2px, 24px. Un icono por concepto, nunca dos |
| Foco | Anillo `#5CD9CC`, **nunca suprimido**: el punto de venta se opera con teclado |
| Táctil | Mínimo 44px en cualquier control; 56px en botones primarios |

**Regla dura del sistema:** el verde `#33BD73` **nunca es decorativo**. Es la luz
verde del cuadre y de la autonomía. Si aparece donde no significa "todo en
orden", está mal usado.
:::

:::caution[Migrar la paleta no es buscar y reemplazar]
Al adoptar los tokens hubo que migrar 20 archivos con clases `neutral-*`. Parece
mecánico y no lo es: **`bg-neutral-900` cumplía dos roles distintos** —superficie
oscura en unas pantallas, botón primario en otras— y el número no dice cuál.

El reemplazo por superficie dejó los cuatro botones de autenticación con texto
blanco sobre fondo blanco: **invisibles**, con el typecheck y los 234 tests en
verde.

Lo agarró una captura de pantalla, no la suite. Cuando se migre `docs/`, conviene
mirar cada pantalla — el compilador no sabe de contraste.

Los tokens semánticos se nombran por **rol**, no por tono, justamente para que
esto no vuelva a pasar: `bg-tarjeta` y `bg-accion` no se pueden confundir.
:::

:::caution[El sistema de diseño trae reglas de negocio, y no todas están vigentes]
`reglas-como-tests.md` tiene 48 reglas ejecutables. Algunas **ya estaban
adoptadas** y se implementaron; otras son **derivas conocidas** donde manda el
dominio.

| Regla del sistema | Estado |
|---|---|
| R2 — motivo mínimo de 10 caracteres | ✅ Adoptada e implementada (M2) |
| R20 — con causa `otro`, el motivo es obligatorio | ✅ Adoptada e implementada (M2) |
| R18 — un lote vencido no se vende | ✅ Coincide con [RN-STK-08](/dominio/stock/) |
| R17 — sale primero el lote más viejo | ✅ Coincide con el FIFO de M2 |
| Vencimiento **6 meses / 3 meses** | ❌ **Deriva.** Manda [RN-STK-08](/dominio/stock/): **30 días** |
| `seller` con carga de camión | ❌ **Deriva.** Manda [RN-STK-01](/dominio/stock/) |

Ante una diferencia entre el sistema de diseño y `/dominio/`, **manda el
dominio**: los mockups congelaron un modelo de negocio que después cambió. Ver
[el roadmap](/arquitectura/roadmap/) sobre derivas conocidas.
:::

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

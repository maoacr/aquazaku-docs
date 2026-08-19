---
title: Roadmap de desarrollo
description: Orden y criterios para construir el sistema Aquazaku módulo por módulo.
sidebar:
  order: 1
---

El sistema Aquazaku no se construye de una sola vez. Se construye **módulo por
módulo**, cada uno en su expresión mínima viable, con la arquitectura entre
proyectos y el dominio ya cerrados antes de tocar el primer endpoint.

Esta página define **qué se construye, en qué orden, y por qué en ese orden**.
El detalle de cómo se construye cada módulo vive en su propio cambio SDD
(`sdd/<módulo>/`) y se linkea desde el [catálogo](/arquitectura/modulos/).

---

## Principios rectores

El orden y la cadencia del roadmap se sostienen sobre cinco reglas. Las dos
primeras son **reglas de oro** declaradas explícitamente; las demás son
convenciones que ya están vigentes en el proyecto.

### 1. De menos a más — la fundación antes que el resto

Cada módulo se construye en su **expresión mínima viable** antes de agregar
complejidad. Si un módulo necesita identidad para funcionar, **identidad se
construye primero**. Si necesita stock para vender, stock se construye antes
que ventas.

**Por qué:** el módulo fundacional es el que menos-a-más dicta. En Aquazaku
eso es **Auth + RBAC**: nada funciona sin saber quién opera y qué puede hacer.
Referencia: memoria `architecture/aquazaku-golden-rules`.

### 2. Mobile-first como metodología de UI, no como plataforma

> **Working assumption** (pendiente de confirmación por el usuario): "mobile
> first" se interpreta como **metodología de diseño UI** — responsive,
> touch targets accesibles, sticky bottom CTAs — aplicada a TODA superficie.
> **NO** se interpreta como prioridad de plataforma: la prioridad sigue siendo
> web Admin + POS primero (decisión `estrategia/mvp-scope-web-first`).
>
> Si al final es prioridad de plataforma, el roadmap se ajusta, no se
> reescribe — el orden fundación → operacionales → soporte no cambia.

**Por qué:** las dos lecturas son coherentes mientras no haya app móvil. La
metodología mobile-first ya se aplica a la web responsiva del POS (mostrador)
y del Admin (que se opera desde el celular cuando el dueño viaja).

### 3. Build incremental — no más iteración de diseño

El ciclo de iteración sobre los mockups de `claude-design/` está **cerrado**.
Lo que falta se corrige al construir, no en una nueva ronda de diseño.

**Por qué:** los mockups ya tienen fidelidad suficiente para servir de
referencia visual. Seguir puliendo diseño es costo que no aporta valor. Las
derivas conocidas (vencimiento 6m vs 30d, `entrega` vs `retornables`,
personas placeholder) se resuelven en la implementación. Referencia: memoria
`architecture/aquazaku-build-strategy`.

### 4. Orden fundación → operacionales → soporte

| Fase | Qué incluye | Razón de ser |
| --- | --- | --- |
| **Fundación** | M0 (Auth + RBAC) | Sin identidad no hay permisos, sin permisos no hay módulo que funcione. |
| **Operacionales** | M1–M7 (Productos, Stock, Insumos, Producción, Clientes, Ventas, Retornables) | Son los módulos que operan el negocio día a día. Cada uno depende del anterior. |
| **Soporte y control** | M10, M9, M11, M12, M13 (Precios, Proveedores, Contador, Alertas, Auditoría) | Son módulos que **consumen** lo que los operacionales ya registran, o que **auditan** lo que ya pasó. No son blockers de la operación. |
| **Post-MVP** | M8 (Rutas y seller mobile) | Mobile-first del seller + rutas con offline-first se difiere a post-MVP (decisión `estrategia/mvp-scope-web-first`). |

### 5. Cada módulo pasa por el pipeline SDD completo

Cada módulo atraviesa **spec → design → tasks → apply → verify → archive**
antes de pasar al siguiente. No se arranca un módulo mientras el anterior esté
a medias. Ver [Pipeline SDD](#pipeline-sdd-por-módulo) abajo.

---

## Arquitectura general

### Estructura polyrepo

```
/Users/mao/code/aquazaku/          ← repo "paraguas" (no versiona código)
├── docs/                          ← Astro Starlight — este sitio (✅ activo)
├── api/                           ← Backend y API HTTP/JSON  (🔲 pendiente)
├── web/                           ← Admin + POS responsivo   (🔲 pendiente)
├── mobile/                        ← App del seller           (🔲 POST-MVP)
├── claude-design/                 ← Mockups visuales         (referencia, no docs)
└── README.md / .gitignore
```

Cada subproyecto (`api/`, `web/`, `mobile/`) vive en su **propio repo git**
independiente y está ignorado por la raíz. La raíz solo contiene README y
.gitignore para anclar el workspace y darle a engram un nombre de proyecto
único.

**Por qué polyrepo y no monorepo:** preserva el repo `aquazaku-docs` que ya
existía y evita que engram fragmente la memoria por repo. Las decisiones
transversales (ej. sincronización, contrato API) viven en un solo silo.
Referencia: memoria `aquazaku/arquitectura/estrategia-repos`.

### Contrato entre proyectos

| Proyecto | Rol | Contrato hacia afuera | Estado |
| --- | --- | --- | --- |
| `docs/` | Documentación técnica | Sirve páginas estáticas (Astro Starlight). | ✅ activo |
| `api/` | Backend | Expone **HTTP/JSON**. Autentica, valida reglas, registra auditoría. | 🔲 pendiente |
| `web/` | Admin + POS | SPA o server-rendered web responsiva. Consume `api/`. | 🔲 pendiente |
| `mobile/` | App seller | React Native o equivalente. Consume `api/`. | 🔲 POST-MVP |

**Reglas de dependencia:**

- `api/` no conoce `web/` ni `mobile/`. Solo expone endpoints.
- `web/` y `mobile/` solo hablan con `api/`. Nunca directo a la base.
- `docs/` no referencia código de `api/` ni de `web/` — describe reglas y
  decisiones, no implementaciones.

> Las **capas internas** de cada proyecto (modelo de datos, controllers,
> componentes UI) se definen **cuando arranca ese proyecto**, no antes. Esta
> página describe el **contrato entre proyectos**, no las decisiones internas.

---

## Roles del sistema

El sistema tiene **cuatro roles canónicos** — no tres. El `contador` se agregó
en la sesión del 18-ago-2026 para temas tributarios en Colombia (DIAN) y es
el único rol que **no muta datos**.

| Rol | Quién es | Dónde opera | Permisos |
| --- | --- | --- | --- |
| `admin` | Dueño / administración | Web (remoto, escritorio en planta cuando viaja) | `todo`, sin restricciones |
| `seller` | Vendedor — contacta clientes a distancia (llamada/WhatsApp) y registra ventas | Web (mobile-first UI) en MVP; app móvil post-MVP | Acotados a su alcance (`propio`, `ruta`) |
| `pos` | Operario de planta + mostrador | Web / terminal en la planta | Acotados a planta + mostrador |
| `contador` | Contador externo o interno | Web, **solo lectura** | Lectura + descarga de PDFs y CSV |

**Multi-rol:** un usuario puede tener **N roles asignados** a la vez (ej.
`["pos", "seller"]`). Todo se audita bajo el mismo `user_id`. La UI muestra
los módulos según los roles que el usuario tiene. Referencia: memoria
`dominio/acceso/roles-y-multi-rol`.

**Por qué existe `contador` aparte de `admin`:** el dueño no debe ser quien se
genera a sí mismo los reportes que va a presentar. La separación agrega un
testigo externo al sistema.

La **matriz completa celda por celda** está en
[Roles y permisos](/dominio/roles-y-permisos/).

---

## Módulos del sistema

El sistema se divide en **14 módulos** numerados M0–M13. El número indica el
orden de construcción sugerido, no prioridad de negocio: M0 es fundación
porque todo lo demás lo necesita, no porque sea el más visible.

### Tabla de módulos

| # | Módulo | Propósito (una línea) | Roles que lo usan | Depende de | Estado |
| :-: | --- | --- | --- | --- | --- |
| M0 | **Auth + RBAC** | Identidad, login, permisos por rol y alcance | Todos | — | 🟡 por arrancar |
| M1 | **Productos y catálogo** | Qué se vende: pacas 600ml/300ml, botellones con sus unidades y conversiones | `admin`, `pos`, `seller`, `contador` | M0 | 🔲 pendiente |
| M2 | **Stock de producto terminado** | Lotes, vencimiento 30d, FIFO, bloqueo de vencidos, alertas de stock crítico | `admin`, `pos`, `seller`, `contador` | M0, M1 | 🔲 pendiente |
| M3 | **Insumos** | Tapas, sellos, bolsas por kg con stock mínimo configurable (default 200/200) | `admin`, `pos` | M0 | 🔲 pendiente |
| M4 | **Producción y cierre del día** | Tandas, lote generado automáticamente, mermas, descartes con causa, mantenimiento de filtros | `admin`, `pos` | M0, M1, M2, M3 | 🔲 pendiente |
| M5 | **Clientes** | Alta con verificación de documento, ficha, segmentación residencial/comercial, bloqueo de baja con cifras | `admin`, `pos`, `seller`, `contador` | M0 | 🔲 pendiente |
| M6 | **Ventas** | POS, pedidos WhatsApp, devoluciones con motivo, descuentos con piso absoluto, factura electrónica como intención | `admin`, `pos`, `seller`, `contador` | M0, M1, M2, M5 | 🔲 pendiente |
| M7 | **Retornables (botellones y bases)** | Entrega con flujo híbrido, devoluciones, daño con tarifa fija, traza por `id_sticker` | `admin`, `pos`, `contador` | M0, M5 | 🔲 pendiente |
| M8 | **Rutas y seller mobile** | App nativa del seller, offline-first, cierre de ruta | `seller`, `admin`, `contador` | M0, M5, M6, M7 | ⏸ POST-MVP |
| M9 | **Proveedores y compras** | Mixto contado/transferencia/crédito, sin módulo de CxP completo | `admin`, `pos`, `contador` | M0, M3 | 🔲 pendiente |
| M10 | **Precios y promociones** | Listas residencial/comercial con piso, códigos de descuento con piso absoluto | `admin`, `pos`, `seller`, `contador` | M0, M1 | 🔲 pendiente |
| M11 | **Contador** | Panel solo lectura: cartera por edad, facturas sin emitir, descarga CSV/PDF | `contador`, `admin` | M0, M5, M6, M7, M9, M10 | � pendiente |
| M12 | **Alertas** | Alimenta al panel de planta y al panel admin; umbrales configurables | `admin`, `pos` | M0, M2, M3, M4 | 🔲 pendiente |
| M13 | **Auditoría** | Quién hizo qué cuándo; transversal — todo módulo registra | `admin` (consulta) | M0 + transversal | 🔲 pendiente |

### Reglas del orden

1. **M0 es fundación.** Nada arranca antes que M0.
2. **M1, M2, M3** pueden ir en cualquier orden entre sí una vez M0 esté
   verificado. Son las "tablas maestras" del catálogo.
3. **M4 necesita M1+M2+M3.** Producción registra producto, descuenta stock y
   consume insumos — los tres juntos.
4. **M5, M6, M7 se necesitan mutuamente en parte:** M5 (clientes) habilita M6
   (ventas) y M7 (retornables a un cliente). M7 puede arrancar con cliente
   opcional, pero la versión completa depende de M5.
5. **M10 va antes que M6** si se quiere validar precios antes de vender; o
   puede ir después de M6 si se arranca con precios hardcodeados y se
   flexibiliza después. Decisión de cadencia.
6. **M9, M11, M12, M13** son soporte — entran cuando los operacionales ya
   tienen datos reales para consumir/auditar.
7. **M8 queda explícitamente fuera del MVP.** Se referencia acá para que no
   se olvide, pero no se implementa en esta fase.

### Documentos de dominio ya existentes

Cada módulo tiene su documentación de dominio en `/docs/dominio/` con las
reglas de negocio (RN-\*) ya acordadas. El roadmap **no las repite** —
linkea.

| Módulo | Doc de dominio | Reglas principales (referencia) |
| --- | --- | --- |
| M1 | — *(a documentar)* | RN-PRD-01 (equivalencias en litros como configuración) |
| M2 | [Stock](/dominio/stock/) | RN-STK-01 a 07 (ubicación, motivos, FIFO, vencimiento 30d, devoluciones, descarte) |
| M3 | — *(a documentar)* | pendiente confirmar stock mínimo default 200/200 |
| M4 | [Producción](/dominio/produccion/) | RN-PRD-02 a 24 (tanques separados, cierre diario, lote, encendido/apagado, etc.) |
| M5 | [Clientes](/dominio/clientes/) | RN-CLI-08 (documento único), RN-CLI-12 (crédito), RN-CLI-15 (verificación) |
| M6 | [Ventas](/dominio/ventas/) | RN-VEN-01 a 13 (inmutabilidad, anulación, precios, descuentos, factura) |
| M7 | [Botellones y bases](/dominio/botellones-y-bases/) | RN-ENV-01+ y RN-BAS-01+ (entrega híbrida, daño con tarifa, id_sticker) |
| M9 | [Proveedores](/dominio/proveedores/) | pendiente (mixto contado/transferencia/crédito) |
| M0 | [Roles y permisos](/dominio/roles-y-permisos/) | RN-ACC-01 a 05 (multi-rol, UI oculta, alcance, auditoría, desactivación) |

---

## Convenciones transversales

Reglas que aplican a **todos** los módulos, no a uno solo. El roadmap las
recuerda; el detalle vive en los docs de dominio y en engram.

| Convención | Referencia |
| --- | --- |
| **Reglas con ID `RN-XXX-##`** — área + correlativo, estado explícito (✅ / 🟡 / 🔴) | `aquazaku/dominio/convencion-reglas` |
| **Mobile-first como metodología UI** — touch targets ≥ 44px, sticky bottom CTAs, responsive de entrada | `architecture/aquazaku-golden-rules` (working assumption) |
| **Datos en bandas, no falsa precisión** — "entre 3 y 5 días", nunca "4,3" | [RN-PRD-15](/dominio/produccion/) |
| **Acción irreversible con motivo obligatorio** — anulaciones, ajustes, descartes: texto ≥ 10 caracteres | `aquazaku/dominio/convencion-reglas` + claude-design `reglas-como-tests` |
| **El saldo calculado manda, la lectura visual reconcilia** — patrón inventario contable vs conteo físico | [RN-PRD-14](/dominio/produccion/) |
| **Personas de los mockups son placeholder** — al construir, el admin crea un perfil por cada rol canónico | `design/placeholder-personas` |
| **Multi-rol por usuario, un `user_id` único** — la UI oculta módulos según el rol ejercido, la API prohíbe | [RN-ACC-01 a 03](/dominio/roles-y-permisos/) |

---

## Pipeline SDD por módulo

Cada módulo recorre las seis fases de Spec-Driven Development antes de pasar
al siguiente. No se pisan fases entre módulos distintos.

```
spec       →  ¿QUÉ se hace?   (requerimientos + escenarios Given/When/Then)
design     →  ¿CÓMO se hace?  (arquitectura interna, archivos, contratos, datos)
tasks      →  ¿CÓMO se parte? (lista de tareas implementables, agrupables)
apply      →  CONSTRUIR        (código + tests, commits por unidades de revisión)
verify     →  PROBAR           (ejecutar tests, simular escenarios, UAT conversacional)
archive    →  SINCRONIZAR      (delta specs → spec canónico, cleanup)
```

Un módulo queda **archivado** solo cuando su `verify` pasa. El siguiente módulo
puede arrancar en `design` mientras el anterior está en `apply`, pero no antes.

---

## Estado actual

**Hoy, 19-ago-2026:**

| Fase | Módulo |
| --- | --- |
| Spec en curso | — |
| Design en curso | — |
| Apply en curso | — |
| Verificado | — |
| **Por arrancar** | **M0 — Auth + RBAC** |
| Pendiente | M1–M7, M9–M13 |
| Diferido (post-MVP) | M8 — Rutas y seller mobile |

El resto del documento de dominio está cerrado: las reglas RN-\* que ya están
publicadas en `/dominio/` cubren lo que el módulo necesita **definir**, no
cómo lo **implementa**. El SDD de cada módulo traduce esas reglas en código.

---

## Decisiones abiertas antes de arrancar M0

Preguntas que siguen sin resolverse y que pueden frenar la spec/design del
primer módulo:

1. **Interpretación final de "mobile-first"** — ¿metodología UI (working
   assumption actual) o prioridad de plataforma? Si es plataforma, hay que
   decidir si el seller opera desde una app móvil desde el día uno o se
   arranca por web con app diferida (que ya está decidido).
2. **Stack del proyecto `api/`** — pendiente. Ver
   [`empezar/pendientes`](/empezar/pendientes/). No bloquea el dominio (las
   reglas están cerradas), pero bloquea el `design.md` de M0.
3. **Nombre del módulo de retornables** — `entrega` (como aparece en
   `claude-design/`) o `retornables` (como aparece en el modelo de datos y en
   el dominio). Coexisten hoy; hay que unificar antes de la spec de M7.
4. **Stock mínimo default de insumos** — el plan de M3 asume 200/200 (tapas
   y sellos) pero el número no está confirmado por Aquazaku. Confirmar antes
   del `design.md`.
5. **Derivas heredadas del paquete `claude-design/`** — el verify del
   19-ago-2026 documentó varias derivas aceptadas (vencimiento 6m, modelo
   seller mobile offline-first, 9 personas). Verificar que el equipo que
   arranque M0 las tenga presente para no replicarlas en el código.

---

## Ver también

- [Catálogo de módulos](/arquitectura/modulos/) — índice rápido por módulo.
- [Dominio](/dominio/) — reglas RN-\* que el roadmap asume ya cerradas.
- [Decisiones técnicas](/decisiones/) — ADRs que respaldan el orden y la
  estructura.
- [Qué falta preguntar](/empezar/pendientes/) — preguntas abiertas a
  Aquazaku (principalmente mediciones 🟠 que requieren ir a la planta).

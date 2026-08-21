---
title: Spec de M1 — Productos y catálogo
description: "Diseño del primer módulo de negocio: la tabla de productos, la extensión de la matriz de permisos y dónde se hace cumplir cada regla del dominio."
---

**Fecha:** 2026-08-21
**Estado:** 📝 Diseñado — por implementar
**Módulo:** M1 del [Roadmap Aquazaku](/arquitectura/roadmap/)
**Autores:** Mao (product owner) + AI (asistente de diseño)

---

## 1. Contexto

M1 es el **primer módulo de negocio** del sistema. M0 construyó identidad,
permisos y bitácora; M1 es lo primero que un usuario reconoce como "el sistema
de Aquazaku".

Gatea a cuatro módulos: **M2** (stock cuenta unidades de estos productos),
**M4** (producción genera lotes de estos productos), **M6** (una venta es una
línea que apunta acá) y **M10** (las promociones se aplican sobre estos
precios).

Las reglas que este módulo implementa están en
[Productos y catálogo](/dominio/productos/) — **RN-CAT-01 a 11**, cerradas el
21-ago-2026 sin preguntas abiertas. Esta spec describe **cómo** se implementan;
no redefine el **qué**.

## 2. Objetivos

1. Tabla `productos` con precios, presentación y equivalencia en litros.
2. CRUD de catálogo restringido a `admin`, con auditoría de todo cambio de precio.
3. Lectura del catálogo para los cuatro roles.
4. Invariante de precio mínimo garantizado **en la base**, no en el servicio.
5. Código de producto generado, legible y no reusable.
6. Catálogo semilla con los tres productos reales de Aquazaku.
7. Pantalla de administración del catálogo en `web/`.

## 3. Fuera de alcance (M1)

| Queda fuera | Va en |
| --- | --- |
| Stock, lotes, vencimiento | M2 |
| Insumos (tapas, sellos, bolsas) | M3 |
| Producción y conversión de litros a producto | M4 |
| Venta, línea de venta, congelado de precio | M6 |
| Códigos de descuento y promociones | M10 |
| Motor de IVA, retenciones, integración DIAN | post-MVP ([RN-CAT-09](/dominio/productos/)) |
| Código de barras | no pedido |
| Imágenes de producto | no pedido |

:::caution[Una regla de M1 no se puede hacer cumplir todavía]
[RN-CAT-02](/dominio/productos/) dice que un producto solo se desactiva **si no
quedan unidades en stock**. La tabla de stock es de M2.

En M1 el endpoint desactiva sin poder verificarlo. La verificación se agrega
en M2, y queda anotada como deuda explícita en
[§10 Riesgos](#14-riesgos-y-deuda-asumida) — no como un olvido.
:::

## 4. Decisiones arquitectónicas

| # | Decisión | Por qué |
| --- | --- | --- |
| 1 | El precio vive en `productos`, no en una tabla de precios | [RN-CAT-03](/dominio/productos/): M6 depende de M1 y no de M10. Con los precios en M10 no se podría vender hasta construirlo. |
| 2 | `litros` es una **columna generada**, no un campo que se escribe | Un derivado que se guarda a mano se desincroniza. Postgres lo calcula desde `contenido_ml × unidades`; es imposible que discrepe. |
| 3 | El piso de precio es un **CHECK en la base** | Es la garantía que no depende de que cada endpoint se acuerde de validar. Mismo criterio que `citext` en `users.email`. |
| 4 | El código lo genera el servicio; la identidad es el UUID | [RN-CAT-11](/dominio/productos/), mismo principio que [RN-CLI-01](/dominio/clientes/). Un código renombrado no puede arrastrar ventas históricas. |
| 5 | Sin `DELETE` en el módulo | [RN-CAT-02](/dominio/productos/). El repositorio no expone borrado: no hay forma de llamarlo por accidente. |
| 6 | Dinero en `numeric(12,2)`, nunca en `float` | Un peso perdido por redondeo binario es un peso que no cuadra en el cierre. |

## 5. Modelo de datos

Una sola tabla nueva.

```ts
export const presentacionEnum = pgEnum('presentacion', ['paca', 'botellon'])

export const productos = pgTable('productos', {
  id: uuid('id').primaryKey().defaultRandom(),

  // Legible, generado, único y NO reusable — RN-CAT-11
  codigo: text('codigo').notNull(),
  nombre: text('nombre').notNull(),

  presentacion: presentacionEnum('presentacion').notNull(),

  // Equivalencia en litros — configuración, no código (RN-PRD-01)
  contenidoMl: integer('contenido_ml').notNull(),
  unidades: integer('unidades').notNull().default(1),
  litros: numeric('litros', { precision: 10, scale: 3 })
    .generatedAlwaysAs(sql`(contenido_ml::numeric * unidades) / 1000`),

  // Precios — RN-CAT-03
  precioResidencial: numeric('precio_residencial', { precision: 12, scale: 2 }).notNull(),
  precioComercial:   numeric('precio_comercial',   { precision: 12, scale: 2 }).notNull(),
  precioMinimo:      numeric('precio_minimo',      { precision: 12, scale: 2 }).notNull(),

  // Semántica tributaria — RN-CAT-09. Hoy: true / 0
  precioIncluyeImpuestos: boolean('precio_incluye_impuestos').notNull().default(true),
  tarifaIvaPorcentaje: numeric('tarifa_iva_porcentaje', { precision: 5, scale: 2 })
    .notNull().default('0'),

  activo: boolean('activo').notNull().default(true),   // RN-CAT-02

  creadoEn:     tstz('creado_en').notNull().defaultNow(),
  actualizadoEn: tstz('actualizado_en').notNull().defaultNow(),
}, (t) => [
  uniqueIndex('productos_codigo_uq').on(t.codigo),
  index('productos_activo_idx').on(t.activo),

  // RN-CAT-04 — el piso es piso. En la base, no en el servicio.
  check('precio_minimo_es_piso', sql`
    ${t.precioMinimo} <= ${t.precioResidencial} AND
    ${t.precioMinimo} <= ${t.precioComercial}
  `),
  check('precios_no_negativos', sql`${t.precioMinimo} >= 0`),
  check('unidades_positivas', sql`${t.unidades} >= 1`),
])
```

### Por qué `unidades` también en el botellón

El botellón lleva `unidades = 1` y `contenido_ml = 20000`. Podría haber sido
`null`, pero entonces el cálculo de litros necesitaría un `COALESCE` y la
columna generada dejaría de ser trivial.

Con `1` la fórmula es la misma para los tres productos, y
[RN-CAT-10](/dominio/productos/) (la paca es indivisible) sigue valiendo: que la
paca **tenga** 20 unidades no significa que se puedan vender por separado.

### Lo que esta tabla NO tiene

- **`stock`** — es de M2, y meterlo acá mezclaría catálogo con inventario.
- **`costo`** — es de M9 (compras), y el margen no es un atributo del catálogo.
- **`es_retornable`** — el botellón como envase es de M7
  ([RN-CAT-05](/dominio/productos/)). Un flag acá invitaría a mezclar los dos
  ciclos de vida.

## 6. Extensión de la matriz de permisos

Hoy `matrix.ts` solo tiene dos celdas de `productos`:

```ts
{ resource: 'productos', action: 'ver', scope: 'todo' },
{ resource: 'productos', action: 'editar_precios', scope: 'todo' },
```

M1 necesita tres acciones más, solo para `admin` — [RN-CAT-06](/dominio/productos/):

| Permiso | `admin` | `seller` | `pos` | `contador` |
| --- | :-: | :-: | :-: | :-: |
| `productos:ver` | ✅ | ✅ | ✅ | 🟡 `todo` read-only |
| `productos:crear` | ✅ | ❌ | ❌ | ❌ |
| `productos:editar` | ✅ | ❌ | ❌ | ❌ |
| `productos:editar_precios` | ✅ | ❌ | ❌ | ❌ |
| `productos:desactivar` | ✅ | ❌ | ❌ | ❌ |

:::danger[Se tocan DOS archivos, siempre juntos]
La matriz del documento y la del código son **la misma fuente de verdad**, y
`matrix.test.ts` falla si se desincronizan. Agregar una celda exige tocar
[Roles y permisos](/dominio/roles-y-permisos/) **y** `api/src/modules/authz/matrix.ts`
en el mismo commit.

`desactivar` es una acción nueva: hay que sumarla al tipo `Action`.
:::

## 7. De la regla al mecanismo

La parte más útil de esta spec: **dónde vive cada regla**. Si una regla no
aparece acá, no está implementada.

| Regla | Dónde se hace cumplir | Mecanismo |
| --- | --- | --- |
| RN-CAT-01 — catálogo única fuente | Base *(M6)* | FK de `venta_linea.producto_id`; en M1 no hay nada que hacer todavía |
| RN-CAT-02 — desactivar, no borrar | Servicio | `activo = false`. **Sin `DELETE` en el módulo.** La condición "sin stock" se difiere a M2 |
| RN-CAT-03 — precio en el producto | Base | Tres columnas en `productos` |
| RN-CAT-04 — el piso es piso | **Base** | `CHECK precio_minimo_es_piso` |
| RN-CAT-05 — comprar botellones ≠ producto | — | Nada: la compra de envases es M7 y no toca esta tabla. Se hace cumplir por omisión |
| RN-CAT-06 — solo `admin` edita | Matriz + auditoría | Celdas nuevas + `requirePermission(..., { auditaLaRuta: true })` |
| RN-CAT-07 — el precio no reescribe el pasado | *(M6)* | Contrato documentado; M6 congela el precio en la línea de venta |
| RN-CAT-08 — un solo producto de botellón | Seed | El catálogo semilla tiene tres filas, no cuatro |
| RN-CAT-09 — semántica del precio | Base | `precio_incluye_impuestos` + `tarifa_iva_porcentaje` |
| RN-CAT-10 — la paca es indivisible | Base | `unidades` es atributo del producto, no una unidad vendible aparte |
| RN-CAT-11 — código generado, no reusable | Servicio + base | Generador determinista + `uniqueIndex` sobre `codigo` |

### Auditoría del cambio de precio

`emit()` acepta un `payload` jsonb. El cambio de precio lo usa para guardar el
antes y el después — sin eso, la bitácora diría *que* alguien cambió un precio
pero no *de cuánto a cuánto*, que es justamente lo que se va a querer saber.

```ts
await emit({
  ...contexto,
  action: 'productos:editar_precios',
  resource: 'productos',
  resourceId: producto.id,
  result: 'ok',
  payload: {
    codigo: producto.codigo,
    antes:   { residencial: '10000.00', comercial: '9500.00', minimo: '8000.00' },
    despues: { residencial: '11000.00', comercial: '10500.00', minimo: '8000.00' },
  },
})
```

Esto ya está previsto en el módulo de auditoría de M0: el comentario de
`audit.ts` lista *"cambios de precio"* entre las acciones que RN-ACC-04 exige
registrar.

## 8. Endpoints

Todos bajo `/api/productos`. El browser **nunca** los llama directo — pasan por
el BFF de `web/` ([ADR-0002](/decisiones/0002-bff-pattern/)).

| Método | Ruta | Permiso | Notas |
| --- | --- | --- | --- |
| `GET` | `/productos` | `productos:ver` | Query `?activo=true\|false\|todos`, default `true` |
| `GET` | `/productos/:id` | `productos:ver` | 404 si no existe |
| `POST` | `/productos` | `productos:crear` | Genera el código; 409 si colisiona |
| `PATCH` | `/productos/:id` | `productos:editar` | Nombre y presentación |
| `PATCH` | `/productos/:id/precios` | `productos:editar_precios` | **Auditado con payload** |
| `POST` | `/productos/:id/desactivar` | `productos:desactivar` | Idempotente |
| `POST` | `/productos/:id/reactivar` | `productos:desactivar` | Misma capacidad, simétrica |

### Códigos de error

Siguiendo el patrón de M0 (`ErrorDeNegocio` con código estable):

| Código | HTTP | Cuándo |
| --- | --- | --- |
| `PRODUCTO_NO_ENCONTRADO` | 404 | El id no existe |
| `CODIGO_DUPLICADO` | 409 | El código generado ya está tomado |
| `PRECIO_MINIMO_INVALIDO` | 422 | El piso quedaría por encima de un precio de lista |
| `PRODUCTO_YA_INACTIVO` | 409 | Desactivar uno que ya lo está y no es idempotente en el caller |

:::note[Por qué validar el piso en el servicio si ya hay CHECK]
El `CHECK` es la garantía; la validación en el servicio es la **explicación**.
Sin ella, el usuario recibiría un error de Postgres en vez de un mensaje que
dice qué corregir.

La base impide el dato malo aunque el servicio se olvide. El servicio existe
para que el error sea legible. Los dos, no uno.
:::

## 9. Frontend (`web/`)

| Pantalla | Ruta | Quién entra |
| --- | --- | --- |
| Catálogo (lectura) | `/modulos/productos` | los cuatro roles |
| Administración | `/modulos/productos/gestion` | solo `admin` |

- Server Components leen vía `apiServerFetch()` — la única función que puede
  hablar con `api/`.
- Mutaciones por **Server Actions**, no por `fetch` desde el cliente.
- El formulario valida el piso **antes** de enviar, con el mismo esquema Zod que
  usa el backend. La validación del cliente es comodidad; la del servidor es la
  que manda.
- Sin TanStack Table todavía: con tres productos sería infraestructura sin uso.

## 10. Seed

`drizzle/seed.ts` ya siembra roles y el primer admin. Se agrega el catálogo,
**idempotente** como el resto: si los productos existen, no hace nada.

| Código | Nombre | Presentación | Contenido | Unidades | Litros |
| --- | --- | --- | --- | --- | --- |
| `PACA-600` | Paca de bolsas 600 ml | `paca` | 600 ml | 20 | 12 |
| `PACA-300` | Paca de bolsas 300 ml | `paca` | 300 ml | 50 | 15 |
| `BOT-20` | Recarga de botellón 20 L | `botellon` | 20 000 ml | 1 | 20 |

`BOT-20` arranca con **$10.000** — el precio vigente confirmado por Aquazaku
([RN-CAT-08](/dominio/productos/)). Es dato semilla, editable desde la UI, no
una constante.

Los precios de las pacas **no están confirmados**: el seed los deja en `0` y la
primera tarea del `admin` es cargarlos. Sembrar un número inventado sería peor
que sembrar un cero — un cero se ve, un número plausible no.

## 11. Estrategia de testing

Siguiendo lo aprendido en M0: *una task no está terminada porque sus tests
pasen, sino cuando se la vio funcionar de punta a punta*.

| Capa | Qué verifica |
| --- | --- |
| Unit — servicio | Generación de código, invariante del piso, idempotencia de desactivar |
| Unit — matriz | Las cinco celdas nuevas, rol por rol. `matrix.test.ts` ya falla si el doc y el código se desincronizan |
| Integración — base | Que el `CHECK` **rechace** de verdad: insertar un piso inválido y esperar el error de Postgres |
| Integración — columna generada | Que `litros` salga 12, 15 y 20 sin escribirlo nunca |
| Integración — auditoría | Que un cambio de precio deje fila con `payload.antes` y `payload.despues` |
| Integración — permisos | Que `pos` y `seller` reciban **403** al crear o editar precios |
| Bruno | La colección corre contra un servidor real, con `Origin` |
| Manual | Login como `admin`, cargar un precio, verlo en la bitácora |

:::danger[El test que más importa]
El del `CHECK`. Es fácil escribir un test que valide el servicio y creer que el
invariante está cubierto — pero el servicio se puede bypassear con un `UPDATE`
directo, y la promesa de RN-CAT-04 es que **eso también falle**.

Si ese test no existe, el `CHECK` podría no estar en la migración y nadie se
enteraría.
:::

## 12. Archivos

**`api/`**

```
src/db/schema.ts                              (modificado — tabla productos)
src/db/migrations/0002_productos.sql          (nuevo)
src/modules/authz/matrix.ts                   (modificado — 3 acciones)
src/modules/productos/routes.ts               (nuevo)
src/modules/productos/service.ts              (nuevo)
src/modules/productos/validation.ts           (nuevo)
src/modules/productos/codigo.ts               (nuevo — generador)
src/modules/productos/__tests__/              (nuevo)
drizzle/seed.ts                               (modificado — catálogo)
bruno/aquazaku/5-Productos/                   (nuevo)
```

**`web/`**

```
src/app/(app)/modulos/productos/page.tsx          (nuevo)
src/app/(app)/modulos/productos/gestion/page.tsx  (nuevo)
src/app/(app)/modulos/productos/actions.ts        (nuevo)
src/components/productos/                          (nuevo)
```

**`docs/`**

```
backend/index.md          (endpoints + códigos de error)
base-de-datos/index.md    (tabla productos, migración 0002)
frontend/index.md         (dos pantallas nuevas)
dominio/roles-y-permisos.md (matriz — 3 celdas)
arquitectura/roadmap.md   (M1 terminado)
```

## 13. Criterios de éxito (Definition of Done)

1. `admin` crea un producto desde la UI y le aparece con código generado.
2. Un `UPDATE` directo en `psql` que viole el piso **es rechazado por Postgres**.
3. `litros` da 12, 15 y 20 sin que nadie lo haya escrito.
4. `pos` y `seller` ven el catálogo y reciben **403** al intentar editarlo.
5. Un cambio de precio deja fila en `audit_log` con antes y después.
6. Un producto desactivado desaparece del listado por defecto y sigue existiendo.
7. El seed corre dos veces sin duplicar nada.
8. `api/` y `web/` verdes; Bruno verde contra servidor real.
9. La documentación de `/docs` refleja lo implementado, no lo planeado.
10. **Verificado en un browser real, con todos los servicios arriba.**

## 14. Riesgos y deuda asumida

| # | Riesgo | Mitigación |
| --- | --- | --- |
| 1 | **RN-CAT-02 sin poder verificarse** — se desactiva sin comprobar stock | Deuda explícita. Se cierra en M2, y el criterio de aceptación de M2 lo incluye |
| 2 | **Cuatro reglas siguen 🟡** — RN-CAT-01, 02, 03 y 09 son propuestas nuestras | Están marcadas en el dominio. Si Aquazaku corrige alguna, cambia el modelo antes de que haya datos |
| 3 | **Precios de pacas sin confirmar** | El seed los deja en `0`, visible e imposible de confundir con un precio real |
| 4 | **La columna generada es nueva en el proyecto** | Test de integración dedicado; si Drizzle la emitiera mal en la migración, el test lo detecta antes que un usuario |
| 5 | **Desincronizar matriz doc ↔ código** | `matrix.test.ts` ya falla si pasa. El riesgo real es olvidar el doc, no el código |

### Preguntas abiertas

Ninguna. El dominio de M1 se cerró el 21-ago-2026 y esta spec no abrió ninguna
nueva.

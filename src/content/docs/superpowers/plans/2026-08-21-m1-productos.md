---
title: Plan de M1 — Productos y catálogo
description: "Las 8 tasks de implementación de M1, con el orden de dependencias, los criterios de cierre de cada una y qué verificar antes de darla por terminada."
---

**Objetivo:** implementar M1 según la
[spec de diseño](/superpowers/specs/2026-08-21-m1-productos-design) — tabla
`productos`, CRUD restringido a `admin`, invariantes en la base, catálogo
semilla y dos pantallas en `web/`.

**Dominio:** [Productos y catálogo](/dominio/productos/) — RN-CAT-01 a 11.

**Estado:** 🚧 en curso — T1 y T2 cerradas.

---

## La lección de M0, que acá también aplica

> Una task no está terminada porque sus tests pasen. Está terminada cuando se la
> vio funcionar de punta a punta, con todos los servicios arriba.

Los dos peores bugs de M0 —el header `Origin` y el logout faltante— vivían en
costuras: entre repos, o entre *"el endpoint existe"* y *"alguien lo llama"*.
Ninguna suite unitaria mira ahí, por diseño.

Cada task que produce endpoint cierra con una petición HTTP real. Cada task que
produce pantalla cierra con un browser abierto.

---

## Restricciones globales

- **Polyrepo.** `api/` y `web/` son repos independientes con su propio remote.
  Nunca se commitea desde la raíz.
- **No se buildea después de cada cambio.** El typecheck sí.
- Convención del proyecto: 2 espacios, comillas simples, sin punto y coma.
- Conventional commits, sin `Co-Authored-By`.
- Cada commit deja el proyecto en verde: tests + typecheck.
- Sin `TODO` ni `PLACEHOLDER` en código que se mergea.
- **Las migraciones son SQL explícito.** No se autogeneran contra producción.
- Dinero siempre en `numeric`, nunca `float`.
- Los tests corren contra `aquazaku_test`, jamás contra `aquazaku_dev`.

---

## Grafo de dependencias

```
T1 schema ─────┬─── T3 código ─── T4 servicio ─── T5 rutas ─┬─ T7 web
               │                        │                    │
               └─── T6 seed             │                    └─ T8 bruno + docs
                                        │
T2 matriz ──────────────────────────────┘
```

- **T1** y **T2** son independientes: se pueden hacer en cualquier orden.
- **T5** necesita T2 (los permisos) y T4 (el servicio).
- **T8** cierra: sin T5 y T7 no hay nada que explorar ni que documentar.

---

## Task 1 — Schema y migración

**Archivos**
- Modificar: `api/src/db/schema.ts`
- Crear: `api/src/db/migrations/0002_productos.sql`
- Crear: `api/src/db/__tests__/productos-schema.test.ts`

**Produce:** la tabla `productos` con sus invariantes.

- [x] **Paso 1 — Enum y tabla en `schema.ts`**

Seguir el estilo del archivo: helper `tstz`, `pgEnum` arriba, comentario que
explique el *por qué* de lo que no es obvio.

```ts
export const presentacionEnum = pgEnum('presentacion', ['paca', 'botellon'])
```

- [x] **Paso 2 — Columna generada para `litros`**

```ts
litros: numeric('litros', { precision: 10, scale: 3 })
  .generatedAlwaysAs(sql`(contenido_ml::numeric * unidades) / 1000`),
```

El botellón lleva `unidades = 1` para que la fórmula sea la misma en los tres
productos. Con `null` haría falta un `COALESCE` y la columna dejaría de ser
trivial de leer.

- [x] **Paso 3 — Los tres `CHECK`**

```ts
check('precio_minimo_es_piso', sql`
  ${t.precioMinimo} <= ${t.precioResidencial} AND
  ${t.precioMinimo} <= ${t.precioComercial}
`),
check('precios_no_negativos', sql`${t.precioMinimo} >= 0`),
check('unidades_positivas', sql`${t.unidades} >= 1`),
```

- [x] **Paso 4 — Migración SQL explícita**

Escribirla a mano, no generarla. Incluye el `GRANT` a `aquazaku_app`: el rol de
la aplicación no es dueño de las tablas, así que sin `GRANT` la app no puede
leer ni escribir.

```sql
GRANT SELECT, INSERT, UPDATE ON productos TO aquazaku_app;
```

Sin `DELETE`. [RN-CAT-02](/dominio/productos/) dice que un producto no se borra
— y la forma más barata de garantizarlo es que el rol no tenga el privilegio.

- [x] **Paso 5 — Tests de integración**

| Verifica | Cómo |
| --- | --- |
| El `CHECK` rechaza de verdad | `INSERT` con piso mayor al precio de lista → error de Postgres |
| `litros` sale 12, 15 y 20 | Insertar los tres productos, leer `litros`, nunca escribirlo |
| El código es único | Segundo `INSERT` con el mismo código → violación de unicidad |
| `aquazaku_app` no puede borrar | `DELETE` con el rol de app → `insufficient_privilege` |

:::danger[El test que más importa]
El del `CHECK`. Es fácil validar en el servicio y creer que el invariante está
cubierto — pero el servicio se puede saltear con un `UPDATE` directo, y la
promesa de [RN-CAT-04](/dominio/productos/) es que **eso también falle**.

Si ese test no existe, el `CHECK` podría faltar en la migración y nadie se
enteraría hasta que un precio quede por debajo del piso en producción.
:::

**Cierra cuando:** los cuatro tests pasan y `psql` rechaza un `UPDATE` que viole
el piso, probado a mano.

:::note[Notas de ejecución — T1 cerrada el 21-ago-2026]
**El `GRANT` del plan estaba mal, hacía falta un `REVOKE`.** La migración `0001`
había dejado un `ALTER DEFAULT PRIVILEGES` que concede `SELECT, INSERT, UPDATE,
DELETE` sobre toda tabla nueva. `productos` nació con borrado heredado: agregar
un `GRANT` sin `DELETE` no quitaba nada. Se revoca explícitamente.

**`litros` quedó `NOT NULL`.** Drizzle la generó nullable. Como sus dos entradas
son `NOT NULL` nunca puede serlo, y dejarla así obligaba a un chequeo de null
inútil en cada consumidor.

**El `CHECK` resultó más fuerte de lo que pedía el plan.** Rechaza el `UPDATE`
incluso ejecutado con el rol **dueño** — el mismo que corre las migraciones. El
`GRANT` solo limita al rol de la aplicación; el `CHECK` no perdona a nadie.

**Los timestamps van en inglés.** La spec los escribía `creadoEn` /
`actualizadoEn`, pero todas las tablas del proyecto usan `createdAt` /
`updatedAt`. Manda el código existente.

**`rm` está aliaseado a `trash`** y no acepta `-f`: un snapshot viejo de
drizzle-kit sobrevivió y la segunda generación produjo un `ALTER` en vez de un
`CREATE`. Para limpiar artefactos de migración va `/bin/rm`.

**Resultado:** 14 tests nuevos, suite de `api/` en **363** (venía de 349).
:::

---

## Task 2 — Extender la matriz de permisos

**Archivos**
- Modificar: `api/src/modules/authz/matrix.ts`
- Modificar: `docs/src/content/docs/dominio/roles-y-permisos.md`
- Modificar: `api/src/modules/authz/__tests__/matrix.test.ts`

**Produce:** `productos:crear`, `productos:editar`, `productos:desactivar`.

- [x] **Paso 1 — Agregar `desactivar` al tipo `Action`**

Es una acción nueva en el sistema, no solo una celda nueva.

- [x] **Paso 2 — Tres celdas, solo para `admin`**

```ts
{ resource: 'productos', action: 'crear',       scope: 'todo' },
{ resource: 'productos', action: 'editar',      scope: 'todo' },
{ resource: 'productos', action: 'desactivar',  scope: 'todo' },
```

- [x] **Paso 3 — La misma tabla en el doc de dominio**

:::danger[Dos archivos, un solo commit]
La matriz del documento y la del código son **la misma fuente de verdad**, y
`matrix.test.ts` falla si se desincronizan. El riesgo real no es olvidar el
código —el test lo atrapa— sino olvidar el documento.
:::

- [x] **Paso 4 — Tests celda por celda**

Que `seller`, `pos` y `contador` reciban `false` en las tres acciones nuevas.
No alcanza con probar que `admin` puede: hay que probar que los otros no.

**Cierra cuando:** `matrix.test.ts` verde y la tabla del doc coincide con el
código.

:::note[Notas de ejecución — T2 cerrada el 21-ago-2026]
**Eran tres archivos, no dos.** El plan decía "matriz + doc", pero
`matrix.test.ts` transcribe el documento **a mano y por separado**, a propósito:
si derivara del código, el test confirmaría que el código es igual a sí mismo.
Esa duplicación deliberada es la que da valor al test — y significa que agregar
una celda cuesta tres ediciones.

**Lo que ningún test puede atrapar.** El test verifica que el código coincida
con *su propia transcripción*, no con el documento. Si alguien actualiza código
y test pero olvida el doc, todo queda verde y la documentación miente.

Se verificó cruzando los dos repos a mano: extraer las celdas de `productos` del
`matrix.ts` y de la tabla markdown, y compararlas. Coincidieron en los cuatro
roles. **Conviene repetir ese cruce cada vez que se toque la matriz.**

**Test extra que no estaba en el plan:** que los cuatro roles conserven
`productos:ver`. Un `pos` que no ve precios no puede vender — es una regresión
fácil de introducir al restringir la escritura.

**Resultado:** 2 tests nuevos, suite de `api/` en **365**.
:::

---

## Task 3 — Generador de código

**Archivos**
- Crear: `api/src/modules/productos/codigo.ts`
- Crear: `api/src/modules/productos/__tests__/codigo.test.ts`

**Produce:** `generarCodigo(presentacion, contenidoMl)` → `PACA-600`, `BOT-20`.

- [ ] **Paso 1 — Determinista y legible**

```
paca     + 600 ml    → PACA-600
paca     + 300 ml    → PACA-300
botellon + 20 000 ml → BOT-20
```

La paca se nombra por mililitros; el botellón por litros, porque así lo dice el
negocio ("botellón de veinte litros", no "de veinte mil mililitros"). El
[glosario](/empezar/glosario/) manda sobre la simetría del código.

- [ ] **Paso 2 — Colisión resuelta con sufijo, no con azar**

Si `PACA-600` ya existe, el siguiente es `PACA-600-2`. Un sufijo aleatorio
haría el código impredecible y rompería lo único que justifica tenerlo: que
una persona lo pueda leer y decir.

- [ ] **Paso 3 — El código no se reusa nunca**

La unicidad la garantiza el índice de la base. El generador consulta los
existentes **incluyendo los inactivos** — reciclar el código de un producto
desactivado haría que un comprobante viejo parezca referirse al nuevo
([RN-CAT-11](/dominio/productos/)).

**Cierra cuando:** los tests cubren los tres productos reales, la colisión y el
caso del inactivo.

---

## Task 4 — Servicio

**Archivos**
- Crear: `api/src/modules/productos/service.ts`
- Crear: `api/src/modules/productos/__tests__/service.test.ts`

**Produce:** `listar`, `porId`, `crear`, `editar`, `editarPrecios`,
`desactivar`, `reactivar`.

- [ ] **Paso 1 — Validar el piso antes de tocar la base**

El `CHECK` es la garantía; esta validación es la **explicación**. Sin ella el
usuario recibe un error de Postgres en vez de un mensaje que dice qué corregir.

```ts
if (minimo > residencial || minimo > comercial) {
  throw new ErrorDeNegocio('PRECIO_MINIMO_INVALIDO', 422,
    'El precio mínimo no puede superar ningún precio de lista.')
}
```

- [ ] **Paso 2 — `editarPrecios` audita con el antes y el después**

```ts
await emit({
  ...contexto,
  action: 'productos:editar_precios',
  resource: 'productos',
  resourceId: producto.id,
  result: 'ok',
  payload: {
    codigo: producto.codigo,
    antes:   { residencial, comercial, minimo },
    despues: { ...nuevos },
  },
})
```

Sin el `payload`, la bitácora diría *que* alguien cambió un precio pero no *de
cuánto a cuánto* — que es exactamente lo que se va a querer saber.

- [ ] **Paso 3 — `desactivar` es idempotente en la base, explícito en el servicio**

Desactivar uno ya inactivo devuelve `PRODUCTO_YA_INACTIVO` (409). Es
información, no un fallo silencioso: si el `admin` creyó que estaba activo,
merece enterarse.

- [ ] **Paso 4 — Sin `DELETE` en el módulo**

No se expone. No hay forma de llamarlo por accidente.

- [ ] **Paso 5 — La deuda de RN-CAT-02, escrita en el código**

```ts
// RN-CAT-02 exige que no queden unidades en stock para desactivar.
// La tabla de stock es de M2: acá todavía no se puede verificar.
// El criterio de aceptación de M2 incluye cerrar esta condición.
```

Un comentario que cita la regla y dice cuándo se cierra. No un `TODO` suelto.

**Cierra cuando:** los tests cubren el piso inválido, la auditoría con payload,
la doble desactivación y el listado filtrando por `activo`.

---

## Task 5 — Rutas y validación

**Archivos**
- Crear: `api/src/modules/productos/validation.ts`
- Crear: `api/src/modules/productos/routes.ts`
- Crear: `api/src/modules/productos/__tests__/routes.test.ts`
- Modificar: `api/src/server.ts`

**Produce:** los siete endpoints de la
[spec §8](/superpowers/specs/2026-08-21-m1-productos-design).

- [ ] **Paso 1 — Esquemas Zod**

Que `web/` pueda importar el mismo esquema. La validación del cliente es
comodidad; la del servidor es la que manda — pero no tienen por qué diferir.

- [ ] **Paso 2 — `requirePermission` en cada ruta**

`editarPrecios` va con `{ auditaLaRuta: true }`.

- [ ] **Paso 3 — Errores con código estable**

`PRODUCTO_NO_ENCONTRADO` · `CODIGO_DUPLICADO` · `PRECIO_MINIMO_INVALIDO` ·
`PRODUCTO_YA_INACTIVO`.

- [ ] **Paso 4 — Tests E2E, no solo unitarios**

| Verifica | Espera |
| --- | --- |
| `pos` intenta crear | **403** |
| `seller` intenta editar precios | **403** |
| `contador` lista | **200**, y no puede mutar nada |
| `admin` crea y el código aparece | **201** con `codigo` |
| Piso inválido | **422** con mensaje legible |

**Cierra cuando:** los cinco casos pasan y una petición HTTP real devuelve lo
esperado.

---

## Task 6 — Catálogo semilla

**Archivos**
- Modificar: `api/drizzle/seed.ts`
- Modificar: `api/src/db/__tests__/seed.test.ts`

- [ ] **Paso 1 — `sembrarProductos()`, idempotente**

Igual que `sembrarRoles()`: si ya están, no hace nada y sale en 0.

| Código | Nombre | Presentación | Contenido | Unidades |
| --- | --- | --- | --- | --- |
| `PACA-600` | Paca de bolsas 600 ml | `paca` | 600 | 20 |
| `PACA-300` | Paca de bolsas 300 ml | `paca` | 300 | 50 |
| `BOT-20` | Recarga de botellón 20 L | `botellon` | 20000 | 1 |

- [ ] **Paso 2 — Solo `BOT-20` con precio real**

$10.000, confirmado por Aquazaku ([RN-CAT-08](/dominio/productos/)).

Las pacas arrancan en **`0`**. Sus precios no están confirmados, y sembrar un
número plausible sería peor que sembrar un cero: **un cero se ve; un número
inventado se confunde con un dato real** y termina en una venta.

**Cierra cuando:** el seed corre dos veces sin duplicar y los litros calculados
dan 12, 15 y 20.

---

## Task 7 — Pantallas en `web/`

**Archivos**
- Crear: `web/src/app/(app)/modulos/productos/page.tsx`
- Crear: `web/src/app/(app)/modulos/productos/gestion/page.tsx`
- Crear: `web/src/app/(app)/modulos/productos/actions.ts`
- Crear: `web/src/components/productos/`

- [ ] **Paso 1 — Catálogo de lectura, para los cuatro roles**

Server Component que lee con `apiServerFetch()`. **La única función que puede
hablar con `api/`** ([ADR-0002](/decisiones/0002-bff-pattern/)).

- [ ] **Paso 2 — Gestión, solo `admin`**

El guard del route group `(app)` ya resuelve la sesión. Ocultar el menú no es
seguridad ([RN-ACC-02](/dominio/roles-y-permisos/)): el 403 lo da la API.

- [ ] **Paso 3 — Mutaciones por Server Actions**

Nunca `fetch` desde el cliente. La regla de ESLint lo prohíbe, y está para eso.

- [ ] **Paso 4 — Sin TanStack Table**

Con tres productos sería infraestructura sin uso. Entra cuando haya una tabla
que lo pida.

- [ ] **Paso 5 — Verificación manual en browser**

Login como `admin` → crear producto → ver el código generado → cambiar un
precio → **encontrar ese cambio en `/admin/auditoria` con el antes y el
después**.

Después, login como `pos`: ver el catálogo, no ver el botón de gestión, y
—entrando a la URL a mano— recibir 403.

**Cierra cuando:** los dos recorridos se hicieron en un browser real.

---

## Task 8 — Bruno, documentación y cierre

**Archivos**
- Crear: `api/bruno/aquazaku/5-Productos/`
- Modificar: `docs/` — backend, base de datos, frontend, roadmap

- [ ] **Paso 1 — Colección Bruno con aserciones**

No requests decorativos: cada uno con tests. Incluir el que **debe fallar** —
crear producto como `pos` y esperar 403.

:::caution[`params:query` va a nivel superior]
Adentro del bloque `get { }` Bruno **saltea el archivo entero** con un warning
fácil de pasar por alto, y la corrida sigue en verde con menos requests. Si el
resumen dice `Skipped`, hay un archivo que no corrió.
:::

- [ ] **Paso 2 — Documentar lo implementado, no lo planeado**

| Doc | Qué actualizar |
| --- | --- |
| `backend/index.md` | Endpoints y códigos de error |
| `base-de-datos/index.md` | Tabla `productos`, migración `0002`, columna generada, los `CHECK` |
| `frontend/index.md` | Las dos pantallas |
| `arquitectura/roadmap.md` | M1 terminado, M2 por arrancar |
| `arquitectura/modulos.md` | Estado y qué quedó construido |

- [ ] **Paso 3 — Barrido de `/docs`**

Links internos **con anchors**, frontmatter completo, cero mojibake.

- [ ] **Paso 4 — Verificación final de punta a punta**

Todos los servicios arriba, browser real, los diez criterios de la
[spec §13](/superpowers/specs/2026-08-21-m1-productos-design).

**Cierra cuando:** Bruno verde contra servidor real y `/docs` refleja lo que
existe.

---

## Definition of Done de M1

1. `admin` crea un producto desde la UI y le aparece con código generado.
2. Un `UPDATE` directo en `psql` que viole el piso **es rechazado por Postgres**.
3. `litros` da 12, 15 y 20 sin que nadie lo haya escrito.
4. `pos` y `seller` ven el catálogo y reciben **403** al intentar editarlo.
5. Un cambio de precio deja fila en `audit_log` con antes y después.
6. Un producto desactivado desaparece del listado por defecto y sigue existiendo.
7. El seed corre dos veces sin duplicar nada.
8. `api/` y `web/` verdes; Bruno verde contra servidor real.
9. `/docs` refleja lo implementado.
10. **Verificado en un browser real, con todos los servicios arriba.**

---

## Notas de ejecución

*(Se completan mientras se implementa: qué hubo que corregir del plan y qué se
descubrió construyendo. La sección equivalente del
[plan de M0](/superpowers/plans/2026-08-19-m0-auth-rbac) resultó ser la parte
más útil del documento — es donde quedaron los bugs que ninguna suite miraba.)*

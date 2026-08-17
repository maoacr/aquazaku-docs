---
title: Roles y permisos
description: Modelo de autorización de Aquazaku — Admin, Seller y POS, qué puede hacer cada uno y sobre qué datos.
sidebar:
  order: 9
---

## Los tres roles

**Estado:** ✅ Confirmada — definidos por Aquazaku.

El sistema tiene exactamente **tres roles**. No hay más, y agregar uno nuevo es
una decisión de negocio, no una comodidad de implementación.

| Rol | Quién es | Dónde opera | Cómo vende |
| --- | --- | --- | --- |
| `admin` | Dueño / administración | Web | — (supervisa) |
| `seller` | Vendedor de ruta | **Mobile** | Va al cliente |
| `pos` | Punto de venta fijo | Web / terminal | El cliente viene |

La diferencia entre `seller` y `pos` no es de jerarquía: es de **contexto de
operación**. Uno vende en la calle, sin señal, contra la carga de su vehículo.
El otro vende en el mostrador, con conexión, contra el stock de bodega.

Esa distinción atraviesa todo el sistema —stock por ubicación, modo offline,
rendición— y por eso son dos roles y no uno con un flag.

---

## El error que casi todos cometen

Un permiso tiene **dos ejes**, no uno. La mayoría de los sistemas modela solo el
primero y después parchea el segundo a mano por toda la aplicación.

| Eje | Pregunta | Ejemplo |
| --- | --- | --- |
| **Acción** | ¿Qué puede hacer? | `ventas:ver` |
| **Alcance** | ¿Sobre qué datos? | Solo las suyas |

Un `seller` "puede ver ventas" — pero solo las suyas. Eso **no** es un flag
booleano: es un filtro de datos. Si tratás el alcance como un `if` suelto en cada
endpoint, tarde o temprano hay un endpoint donde te olvidaste, y un vendedor ve
la facturación completa de la empresa.

:::danger[Regla de oro]
El alcance es parte del permiso, no un detalle de implementación.
Se declara junto al permiso y se aplica en un solo lugar.
:::

### Alcances definidos

| Alcance | Significa |
| --- | --- |
| `todo` | Todos los registros del sistema |
| `ruta` | Solo los de la ruta que tiene abierta |
| `propio` | Solo los registros que él mismo creó |
| — | Sin acceso |

---

## Nomenclatura de permisos

```
ventas:anular
  │      └── acción
  └───────── recurso
```

Minúsculas, sin acentos, `recurso:accion`. El mismo string se usa en el backend,
en el frontend y en esta documentación. Una sola fuente de verdad.

---

## Matriz de permisos

**Leyenda:** ✅ alcance `todo` · 🟡 alcance limitado (se indica) · ❌ sin acceso

:::caution[Los roles están confirmados; el detalle de la matriz no]
Que existan `admin`, `seller` y `pos` viene de Aquazaku. **La asignación
celda por celda todavía es un borrador nuestro.** Repasala con el cliente antes
de implementar — sobre todo las filas marcadas con ⚠️.
:::

### Ventas y cobros

| Permiso | `admin` | `seller` | `pos` |
| --- | :-: | :-: | :-: |
| `ventas:ver` | ✅ | 🟡 `propio` | 🟡 `propio` |
| `ventas:crear` | ✅ | 🟡 `ruta` | ✅ |
| `ventas:anular` ⚠️ | ✅ | ❌ | ❌ |
| `cobros:ver` | ✅ | 🟡 `propio` | 🟡 `propio` |
| `cobros:registrar` | ✅ | 🟡 `ruta` | ✅ |

### Clientes

| Permiso | `admin` | `seller` | `pos` |
| --- | :-: | :-: | :-: |
| `clientes:ver` | ✅ | 🟡 `ruta` | ✅ |
| `clientes:crear` | ✅ | 🟡 `ruta` | ✅ |
| `clientes:verificar_documento` | ✅ | 🟡 `ruta` | ✅ |
| `clientes:editar` | ✅ | ❌ | ❌ |
| `clientes:habilitar_credito` | ✅ | ❌ | ❌ |

### Stock de producto

| Permiso | `admin` | `seller` | `pos` |
| --- | :-: | :-: | :-: |
| `stock:ver` | ✅ | 🟡 `ruta` | 🟡 `BODEGA` |
| `stock:cargar_ruta` ⚠️ | ✅ | ❌ | ❌ |
| `stock:ajustar` | ✅ | ❌ | ❌ |
| `insumos:ver` | ✅ | ❌ | ❌ |
| `insumos:ajustar` | ✅ | ❌ | ❌ |

### Botellones — por cantidad

| Permiso | `admin` | `seller` | `pos` |
| --- | :-: | :-: | :-: |
| `botellones:ver` | ✅ | 🟡 `ruta` | 🟡 `BODEGA` |
| `botellones:entregar` | ✅ | 🟡 `ruta` | ✅ |
| `botellones:recibir_retorno` | ✅ | 🟡 `ruta` | ✅ |
| `botellones:registrar` | ✅ | ❌ | ❌ |
| `botellones:descartar` | ✅ | ❌ | ❌ |

### Bases — por unidad identificada

| Permiso | `admin` | `seller` | `pos` |
| --- | :-: | :-: | :-: |
| `bases:ver` | ✅ | 🟡 `ruta` | ✅ |
| `bases:prestar` ⚠️ | ✅ | 🟡 `ruta` | ✅ |
| `bases:retirar` | ✅ | 🟡 `ruta` | ✅ |
| `bases:registrar` | ✅ | ❌ | ❌ |
| `bases:descartar` | ✅ | ❌ | ❌ |

:::note[Por qué son dos bloques y no uno]
Botellones y bases se rastrean con granularidad distinta
([Botellones y bases](/dominio/botellones-y-bases/)), así que sus operaciones no
son las mismas. `botellones:entregar` mueve una cantidad; `bases:prestar` asigna
una unidad concreta a una dirección concreta.

Colapsarlos en un `envases:*` genérico esconde justamente la diferencia que hace
falta modelar.
:::

### Producción y agua

| Permiso | `admin` | `seller` | `pos` |
| --- | :-: | :-: | :-: |
| `produccion:ver` | ✅ | ❌ | ❌ |
| `produccion:registrar_cierre` ⚠️ | ✅ | ❌ | ❌ |
| `tanques:ver` | ✅ | ❌ | ❌ |
| `tanques:registrar_reposicion` | ✅ | ❌ | ❌ |
| `tanques:ajustar` | ✅ | ❌ | ❌ |
| `configuracion:equivalencias` | ✅ | ❌ | ❌ |

:::caution[Falta un actor]
Hoy solo `admin` puede registrar el cierre de producción, porque los tres roles
confirmados no incluyen a nadie de planta.

Si quien envasa no es un `admin`, o el cierre lo carga un operario, **falta un
rol** — y eso hay que resolverlo con Aquazaku antes de implementar
[RN-PRD-04](/dominio/produccion/).
:::

### Proveedores y compras

| Permiso | `admin` | `seller` | `pos` |
| --- | :-: | :-: | :-: |
| `proveedores:ver` | ✅ | ❌ | ❌ |
| `proveedores:crear` | ✅ | ❌ | ❌ |
| `compras:crear` | ✅ | ❌ | ❌ |
| `compras:recibir` ⚠️ | ✅ | ❌ | ❌ |

### Rutas

| Permiso | `admin` | `seller` | `pos` |
| --- | :-: | :-: | :-: |
| `rutas:ver` | ✅ | 🟡 `propio` | ❌ |
| `rutas:abrir` ⚠️ | ✅ | ❌ | ❌ |
| `rutas:rendir` | ✅ | 🟡 `propio` | ❌ |
| `rutas:cerrar_con_faltante` | ✅ | ❌ | ❌ |

### Administración

| Permiso | `admin` | `seller` | `pos` |
| --- | :-: | :-: | :-: |
| `productos:ver` | ✅ | ✅ | ✅ |
| `productos:editar_precios` | ✅ | ❌ | ❌ |
| `usuarios:*` | ✅ | ❌ | ❌ |
| `reportes:operativos` | ✅ | ❌ | ❌ |
| `reportes:financieros` | ✅ | ❌ | ❌ |
| `configuracion:*` | ✅ | ❌ | ❌ |

---

## La consecuencia de tener solo tres roles

Con este modelo, **`admin` concentra todas las funciones de control**: ajusta
stock, anula ventas, cambia precios, descarta botellones y bases, y administra
usuarios.

Eso es perfectamente razonable en una operación chica. Pero hay que decirlo en
voz alta, porque tiene una consecuencia directa:

:::danger[Sin separación de funciones, la auditoría es el único control]
En un sistema con más roles, el control es estructural: quien vende no puede
ajustar el stock, así que no puede tapar un faltante.

Acá no existe esa barrera. `admin` puede hacer todo y corregir la evidencia de
haberlo hecho. Lo único que queda en pie es el **registro de auditoría**
([RN-ACC-04](#rn-acc-04--toda-acción-sensible-queda-auditada)).

Por eso la auditoría deja de ser un "nice to have" y pasa a ser un requisito de
primer orden. Si se implementa tarde o a medias, el sistema no controla nada.
:::

Las dos preguntas que hay que hacerle a Aquazaku:

1. ¿Cuántas personas van a tener rol `admin`? Si son varias, ¿está bien que
   todas puedan anular ventas y ajustar stock?
2. ¿Hace falta un `admin` de solo lectura, para un contador externo o para el
   dueño que quiere mirar sin poder romper nada?

---

## Reglas de acceso

### RN-ACC-01 — Un usuario tiene exactamente un rol

**Estado:** 🟡 Supuesto

No hay acumulación de roles: un usuario es `admin`, `seller` **o** `pos`.

**Por qué:** la combinación de roles multiplica los casos a probar y hace que
nadie pueda responder "¿qué ve exactamente esta persona?".

:::caution[Caso a validar]
¿Puede una misma persona atender el mostrador algunos días y salir a ruta otros?
Si la respuesta es sí, este modelo necesita revisión — o esa persona tiene dos
usuarios, que es una solución fea pero honesta.
:::

---

### RN-ACC-02 — La UI oculta, la API prohíbe

**Estado:** ✅ Confirmada *(decisión técnica)*

El permiso se valida **siempre** en el servidor. Que el frontend no muestre el
botón es comodidad para el usuario, no seguridad.

**Por qué:** ocultar un botón no impide llamar al endpoint. Toda validación que
viva únicamente en el cliente ya está rota, solo que todavía no lo sabés.

:::danger[No negociable]
Un endpoint sin verificación de permiso en el servidor es un endpoint público,
sin importar cómo se vea la pantalla. Y con `seller` operando desde una app
mobile —que es un cliente que no controlás— esto no es teoría.
:::

---

### RN-ACC-03 — El alcance se aplica en la capa de datos

**Estado:** ✅ Confirmada *(decisión técnica)*

El filtro por alcance (`propio`, `ruta`, `todo`) se aplica en un único lugar del
acceso a datos, no repetido endpoint por endpoint.

**Por qué:** repetir el filtro garantiza que algún día falte en uno. Y ese uno
va a ser el de reportes.

---

### RN-ACC-04 — Toda acción sensible queda auditada

**Estado:** 🟡 Supuesto

Anulaciones, ajustes de stock, bajas de botellones y bases, préstamo y retiro de
bases, cambios de precio, habilitación de crédito y cierres con faltante
registran **quién, cuándo y por qué**.

**Por qué:** con `admin` concentrando todo el poder de corrección, la auditoría
es el único mecanismo de control que queda. Todas las reglas de inmutabilidad
del dominio ([RN-VEN-02](/dominio/ventas/), [RN-RUT-04](/dominio/rutas/))
dependen de que exista.

---

### RN-ACC-05 — Un usuario no se borra, se desactiva

**Estado:** 🟡 Supuesto

Un usuario con historial se desactiva y pierde el acceso, pero sus registros
mantienen la referencia a él.

**Por qué:** borrar al usuario deja huérfanas todas las ventas que registró.

---

## Preguntas abiertas

- ¿`pos` puede anular una venta del día, o siempre tiene que pedírselo a `admin`?
  Es la fricción operativa más probable del modelo.
- ¿`pos` vende contra el stock de bodega directamente, o el punto de venta tiene
  su propia ubicación de stock?
- ¿`seller` puede registrar clientes nuevos en la calle, o los crea la oficina?
- ¿Quién carga la ruta del `seller` por la mañana — un `admin` siempre?
- ¿Hay más de un punto de venta?

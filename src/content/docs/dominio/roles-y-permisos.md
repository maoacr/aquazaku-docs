---
title: Roles y permisos
description: Modelo de autorización de Aquazaku — Admin, Seller, POS y Contador, qué puede hacer cada uno y sobre qué datos.
sidebar:
  order: 9
---

## Los cuatro roles

**Estado:** ✅ Confirmada — definidos por Aquazaku.

El sistema tiene exactamente **cuatro roles**. No hay más, y agregar uno nuevo
es una decisión de negocio, no una comodidad de implementación.

| Rol | Quién es | Dónde opera | Qué hace |
| --- | --- | --- | --- |
| `admin` | Dueño / administración | Web (remoto, visita la planta cuando viaja) | Configuración, auditoría, ajustes sensibles |
| `seller` | Vendedor | **App móvil** | Contacta clientes y registra ventas a distancia |
| `pos` | Planta + mostrador | Web / terminal en la planta | Venta de mostrador, preparación de pedidos, despacho, cierre de producción |
| `contador` | Contador externo o interno | Web, **solo lectura** | Genera reportes PDF para temas impositivos y legales |

:::note[El `seller` es un usuario de app móvil]
El acceso web para el `seller` puede existir como respaldo —teléfono roto,
consulta desde la oficina— pero **no es su superficie de trabajo**. La app móvil
es la que se diseña y la que define sus flujos.

Esto no es un detalle de implementación: condiciona el modo offline
([RN-RUT-05](/dominio/rutas/)), la validación local de documentos
([RN-CLI-11](/dominio/clientes/)) y toda la operación de ruta.
:::

La diferencia entre `seller` y `pos` no es de jerarquía: es de **contexto de
operación**. Uno contacta clientes por canal remoto. El otro opera la planta y
atiende mostrador.

:::tip[Seller NO es repartidor]
Es importante aclararlo para no caer en el modelo equivocado: en Aquazaku el
`seller` **no visita con producto**, solo contacta clientes y registra ventas.
La preparación del pedido y la entrega están a cargo del `pos` en la planta,
con **transportadores informales externos** (no son usuarios del sistema). Ver
[Operaciones](/dominio/operaciones/) cuando se redacte esa sección.
:::

### Por qué existe `contador` aparte de `admin`

El `admin` es el dueño, vive en otra ciudad y concentra los permisos sensibles
del sistema (anular ventas, ajustar stock, cambiar precios). Para temas
tributarios en Colombia — DIAN, retenciones, ICA, etc. — hace falta entregarle
reportes a un **contador externo** que no tiene por qué poder modificar nada.

Un `admin` "de solo lectura" como flag sobre el mismo rol **no alcanza**:
el contador necesita generar y descargar sus propios reportes sin heredar los
permisos de modificación. Es un rol aparte, no un subconjunto.

:::danger[El contador NO hereda los privilegios del admin]
Esta separación es importante por **auditoría**: el dueño no debe ser quien se
genera a sí mismo los reportes que va a presentar. Si el dueño es el contador,
la trazabilidad se pierde.
:::

### Multi-rol por usuario

**Estado:** ✅ Confirmada — cerrá la pregunta #13 de
[Qué falta preguntar](/empezar/pendientes/).

Un mismo usuario puede tener **N roles asignados** a la vez. Esto cubre el caso
futuro en que una persona ejerza varias funciones (ej. operador de planta que
también venda en la calle).

```
usuario = {
  id: uuid,
  email: string,
  roles: ["pos", "seller"],   // cualquiera de los cuatro; asignable por admin
  ...
}
```

**Todo se audita bajo el mismo `user_id`**, sin importar bajo qué rol se actuó.
La auditoría registra `rol_ejercido` además del `user_id`, así que se puede
responder "¿qué hizo este usuario como seller?" o "¿qué hizo como pos?"
filtrando el log.

### Multi-rol por usuario ≠ UI multi-rol

Que un usuario tenga permisos de `pos` y `seller` **no significa que la app
muestre todos los módulos a la vez**. Regla de UI:

- **App móvil**: por defecto **no muestra** módulos típicos de `pos` (cierre
  de producción, despacho, entrega de bases, configuración). Es una regla de
  UX, no de permisos.
- **Web (desktop)**: muestra los módulos según los roles que el usuario tiene.

El backend **no conoce el device** — autoriza por capacidad del rol, sin mirar
si la petición viene desde mobile o web. Ocultar un botón no es seguridad
([RN-ACC-02](#rn-acc-02--la-ui-oculta-la-api-prohíbe)).

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

:::caution[La matriz es un borrador]
Que existan los cuatro roles viene de Aquazaku. **La asignación celda por celda
sigue siendo un borrador nuestro.** Repasala con el cliente antes de implementar
— sobre todo las filas marcadas con ⚠️.

Los permisos agregados o modificados en esta sesión corresponden a las
decisiones tomadas en [Qué falta preguntar](/empezar/pendientes/): la fila
`ventas:anular` se reformuló según [RN-VEN-08](/dominio/ventas/),
`bases:prestar` se reformuló según [RN-BAS-07](/dominio/botellones-y-bases/), y
`produccion:registrar_cierre` ahora se delega a `pos` por [RN-PRD-04](/dominio/produccion/).
:::

### Ventas y cobros

| Permiso | `admin` | `seller` | `pos` | `contador` |
| --- | :-: | :-: | :-: | :-: |
| `ventas:ver` | ✅ | 🟡 `propio` | 🟡 `propio` | 🟡 `todo` |
| `ventas:crear` | ✅ | ✅ | ✅ | ❌ |
| `ventas:anular` ⚠️ | ✅ | 🟡 `propio + día_en_curso` | 🟡 `propio + día_en_curso` | ❌ |
| `cobros:ver` | ✅ | 🟡 `propio` | 🟡 `propio` | 🟡 `todo` |
| `cobros:registrar` | ✅ | ✅ | ✅ | ❌ |

### Clientes

| Permiso | `admin` | `seller` | `pos` | `contador` |
| --- | :-: | :-: | :-: | :-: |
| `clientes:ver` | ✅ | ✅ | ✅ | 🟡 `todo` |
| `clientes:crear` | ✅ | ✅ | ✅ | ❌ |
| `clientes:verificar_documento` | ✅ | ✅ | ✅ | ❌ |
| `clientes:editar` | ✅ | ❌ | ❌ | ❌ |
| `clientes:habilitar_credito` | ✅ | ❌ | ❌ | ❌ |

### Stock de producto

| Permiso | `admin` | `seller` | `pos` | `contador` |
| --- | :-: | :-: | :-: | :-: |
| `stock:ver` | ✅ | 🟡 `todo` | 🟡 `BODEGA` | 🟡 `todo` |
| `stock:cargar_ruta` ⚠️ | ✅ | ❌ | ✅ | ❌ |
| `stock:ajustar` | ✅ | ❌ | 🟡 `cantidades` (con motivo) | ❌ |
| `insumos:ver` | ✅ | ❌ | ✅ | 🟡 `todo` |
| `insumos:ajustar` | ✅ | ❌ | 🟡 `cantidades` (con motivo) | ❌ |

### Botellones — por cantidad

| Permiso | `admin` | `seller` | `pos` | `contador` |
| --- | :-: | :-: | :-: | :-: |
| `botellones:ver` | ✅ | ✅ | ✅ | 🟡 `todo` |
| `botellones:entregar` | ✅ | ❌ | ✅ | ❌ |
| `botellones:recibir_retorno` | ✅ | ❌ | ✅ | ❌ |
| `botellones:registrar` | ✅ | ❌ | ✅ | ❌ |
| `botellones:descartar` | ✅ | ❌ | ✅ (con motivo) | ❌ |

### Bases — por unidad identificada

| Permiso | `admin` | `seller` | `pos` | `contador` |
| --- | :-: | :-: | :-: | :-: |
| `bases:ver` | ✅ | ✅ | ✅ | 🟡 `todo` |
| `bases:prestar` ⚠️ | ✅ | ❌ | ✅ (con cliente verificado) | ❌ |
| `bases:retirar` | ✅ | ❌ | ✅ | ❌ |
| `bases:registrar` | ✅ | ❌ | ✅ | ❌ |
| `bases:descartar` | ✅ | ❌ | ✅ (con motivo) | ❌ |

:::note[Por qué son dos bloques y no uno]
Botellones y bases se rastrean con granularidad distinta
([Botellones y bases](/dominio/botellones-y-bases/)), así que sus operaciones no
son las mismas. `botellones:entregar` mueve una cantidad; `bases:prestar` asigna
una unidad concreta a una dirección concreta.

Colapsarlos en un `envases:*` genérico esconde justamente la diferencia que hace
falta modelar.
:::

### Producción y agua

| Permiso | `admin` | `seller` | `pos` | `contador` |
| --- | :-: | :-: | :-: | :-: |
| `produccion:ver` | ✅ | ❌ | ✅ | 🟡 `todo` |
| `produccion:registrar_cierre` | ✅ | ❌ | ✅ | ❌ |
| `tanques:ver` | ✅ | ❌ | ✅ | ❌ |
| `tanques:registrar_reposicion` | ✅ | ❌ | ✅ | ❌ |
| `tanques:ajustar` | ✅ | ❌ | ❌ | ❌ |
| `configuracion:equivalencias` | ✅ | ❌ | ✅ | ❌ |

:::tip[¿Quién registra el cierre de producción? — pregunta #8 cerrada]
La persona que opera la planta **es** el `pos`. El cierre de producción lo
registra `pos` directamente, sin pedir autorización a `admin`. Quedó resuelto
en la sesión del 18-ago-2026 y ya no hace falta tratarlo como abierto.
:::

### Proveedores y compras

| Permiso | `admin` | `seller` | `pos` | `contador` |
| --- | :-: | :-: | :-: | :-: |
| `proveedores:ver` | ✅ | ❌ | 🟡 `todo` | 🟡 `todo` |
| `proveedores:crear` | ✅ | ❌ | ❌ | ❌ |
| `compras:crear` | ✅ | ❌ | ✅ | ❌ |
| `compras:recibir` ⚠️ | ✅ | ❌ | ✅ | ❌ |

### Rutas

| Permiso | `admin` | `seller` | `pos` | `contador` |
| --- | :-: | :-: | :-: | :-: |
| `rutas:ver` | ✅ | 🟡 `propio` | 🟡 `todo` | 🟡 `todo` |
| `rutas:abrir` | ✅ | ✅ | ❌ | ❌ |
| `rutas:rendir` | ✅ | 🟡 `propio` | ❌ | ❌ |
| `rutas:cerrar_con_faltante` | ✅ | ❌ | ❌ | ❌ |

### Administración

| Permiso | `admin` | `seller` | `pos` | `contador` |
| --- | :-: | :-: | :-: | :-: |
| `productos:ver` | ✅ | ✅ | ✅ | 🟡 `todo` |
| `productos:editar_precios` | ✅ | ❌ | ❌ | ❌ |
| `usuarios:*` | ✅ | ❌ | ❌ | ❌ |
| `reportes:operativos` | ✅ | ❌ | 🟡 `prep` | ✅ |
| `reportes:financieros` | ✅ | ❌ | ❌ | ✅ |
| `reportes:descargar_pdf` | ✅ | ❌ | 🟡 `operativos` | ✅ |
| `configuracion:*` | ✅ | ❌ | ❌ | ❌ |

---

## La consecuencia de tener `admin` con super-poderes

Con este modelo, **`admin` concentra las funciones de control sensibles**:
ajusta stock, anula ventas, cambia precios, descarta botellones y bases, y
administra usuarios. Ningún otro rol puede tocar nada de esto.

Eso es perfectamente razonable en una operación chica, sobre todo porque **el
dueño es el único `admin`** y vive en otra ciudad (viaja a Tasajera cada cierto
tiempo). Pero hay que decirlo en voz alta:

:::danger[Sin separación de funciones, la auditoría es el único control]
En un sistema con más roles, el control sería estructural: quien vende no
podría ajustar el stock, así que no podría tapar un faltante.

Acá no existe esa barrera. `admin` puede hacerlo todo y corregir la evidencia
de haberlo hecho. Lo único que queda en pie es el **registro de auditoría**
([RN-ACC-04](#rn-acc-04--toda-acción-sensible-queda-auditada)).

**El rol `contador` no resuelve esto**, pero ayuda: alguien externo mira la
información sin poder modificarla, y cada descarga de reporte PDF queda en el
log. La auditoría gana un testigo.
:::

---

## Reglas de acceso

### RN-ACC-01 — Un usuario puede tener varios roles a la vez

**Estado:** ✅ Confirmada — cerrá la pregunta #13 de
[Qué falta preguntar](/empezar/pendientes/).

Un usuario puede tener **N roles** asignados a la vez, configurado por `admin`.
Hoy el operario de planta tiene solo `pos`; una futura persona híbrida podría
tener `["pos", "seller"]`.

**Por qué:** la operación futura de Aquazaku puede incluir personas que
atiendan mostrador y salgan a ruta según el día. Prohibirlo en el modelo
implica crear dos usuarios para la misma persona — feo y propenso a errores.

:::tip[Multi-rol NO es lo mismo que UI multi-rol]
El usuario puede tener permisos de `pos` y `seller`. Pero la app muestra los
módulos según el contexto y el rol ejercido: en mobile, por defecto se ocultan
los módulos de `pos`. Ver la sección "Multi-rol por usuario" arriba.
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

- ¿`pos` vende contra el stock de bodega directamente, o el punto de venta tiene
  su propia ubicación de stock?
- ¿Hay más de un punto de venta?

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
la sección de Operaciones cuando se redacte — todavía no existe.
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

**Todos los roles asignados están activos simultáneamente. NO existe switch-role
ni `active_role`.** Un usuario con `["pos", "seller"]` ve y opera ambos módulos
sin elegir uno. La decisión de diseño completa está en
[ADR-0003](/decisiones/0003-roles-permisos-matriz/).

**Todo se audita bajo el mismo `user_id`**. La auditoría registra
`rol_ejercido` como **array** (los roles bajo los que se ejecutó la acción
específica), así que se puede responder "¿qué hizo este usuario como seller?"
o "¿qué hizo como pos?" filtrando el log.

### Multi-rol por usuario ≠ UI multi-rol

Que un usuario tenga permisos de `pos` y `seller` **no significa que la app
muestre los módulos según un rol activo**. Regla de UI:

- **Web (desktop)**: muestra los módulos para los que el usuario tiene al
  menos un rol con permiso. Sin selector de rol, sin switch.
- **App móvil** (post-MVP): la lógica de UI mobile se define aparte, pero la
  regla sigue siendo "permisos del backend, UI mobile decide qué mostrar".

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

| Alcance | Significa | Filtra datos |
| --- | --- | :-: |
| `todo` | Todos los registros del sistema | sin filtro |
| `propio` | Solo los registros que él mismo creó | sí |
| `ruta` | Solo los de la ruta que tiene abierta | sí |
| `BODEGA` | Solo lo que está físicamente en bodega | sí |
| `prep` | Solo los reportes de preparación | no — categoría |
| `operativos` | Solo los reportes operativos | no — categoría |
| — | Sin acceso | — |

Los cuatro primeros filtran **filas de una tabla** y se aplican con una cláusula
`WHERE`. `prep` y `operativos` no: acotan **qué categoría de reporte** se puede
ver o descargar, y eso lo resuelve el módulo de reportes (M13), no la capa de
datos.

La distinción importa: si un alcance categórico se colara en una consulta de
tabla, no habría columna por la cual filtrar. El código
([`scopes.ts`](/decisiones/0005-scopes-fail-closed/)) falla en ese caso en vez de
devolver todo sin filtrar.

:::caution[`cantidades` y `con motivo` NO son alcances]
En la matriz vas a ver celdas como `🟡 cantidades (con motivo)` o
`✅ con cliente verificado`. **No son alcances** — son restricciones de negocio y
viven en la capa de servicio del módulo, no en la matriz de permisos.

La matriz responde *¿puedo hacer esto?*. El servicio responde *¿se dan las
condiciones para hacerlo ahora?*. Mezclarlas convierte la matriz en un árbol de
decisión imposible de testear.
:::

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

:::tip[Estado de la matriz]
Las celdas marcadas ⚠️ fueron **resueltas en la sesión de M0** (sesión del
19-ago-2026). La asignación celda por celda está documentada en
[ADR-0003](/decisiones/0003-roles-permisos-matriz/). La matriz que ves abajo es
la versión ejecutable que se codifica en `api/src/modules/authz/matrix.ts`.

La matriz del doc y la del código son **la misma fuente de verdad** — un cambio
acá se refleja en el código y viceversa.
:::

### Ventas y cobros

| Permiso | `admin` | `seller` | `pos` | `contador` |
| --- | :-: | :-: | :-: | :-: |
| `ventas:ver` | ✅ | 🟡 `propio` | 🟡 `propio` | 🟡 `todo` |
| `ventas:crear` | ✅ | ✅ | ✅ | ❌ |
| `ventas:anular` | ✅ `todo` | 🟡 `propio` + status=pendiente | 🟡 `propio` + status=pendiente | ❌ |
| `ventas:anular_verificada` | ✅ `todo` (motivo obligatorio) | ❌ | ❌ | ❌ |
| `ventas:verificar_pago` | ✅ `todo` | 🟡 `propio` | 🟡 `propio` | ❌ |
| `ventas:gestionar_cuentas_pendientes` | ✅ `todo` | ❌ | ❌ | ❌ |
| `cobros:ver` | ✅ | 🟡 `propio` | 🟡 `propio` | 🟡 `todo` |
| `cobros:registrar` | ✅ | ✅ | ✅ | ❌ |

:::note[State machine de ventas — implementado en M2]
Las nuevas reglas `ventas:anular` (restringida a status pendiente),
`ventas:anular_verificada`, `ventas:verificar_pago` y
`ventas:gestionar_cuentas_pendientes` son consecuencia del state machine
completo de ventas (pago total → pendiente de verificación → verificado, pago
parcial → parcial_verificado con saldo, > 7 días → vencida). El state machine
en sí se implementa en M2; en M0 la matriz ya tiene las reglas declaradas
para que cuando llegue M2 estén listas.
:::

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
| `stock:cargar_ruta` | ✅ `todo` | ❌ | ✅ `todo` | ❌ |
| `stock:ajustar` | ✅ | ❌ | 🟡 `cantidades` (con motivo) | ❌ |
| `insumos:ver` | ✅ | ❌ | ✅ | 🟡 `todo` |
| `insumos:ajustar` | ✅ | ❌ | 🟡 `cantidades` (con motivo) | ❌ |

:::note[Cargar stock a ruta es solo del `pos`]
Confirmado en la sesión de M0: un usuario con **solo** rol `seller` no puede
cargar stock a una ruta (no tiene sentido — el seller no está en la planta).
Si el usuario tiene `["pos", "seller"]`, sí puede porque su rol `pos` lo
habilita.
:::

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
| `bases:prestar` | ✅ `todo` | ❌ | ✅ con cliente verificado | ❌ |
| `bases:retirar` | ✅ | ❌ | ✅ | ❌ |
| `bases:registrar` | ✅ | ❌ | ✅ | ❌ |
| `bases:descartar` | ✅ | ❌ | ✅ (con motivo) | ❌ |

:::note[Prestar base requiere cliente verificado]
Constraint de negocio ([RN-CLI-11](/dominio/clientes/)): el préstamo de una
base exige que el cliente haya pasado la verificación de documento. Vive en la
capa de servicio, no en la matriz — la matriz dice "puede prestar", el servicio
chequea "el cliente está verificado".
:::

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
| `compras:recibir` | ✅ `todo` | ❌ | ✅ solo si compra=pendiente y proveedor=activo | ❌ |

:::note[Recibir compra tiene precondiciones]
`pos` solo puede recibir una compra si está en estado `pendiente` y su
proveedor está `activo`. Es una validación de la capa de servicio
(chequea ambos antes de confirmar la recepción).
:::

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
| `auditoria:ver` | ✅ `todo` | ❌ | ❌ | ✅ `todo` (read-only) |
| `reportes:operativos` | ✅ | ❌ | 🟡 `prep` | ✅ |
| `reportes:financieros` | ✅ | ❌ | ❌ | ✅ |
| `reportes:descargar_pdf` | ✅ | ❌ | 🟡 `operativos` | ✅ |
| `configuracion:*` | ✅ | ❌ | ❌ | ❌ |

:::note[Auditoría consultable desde M0]
`auditoria:ver` se implementa en M0 como parte del módulo de Auth + RBAC: el
admin puede consultar el log completo, el contador tiene acceso read-only para
descargar reportes. La UI vive en `/admin/auditoria` y `/contador/auditoria`.
El PDF export y las agregaciones van en M13.
:::

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

**Estado:** ✅ Confirmada (sesión M0 del 19-ago-2026)

Anulaciones, ajustes de stock, bajas de botellones y bases, préstamo y retiro de
bases, cambios de precio, habilitación de crédito y cierres con faltante
registran **quién, cuándo, bajo qué rol y por qué**. La consulta de la
auditoría es accesible desde la UI por admin (vista completa) y contador
(read-only para temas impositivos/DIAN).

**Por qué:** con `admin` concentrando todo el poder de corrección, la auditoría
es el único mecanismo de control que queda. Todas las reglas de inmutabilidad
del dominio ([RN-VEN-02](/dominio/ventas/), [RN-RUT-04](/dominio/rutas/))
dependen de que exista. La consulta UI cierra el ciclo: sin forma de ver la
auditoría, no es control, es solo un log oculto.

**Implementación:** `audit_log` append-only (REVOKE + trigger en Postgres),
escritura automática desde `authz/middleware.ts` (allow/deny) y desde la capa
de servicio de cada módulo (acciones sensibles). La UI vive en
`/admin/auditoria` y `/contador/auditoria` con filtros por usuario, módulo,
acción y rango de fechas. Detalles en
[ADR-0001](/decisiones/0001-stack-m0) y
[spec de M0](/superpowers/specs/2026-08-19-auth-rbac-design).

---

### RN-ACC-05 — Un usuario no se borra, se desactiva

**Estado:** 🟡 Supuesto

Un usuario con historial se desactiva y pierde el acceso, pero sus registros
mantienen la referencia a él.

**Por qué:** borrar al usuario deja huérfanas todas las ventas que registró.

---

### RN-ACC-06 — Siempre tiene que quedar un administrador activo

**Estado:** ✅ Confirmada (implementación de M0, 20-ago-2026)

El sistema **rechaza** cualquier operación que dejaría cero administradores
activos:

- quitarle el rol `admin` al único que lo tiene,
- desactivar al único administrador activo.

Un administrador **desactivado no cuenta** como respaldo: si contara, el sistema
quedaría en manos de una cuenta que no puede entrar.

**Por qué:** hoy el dueño es el único `admin`
([ver arriba](#la-consecuencia-de-tener-admin-con-super-poderes)). Sin esta
regla, un click de más en la pantalla de usuarios —la que existe justamente para
editar usuarios— lo deja sin el rol, y **nadie queda con permiso para
devolvérselo**. El sistema pasa a ser inadministrable y solo se recupera
metiendo mano directamente en la base de datos.

No es un escenario rebuscado. Es el error más fácil de cometer en esa pantalla.

**Cómo se comporta:** la API responde `409` con el código `ULTIMO_ADMIN` y un
mensaje que dice qué hacer ("asignale el rol admin a otra persona antes"). El
intento fallido **queda auditado**: alguien tratando de quitarse el rol admin es
exactamente el tipo de cosa que hay que poder ver después.

**Qué NO hace:** no impide que un admin se quite el rol a sí mismo si hay otro
administrador activo. Delegar y salir es una operación legítima.

---

### RN-ACC-07 — Un cambio de roles hace efecto en el acto

**Estado:** ✅ Confirmada (implementación de M0, 20-ago-2026)

Cuando un admin le cambia los roles a alguien, el cambio rige **desde el
siguiente request**, sin necesidad de que la persona vuelva a iniciar sesión. Y
sin cerrarle la sesión: sigue trabajando, con los permisos nuevos.

**Por qué:** los roles se congelan dentro de la sesión al iniciar sesión
([RN-ACC-01](#rn-acc-01--un-usuario-puede-tener-varios-roles-a-la-vez)), que es
lo que evita consultar la base en cada request. Sin actualizarlos al cambiarlos,
quitarle el rol `admin` a alguien lo dejaría administrando **siete días más**,
hasta que le venza la sesión.

**Por qué no se cierra la sesión:** cerrarla también resolvería el problema, pero
echaría a la persona del sistema cada vez que un admin le toca un rol. Un trámite
administrativo no debería interrumpirle el trabajo a nadie.

**Excepción:** desactivar a un usuario **sí** le cierra las sesiones. Ahí no hay
trabajo que preservar.

---

## Preguntas abiertas

- ¿`pos` vende contra el stock de bodega directamente, o el punto de venta tiene
  su propia ubicación de stock?
- ¿Hay más de un punto de venta?

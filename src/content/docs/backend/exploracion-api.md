---
title: Explorar la API con Bruno
description: Colección versionada de los endpoints de api/. Se corre a mano para probar y en CI como verificación sobre HTTP real.
---

La API se explora con [Bruno](https://www.usebruno.com/): un cliente HTTP cuyas
colecciones son **archivos de texto versionados en el repo**, no un espacio en
la nube de alguien.

La colección vive en `api/bruno/aquazaku/`.

:::tip[Por qué archivos y no un servicio]
Una colección en la nube se desincroniza del código en silencio: alguien cambia
un endpoint, la colección sigue mostrando el anterior, y nadie se entera hasta
que un request falla sin explicación.

Acá la colección viaja en el mismo commit que el endpoint. Si un pull request
cambia una ruta y no toca la colección, se ve en el diff.
:::

## Qué cubre

| Carpeta | Qué prueba |
|---|---|
| `01-Auth` | Señal de vida, login y perfil con permisos resueltos |
| `02-Usuarios` | Listar, crear, asignar roles y la **protección del último admin** |
| `03-Auditoria` | Consulta, filtro de denegados y validación de filtros |
| `04-Productos` | Catálogo, piso de precio, auditoría del cambio y **un `pos` recibiendo 403** |
| `05-Stock` | Lotes, ajuste, descarte, el libro y **un `contador` recibiendo 403** |
| `06-Insumos` | Alta, entrada en unidades y en kilos, la conversión rechazada sin equivalencia, y **un `seller` recibiendo 403** |
| `07-Produccion` | El cierre del día con sus cuatro escritos, la reposición **sin cantidad**, la reconciliación que no escribe, y **un `pos` que puede anotar pero no ajustar** |
| `08-Clientes` | El dígito de verificación calculado, el cruce CC/NIT que **advierte sin bloquear**, el crédito rechazado sin verificación, y **un `contador` recibiendo 403** |
| `09-Ventas` | El precio congelado, el piso que no se perfora, la anulación que devuelve al mismo lote, el cobro que no puede pasarse de la deuda, y **un `contador` recibiendo 403** |
| `10-Retornables` | La **ley de conservación** del parque, la entrega que escribe dos filas con signo opuesto, la base que se presta a una **dirección**, el daño que genera recargo, **la venta que despacha un envase y lo deja a nombre del cliente**, y **un `seller` que mira y no opera** |
| `11-Proveedores` | La compra que escribe el documento **y** el inventario juntos, el crédito modelado sin ejercerse, el aviso de vencidas que se apaga al pagar, y **un `pos` que compra pero no da de alta proveedores** |
| `12-Sesion` | Cierre de sesión y que la credencial deje de servir |

Las carpetas llevan número porque el orden importa: el login deja la cookie que
usan los requests siguientes.

:::caution[El cierre de sesión va último, por definición]
`Sesion` cierra la sesión. Cualquier carpeta que corra después lo hace **sin
cookie** y falla entera con 401.

Cuando se agregue una carpeta nueva, va **antes** de esa. Por eso `Sesion` ya se
movió seis veces: de `04` a `05` con el catálogo, a `06` con el stock, a `07`
con los insumos, a `08` con producción, a `09` con clientes, a `10` con ventas, a `11` con
retornables y a `12` con proveedores.

:::danger[Los números llevan cero adelante, y no es estética]
`bru` ordena las carpetas **alfabéticamente**, así que `"10" < "2"`. La primera
vez que `Sesion` llegó a `10-Sesion`, el logout corrió SEGUNDO: dejó sin cookie
a todo lo que venía después y **115 de 133 requests fallaron con 401**.

Lo peor es dónde apuntaba el error. Los tests rojos eran los de `2-Usuarios`,
`3-Auditoria`, `4-Productos` — módulos que no se habían tocado. Nada señalaba a
la carpeta que se acababa de renombrar.

Con `01`, `02`, … `11` el orden alfabético y el numérico coinciden, y la
convención sobrevive pasado el noveno módulo. Quedan cinco lugares antes de que
haga falta pensarlo de nuevo.
:::

Renumerarla cada vez es más trabajo que dejarla fija, y es a propósito: el
número es lo que hace visible el orden en el árbol de archivos. Un `99-Sesion`
que nunca se mueve esconde que hay un orden.
:::

### El único lugar donde otro rol pega contra `api/`

Seis carpetas cambian de sesión a mitad de camino y vuelven a admin al
terminar.

`04-Productos` entra como el `pos` que creó `02-Usuarios`, verifica que **no**
pueda crear productos (403) y que **sí** pueda leer el catálogo (200).

`05-Stock` **crea su propio `contador`**, y no por gusto: el usuario de
`02-Usuarios` termina con `pos` + `seller`, y como los roles se **suman**
(RN-ACC-01), el `pos` puede ajustar stock. Ese usuario no sirve para probar un
rechazo. El `contador` es el testigo externo —mira todo, no modifica nada— y es
el rol correcto para verificar que lectura y escritura están separadas de
verdad.

`06-Insumos` entra como un `seller`: no toca la planta, así que no ve insumos.

`07-Produccion` entra como un `pos`, y es la carpeta donde la separación se ve
mejor. El `pos` **sí** puede anotar que llegó agua —es un hecho que observa
parado en la planta— y **no** puede ajustar un saldo que no cuadra. Son dos
permisos y no uno porque corregir un saldo no es contar un hecho: es decidir
cuál de dos números es el bueno, y un registro que quien opera puede cuadrar
solo deja de servir como registro.

`08-Clientes` entra como un `contador`: ve la cartera —la necesita para saber
cuánto debe cada uno— y no puede registrar ni verificar. Verificar un documento
es afirmar que se lo tuvo en la mano, y el contador no está en el mostrador ni
en la calle.

`09-Ventas` vuelve a entrar como `contador`, y por una razón distinta: acá el
alcance no es «ve o no ve», es **`propio` contra `todo`**. Un `pos` ve y anula
sus ventas y no las de otro, y eso lo recorta `scopedCondition` a partir de la
sesión. Es la primera carpeta donde el alcance —y no el permiso— es lo que se
está probando.

Los tests unitarios ya verifican que la matriz le niegue el permiso, pero esos
no atraviesan un socket. Los dos peores bugs de M0 —el header `Origin` y el
logout faltante— vivían justamente en costuras entre capas, donde ninguna suite
unitaria mira por diseño.

El request `13-Volver-como-admin` no es ceremonia: sin él, `05-Sesion` cerraría
la sesión del `pos` y su verificación probaría algo distinto de lo que dice
probar.

## Correrla a mano

```bash
cd api/bruno/aquazaku && bru run . -r --env local
```

:::danger[Se corre DESDE la raíz de la colección]
`bru` 4.x exige que el path apunte a la colección, no a una ruta relativa desde
otro lado. `bru run bruno/aquazaku` desde `api/` responde:

```
You can run only at the root of a collection
```

Y el flag `--recursive` ya no existe: es `-r`. Con la forma vieja el comando
imprime la ayuda y sale con código 1, o sea que **el pipeline se pone rojo sin
haber corrido ni un request** — fácil de confundir con un test que falla.
:::

:::danger[Contra otro puerto, hay que mover también `BETTER_AUTH_URL`]
Correr la colección contra una instancia en un puerto distinto —por ejemplo una
levantada contra `aquazaku_test` para no tocar la base de desarrollo— falla
entera con **401 desde el login**, y el mensaje no dice por qué.

La causa es que Better-Auth valida su propia base URL: si `BETTER_AUTH_URL`
sigue apuntando al puerto de siempre, el `sign-in` se rechaza aunque la
contraseña esté bien. Los 401 que siguen son consecuencia de no tener cookie, y
mandan a buscar el problema al lugar equivocado.

```bash
DATABASE_URL='...aquazaku_test' PORT=3099 BETTER_AUTH_URL='http://localhost:3099' \
  pnpm tsx --env-file-if-exists=.env src/server.ts
```

Y ojo con el limitador de login: son 5 intentos por IP+email cada 15 minutos.
Un login exitoso limpia el contador, pero una tanda de fallidos deja la
colección en 429 — que se confunde con un test roto. Vive en memoria, así que
reiniciar el proceso lo borra.
:::

:::danger[Resetear la base de tests: `DROP SCHEMA public` no alcanza, y miente]
Para correr la colección contra una base limpia es tentador hacer
`DROP SCHEMA public CASCADE; CREATE SCHEMA public;`. Hace dos daños, y los dos
se reportan como éxito.

**1. El registro de migraciones sobrevive.** Drizzle lo guarda en el esquema
`drizzle`, no en `public`. Después del drop, `pnpm db:migrate:test` imprime
`✓ migraciones aplicadas` **sin crear una sola tabla**: ve todas las
migraciones registradas y no aplica ninguna. El síntoma aparece recién en el
login, como un 500 que dice `relation "users" does not exist`.

**2. Se lleva los GRANTS.** Y esos grants no son burocracia: son la mitad de la
garantía append-only. `0001_audit_append_only.sql` le da a `aquazaku_app` solo
`SELECT, INSERT` sobre `audit_log`, y `0003_stock.sql` le **revoca**
`UPDATE, DELETE` sobre `movimientos_stock`. Restaurarlos «a ojo» con un
`GRANT ... ON ALL TABLES` los aplana todos y deja la base con permisos de más:
17 tests de inmutabilidad se ponen rojos porque la operación que debía fallar
**termina bien**.

Los grants viven en las migraciones a propósito, junto a la tabla que protegen.
No hay un archivo de setup aparte que haya que acordarse de correr — y por eso
tampoco hay que escribirlos a mano nunca.

```bash
# Reset total: los DOS esquemas, y que las migraciones pongan los permisos.
DROP SCHEMA IF EXISTS public CASCADE;
DROP SCHEMA IF EXISTS drizzle CASCADE;
CREATE SCHEMA public;
```

Para un reset **entre corridas** —mucho más barato— alcanza con `TRUNCATE` de
todas las tablas de `public`: deja esquema, permisos y migraciones intactos.
`audit_log` queda afuera porque su trigger rechaza el `TRUNCATE`, y está bien
que lo haga.
:::

:::caution[El seed se ejecuta por el nombre del archivo]
`drizzle/seed.ts` arranca con `if (process.argv[1]?.endsWith('seed.ts'))`.
Importarlo desde un wrapper con otro nombre —para apuntarlo a otra base, por
ejemplo— **no siembra nada y sale con código 0**. Un éxito falso.

Si hace falta envolverlo, hay que pisar `process.argv[1]` antes del import. Y
verificar que el admin existe **antes** de correr la colección: un seed vacío se
manifiesta como 175 requests fallando con 401, que manda a buscar el problema a
la autenticación.
:::

El entorno `local` deja `adminPassword` como variable **secreta**: no está en el
archivo. Se pasa al correr, o se completa desde la interfaz de Bruno.

```bash
bru run . -r --env local --env-var adminPassword=tu-contraseña
```

:::caution[No es la contraseña del seed]
`SEED_ADMIN_PASSWORD` es la contraseña **inicial**. El admin nace con
`mustChangePassword`, así que lo primero que hace al entrar es cambiarla — y
desde ese momento el valor del `.env` ya no sirve para entrar.

Va la contraseña **actual**. Si se perdió, se recupera por el flujo de
`/forgot-password`, que en dev deja el mail en
[Mailpit](http://localhost:8025).
:::

## Los tests no son decorativos

Cada request lleva aserciones. Algunas verifican el camino feliz; otras están
para que **fallar sea el resultado correcto**:

```
2-Usuarios/04-Ultimo-admin (409 Conflict)
   ✓ responde 409
   ✓ el código dice cuál es el problema
   ✓ el mensaje explica qué hacer, no solo que falló
```

Ese request intenta quitarle el rol admin al único administrador activo. Si
alguna vez devuelve `200`, no es un éxito: es que se rompió
[RN-ACC-06](/dominio/roles-y-permisos/) y el sistema quedó a un click de ser
inadministrable.

Otro par que vale la pena mirar juntos: `2-Usuarios/04` genera un acceso
denegado, y `3-Auditoria/02-Solo-denegados` **lo busca en la bitácora**. Entre
los dos verifican el ciclo completo de RN-ACC-04 — la acción ocurre, queda
registrada y se puede encontrar.

## El header `Origin`

La colección lo pone sola, en un script de nivel colección:

```js
req.setHeader("Origin", bru.getEnvVar("webOrigin"));
```

No es opcional. Better-Auth rechaza con **403 `MISSING_OR_NULL_ORIGIN`** toda
petición que cambie estado y llegue sin él. Está en la colección y no en cada
request para que ninguno nuevo nazca sin él — el mismo problema
[nos rompió todo el login una vez](/frontend/bff-pattern/).

## En CI

El workflow de `api/` corre la colección contra un servidor de verdad, después
de migrar y sembrar. Es la **única verificación del proyecto que atraviesa un
socket real**: el resto de los tests usan `app.inject()`, que no pasa por la red.

Esa diferencia no es teórica. El bug del header `Origin` vivía justo ahí.

## Agregar un endpoint nuevo

1. Crear el `.bru` en la carpeta que corresponda, con un `seq` que respete el
   orden de dependencias.
2. Escribirle tests. Un request sin aserciones documenta la forma de la
   petición, pero no verifica nada.
3. Correr la colección local antes de abrir el pull request.

:::caution[`params:query` va a nivel superior]
Este error de sintaxis hace que Bruno **saltee el archivo entero** con un
warning fácil de pasar por alto, y la corrida sigue en verde con menos requests
de los que debería:

```
params:query {   ← nunca adentro del bloque get { }
  limite: 10
}
```

Si el resumen dice `Skipped`, mirá el warning: hay un archivo que no se está
corriendo.
:::

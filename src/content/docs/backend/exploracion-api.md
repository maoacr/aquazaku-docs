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
| `1-Auth` | Señal de vida, login y perfil con permisos resueltos |
| `2-Usuarios` | Listar, crear, asignar roles y la **protección del último admin** |
| `3-Auditoria` | Consulta, filtro de denegados y validación de filtros |
| `4-Sesion` | Cierre de sesión y que la credencial deje de servir |

Las carpetas llevan número porque el orden importa: el login deja la cookie que
usan los requests siguientes.

## Correrla a mano

```bash
cd api && bru run bruno/aquazaku -r --env local
```

El entorno `local` deja `adminPassword` como variable **secreta**: no está en el
archivo. Se pasa al correr, o se completa desde la interfaz de Bruno.

```bash
bru run bruno/aquazaku -r --env local --env-var adminPassword=tu-contraseña
```

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

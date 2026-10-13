---
title: Cómo documentar
description: Reglas para escribir y mantener la documentación de Aquazaku.
sidebar:
  order: 1
---

## La regla base

La documentación se escribe **junto con el código**, no después. Un cambio que
altera el comportamiento del sistema y no toca esta documentación está incompleto.

## Dónde va cada cosa

| Si estás escribiendo… | Va en |
| --- | --- |
| Una regla de negocio | `dominio/` |
| El porqué de una elección técnica | `decisiones/` (ADR) |
| Cómo está armado el sistema hoy | `arquitectura/` |
| Un endpoint | `backend/` |
| Una tabla o migración | `base-de-datos/` |
| Una pantalla o componente | `frontend/` o `mobile/` |

## Agregar una página

1. Creá el `.md` en la carpeta que corresponde.
2. Poné `title` y `description` en el frontmatter — la `description` va al SEO
   y al buscador interno, no la dejes vacía.
3. Listo. El sidebar usa `autogenerate`, así que la entrada aparece sola.

Usá `sidebar.order` solo cuando el orden alfabético no sirva.

```md
---
title: Registrar una venta
description: Flujo completo de una venta desde la app del vendedor.
sidebar:
  order: 2
---
```

## Marcar lo que no sabemos

Un supuesto sin marcar es un bug esperando. Marcalo visible:

```md
:::caution[Supuesto sin confirmar]
Asumimos que un cliente pertenece a una sola ruta. Falta confirmar con Aquazaku.
:::
```

## Cuando una regla confirmada deja de ser verdad

Pasa, y no es un error de redacción: el negocio cambia. Aquazaku compró un
segundo tipo de base y [RN-BAS-09](/dominio/botellones-y-bases/) —«una sola
clase de base», ✅ Confirmada— dejó de describir la realidad.

**La regla no se reescribe en su lugar. Se deroga y se reemplaza.**

1. El **texto original queda intacto**.
2. El **estado** pasa a `⛔ Derogada el DD-mmm-AAAA`, con el link a la que la
   reemplaza.
3. Un bloque arriba avisa que lo de abajo es **registro, no instrucción**.
4. La regla nueva toma **el siguiente número libre** — nunca el de la derogada.
5. Las **citas** a la vieja se repuntan a la nueva, una por una.

**Por qué no se reescribe:** el número es un identificador estable y otras
reglas lo citan. RN-BAS-09 estaba citada dos veces desde RN-BAS-10 como
fundamento de un razonamiento. Cambiarle el contenido dejaría esas dos citas
apuntando a lo contrario de lo que quien las escribió asumió, **en silencio** —
el mismo daño que reciclar el número de una pregunta cerrada.

Y el paso 4 por lo mismo: un número derogado tampoco se recicla.

:::tip[Derogar no es corregir]
Si la regla **estaba mal escrita** —decía algo que nunca fue cierto—, eso se
corrige en su lugar y listo. Derogar es para cuando **era verdad y dejó de
serlo**: ahí hay dos hechos, uno vigente y uno histórico, y los dos importan.
:::

## El vocabulario es el del negocio, no el de quien escribe

Esta es la regla más importante de la página, y la más fácil de romper sin darse
cuenta.

Los términos del dominio tienen que ser los que usa **Aquazaku**, no los que le
salen naturales a quien redacta. El español técnico está lleno de regionalismos
que suenan neutros y no lo son.

| ❌ No usar | ✅ Usar | Por qué |
| --- | --- | --- |
| Dar de alta | **Registrar** | "Alta" es rioplatense/peninsular; en Colombia se lee ambiguo |
| Dar de baja | **Descartar** / **Desactivar** | Ídem, y "descartar" dice mejor qué pasa |
| Fichar, empadronar | **Registrar** | — |
| Remito | **Comprobante** | — |

**Por qué importa tanto:** estos términos no se quedan en la documentación.
Terminan siendo nombres de permisos, de tablas y de métodos:

```
botellones:dar_alta    ← quedaba así en el backend
botellones:registrar   ← corregido
```

Si el equipo dice "registrar" y el código dice `darDeAlta`, cada lectura del
código cuesta una traducción mental. Eso es exactamente lo que el
[glosario](/empezar/glosario/) existe para evitar.

:::tip[Ante la duda, preguntá]
Si no estás seguro de que un término sea el que usa el negocio, **preguntalo**.
Es más barato que renombrarlo cuando ya está en la base de datos.

Cuando aparezca un término nuevo en una conversación con el cliente, va al
glosario antes de escribir la clase.
:::

## Estilo

- Español neutro para los términos del dominio; el resto de la prosa puede ser
  directa y coloquial.
- Frases cortas. Si una oración necesita dos comas para respirar, partila.
- Mostrá el ejemplo antes que la teoría.
- Si algo no está definido, decilo. "Pendiente" es información; el silencio no.

## Levantar el sitio

```bash
pnpm dev      # http://localhost:4321
pnpm build    # genera ./dist
pnpm preview  # sirve el build
```

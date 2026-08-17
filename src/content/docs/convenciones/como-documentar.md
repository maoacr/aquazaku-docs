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

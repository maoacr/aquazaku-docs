---
title: Visión general
description: Qué es Aquazaku, qué problema resuelve el sistema y qué piezas lo componen.
sidebar:
  order: 1
---

## El negocio

Aquazaku **produce y vende** agua. No es un revendedor: tiene planta de empaque.

```
   AGUA A GRANEL          PRODUCCIÓN            VENTA
   2 tanques × 2000 L  →  envasado diario  →  pos (mostrador)
   red municipal          + tapas y sellos     seller (ruta)
   tarifa plana
```

La planta está en **Campo de la Cruz**.

Vende en dos formatos:

- **Pacas de agua** — bolsas de 600 ml o de 300 ml. Se venden y no vuelven.
- **Recarga de botellones** — 20 litros. El cliente entrega el vacío y recibe uno
  lleno. El envase es un activo retornable, no se vende: se controla.

Y presta un tercer elemento: la **base** del botellón, que va a una dirección
concreta del cliente y tiene ID propio.

Hay tres cosas que hacen que este sistema no sea "un punto de venta más":

1. **El envase retornable.** Un botellón que sale y no vuelve es una pérdida de
   inventario que un POS común no ve.
2. **El préstamo identificado.** Una base tiene que poder reclamarse en su
   dirección exacta.
3. **El balance de agua.** El sistema tiene que cuadrar litros en tanque contra
   producto envasado — incluyendo el agua que se gasta lavando botellones y que
   no termina en ningún producto.

## Qué resuelve el sistema

| Área | Problema que resuelve |
| --- | --- |
| Producción | Cuadrar litros de agua contra lo que se envasó cada día |
| Ventas | Registrar la venta y su cobro, con o sin ruta |
| Stock | Saber cuánto producto y cuántos envases hay, y dónde |
| Activos prestados | Saber qué base está en qué dirección de qué cliente |
| Clientes | Quién compra, con qué frecuencia, cuánto debe |
| Proveedores | Compras de insumos y reposición |
| Roles y permisos | Que cada rol vea y haga solo lo suyo |
| App mobile | Que el vendedor en la calle opere sin depender de la oficina |

## Piezas del sistema

Cada pieza vive en su propio proyecto dentro del folder `aquazaku/`:

| Proyecto | Estado | Qué es |
| --- | --- | --- |
| `docs/` | ✅ activo | Esta documentación (Astro Starlight) |
| `api/` | 🔲 pendiente | Backend y API del sistema |
| `web/` | 🔲 pendiente | Panel de administración |
| `mobile/` | 🔲 pendiente | App para vendedores |

:::note[Documentación viva]
Esta tabla se actualiza cuando se agrega un proyecto. Si un proyecto existe en el
repo y no está acá, la documentación quedó desactualizada — arreglalo.
:::

## Por dónde seguir

1. [Glosario del negocio](/empezar/glosario/) — el vocabulario compartido.
   Empezá acá antes de tocar código.
2. [Arquitectura](/arquitectura/) — cómo se separan las piezas.
3. [Decisiones técnicas](/decisiones/) — por qué está hecho así y no de otra forma.

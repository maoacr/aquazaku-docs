---
title: Flujo de una venta
description: Happy path lineal con las branches documentadas: cliente nuevo o existente, con o sin botellones, entrega de base.
sidebar:
  order: 5
---

# Flujo de una venta

El happy path en tres pasos. Las branches y bloqueos se documentan
abajo — no caben en un workflow lineal con `archify`, pero la lógica
está en el POS y en el seed del sistema.

[Ver diagrama en pantalla completa →](/diagramas/aquazaku-venta-flujo.html){target="\_blank"}

<iframe src="/diagramas/aquazaku-venta-flujo.html" width="100%" height="640" style="border: 0;"></iframe>

## Happy path

1. **Llega al POS** con productos y, posiblemente, botellones.
2. **Cliente** — el POS busca o da de alta al cliente.
3. **Venta** — el POS cobra. Si hay pago parcial, queda en `PENDIENTE_PAGO`.
4. **Entrega de base** — si hay base, se escanea/tipea el sticker y se asigna al cliente.

Si la persona llega con sus botellones y no quiere ser registrada, se
hace la venta sin cliente. La recarga se acredita al parque, no a un
cliente.

## Branches y bloqueos

### El sistema decide, no el POS

Si el cliente NO tiene bases entregadas y quiere llevar más de las que
entrega, el sistema lo obliga a registrar el cliente primero. La venta
no se completa sin nombre, teléfono y dirección.

Si el cliente ya es cliente, el POS elige entre los clientes existentes
o registra uno nuevo. No hay un campo "cliente nuevo" pelado: siempre es
alta o búsqueda.

### La venta sin cliente es válida pero limitada

Si la persona llega con sus botellones y no quiere ser registrada, se
hace la venta sin cliente. La recarga se acredita al parque, no a un
cliente.

:::caution[PERO si después quiere más bases]
Si el cliente quiere LLEVAR más bases de las que entrega, la venta se
bloquea hasta que se registre. El sistema avisa: "este cliente no tiene
bases tuyas, registra el cliente para poder entregar más".
:::

### Mismatch de base

Si el cliente devuelve una base con un consecutivo distinto al que se
llevó, el sistema avisa del mismatch. El POS debe reconciliar antes de
cerrar la venta.

### Cada base tiene un sticker

Al entregar una base, se escanea o tipea su consecutivo (0001–9999) y se
asigna al cliente. La base queda con `responsable_actual` hasta que
vuelva al parque o se descarte. Un botellón sin responsable es un
botellón perdido en el sistema.

## Lo que el sistema valida

- Si la venta dejaría al cliente con más bases tuyas de las que entregó
  → bloqueo + pedir registro.
- Si el cliente devuelve una base con un consecutivo distinto → alerta
  de mismatch.
- Si la venta no tiene cliente y la persona quiere llevar más bases →
  bloqueo + pedir registro.
- Si el stock del producto/lote está en 0 → la venta no se completa.

## Estados de la venta

El estado de la venta sigue el [ciclo de vida de venta](./ciclo-de-venta):
REGISTRADA → PENDIENTE_PAGO → PAGO_PARCIAL/TOTAL → COMPLETADA. Las
anulaciones están atadas al estado, no al día.

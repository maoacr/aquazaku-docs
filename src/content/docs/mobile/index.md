---
title: Mobile
description: App mobile para vendedores de Aquazaku.
sidebar:
  order: 1
---

Documentación del proyecto `mobile/`: la app que usa el `seller` en la calle.

Es **su superficie de trabajo**, no una versión reducida de la web. El acceso web
para el `seller` existe solo como respaldo —teléfono roto, consulta desde la
oficina— y no define sus flujos.

:::caution[Decisión técnica pendiente: nativa o PWA]
No está decidido si `mobile/` será una app nativa, híbrida o una PWA. La elección
depende sobre todo de **cuánto control se necesita sobre el almacenamiento local
y la sincronización en segundo plano**, que es el corazón de esta app.

Va como [ADR](/decisiones/) antes de escribir código. No bloquea el diseño de
interfaz.
:::

## Qué documentar acá

- **Stack y build** — cómo se compila y se distribuye a los vendedores.
- **Modo offline** — qué se puede hacer sin señal y cómo se resuelve un conflicto
  al sincronizar. Esta es la decisión más pesada de toda la app.
- **Flujo de ruta** — carga, visitas, ventas, recargas, rendición.
- **Permisos del dispositivo** — ubicación, cámara, almacenamiento y para qué.

## El punto delicado

El vendedor trabaja donde **no hay señal**. La app tiene que operar offline y
sincronizar después. Eso obliga a definir:

1. Qué operaciones se permiten sin conexión.
2. Cómo se generan identificadores sin colisionar con el servidor.
3. Qué gana cuando dos versiones del mismo dato chocan.

Ninguna de las tres se resuelve improvisando en el código. Van como
[ADR](/decisiones/) antes de escribir la primera pantalla.

:::note[Proyecto no iniciado]
El proyecto `mobile/` todavía no existe. Esta sección se llena cuando arranque.
:::

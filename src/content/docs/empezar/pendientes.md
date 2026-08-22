---
title: Qué falta preguntar
description: Checklist consolidado de lo que hay que validar con Aquazaku antes de implementar.
sidebar:
  order: 3
---

Esta página tiene **únicamente las preguntas que siguen abiertas**. Lo que ya
quedó resuelto está documentado en su `RN-*` correspondiente dentro de las
secciones de dominio ([Clientes](/dominio/clientes/),
[Ventas](/dominio/ventas/), [Producción](/dominio/produccion/),
[Botellones y bases](/dominio/botellones-y-bases/),
[Productos](/dominio/productos/),
[Roles y permisos](/dominio/roles-y-permisos/), etc.).

Está ordenada por **cuánto duele equivocarse**, no por área.

:::tip[Cómo usarla]
Cuando una pregunta se responde: actualizá la regla correspondiente (cambiá
`🟡 Supuesto` por `✅ Confirmada` en el `RN-*` que corresponda) y borrá la
línea de acá.

Esta página tiene que **encogerse** con el tiempo. Si crece, el proyecto está
avanzando sobre supuestos.
:::

:::danger[Los números no se reciclan]
El número de pregunta es un **identificador global y estable**, igual que el de
una regla. Las reglas lo citan: `✅ Confirmada — cerrá la pregunta #23`.

Reusar el número de una pregunta cerrada rompe esa cita en silencio — apunta a
otra cosa y nadie se entera. **Una pregunta nueva toma el siguiente libre, aunque
queden huecos.**

Máximo asignado hasta hoy: **31**. La próxima es la 32.
:::

---

## 🔴 Bloquean parte de M2 — Stock

Ninguna frena el libro de movimientos ni los lotes, pero sí lo que se construye
encima. Contexto en la
[spec de M2](/superpowers/specs/2026-08-22-m2-stock-design).

| # | Pregunta | Para qué |
| :-: | --- | --- |
| 30 | **¿Cuál es el stock mínimo de producto terminado que debería disparar alerta?** ¿Uno por producto, o uno solo para todos? | El roadmap pone las alertas en M2, pero ninguna regla define el umbral. Sin el número, M2 entrega la consulta y M12 la usa cuando exista |
| 31 | **¿Cada cuánto se hace inventario físico?** | Define si el ajuste es excepcional o rutina, y si hace falta una pantalla de conteo o alcanza con el ajuste puntual — [RN-STK-02](/dominio/stock/) |

---

## 🟠 Faltan mediciones en planta

No son decisiones: son números que hay que ir a tomar.

| # | Qué medir | Para qué |
| :-: | --- | --- |
| 4 | **Caudal en GPM** — y si la placa dice galón americano o imperial. Son 20% de diferencia. | [RN-PRD-18](/dominio/produccion/) |
| 5 | **Tiempo de llenado de un tanque de 2.000 L** → de ahí sale el caudal real. | [RN-PRD-18](/dominio/produccion/) |
| 6 | **Litros que consume lavar un botellón.** | [RN-PRD-05](/dominio/produccion/) |
| 7 | **Consumo diario promedio en litros.** *Se autocalcula a las semanas de registrar cierres de producción — un estimado inicial alcanza.* | [RN-PRD-13](/dominio/produccion/) |

---

## 🟢 Refinan, no bloquean

Se pueden dejar para después sin frenar el diseño.

| # | Pregunta | Por qué importa |
| --- | --- | --- |
| 32 | **¿Qué datos personales guarda y edita cada persona de sí misma?** Nombre, apellido, nombre preferido, teléfono, foto — ¿cuáles son obligatorios y cuáles opcionales? | Hoy `/perfil` solo muestra nombre, email y roles, y **no deja editar nada**. Sin la lista de campos no se puede definir la tabla ni el formulario |
| 33 | **¿La foto de perfil se sube al sistema o alcanza con las iniciales?** Si se sube: ¿dónde se guarda y quién paga ese almacenamiento? | Una foto obliga a resolver subida de archivos, límite de tamaño, recorte y borrado — es la diferencia entre un formulario y un módulo |
| 34 | **¿Quién puede editar los datos de otra persona, y qué pasa con el email?** | El email es la identidad de acceso. Si se puede cambiar, hay que resolver verificación del nuevo correo antes de que reemplace al viejo |
| 35 | **¿Cómo funciona hoy pedir un día libre?** ¿Se avisa por WhatsApp, se anota en un cuaderno, lo aprueba una sola persona? | Mao propuso un formulario de solicitud de permiso dentro del perfil. Antes de diseñarlo hay que saber a qué proceso real reemplaza — un formulario que nadie mira es peor que el WhatsApp |

| 36 | **¿Cuántos días antes de vencer conviene avisar?** La vida útil es de 30 días ([RN-STK-08](/dominio/stock/)) y lo vencido se bloquea solo, pero no hay regla para el aviso previo | La insignia «vence pronto» ya está implementada con **7 días** como propuesta —una cuarta parte de la vida, y «lo que vence esta semana» se dice fácil en la planta—. Si el número es otro, se cambia una constante en `estado.tsx` y nada más |
---

## Módulo pendiente: Mi perfil

No es una pregunta suelta, así que va aparte.

La pantalla `/perfil` existe desde la fase de diseño, pero **nació chica y a
propósito**: se creó para darle casa al tercer estado del tema —`sistema`—
cuando el toggle de la cabecera pasó a ser claro ↔ oscuro. Muestra quién sos,
qué habilita cada rol y el link para cambiar la contraseña. Nada más.

Como módulo de perfil no alcanza, y hace falta decir con qué se lo mide:

- **no trae los datos de la persona** más allá de lo que ya tenía la sesión;
- **no deja editar nada** — ni nombre, ni apellido, ni nombre preferido, ni
  teléfono, ni foto;
- no tiene lugar para lo que venga después, como pedir un día de permiso.

Convertirlo en un módulo de verdad toca las cuatro capas: columnas nuevas en la
base, endpoints de lectura y escritura en `api/`, auditoría de cada cambio
—cambiarse el teléfono es una acción sensible— y la pantalla. Y si la foto se
sube, además subida de archivos, que hoy el sistema no hace en ningún lado.

Es un milestone propio. Las preguntas 32 a 35 son lo que hay que responder antes
de escribir la primera línea.

*(A la fecha de la última sesión de planning quedan las 4 mediciones 🟠 de
planta y las 4 preguntas 🟢 de perfil.)*

---

## Propuestas a Aquazaku

No son preguntas: son recomendaciones que conviene plantear antes de escribir código.

| Propuesta | Por qué |
| --- | --- |
| **Regleta graduada en el tanque de 13.000 L** | Es el último punto ciego del balance de agua. Cuesta casi nada y cierra el cálculo. Los tanques de 2000 L ya no la necesitan. Ver [la especificación](/dominio/produccion/). |
| **Registrar el tiempo de cada corrida de procesamiento** | El caudal se mide después de los filtros: si el tiempo sube mes a mes, los filtros se están tapando. Mantenimiento predictivo gratis. |

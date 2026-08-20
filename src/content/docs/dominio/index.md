---
title: Dominio
description: Reglas de negocio de Aquazaku — ventas, stock, envases, clientes, proveedores, rutas y permisos.
sidebar:
  order: 1
---

El corazón del sistema. Acá viven las **reglas del negocio**, escritas en el
lenguaje del negocio y no en el de la base de datos.

Antes de modelar una tabla o diseñar un endpoint, la regla se entiende y se
escribe acá. Sin esto terminamos con un CRUD que no representa cómo trabaja
Aquazaku realmente.

## Mapa del dominio

Seguido en el orden en que fluye el negocio: el agua entra, se convierte en
producto, y el producto sale.

| Área | Qué define |
| --- | --- |
| [Producción y agua](/dominio/produccion/) | Tanques en litros, envasado diario y conversión a producto |
| [Stock de producto](/dominio/stock/) | Producto por ubicación |
| [Botellones y bases](/dominio/botellones-y-bases/) | Los dos activos retornables y su trazabilidad |
| [Ventas](/dominio/ventas/) | Qué es una venta, cómo se anula, cómo se cobra, crédito |
| [Clientes](/dominio/clientes/) | Identidad, saldo, crédito y asignación a ruta |
| [Proveedores y compras](/dominio/proveedores/) | Reposición de insumos y su impacto en stock |
| [Rutas y rendición](/dominio/rutas/) | Carga, operación en calle y cierre del día |
| [Roles y permisos](/dominio/roles-y-permisos/) | `admin`, `seller`, `pos` — quién puede hacer qué, y sobre qué datos |

## Cómo se escriben las reglas

Toda regla tiene **un identificador estable**. No es burocracia: es lo que te
permite escribir un test que dice `// RN-VEN-02` y que dentro de un año alguien
entienda por qué ese test existe.

```
RN-VEN-02
│  │   └── número correlativo dentro del área
│  └────── área del dominio
└───────── Regla de Negocio
```

| Prefijo | Área |
| --- | --- |
| `RN-PRD` | Producción y agua |
| `RN-VEN` | Ventas |
| `RN-STK` | Stock de producto |
| `RN-ENV` | Botellones (por cantidad) |
| `RN-BAS` | Bases (por unidad identificada) |
| `RN-CLI` | Clientes |
| `RN-PRO` | Proveedores y compras |
| `RN-RUT` | Rutas y rendición |
| `RN-ACC` | Acceso, roles y permisos |

Cada regla se escribe con esta estructura:

```md
### RN-VEN-02 — Una venta confirmada no se edita

**Estado:** Supuesto

Enunciado corto y verificable de la regla.

**Por qué:** el motivo de negocio. Sin esto la regla es una opinión.
```

### Estados de una regla

| Estado | Significa |
| --- | --- |
| ✅ **Confirmada** | Validada con Aquazaku. Se puede implementar. |
| 🟡 **Supuesto** | La propusimos nosotros. **No implementar sin confirmar.** |
| 🔴 **En conflicto** | Dos fuentes dicen cosas distintas. Hay que resolver antes de seguir. |

### Reglas de las reglas

1. Una regla se enuncia de forma **verificable**. Si no podés escribir un test
   que la compruebe, todavía no es una regla — es una intención.
2. Una regla nunca cambia de número. Si queda obsoleta se marca como derogada
   y se escribe una nueva.
3. El número de regla se cita en el código y en los tests. El código explica
   *cómo*; la regla explica *por qué*.

:::caution[Casi todo acá todavía es supuesto]
La mayoría de las reglas de esta sección fueron redactadas a partir de la
descripción inicial del negocio, no de una validación con Aquazaku. Están
marcadas como 🟡 **Supuesto** justamente para eso: son un borrador para corregir
con el cliente, no una especificación aprobada.

Ya confirmado por Aquazaku:

- Los cuatro roles del sistema: `admin`, `seller`, `pos`, `contador`.
- El `pos` vende contra el stock de `BODEGA`, sin ubicación propia.
- Los botellones se controlan **por cantidad**, sin ID individual.
- Las bases se controlan **por ID**, se prestan y se asignan a una **dirección**.
- Hay planta de empaque: dos tanques de 2000 L, cierre de producción diario, y el
  lavado de botellón consume agua sin generar producto.
- Dos tipos de paca: **20 bolsas de 600 ml** (12 L) y **50 bolsas de 300 ml** (15 L).
- Identidad del cliente: **UUID** del sistema; el documento es dato de búsqueda.
- La **ruta se asigna a la dirección**; el **saldo de botellones, al cliente**.
- Hoy se **envasa bajo demanda**: no se distingue botellón lleno de vacío.
- Tapas y sellos termoencogibles son **stock**: cada botellón llenado consume
  1 tapa + 1 sello.
- La planta está en **Campo de la Cruz**. El agua viene de la red municipal con
  **tarifa plana**: no tiene costo marginal, pero sigue siendo finita.
- El suministro **no es continuo**. Aquazaku almacena **13.000 L de agua cruda**,
  aparte de **2 tanques de 2000 L** de agua ya procesada. Total: 17.000 L.
- El procesamiento **rinde 70%**: los filtros rechazan el 30% del flujo.
  Utilizable real: **13.100 L**.
- **No hay medidor ni regla** en los tanques: el nivel se estima a ojo en cuartos
  ([RN-PRD-14](/dominio/produccion/)).
- Pero **sí hay un caudalímetro en GPM** después de los filtros, antes de los
  tanques de 2000 L: el volumen procesado se mide con `caudal × tiempo`.
- Cortes de agua: **1 día** es lo habitual y se soporta; **5 días** es el peor
  caso conocido. Ese peor caso es el que dimensiona el almacenamiento.

Un supuesto sin marcar se convierte en un bug de negocio tres meses después.

👉 Todas las preguntas abiertas están consolidadas en
[Qué falta preguntar](/empezar/pendientes/).
:::

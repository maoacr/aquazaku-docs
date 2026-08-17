---
title: Rutas y rendición
description: Ciclo diario del seller — carga, operación en calle y cierre cuadrado.
sidebar:
  order: 8
---

El ciclo de trabajo del `seller`. Es donde se cruzan ventas, stock y envases,
y donde el sistema demuestra si sirve o no.

Aplica **solo al rol `seller`**. El `pos` vende desde un punto fijo y no abre ni
rinde rutas — ver [Roles y permisos](/dominio/roles-y-permisos/).

:::note[Una ruta agrupa direcciones, no clientes]
La unidad que se asigna a una ruta es la **dirección**
([RN-CLI-05](/dominio/clientes/)). Un cliente con locales en zonas distintas
puede aparecer en más de una ruta.

Hoy Aquazaku atiende a todos sin rutas armadas, por el volumen bajo. El modelo
igual se construye por dirección desde el principio: hacerlo después obliga a
migrar rutas ya en uso.
:::

## El ciclo del día

```
1. CARGA        El seller sale con producto y envases registrados
      ↓
2. OPERACIÓN    Vende, recarga, cobra — offline, sin señal
      ↓
3. RETORNO      Vuelve con lo no vendido y los envases recuperados
      ↓
4. RENDICIÓN    Se cuadra: lo que salió = lo vendido + lo devuelto + faltante
```

---

### RN-RUT-01 — Una ruta abre con una carga registrada

**Estado:** 🟡 Supuesto

Al salir se registra qué producto y cuántos envases lleva el `seller`. Esa carga
mueve stock de `BODEGA` a `RUTA:{id}` ([RN-STK-02](/dominio/stock/)).

**Por qué:** sin carga inicial no hay contra qué cuadrar al cierre. La rendición
sería una declaración jurada.

---

### RN-RUT-02 — Un `seller` tiene una sola ruta abierta a la vez

**Estado:** 🟡 Supuesto

No se puede abrir una ruta nueva sin haber rendido la anterior.

**Por qué:** con dos rutas abiertas no se sabe a cuál imputar una venta, y el
cuadre se vuelve imposible.

---

### RN-RUT-03 — La rendición tiene que cuadrar

**Estado:** 🟡 Supuesto

Al cerrar la ruta:

```
PRODUCTO
carga inicial = vendido + devuelto a bodega + faltante

ENVASES
envases que salieron = entregados a clientes + devueltos + faltante

DINERO
cobrado en efectivo = suma de cobros registrados en la ruta
```

Si hay **faltante**, la ruta no se cierra sin motivo registrado. El faltante se
acepta —pasa— pero nunca en silencio.

**Por qué:** esta es la regla que convierte al sistema en un control real.
Un cierre que cuadra solo porque el sistema ajusta la diferencia no controla nada.

---

### RN-RUT-04 — Una ruta rendida no se reabre

**Estado:** 🟡 Supuesto

Cerrada la rendición, la ruta es inmutable. Una corrección se hace con un ajuste
posterior, con su propio motivo y responsable.

**Por qué:** mismo principio que [RN-VEN-02](/dominio/ventas/). Si el cierre de
ayer puede cambiar hoy, ningún arqueo es confiable.

---

### RN-RUT-05 — La app opera sin conexión

**Estado:** 🟡 Supuesto

El `seller` trabaja donde no hay señal. La app registra ventas, recargas y cobros
localmente y sincroniza cuando recupera conexión. Las validaciones de stock
corren contra la carga local.

:::danger[Decisión pendiente, y es la más cara del sistema]
El modo offline obliga a definir tres cosas **antes** de escribir la primera
pantalla:

1. Qué operaciones se permiten sin conexión y cuáles no.
2. Cómo se generan identificadores en el dispositivo sin colisionar con el servidor.
3. Qué versión gana cuando el mismo dato cambió en los dos lados.

Ninguna de las tres se improvisa en el código. Van como
[ADR](/decisiones/) con sus alternativas evaluadas.
:::

---

## Preguntas abiertas

- ¿La ruta es fija por `seller` o se arma cada día?
- ¿El `seller` puede vender a un cliente que no está en su ruta?
- ¿Quién autoriza un faltante? ¿Se descuenta al `seller`?
- ¿Se hace seguimiento de ubicación del `seller` durante la ruta?
- ¿Qué pasa si el `seller` termina el día sin señal y no puede sincronizar?
  ¿La ruta queda abierta hasta que sincronice?
- ¿Quién carga la ruta por la mañana? Hoy la matriz solo se lo permite a `admin`.

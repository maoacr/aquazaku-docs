---
title: ADR-0007 — Una acción sensible sin bitácora no se ejecuta
description: "Cuándo un fallo de auditoría corta la operación y cuándo no, y por qué la respuesta no es la misma para todo."
---

**Estado:** Aceptado
**Fecha:** 2026-08-22
**Deciden:** Mao (product owner), asistente AI

## Contexto

[RN-ACC-04](/dominio/roles-y-permisos/) exige que toda acción sensible quede
registrada. La pregunta que la regla **no** contesta es qué hacer cuando el
registro falla: la base no responde, la tabla está bloqueada, se agotaron las
conexiones.

No es hipotética. `audit_log` es append-only por triggers y por permisos
([ADR-0004](/decisiones/0004-audit-log-inmutable/)), así que tiene más formas de
fallar que una tabla común.

El sistema ya tenía las dos respuestas conviviendo sin que estuviera escrito
cuál va dónde, y eso casi produce un bug real: al implementar M1 se usó la
función **no bloqueante** para los cambios de precio. Con esa versión, un precio
podía cambiarse y la bitácora fallar **en silencio** — exactamente lo que
RN-ACC-04 existe para impedir. Se detectó leyendo por qué existía la función
antes de usarla, no con un test.

## Alternativas evaluadas

### Opción A — Nunca bloquear: si la bitácora falla, se loguea y se sigue

- ✅ El sistema nunca se cae por un problema de registro.
- ✅ Un incidente de base no impide operar.
- ❌ **Una acción sensible puede ocurrir sin dejar rastro.** El día que haga
  falta investigar, el registro que importaba es el que no está.
- ❌ Convierte RN-ACC-04 en una intención, no en una garantía.

### Opción B — Bloquear siempre: sin bitácora no se hace nada

- ✅ La garantía es real y sin excepciones.
- ❌ Una caída de `audit_log` deja a la gente **sin poder iniciar sesión**.
  Un problema de registro se convierte en una caída total.
- ❌ Castiga acciones cuya trazabilidad no es crítica.

### Opción C — Según lo que esté en juego ← **elegida**

- ✅ La garantía dura donde importa.
- ✅ Entrar al sistema nunca depende de que la bitácora esté sana.
- ❌ Hay que decidir, por acción, de qué lado cae — y eso se puede equivocar.

## Decisión

Elegimos la **Opción C**, con una regla explícita para que "hay que decidir" no
signifique "cada quien elige":

| Tipo de acción | Si la auditoría falla | Por qué |
| --- | --- | --- |
| **Sensible** — cambio de precio, anulación, ajuste de stock, baja de envases, crédito, cierre con faltante | **La operación falla** | Es lo que RN-ACC-04 nombra. Sin rastro, la acción no debería haber ocurrido |
| **Evento de sesión** — entrar, salir | Se loguea el problema y se sigue | Convertir una bitácora caída en imposibilidad de entrar transforma un problema de registro en una caída total |
| **Rechazo de una acción** — el 403, el 409, el 422 | Se loguea el problema y se sigue | Si fallara acá, **taparía el error de negocio original** que el usuario necesita ver |

Esa tercera fila es la menos obvia y la que más se equivoca. Auditar un fallo no
puede convertirse en un segundo fallo que oculte al primero: la persona quedaría
mirando "error del servidor" cuando el sistema en realidad le estaba diciendo
que no tiene permiso.

## Consecuencias

**Se vuelve fácil:**

- Responder "¿quién cambió este precio y de cuánto a cuánto?" con certeza, no
  con probabilidad.
- Confiar en que un hueco en la bitácora significa que la acción no ocurrió.

**Se vuelve difícil / costoso:**

- Un incidente en `audit_log` frena las operaciones sensibles. Es el costo
  aceptado a cambio de que la bitácora sea confiable.
- Cada módulo nuevo tiene que ubicar sus acciones en la tabla de arriba. No hay
  default seguro: elegir mal en cualquiera de las dos direcciones tiene costo.

**Lo que aceptamos pagar:** que una caída de base convierta una acción sensible
en un error para el usuario, en vez de dejarla pasar sin registro.

:::caution[El detalle sensible va en el `payload`, no solo en la acción]
Registrar que alguien cambió un precio no alcanza. Sin el **antes y el después**
la bitácora dice que hubo un cambio pero no cuál, que es justamente lo que se va
a querer saber cuando aparezca una venta con un número raro.

Por eso las rutas que conocen el detalle escriben ellas la bitácora, y no lo
delegan al middleware: el middleware sabe *quién* y *qué acción*, pero no
*de cuánto a cuánto*.
:::

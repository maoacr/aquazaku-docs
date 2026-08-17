---
title: Brief de diseño
description: Prompt listo para pasar a una herramienta de diseño, con el contexto, las restricciones y el listado de vistas del sistema Aquazaku.
sidebar:
  order: 2
---

Este documento está escrito para **copiarse y pegarse completo** en una
herramienta de diseño asistida por IA. Es autocontenido: no asume que quien lo
lea conozca el resto de esta documentación.

Antes de pegarlo, adjuntá los assets de marca (logotipo, isotipo) y los colores
corporativos en hexadecimal.

:::note[Mantenelo sincronizado]
Si el dominio cambia, este brief cambia. Es la traducción del dominio a
pantallas — si se desactualiza, se diseña sobre reglas viejas.
:::

---

````markdown
# Sistema de gestión Aquazaku — Brief de diseño

Necesito que diseñes el sistema de interfaz completo para Aquazaku. Te adjunto
el logotipo, el isotipo y los colores corporativos en hexadecimal.

## 1. El negocio

Aquazaku produce y vende agua potable en Campo de la Cruz, Colombia. **No es un
revendedor: tiene planta de empaque propia.**

Vende en tres formatos:
- **Pacas de bolsas de 600 ml** (20 unidades por paca)
- **Pacas de bolsas de 300 ml** (50 unidades por paca)
- **Botellones de 20 litros** — recarga: el cliente entrega el vacío y recibe uno lleno

Además presta **bases** (soportes/dispensadores de botellón) a los clientes.

Hay tres cosas que hacen que esto NO sea un punto de venta común, y las tres
tienen consecuencias visuales:

1. **Activos retornables.** El botellón y la base salen pero no se venden. Hay
   que saber siempre cuántos hay y dónde.
2. **Balance de agua.** La planta convierte litros en producto, con pérdidas en
   el camino. El agua es finita y el suministro municipal es intermitente.
3. **Operación sin señal.** El vendedor de ruta trabaja donde no hay internet.

## 2. Las tres superficies

El sistema tiene exactamente **tres roles**, y cada uno usa una superficie distinta:

| Rol | Superficie | Contexto de uso |
| --- | --- | --- |
| `admin` | Web de escritorio | Oficina, pantalla grande, sesiones largas |
| `pos` | Web / terminal | Mostrador, uso rápido y repetitivo, con conexión |
| `seller` | **App móvil** | Calle, sol directo, sin señal, una sola mano |

Diseñá las tres. No son la misma aplicación con distinto menú: son contextos de
uso muy diferentes.

**Sobre el `seller`:** técnicamente podrá entrar por la web, pero **la app móvil
es su superficie real y la que hay que diseñar**. El acceso web es un respaldo de
emergencia —se rompió el teléfono, hay que consultar algo desde la oficina—, no
una experiencia a diseñar en paralelo.

No dupliques el trabajo: diseñá la app móvil bien. Para el respaldo web alcanza
con que la interfaz de `admin` permita consultar la información del `seller`.

## 3. Restricciones de diseño que vienen del negocio

Estas no son preferencias estéticas. Son reglas del sistema que la interfaz
tiene que respetar.

### 3.1 Nunca mostrar precisión que no existe

El nivel de los tanques de agua **se estima a ojo, en cuartos** (vacío, ¼, ½, ¾,
lleno). No hay medidor ni regla.

Por lo tanto la interfaz **jamás** debe mostrar un número exacto donde solo hay
una estimación:

| ❌ Nunca | ✅ Siempre |
| --- | --- |
| "6.500 L en tanque" | Indicador de banda: ¼ · ½ · ¾ · lleno |
| "Autonomía: 4,3 días" | "Autonomía: entre 3 y 5 días" |

Diseñá un componente de **rango/banda** que comunique incertidumbre con
naturalidad, sin parecer un error. Es un patrón que se repite en varias vistas.

### 3.2 Semáforo de autonomía — el indicador más importante de la planta

El suministro de agua municipal se corta. Lo normal es 1 día; el peor caso
conocido fueron 5 días. La pregunta central de la operación no es "cuánta agua
tengo" sino **"cuántos días puedo producir sin que llegue agua"**.

| Estado | Autonomía | Significado |
| --- | --- | --- |
| 🟢 Verde | ≥ 5 días | Cubre el peor caso histórico |
| 🟡 Amarillo | 1 – 5 días | Cubre un corte normal, no uno extremo |
| 🔴 Rojo | < 1 día | No cubre ni un corte habitual |

Este indicador debe ser **lo primero que se ve** en el panel de planta. Tratalo
como el elemento jerárquicamente dominante de esa pantalla.

### 3.3 Nada se edita: se anula y se rehace

Las ventas, los cierres de producción y las rendiciones de ruta son
**inmutables**. Una vez confirmados no se editan.

La interfaz no debe ofrecer "editar" en ninguno de esos objetos. Solo **anular**,
y la anulación **exige un motivo escrito**.

Diseñá un patrón de "acción irreversible con motivo obligatorio" y usalo
consistentemente: anular venta, ajustar inventario, descartar activos, cerrar
ruta con faltante.

### 3.4 Estado de sincronización siempre visible (móvil)

El `seller` opera sin conexión y sincroniza cuando llega a su casa. **Nunca debe
tener dudas sobre si sus datos están guardados en el servidor o solo en el
teléfono.**

Diseñá un indicador persistente de estado de sincronización con al menos:
pendiente de subir · sincronizando · al día · error.

Debe ser visible desde cualquier pantalla de la app, sin ser intrusivo. Es el
elemento que sostiene la confianza en toda la aplicación móvil.

### 3.5 Legibilidad bajo sol directo (móvil)

El `seller` trabaja al aire libre en la costa Caribe colombiana, con sol muy
fuerte y a menudo con las manos ocupadas o mojadas.

- Contraste alto, muy por encima del mínimo de accesibilidad
- Tipografía grande, tocables amplios (mínimo 48×48 px)
- Operable con **una sola mano**: acciones principales en el tercio inferior
- Nada crítico que dependa de distinguir colores sutiles

### 3.6 Dos activos, dos formas de contarlos

Esta distinción tiene que ser evidente en la interfaz:

| | Botellón | Base |
| --- | --- | --- |
| Se cuenta | Por **cantidad** ("12 botellones") | Por **unidad con ID** ("base #A-0412") |
| Se muestra como | Contador numérico | Lista de ítems identificados |

Nunca los mezcles en un mismo componente: son conceptos distintos y confundirlos
es el error más caro del negocio.

### 3.7 Cada rol ve solo lo suyo

El `seller` ve únicamente sus propias ventas y su ruta. El `pos` ve las suyas.
Diseñá los listados asumiendo que el alcance de datos ya viene filtrado, y no
muestres controles de "ver todo" en las superficies de `seller` y `pos`.

## 4. Sistema de diseño a construir

A partir de los colores corporativos que te adjunto, derivá y documentá:

1. **Paleta primaria** — escala completa (aprox. 50 a 950) del color de marca.
2. **Paleta secundaria / de acento**, con la misma estructura.
3. **Colores semánticos**: éxito, advertencia, error, información. Deben convivir
   con la marca sin competir, y el trío verde/amarillo/rojo del semáforo de
   autonomía debe salir de acá.
4. **Escala de grises** — neutros para texto, bordes, fondos y superficies.
   Definí explícitamente los niveles de superficie (fondo, tarjeta, elevada).
5. **Modo claro y modo oscuro.** El modo oscuro no es opcional: la app móvil se
   usa de madrugada al cargar la ruta.
6. **Escala tipográfica** — familia, pesos, tamaños y altura de línea, con una
   escala separada para móvil.
7. **Sistema de espaciado** — basado en una unidad consistente (sugerido: 4 px),
   con la escala completa documentada.
8. **Radios de borde** y **sistema de sombras / elevación** por niveles.
9. **Estados de interacción**: reposo, hover, foco, activo, deshabilitado,
   cargando. El estado de **foco** debe ser claramente visible: hay operación con
   teclado en el POS.
10. **Iconografía** — set coherente y criterio de uso.

Requisitos transversales:

- **Accesibilidad**: contraste mínimo AA en toda la interfaz; AAA en la app móvil
  por el uso a la intemperie.
- **La información nunca se codifica solo por color**: siempre acompañada de
  texto, icono o forma.
- Entregá los tokens de diseño con nombres semánticos, no literales
  (`superficie-elevada`, no `gris-100`).

## 5. Vistas a diseñar

Marcadas por prioridad: **[1]** núcleo del MVP · **[2]** segunda fase.

### Transversales
- **[1]** Inicio de sesión
- **[1]** Estados vacíos, de carga y de error (patrón reutilizable)
- **[1]** Modal de acción irreversible con motivo obligatorio
- **[2]** Notificaciones y alertas del sistema

### Web — `admin`
- **[1]** Panel principal — autonomía de agua, stock crítico, ventas del día
- **[1]** Registro de corrida de procesamiento (caudal, tiempo, tanque destino)
- **[1]** Cierre de producción diario (pacas por presentación, botellones llenados)
- **[1]** Estado de tanques — agua cruda + dos tanques procesados, en bandas
- **[1]** Stock de producto por ubicación
- **[1]** Insumos (tapas y sellos) con alerta de mínimo
- **[1]** Ajuste de inventario con motivo
- **[1]** Panel de botellones — cuántos hay y dónde (bodega, rutas, clientes)
- **[1]** Listado de bases con ID, estado y ubicación
- **[1]** Ficha de base — historial completo de dónde estuvo
- **[1]** Listado y búsqueda de clientes
- **[1]** Ficha de cliente — identidad, direcciones, y sus tres saldos separados
  (dinero, botellones, bases)
- **[1]** Alta y edición de cliente
- **[1]** Listado y detalle de ventas
- **[1]** Armado y carga de ruta
- **[1]** Rendición de ruta — pantalla de cuadre
- **[1]** Usuarios y roles
- **[1]** Configuración — presentaciones, equivalencias, precios, parámetros de planta
- **[2]** Proveedores, órdenes de compra y recepción
- **[2]** Registro de auditoría
- **[2]** Reportes operativos y financieros
- **[2]** Tendencia de rendimiento de filtros (mantenimiento predictivo)

### Web / terminal — `pos`
- **[1]** Venta en mostrador — flujo rápido, optimizado para teclado
- **[1]** Búsqueda y alta rápida de cliente
- **[1]** Recepción de botellones retornados
- **[1]** Préstamo y retiro de bases
- **[1]** Registro de cobro
- **[2]** Cierre de turno

### Móvil — `seller`

**Esta es la superficie con más peso del proyecto.** El `seller` es quien más
horas pasa dentro del sistema y en las peores condiciones. Si algo se diseña con
especial cuidado, que sea esto.

- **[1]** Inicio de ruta — confirmación de la carga recibida
- **[1]** Lista de visitas del día
- **[1]** Detalle de visita — cliente, dirección, saldos, historial
- **[1]** Registro de venta (funciona sin conexión)
- **[1]** Recarga de botellones — entrega y retorno
- **[1]** Alta de cliente en calle, con estado de verificación de documento
- **[1]** Registro de cobro
- **[1]** Mi carga — qué llevo en el vehículo ahora
- **[1]** Rendición de ruta — cuadre de producto, envases y dinero
- **[1]** Estado de sincronización (detalle)
- **[2]** Préstamo de base en calle

## 6. Detalles concretos de dos vistas críticas

### Rendición de ruta (móvil)
Es la pantalla más importante de la app. Al cerrar el día debe cuadrar:

```
PRODUCTO   lo que salió = vendido + devuelto + faltante
ENVASES    los que salieron = entregados + devueltos + faltante
DINERO     efectivo cobrado = suma de cobros registrados
```

Si hay faltante, **no se puede cerrar sin escribir un motivo**. Diseñá la
diferencia visual entre "cuadra" y "no cuadra" de forma inequívoca, y que el
faltante se vea sin ambigüedad — no debe poder pasar desapercibido.

### Alta de cliente (móvil y POS)
Campos:
- Tipo de documento: **CC** o **NIT** (selección explícita, nunca inferida)
- Número de documento
- Dígito de verificación: **calculado y mostrado por el sistema**, no ingresado

Y una acción diferenciada: **"Verifiqué el documento físico"**. No es un checkbox
de trámite — quien la marca queda registrado afirmando que tuvo la cédula en la
mano. Diseñala con el peso visual de una declaración, no de una opción menor.

Un cliente sin verificar debe verse distinto en toda la aplicación.

## 7. Entregables

1. Documentación del sistema de diseño con todos los tokens.
2. Biblioteca de componentes derivada de él.
3. Las vistas marcadas **[1]**, en modo claro y oscuro.
4. Para las vistas móviles, mostrar además el estado sin conexión.

Empezá por el sistema de diseño y validalo conmigo antes de pasar a las vistas.
````

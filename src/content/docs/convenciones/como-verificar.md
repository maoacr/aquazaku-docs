---
title: Cómo se verifica acá
description: Un test que pasa no prueba nada por sí solo. Las cuatro técnicas que este proyecto usa para saber si una verificación verifica algo.
---

Este proyecto tiene más de mil tests entre `api/` y `web/`. Eso no dice nada por
sí solo: **un test que pasa con el mecanismo borrado no está probando el
mecanismo**, está probando otra cosa — o nada.

Lo que sigue no son buenas prácticas generales. Son cuatro técnicas que se
adoptaron porque **cada una atrapó un error real** en este código, y las cuatro
son baratas.

---

## 1 · Borrá el mecanismo y confirmá que el test falla

Antes de dar por buena una verificación, se rompe a propósito lo que dice
proteger. Si la suite sigue verde, el test no lo estaba probando.

```bash
# Se quita el tope contra el piso de precio…
sd 'Math.min\(nominal, lista - minimo\)' 'nominal' src/modules/ventas/precio.ts
pnpm vitest run src/modules/ventas    # tiene que dar ≠ 0
# …y se restaura
```

Para un invariante de base de datos, se le quita el `CHECK` a `aquazaku_test`:

```bash
psql "$TEST" -c 'ALTER TABLE clientes DROP CONSTRAINT clientes_credito_exige_verificacion;'
pnpm vitest run src/modules/clientes  # tiene que dar ≠ 0
```

### Lo que encontró

| Dónde | Qué pasaba |
| --- | --- |
| M6 · el redondeo del precio | El test usaba montos «limpios» y pasaba **igual sin `Math.round`**. Buscando de verdad aparecieron 1.484 combinaciones donde cambia el resultado; la peor deja el comprobante sin cuadrar consigo mismo por un centavo |
| M6 · la atomicidad de la venta | Dos tests decían probarla y pasaban con la transacción borrada: el rediseño hizo que esos caminos fallaran **antes** de escribir. Se renombraron a lo que verifican de verdad y se escribió el que sí prueba atomicidad |
| Toasts | El `ref` que evita el aviso duplicado no estaba probado. El caso real era **StrictMode**, y sin él cada confirmación se veía **dos veces en desarrollo** |
| M7 · lógica muerta | `!corto && fraccion > 0.002` — la primera condición no decidía nada. Se borró en vez de escribirle un test |
| M16 · el botón reusado entre pasos | En el paso 2 del alta, «Seguir sin teléfono» registraba al cliente y **se salteaba el paso 3**. El test de comportamiento pasaba con el defecto puesto: jsdom no implementa el envío implícito. El que muerde asserta el **atributo** `type`, y al ablarlo nombra el botón exacto |
| M16 · el teléfono plural | Sacar `telefonos` del esquema de alta tiró la colección Bruno de **605/605 a 397/605**. Sin esa corrida, la única evidencia era que los tests nuevos pasaban |

:::tip[Cuando la ablación no rompe nada, hay dos respuestas]
O falta el test, **o sobra el código**. Las dos veces que pasó acá la respuesta
correcta fue distinta, y ninguna era «dejarlo así».
:::

---

## 2 · Medí, no mires

Una captura de pantalla no es evidencia. El color que el CSS declara no es el
que se ve compuesto, y una posición leída de una imagen escalada es una
estimación.

```js
// No: "se ve corrido". Sí:
{ isoLeft: 16, iconoLeft: 36, desalineacion: -20 }
```

### Artefactos de medición en los que ya caímos

- **Identificar por posición.** `querySelectorAll('nav').pop()` devolvió un
  elemento distinto en cada llamada, y `lotes[0]` devolvió el lote de otro
  producto. Hay que identificar por `aria-label`, por id o por relación — nunca
  por índice.
- **Medir durante una transición.** El grid del menú anima su ancho: medir justo
  después del foco reporta el estado inicial. Hay que esperar a que asiente.
- **Medir durante el Suspense.** Los desbordes reportados eran del esqueleto de
  carga, no del contenido.
- **Un `sd` que no matchea.** Dos «ablaciones» dieron verde porque el reemplazo
  nunca se aplicó. Desde entonces el script **afirma que matcheó** antes de
  correr los tests.

:::danger[Guardá la medición antes de confiar en ella]
El menú expandido mide 256 px. Si la medición reporta 72, no estaba expandido y
**todas las posiciones de esa tanda son basura**. Comprobar esa precondición
primero cuesta una línea.
:::

---

## 3 · Corré lo que decís que corriste

Una suite verde por módulo no es una suite verde. En M6 se commiteó con 19 tests
caídos porque se leyó el número de tests sin mirar si había fallos: los tests del
módulo pasaban aislados y rompían en conjunto.

```bash
# Lo que importa es el código de salida, no el texto
pnpm test > /tmp/t.txt 2>&1; echo "EXIT=$?"
```

Lo mismo con la colección Bruno: se corre **entera**, contra una instancia
levantada sobre `aquazaku_test`, nunca contra la base de desarrollo. Ver
[Exploración de la API](/backend/exploracion-api/).

---

## 4 · Leé el título del test y buscá cada sustantivo en el cuerpo

La ablación tiene un punto ciego: **no ve un mecanismo que el test nunca
ejerce.** Si el caso no toca el código, borrar ese código no lo rompe — el test
sigue verde y la ablación no dice nada.

Ese hueco tiene una forma reconocible: un test cuyo **nombre** promete más de lo
que el cuerpo hace.

```tsx
// ❌ Se llama «manda cliente, teléfono y dirección en un solo viaje»
//    y nunca escribe la dirección.
await usuario.type(campo(/Primer nombre/), 'Rosa')
await usuario.type(campo(/Teléfono/), '3001234567')
await usuario.click(boton(/Registrar/))

expect(enviado).toMatchObject({ primerNombre: 'Rosa', telefonos: [...] })
```

El chequeo es de dos segundos: **leé el título, y buscá en el cuerpo cada
sustantivo que nombra.** Si dice «teléfono», tiene que haber un `type` sobre el
campo de teléfono. Si dice «dirección», sobre la dirección. Lo que el título
nombra y el cuerpo no toca: **sale del título, o entra al cuerpo.**

:::danger[Un nombre que miente es peor que no tener test]
No es neutro: **apaga la sospecha.** Al leer la lista de casos, «dirección»
figura cubierta, y nadie vuelve a abrir el cuerpo.

En M16 ese test verde tapó una pérdida de datos silenciosa: la dirección se
descartaba entera si le faltaba la etiqueta, y el alta salía bien igual. Lo
encontró un usuario registrando un cliente real, no la suite.
:::

---

## Por qué esto está escrito

Las cuatro técnicas encontraron errores que ninguna revisión de código habría
visto, porque **todos los síntomas apuntaban al lugar equivocado**: un test
verde, un color que parecía bien, un archivo de tests que se caía por una ruta
registrada en otro módulo, y un caso cuyo nombre decía cubrir lo que nunca tocó.

No hacen falta herramientas. Hace falta acordarse.

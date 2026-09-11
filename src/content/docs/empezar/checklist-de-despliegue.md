---
title: Checklist de despliegue
description: 'Qué verificar en cada ambiente antes de mandar un cambio a la planta, y cómo no perder los datos de clientes reales por el camino.'
sidebar:
  order: 7
---

Esta página es la que se recorre **cada vez** que un cambio va a producción.

Es la compañera de [Desplegar, paso a paso](/empezar/desplegar-paso-a-paso/), y
la división es esta:

| Página | Contesta |
| --- | --- |
| [Desplegar, paso a paso](/empezar/desplegar-paso-a-paso/) | **Cómo** se despliega: los tres casos de migración, la cadena de Supabase, el rollback |
| **Esta** | **Qué verifico** en cada ambiente, en qué orden, y cómo protejo los datos |

## Lo que cambió, y por qué esta página existe

Producción dejó de ser un ambiente de prueba. Tiene **clientes reales**:
nombres, teléfonos y direcciones de gente de Campo de la Cruz que confió esos
datos en el mostrador.

Eso cambia el precio de un error. Antes, romper producción costaba una tarde.
Ahora puede costar información que **no se puede volver a pedir** — nadie va a
recorrer el pueblo preguntando otra vez.

:::danger[El plan gratuito de Supabase no guarda respaldos]
Textual, del panel: `Backup retention: None`.

No hay una copia esperando en algún lado. **El único respaldo que existe es el
que corriste vos** con `pnpm db:respaldo`, y vive en tu máquina.

Si la base se pierde y no hay respaldo local, no hay a quién pedírselo.
:::

## El recorrido, de un vistazo

Cinco fases. Cada una tiene una salida verificable: si no la ves, no seguís.

| | Fase | Dónde | Prueba de que pasó |
| --- | --- | --- | --- |
| 0 | Tu máquina | local | Todo lo que corre CI, en verde |
| 1 | El preview | Vercel + Railway `staging` | El flujo nuevo, hecho a mano |
| 2 | El respaldo | Supabase → tu disco | `✓ respaldo verificado ... N tablas` |
| 3 | El despliegue | GitHub → Railway + Vercel | El caso A, B o C |
| 4 | La comprobación | producción | Una operación real, hecha por vos |

---

## Fase 0 — Tu máquina

**Correr localmente todo lo que corre CI.** No los tests solamente: *todo*. Un
contrato de endpoint que cambia rompe la colección de Bruno aunque los tests
unitarios estén verdes.

### 0.1 · Las migraciones, en las DOS bases

```bash
cd ~/code/aquazaku/api && pnpm db:migrate
```

```bash
cd ~/code/aquazaku/api && pnpm db:migrate:test
```

Son dos comandos porque son dos bases. Olvidarse del segundo cuesta media hora
buscando un bug que no existe: los tests fallan por columnas inexistentes y
parece del código.

El migrador **anuncia el destino antes de tocar nada**:

```
→ migrando aquazaku@localhost/aquazaku_test → schema "public"
✓ migraciones aplicadas
```

### 0.2 · Lo que corre `api-ci`

```bash
cd ~/code/aquazaku/api && pnpm typecheck
```

```bash
cd ~/code/aquazaku/api && pnpm test:coverage
```

Esos son **exactamente** los dos pasos del workflow, más las migraciones de
arriba. Medido hoy, `api` pasa con holgura:

| | Real | Umbral |
| --- | :-: | :-: |
| Statements | 91.25% | — |
| Branches | 81.45% | 65% |
| Functions | 94.60% | 70% |
| Lines | 93.12% | 70% |

:::note[`api` no tiene linter, y no es un olvido]
Su script `lint` es literalmente `tsc --noEmit` — el mismo comando que
`typecheck`. Por eso el workflow no lo corre por separado: correrlo dos veces
no agrega nada.
:::

### 0.3 · Lo que corre `web-ci`

```bash
cd ~/code/aquazaku/web && pnpm typecheck
```

```bash
cd ~/code/aquazaku/web && pnpm lint
```

```bash
cd ~/code/aquazaku/web && pnpm test:coverage
```

El `lint` de `web` **sí** es ESLint de verdad, y ahí vive la regla que hace
cumplir el patrón BFF: que el browser nunca le hable directo a `api/`
([ADR-0002](/decisiones/0002-bff-pattern/)). No te lo saltes.

:::caution[`web-ci` está en rojo, y no lo rompiste vos]
El portón de cobertura de `web` **nunca** estuvo verde. Medido hoy:

| | Real | Umbral | |
| --- | :-: | :-: | :-: |
| Lines | 45.30% | 70% | ❌ |
| Functions | 40.19% | 70% | ❌ |
| Branches | 34.92% | 65% | ❌ |

`pnpm test:coverage` termina con `exit 1` aunque **todos los tests pasen**. Los
umbrales se pusieron como meta y se dejaron como portón.

Entonces «esperar a que CI esté verde» hoy no es una instrucción ejecutable para
`web`. Lo que sí se puede exigir mientras tanto:

1. Que **los tests pasen** (mirá la lista, no el exit code).
2. Que `typecheck` y `lint` estén limpios — esos sí son binarios.
3. Que la cobertura **no baje** respecto de la corrida anterior.

Es deuda conocida, con dueño y con número. Está en
[Qué falta preguntar](/empezar/pendientes/).
:::

### 0.4 · Bruno, si tocaste un contrato

Si cambiaste la forma de una petición o de una respuesta, la colección se rompe
aunque todo lo demás esté verde. `api-ci` la corre en cada push; correla antes
vos.

Necesita dos condiciones que la base de desarrollo no cumple —estar vacía y
tener un solo administrador—, así que va contra la base de **tests**, en el
3002. Está la configuración `api-pruebas` en `.claude/launch.json`.

---

## Fase 1 — El preview

Un push a una PR despliega dos cosas más:

| Plataforma | Qué |
| --- | --- |
| **Vercel** | La URL `xxx-git-<rama>-aquazaku.vercel.app` |
| **Railway `staging`** | La api del preview, contra el schema `preview` |

Acá es donde se **usa** el cambio con las manos. No es opcional y no lo
reemplaza ningún test: la suite verde nunca dijo nada sobre lo que se ve ni
sobre lo que se siente al usarlo.

Qué mirar:

- El flujo nuevo, de punta a punta, como lo haría quien atiende.
- El flujo **viejo** que está más cerca del cambio. Ahí viven las regresiones.
- La consola del navegador. Un error rojo que nadie mira es un bug que se
  despliega.

:::note[Los datos del preview son descartables; los de producción no]
`preview` y `public` son dos schemas del mismo Postgres, con datos distintos y
usuarios distintos. Cuál usa cada proceso lo decide `AQUAZAKU_ENV`.

En `preview` podés romper lo que quieras: se siembra de nuevo en cada deploy.
Esa es exactamente la razón por la que existe — para no probar en la planta.
:::

---

## Fase 2 — El respaldo

**Antes de cualquier migración contra producción.** Sin excepciones, y menos
ahora que hay clientes cargados.

```bash
cd ~/code/aquazaku/api
DATABASE_MIGRATION_URL='<cadena de Supabase>' pnpm db:respaldo
```

Lo que tiene que imprimir:

```
→ respaldando postgres.<ref>@aws-0-us-east-1.pooler.supabase.com/postgres
✓ respaldo verificado de ... — 29 tablas · N MB
  respaldos/aquazaku-<etiqueta>-<sello>.sql.gz
```

Tres cosas de esa salida:

1. **La primera línea es el destino.** Leela. Si dice otra cosa que Supabase, el
   respaldo no sirve para lo que lo pediste.
2. **«verificado» no es adorno**: el script compara el volcado contra la lista
   real de tablas del schema. Un `pg_dump` que devuelve un archivo vacío
   también termina en `0`, y esa verificación es lo que lo atrapa.
3. **El archivo queda en `api/respaldos/`**, que está en `.gitignore`. Ahí
   adentro hay datos de personas reales: **nunca** lo subas a un repo, ni lo
   pases por chat, ni lo adjuntes a un ticket.

:::danger[Sin la cadena explícita, respalda TU MÁQUINA — y dice `✓` igual]
`db:respaldo` lee `DATABASE_MIGRATION_URL`, y el script corre con
`--env-file-if-exists=.env`, que apunta a `localhost`. Sin pasarla en la misma
línea, el respaldo sale de `aquazaku_dev` y **termina con un tilde verde que
parece éxito**.

Ya pasó en este proyecto. Se creyó tener un respaldo de producción que era de la
base local. Por eso el script anuncia el destino: **leé esa línea siempre.**
:::

### Cómo se restaura, si hiciera falta

El propio script lo imprime al terminar:

```bash
gunzip -c respaldos/<archivo>.sql.gz | psql "$DATABASE_MIGRATION_URL"
```

Sobre una base **vacía**. Restaurar encima de una base con datos no es
restaurar: es mezclar.

---

## Fase 3 — El despliegue

Acá se cruza a [Desplegar, paso a paso](/empezar/desplegar-paso-a-paso/), que
tiene los tres casos con sus comandos. El resumen para decidir cuál:

| ¿Trae migración? | ¿Qué hace? | Orden |
| --- | --- | --- |
| No | — | Mergear. Listo |
| Sí | Agrega algo que el código nuevo **todavía no usa** | Mergear → migrar |
| Sí | Agrega algo que el código nuevo **necesita para funcionar** | **Migrar → mergear** |
| Sí | **Renombra** o convierte | **Migrar → mergear** |

El orden de los dos últimos está invertido a propósito, y no es preferencia: el
otro orden tumba la planta.

:::danger[«Aditiva» no quiere decir «se puede mergear primero»]
La primera versión de esta tabla decía que toda migración aditiva se mergea
antes de migrar. **Está mal**, y la distinción es quién necesita lo que se
agrega:

- Si la columna nueva es para código que viene **después**, el código viejo la
  ignora y el orden da igual.
- Si el código que se está desplegando **la lee**, mergear primero lo deja
  pidiendo algo que no existe.

Lo encontró M15. La migración `0017` solo INSERTA dos filas en `parametros` —
aditiva de manual— pero `clientesALlamar()` las lee al arrancar. Desplegar
`web` antes de migrar habría dado un **500**, y `siPuedeVerlo` solo se traga el
403 a propósito:

> «esconder un panel porque el backend está roto convierte una falla ruidosa en
> un tablero que miente por omisión»

O sea que ese 500 sube al error boundary y **se cae el tablero entero**, no solo
el panel nuevo. Una migración de tres `INSERT` habría dejado a la planta sin
pantalla de inicio.

La pregunta correcta no es «¿agrega o renombra?». Es: **¿el código que voy a
desplegar funciona sin esto?**
:::

Cuando la respuesta es que no, `api` igual se puede mergear antes de migrar
—nadie llama todavía al endpoint nuevo— pero `web` **no**, porque es quien lo
llama. El orden que sale de ahí:

1. Mergear `api`
2. Respaldo y migración
3. Mergear `web`

**Las migraciones no corren solas.** El `startCommand` de producción está vacío
a propósito ([ADR-0011](/decisiones/0011-separacion-de-arranques/)): el
container solo levanta el servidor. Migrar es un acto separado y deliberado que
hacés vos.

---

## Fase 4 — La comprobación en producción

### 4.1 · La consola

```bash
curl -s https://api.aquazaku.com/health
```

```json
{"status":"ok","service":"aquazaku-api","base":"ok","desdeHaceMs":19608}
```

Si aparece `"esquema":"pendientes"` con una lista en `faltan`, el código
desplegado le está pidiendo a la base algo que no tiene.

:::caution[`faltan` se calcula UNA VEZ, al arrancar el proceso]
Y por eso **sigue apareciendo después de migrar bien**, hasta que alguien
reinicie el servicio. El proceso vio el schema viejo al nacer y repite eso
mientras viva.

Para saber si la migración entró sin esperar, preguntale a la base:

```sql
select column_name from information_schema.columns
where table_schema = 'public' and table_name = '<la tabla que cambió>';
```
:::

### 4.2 · La comprobación que ninguna consola reemplaza

Entrá a [app.aquazaku.com](https://app.aquazaku.com) y **hacé una operación
real**: registrá un cliente, cargá una venta, lo que el cambio haya tocado.

Casi todos los defectos serios de este proyecto aparecieron al **usar** el
sistema, no al leerlo ni al testearlo. `/health` en verde solo dice que el
servidor está vivo.

---

## Lo que nunca se hace contra producción

Cinco reglas. Cada una está acá porque el costo de romperla no se puede
deshacer.

### 1 · Nunca `pnpm db:seed` contra producción

El seed crea un usuario con acceso total y siembra datos de demostración. Tiene
dos frenos —`AQUAZAKU_ENV` y `SEED_CONFIRM=yes`— justamente porque correrlo
contra la planta sería un desastre silencioso.

Si alguna vez tenés que pasar `SEED_CONFIRM=yes`, parate y preguntate qué estás
haciendo.

### 2 · Nunca cambies `AQUAZAKU_ENV` en el servicio de producción

Esa variable decide **qué schema lee la aplicación**:

| Valor | Schema | Servicio |
| --- | --- | --- |
| `production` | `public` | producción |
| `preview` | `preview` | staging |

Si producción quedara en `preview`, la app leería un schema sin usuarios y sin
clientes. `/health` seguiría diciendo `ok` —`preview` tiene las mismas tablas—
y el login diría «Credenciales inválidas» con la contraseña correcta.

Se ve como un problema de cuentas y es un problema de configuración.

### 3 · Nunca migres sin el respaldo de la Fase 2

Revertir el código **no deshace una migración**. Si ya corrió, hay que escribir
otra que la deshaga explícitamente. Por eso el respaldo no es ceremonia: es la
única vuelta atrás que existe para los datos.

### 4 · Nunca uses `pnpm db:migrate:prod`

Ese atajo corre `tsx --env-file-if-exists=.env.produccion.local`. Si ese archivo
quedó apuntando a otro lado —pasa— migrás la base equivocada y el comando te
dice «✓ migraciones aplicadas» igual.

La forma explícita no depende de ningún archivo:

```bash
DATABASE_MIGRATION_URL='...' pnpm db:migrate
```

### 5 · Nunca pegues la cadena de conexión en un chat, un log o una captura

La cadena incluye la contraseña del rol `postgres`, que es **dueño de la base**:
lee todo, borra todo, y puede saltarse los `REVOKE` que protegen el
`audit_log`.

Por eso el migrador y el respaldo imprimen el destino **sin la contraseña**:
esas líneas terminan en logs y en capturas de pantalla, y se escribieron
sabiéndolo.

:::danger[Si una contraseña se expuso, rotarla no es opcional]
Supabase → *Project Settings* → *Database* → **Reset database password**.
Después actualizar `DATABASE_MIGRATION_URL` y `DATABASE_URL` en Railway.

Una contraseña expuesta y no rotada sigue siendo válida para siempre. «La vio
poca gente» no es una mitigación.
:::

---

## Cuando algo sale mal

| Síntoma | Qué pasó | Qué hacer |
| --- | --- | --- |
| `/health` dice `faltan: [...]` | Se mergeó sin migrar | Correr la migración |
| 500 en todas las pantallas de clientes | Casi siempre el schema atrasado | Mirar `/health` |
| «Credenciales inválidas» con la clave correcta | Puede ser `AQUAZAKU_ENV` mal puesto | Regla 2 |
| `ENOTFOUND db.<ref>.supabase.co` | Es la conexión directa, que es IPv6 | Usar la del pooler |
| El migrador anuncia `localhost` | La cadena no es la de producción | Ctrl+C |
| El preview no acepta ningún usuario | La api de staging no arrancó, o falta el seed | Log del deploy en Railway |
| CI en rojo pero GitHub deja mergear | `main` no tiene protección de rama | Decidirlo aparte |

:::tip[Antes de asumir que rompiste CI, mirá si ya estaba roto]
```bash
gh run list --branch main --workflow <nombre> --limit 5
```

Asumir la culpa lleva a «arreglar» código sano. Asumir la inocencia lleva a
mandar el pipeline en rojo sin enterarse. Las dos suposiciones cuestan lo mismo:
no haber mirado.
:::

## Un solo administrador es un punto único de falla

Hoy producción tiene **un** usuario. Si esa cuenta se pierde —contraseña
olvidada sin acceso al correo, cuenta desactivada por error— la planta queda
afuera de su propio sistema.

Crear un segundo administrador es la clase de tarea que parece opcional hasta el
día que no lo es.

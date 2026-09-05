---
title: ADR-0009 — Cada pieza en su plataforma, con deploy en cada push
description: Dónde corre Aquazaku en producción, y por qué el hosting no es una decisión libre.
---

**Estado:** Aceptado — revisado el mismo día, y **ejecutado el 5-sep-2026**
**Fecha:** 2026-08-28
**Deciden:** Mao

## Contexto

Aquazaku llegó a M9 sin una sola decisión de infraestructura escrita. No había
ADR, no había Dockerfile, y **la palabra «internet» no aparecía en ninguno de
los ocho ADR anteriores ni en el dominio**.

Eso importaba más de lo que parecía: todo el MVP se diseñó *web-first* asumiendo
que la planta tiene conexión, y esa suposición nunca se dijo en voz alta ni se
validó. Se validó al empezar esto: **el servicio de internet en Campo de la Cruz
es continuo.** El día que haya que operar sin conexión será una PWA con
sincronización, y eso es M8 — no una restricción de hoy.

### Lo que el sistema exige del hosting

El hosting no es una elección libre. Hay dos condiciones que salen del código:

**1. Veinte `REVOKE` repartidos en nueve migraciones.** Las bitácoras
—`audit_log`, `movimientos_stock`, `movimientos_base`, `movimientos_insumo`,
`lineas_de_compra`— son append-only, y esa garantía tiene **dos** mitades: los
triggers y los permisos. [ADR-0006](/decisiones/0006-invariantes-en-la-base/)
explica por qué viven en la base.

Cualquier Postgres que no permita `CREATE ROLE` y `REVOKE` deja la mitad de esa
garantía sin poner — y lo hace **en silencio**, porque las migraciones corren
igual.

**2. `pg_advisory_xact_lock`** en el parque de botellones, y un pool de diez
conexiones persistentes.

## Alternativas evaluadas

### Opción A — Todo en una máquina con Docker

- ✅ Un artefacto, una factura, una cosa que respaldar.
- ✅ Control total de los roles de Postgres.
- ✅ El BFF le habla a `api` por red privada: la API **no es alcanzable desde
  internet**.
- ❌ **Los respaldos quedan a cargo de uno.** Un `pg_dump` por cron que hay que
  acordarse de sacar de la máquina. Es la parte más débil.

### Opción B — Todo repartido: Vercel para `web`, algo para `api`, Postgres gestionado

- ✅ Respaldos y escalado gestionados.
- ❌ **El BFF deja de ser interno.** Hoy `web` le habla a `api` por la red
  privada de Docker. Repartido, ese tráfico sale a internet y la API tiene que
  quedar expuesta. No es fatal —hay HTTPS, validación de `Origin` y sesión— pero
  es un cambio de postura que el diseño no asumía.
- ❌ El pool de diez conexiones asume un proceso vivo. En serverless cada
  instancia abre el suyo y se agota el límite.
- ❌ Tres proveedores para ocho personas y un mostrador.

### Opción C — Postgres gestionado, aplicación en una máquina

- ✅ Respaldos gestionados con recuperación a un punto en el tiempo.
- ✅ El BFF sigue hablándole a `api` por red privada.
- ✅ Solo cambia una variable de entorno respecto de la opción A.
- ❌ Dos proveedores en vez de uno.
- ❌ Latencia de red entre la aplicación y la base, en vez de un socket local.

## Decisión

**Cada pieza en su plataforma, y cada una se despliega sola con un push:**

| Pieza | Dónde | Disparador |
| --- | --- | --- |
| `web` | Vercel | push a `main` |
| `api` | **Railway**, construyendo su Dockerfile | push a `main` |
| Postgres | Supabase | — |

### Se decidió la opción C, y se revisó el mismo día

La primera versión de este ADR eligió la opción C —aplicación en una máquina— y
la razón fue buena: los respaldos gestionados.

Lo que estaba mal era el **peso** que se le dio a un costo: administrar un
servidor no se termina nunca. Actualizaciones del sistema, renovación de
certificados, y ser la persona que lo arregla a las dos de la mañana. Para un
negocio de ocho personas sin nadie de sistemas, eso no es un detalle — es el
trabajo que va a quedar sin hacer.

Mao lo puso en una frase: **solo quiere empujar código al repo y que eso
actualice producción.** Con las tres plataformas, eso sale de fábrica.

### El BFF sobrevive, y eso hay que decirlo con precisión

En «Alternativas» se anotó en contra que repartirlo hace que el BFF «deje de ser
interno». Es cierto a medias, y la mitad que importa se mantiene.

Lo que [ADR-0002](/decisiones/0002-bff-pattern/) protege es que **el browser
nunca hable con `api`**. Eso sigue igual: el navegador le habla a Vercel, y el
servidor de Vercel le habla a `api`.

Lo que sí cambia es que `api` queda alcanzable desde internet, en vez de vivir
en una red privada. Sigue protegida por la sesión, la matriz de permisos y la
validación de `Origin` que Better-Auth exige en toda petición que cambie estado.
Es una capa menos, no la capa.

### El pool tampoco es un problema

Se anotó que un pool de diez conexiones «asume un proceso vivo». Es cierto, y
por eso `api` va a una plataforma de **contenedores de larga vida** —Railway o
Fly— y no a funciones. El proceso queda arriba, con su pool, igual que en una
máquina propia.

## Lo que se verificó antes de decidir, y no se supuso

La condición no negociable se probó contra una instancia real:

| Qué | Resultado |
| --- | --- |
| `CREATE ROLE aquazaku_app` | ✅ el rol `postgres` puede, sin ser superusuario |
| Los veinte `REVOKE` | ✅ toman |
| Las once migraciones | ✅ 27 tablas, 13 triggers |
| Bitácoras después de migrar | ✅ `SELECT INSERT`, sin `UPDATE` ni `DELETE` |
| `pg_advisory_xact_lock` por el pooler de transacción | ✅ toma y libera |
| `UPDATE audit_log` con el rol de la aplicación | ✅ `permission denied` |

El último es el que cierra la decisión: la garantía se sostiene **en caliente y
por el camino que usa la aplicación de verdad**, no en un test sintético.

## Consecuencias

### Hay DOS cadenas de conexión, y confundirlas rompe cosas

| Variable | Pooler | Puerto | Por qué |
| --- | --- | :-: | --- |
| `DATABASE_URL` | transacción | 6543 | La aplicación. `pg_advisory_xact_lock` se libera al cerrar la transacción, así que este modo le sirve. |
| `DATABASE_MIGRATION_URL` | sesión | 5432 | Las migraciones. Necesitan DDL, `CREATE ROLE` y `REVOKE`, que el modo transacción no sostiene. |

:::danger[La conexión DIRECTA no sirve]
`db.<ref>.supabase.co` resuelve **solo por IPv6**: Supabase convirtió IPv4 en un
complemento pago. No funciona desde una máquina sin ruta IPv6 —ni desde la
mayoría de los servidores baratos— y el error es un `ENOTFOUND` que no dice nada
sobre IPv6.

Es la cadena que el panel ofrece primero. Van las del pooler.
:::

### La versión de Postgres deja de coincidir

Supabase corre **17.6** y el CI corría **16**. Las migraciones pasaron contra
17, pero eso era una brecha de paridad: un bug propio de 17 no se vería hasta
producción.

**El CI ya está en 17.** El entorno local puede quedar en 16 sin problema — la
compuerta que decide si algo se mergea es el CI, y esa tiene que parecerse a
producción, no a la máquina de quien escribe. Al revés no.

### Hace falta un dominio propio, y no es opcional

`forwardSetCookies` reenvía la cookie de sesión tal cual viene de `api`,
**incluido su atributo `domain`**. Un navegador rechaza una cookie cuyo `domain`
no sea el del sitio que la sirvió, ni un ancestro suyo.

Con subdominios gratis —`algo.vercel.app` y `algo.railway.app`— son dominios raíz
distintos: la cookie no sobrevive y no hay sesión.

Con dominio propio, y **la cookie en el subdominio de la app, no en el padre**:

```
aquazaku.com       → el sitio oficial, público
app.aquazaku.com   → web
api.aquazaku.com   → api
COOKIE_DOMAIN=app.aquazaku.com
```

:::note[Por qué el subdominio y no `.aquazaku.com`]
El reflejo es poner el padre para que `api` también reciba la cookie. **No hace
falta**, y acá es donde [ADR-0002](/decisiones/0002-bff-pattern/) se paga solo:
`web` reenvía la cookie a `api` como un header servidor-a-servidor, donde las
reglas de dominio del navegador no aplican.

Con el padre, la sesión de la planta viajaría en cada petición al sitio público
de la raíz. Es `httpOnly` —ningún JavaScript la lee— pero el servidor de ese
sitio la recibiría entera.
:::

### La aplicación sigue siendo portable

`api` y `web` corren en contenedores contra cualquier Postgres que cumpla las
dos condiciones de arriba. Si una plataforma deja de convenir, cambia dónde se
construye el mismo Dockerfile — no la arquitectura.

Es lo mismo que permitió probar todo el despliegue contra un Postgres local en
Docker antes de tocar una nube, y **encontrar ahí seis bugs de empaquetado** que
ninguna lectura del archivo habría mostrado. Ese trabajo no se pierde: Railway y
Fly construyen exactamente esos Dockerfiles.

### La región de Supabase importa más de lo que parece

Una sola pantalla hace muchas consultas, así que la latencia entre `api` y la
base se multiplica por consulta. Pesa más que la distancia entre el usuario y
`api`.

Conviene que las dos queden cerca, y elegir la región **antes** de cargar datos:
después es una migración.

---

## Lo que quedó en pie — 5 de septiembre de 2026

El ADR dejó de ser un plan. Esto es lo que corre, verificado desde afuera:

| Pieza | Dónde | Plan |
| --- | --- | --- |
| `app.aquazaku.com` | Vercel | Hobby |
| `api.aquazaku.com` | Railway | Hobby |
| Postgres | Supabase `us-east-1` | Free |
| Correo | Resend | Free |
| DNS | Cloudflare, dominio en Namecheap | Free |

Los dos registros van en **DNS only**, nube gris. La raíz queda reservada para
el sitio oficial.

### Las pruebas, no las impresiones

| Prueba | Resultado |
| --- | --- |
| `api /health` | `200` `{"status":"ok"}` |
| Login con credenciales falsas | `401 INVALID_EMAIL_OR_PASSWORD` |
| `/reportes/cartera`, `/clientes`, `/ventas` sin sesión | `401 UNAUTHENTICATED` |
| `web /` y `/modulos/*` sin sesión | `307 → /login` |
| `web /login` | `200`, con su formulario |

**El `307` es el que prueba la arquitectura entera.** Para redirigir,
`getServerUser()` corrió en Vercel, le habló a Railway servidor-a-servidor,
recibió un `401` y decidió. Es [ADR-0002](/decisiones/0002-bff-pattern/)
funcionando entre dos proveedores distintos.

Y el `401` del login es el que prueba que la base responde: `/health` **no
consulta nada**, así que un `200` ahí no dice nada de Supabase.

### Los dos bugs, y qué los resolvió

| Síntoma | Lo que dijo el log |
| --- | --- |
| `api` en `500` | `password authentication failed for user "aquazaku_app"` |
| `web` en `500` | `API_INTERNAL_URL no está definida` |

Ninguno se resolvió leyendo código. Los dos, leyendo un log.

El segundo se cerró en un vistazo porque el mensaje decía exactamente qué
faltaba y por qué. Es el argumento entero a favor de escribir errores que
expliquen, en vez de dejar que el framework tire un stack trace genérico.

Del primero quedó una regla: **la contraseña de un rol de base de datos va en
ASCII puro.** Entre el panel del proveedor, la URL de conexión y el driver hay
tres capas donde un carácter acentuado se puede mal codificar, y el síntoma
—`password authentication failed`— no menciona la codificación por ningún lado.

### Lo que la capa gratuita no cubre

| Riesgo | Estado |
| --- | --- |
| Supabase Free no tiene respaldos | Cubierto con `pnpm db:respaldo`, **manual** |
| Supabase Free se pausa a la semana sin uso | Con uso diario no aparece |
| Vercel Hobby prohíbe el uso comercial | Sin cubrir. El seguro es que `web/Dockerfile` funciona |

### Deuda anotada, no escondida

1. **`/health` no consulta la base.** Railway estuvo en verde toda la puesta en
   marcha con Supabase inalcanzable. Un `SELECT 1` lo arregla.
2. **Better-Auth no ve la IP del cliente** detrás del proxy de Railway, así que
   el rate limit del login usa un balde compartido: un atacante bloquearía a las
   ocho personas de la planta junto con él.
3. **Los errores de `web` hablan solo de desarrollo local** («copiá
   `.env.example` a `.env.local`»), consejo inútil en Vercel.

---
title: Despliegue
description: Cómo se deploya Aquazaku — producción, preview y la separación de concerns que evita que un fallo de preview tumbe producción.
---

# Despliegue

Dos diagramas, dos ambientes. Producción no migra al arrancar; staging sincroniza
su propio schema en cada push a una PR.

## Deploy de producción

Cada merge a `main` dispara Vercel y Railway en paralelo. El contenedor de
Railway arranca con el `CMD ["pnpm", "start"]` del Dockerfile — el `startCommand`
queda vacío a propósito. Las migraciones a producción son un paso deliberado
(`pnpm db:migrate:prod`) que Mao corre a mano después del deploy.

[Ver diagrama en pantalla completa →](/diagramas/aquazaku-deploy-prod.html){target="\_blank"}

<iframe src="/diagramas/aquazaku-deploy-prod.html" width="100%" height="640" style="border: 0;"></iframe>

:::note[Por qué producción NO migra al arrancar]
[ADR-0009](/decisiones/0009-donde-corre-aquazaku/) asume que dos instancias
migrando a la vez se pisan. Una migración a medias es peor que un deploy
demorado. El merge a `main` ya es deliberado (PR + review + merge); agregar
`pnpm db:migrate:prod` después no introduce una nueva categoría de
"olvidos".

Lo que sí se pierde: la "migración automática que alguien configuró una
vez y nunca más revisamos". El server arranca con el último código
mergeado. Si las tablas no existen, los errores 500 aparecen desde el
primer request — no se acumulan en silencio.
:::

## Deploy de preview

Cada push a una PR dispara Vercel y Railway staging en paralelo. El
`startCommand` de staging corre `pnpm db:sync-preview && pnpm db:seed && pnpm start`
— el `db:sync-preview` aplica las migraciones al schema `preview` (el
migrador lee `AQUAZAKU_ENV=preview` y apunta ahí, no a `public`).

[Ver diagrama en pantalla completa →](/diagramas/aquazaku-deploy-preview.html){target="\_blank"}

<iframe src="/diagramas/aquazaku-deploy-preview.html" width="100%" height="640" style="border: 0;"></iframe>

:::caution[El 403 de Better Auth es la señal canaria]
Si el sign-in desde el preview devuelve 403, el wildcard `*.vercel.app`
en `trustedOrigins` no está cubriendo el subdominio que emite Vercel. La
fix es agregar el subdominio explícito o ajustar el patrón. La auditoría
de CI no lo detecta — es runtime, y es la única verificación que prueba
que el ciclo preview funciona end-to-end.
:::

## La separación explicada

El [ADR-0011](/decisiones/0011-separacion-de-arranques/) documenta por qué
el `startCommand` de producción está vacío y el de staging sincroniza su
propio schema. Resumen:

- **Producción** no migra ni sincroniza. Solo arranca el server.
- **Staging** sincroniza su propio schema (`preview`) en cada push.
- **Migrador y aplicación** consultan la misma función `searchPathFor(env)`
  para decidir el schema objetivo. Una sola fuente de verdad.
- Las migraciones de producción son un paso humano, anunciado
  (`pnpm db:migrate:prod`).

Ver también: [Entornos](/arquitectura/entornos/) y la [puesta en
producción](/empezar/puesta-en-produccion/) operativa.

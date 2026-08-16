# aquazaku-docs

Documentación técnica del sistema de gestión de **Aquazaku** — ventas, stock,
clientes, proveedores, roles y permisos, y app mobile para vendedores.

Construida con [Astro Starlight](https://starlight.astro.build/es/).

## Arrancar

```bash
pnpm install
pnpm dev      # http://localhost:4321
```

| Comando | Qué hace |
| --- | --- |
| `pnpm dev` | Servidor de desarrollo en `localhost:4321` |
| `pnpm build` | Genera el sitio estático en `./dist` |
| `pnpm preview` | Sirve el build local para verificarlo |

## Estructura

```
src/content/docs/
├── empezar/         Visión general y glosario del negocio
├── arquitectura/    Cómo está armado el sistema hoy
├── decisiones/      ADR — por qué está armado así
├── dominio/         Reglas de negocio
├── backend/         API, auth y permisos
├── base-de-datos/   Modelo de datos y migraciones
├── frontend/        Panel de administración web
├── mobile/          App de vendedores
└── convenciones/    Cómo se escribe esta documentación
```

El sidebar usa `autogenerate`: agregar un `.md` en cualquiera de esas carpetas
crea su entrada sola, sin tocar `astro.config.mjs`.

## Antes de escribir

Leé [Cómo documentar](src/content/docs/convenciones/como-documentar.md) —
define dónde va cada cosa y cómo se marca lo que todavía no sabemos.

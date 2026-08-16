---
title: Base de datos
description: Modelo de datos, migraciones y decisiones de modelado de Aquazaku.
sidebar:
  order: 1
---

## Qué documentar acá

- **Modelo de datos** — diagrama entidad-relación y qué representa cada tabla
  en términos del [dominio](/dominio/).
- **Migraciones** — cómo se crean, cómo se aplican, cómo se revierte.
- **Índices y consultas críticas** — las consultas que tienen que ser rápidas sí o sí.
- **Datos semilla** — qué necesita una instalación limpia para arrancar.

## El punto delicado

El modelo tiene que distinguir **producto** de **envase retornable**. Una paca sale
y no vuelve; un botellón sale, se espera que vuelva, y a veces no vuelve. Son dos
ciclos de vida distintos y un solo campo `stock` no los representa.

Esa decisión, cuando se tome, va documentada como
[ADR](/decisiones/) — es de las caras de revertir.

:::note[Sin definir todavía]
El motor de base de datos todavía no está elegido. Cuando se elija, se registra
el ADR con las alternativas evaluadas.
:::

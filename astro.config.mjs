// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

// https://astro.build/config
export default defineConfig({
	integrations: [
		starlight({
			title: 'Aquazaku Docs',
			description:
				'Documentación técnica del sistema de gestión de Aquazaku: ventas, stock, clientes, proveedores y app mobile.',
			// Español sin prefijo /es/ en la URL.
			defaultLocale: 'root',
			locales: {
				root: { label: 'Español', lang: 'es' },
			},
			social: [
				{
					icon: 'github',
					label: 'GitHub',
					href: 'https://github.com/maoacr/aquazaku-docs',
				},
			],
			// `autogenerate` lee el filesystem: agregar un .md crea la entrada sola.
			// No hace falta tocar este archivo cada vez que documentamos algo nuevo.
			sidebar: [
				{
					label: 'Empezar acá',
					items: [
						{ label: 'Visión general', slug: 'empezar/vision-general' },
						{ label: 'Glosario del negocio', slug: 'empezar/glosario' },
					],
				},
				{
					label: 'Arquitectura',
					autogenerate: { directory: 'arquitectura' },
				},
				{
					label: 'Decisiones técnicas (ADR)',
					autogenerate: { directory: 'decisiones' },
					collapsed: true,
				},
				{
					label: 'Dominio',
					autogenerate: { directory: 'dominio' },
				},
				{
					label: 'Backend',
					autogenerate: { directory: 'backend' },
				},
				{
					label: 'Base de datos',
					autogenerate: { directory: 'base-de-datos' },
				},
				{
					label: 'Frontend',
					autogenerate: { directory: 'frontend' },
				},
				{
					label: 'Mobile',
					autogenerate: { directory: 'mobile' },
				},
				{
					label: 'Convenciones',
					autogenerate: { directory: 'convenciones' },
					collapsed: true,
				},
			],
		}),
	],
});

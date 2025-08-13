// @ts-check
import cloudflare from '@astrojs/cloudflare';
import mdx from '@astrojs/mdx';
import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';
import svelte from '@astrojs/svelte';
import keystatic from '@keystatic/astro';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'astro/config';
import expressiveCode from 'astro-expressive-code';
import icon from 'astro-icon';
import rehypeAutolinkHeadings from 'rehype-autolink-headings';
import rehypeSlug from 'rehype-slug';
import { visualizer } from 'rollup-plugin-visualizer';

// https://astro.build/config
export default defineConfig({
	vite: {
		plugins: [
			tailwindcss(),
			visualizer({
				emitFile: true,
				filename: 'stats.html',
				gzipSize: true,
				brotliSize: true,
			}),
		],
	},

	adapter: cloudflare({
		platformProxy: {
			enabled: true,
		},
	}),

	integrations: [expressiveCode(), svelte(), mdx(), sitemap(), react(), keystatic(), icon()],

	markdown: {
		rehypePlugins: [
			rehypeSlug,
			[
				rehypeAutolinkHeadings,
				{
					behavior: 'wrap',
					properties: { className: ['anchor'] },
				},
			],
		],
	},
});

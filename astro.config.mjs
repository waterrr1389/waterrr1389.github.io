// @ts-check

import sitemap from '@astrojs/sitemap';
import { defineConfig } from 'astro/config';
import { INNER_PATH } from './src/config';

// https://astro.build/config
export default defineConfig({
	site: 'https://waterrr1389.github.io',
	integrations: [
		sitemap({
			// Keep the hidden /inner section out of the sitemap.
			filter: (page) => !page.includes(`/${INNER_PATH}`),
		}),
	],
	markdown: {
		shikiConfig: {
			themes: {
				light: 'github-light',
				dark: 'github-dark',
			},
			defaultColor: false,
		},
	},
});

// SSR build config for the state-snapshot harness (tools/state-snapshots).
// Bundles ui/ code for execution in node; not part of the site build.
import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig } from 'vite';

import { UI_ALIASES } from './vite.config.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
	root: '.',
	resolve: {
		alias: {
			'virtual:i18next-loader': path.resolve(here, 'tools/state-snapshots/stub-i18n.js'),
			...UI_ALIASES,
		},
	},
	oxc: {
		jsx: { runtime: 'automatic', importSource: 'react' },
	},
	ssr: { noExternal: true },
	build: {
		ssr: process.env.HARNESS_ENTRY!,
		outDir: 'tmp/harness',
		emptyOutDir: true,
		minify: false,
		target: 'node22',
	},
});

/** Bundles ui/core for the node log-pipeline benchmark. See tools/bench/README.md. */

import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig } from 'vite';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
	root: __dirname,
	resolve: {
		alias: {
			'virtual:i18next-loader': path.resolve(__dirname, 'tools/bench/stubs/i18next_resources.js'),
		},
	},
	oxc: {
		jsx: { runtime: 'classic', pragma: 'element', pragmaFrag: 'fragment' },
		jsxInject: "import { element, fragment } from 'tsx-vanilla';",
	},
	ssr: { noExternal: true },
	build: {
		ssr: 'tools/bench/entry.ts',
		outDir: 'tools/bench/.build',
		emptyOutDir: true,
		minify: false,
		target: 'node22',
	},
});

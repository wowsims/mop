// SSR build config for the state-snapshot harness (tools/state-snapshots).
// Bundles ui/core code for execution in node; not part of the site build.
import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig } from 'vite';

const here = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
	root: '.',
	resolve: {
		alias: {
			'virtual:i18next-loader': path.resolve(here, 'tools/state-snapshots/stub-i18n.js'),
		},
	},
	oxc: {
		jsx: { runtime: 'classic', pragma: 'element', pragmaFrag: 'fragment' },
		jsxInject: "import { element, fragment } from 'tsx-vanilla';",
	},
	ssr: { noExternal: true },
	build: {
		ssr: process.env.HARNESS_ENTRY ?? 'tools/state-snapshots/probe.ts',
		outDir: 'tmp/harness',
		emptyOutDir: true,
		minify: false,
		target: 'node22',
	},
});

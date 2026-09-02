// SSR build config for the state-snapshot harness (tools/state-snapshots).
// Bundles ui/ code for execution in node; not part of the site build.
import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig } from 'vite';

const here = path.dirname(fileURLToPath(import.meta.url));
const uiRoot = path.resolve(here, 'ui');

export default defineConfig({
	root: '.',
	resolve: {
		alias: {
			'virtual:i18next-loader': path.resolve(here, 'tools/state-snapshots/stub-i18n.js'),
			'@domain': path.resolve(uiRoot, 'domain'),
			'@generated': path.resolve(uiRoot, 'generated'),
			'@worker': path.resolve(uiRoot, 'worker'),
			'@ui-kit': path.resolve(uiRoot, 'ui-kit'),
			'@features': path.resolve(uiRoot, 'features'),
			'@app': path.resolve(uiRoot, 'app'),
			'@specs': path.resolve(uiRoot, 'sims'),
			'@i18n': path.resolve(uiRoot, 'i18n'),
			'@core': path.resolve(uiRoot, 'core'),
		},
	},
	oxc: {
		jsx: { runtime: 'classic', pragma: 'element', pragmaFrag: 'fragment' },
		jsxInject: "import { element, fragment } from 'tsx-vanilla';",
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

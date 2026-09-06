// Unit-test config. The site build stays in vite.config.mts; this only adds a DOM and the
// test-file glob, and reuses the same aliases so a test resolves imports exactly as the app does.
import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig } from 'vitest/config';

import { UI_ALIASES } from './vite.config.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
	resolve: {
		alias: {
			'virtual:i18next-loader': path.resolve(here, 'tools/state-snapshots/stub-i18n.js'),
			...UI_ALIASES,
		},
	},
	// Same JSX contract as the app: React by default, tsx-vanilla for files carrying the pragma.
	oxc: {
		jsx: { runtime: 'automatic', importSource: 'react' },
	},
	test: {
		environment: 'happy-dom',
		setupFiles: [path.resolve(here, 'vitest.setup.ts')],
		include: ['ui/**/*.test.ts', 'ui/**/*.test.tsx'],
		restoreMocks: true,
	},
});

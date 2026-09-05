/** @type {import('vite').UserConfig} */

import fs from 'fs';
import { IncomingMessage, ServerResponse } from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { ConfigEnv, defineConfig, PluginOption, UserConfigExport } from 'vite';
import { watchAndRun } from 'vite-plugin-watch-and-run';
import { checker } from 'vite-plugin-checker';
import i18nextLoader from 'vite-plugin-i18next-loader';
import stylelint from 'vite-plugin-stylelint';

import { SPEC_PAGE_TEMPLATE, specPages } from './tools/vite/spec_pages.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const BASE_PATH = path.resolve(__dirname, 'ui');
export const OUT_DIR = path.join(__dirname, 'dist', 'mop');

// The ui/ path aliases. Mirrored by `compilerOptions.paths` in tsconfig.json and by the
// layering rules in .oxlintrc.json; shared with vite.harness.mts from here so the two vite
// configs cannot drift.
export const UI_ALIASES: Record<string, string> = {
	'@domain': path.resolve(BASE_PATH, 'domain'),
	'@generated': path.resolve(BASE_PATH, 'generated'),
	'@worker': path.resolve(BASE_PATH, 'worker'),
	'@ui-kit': path.resolve(BASE_PATH, 'ui-kit'),
	'@features': path.resolve(BASE_PATH, 'features'),
	'@app': path.resolve(BASE_PATH, 'app'),
	'@specs': path.resolve(BASE_PATH, 'sims'),
	'@i18n': path.resolve(BASE_PATH, 'i18n'),
	'@jsx-vanilla': path.resolve(BASE_PATH, 'shared/jsx-vanilla'),
};

function serveExternalAssets() {
	const simWorker = process.env.WASM_WORKER ? '/mop/sim_worker.js' : '/mop/local_worker.js';
	const workerMappings = {
		'/mop/sim_worker.js': simWorker,
		'/mop/net_worker.js': '/mop/net_worker.js',
		'/mop/lib.wasm.gz': '/mop/lib.wasm.gz',
		'/mop/highs.wasm': '/mop/highs.wasm',
	};

	return {
		name: 'serve-external-assets',
		configureServer(server) {
			server.middlewares.use((req, res, next) => {
				const url = req.url!;
				const pathname = new URL(url, 'http://localhost').pathname;

				if (Object.keys(workerMappings).includes(pathname)) {
					const targetPath = workerMappings[pathname as keyof typeof workerMappings];
					const assetsPath = path.resolve(__dirname, './dist/mop');
					const requestedPath = path.join(assetsPath, targetPath.replace('/mop/', ''));

					serveFile(res, requestedPath);
					return;
				}

				if (pathname.includes('/mop/assets')) {
					const assetsPath = path.resolve(__dirname, './assets');
					const assetRelativePath = pathname.split('/mop/assets')[1];
					const requestedPath = path.join(assetsPath, assetRelativePath);

					serveFile(res, requestedPath);
					return;
				} else {
					next();
				}
			});
		},
	} satisfies PluginOption;
}

function serveFile(res: ServerResponse<IncomingMessage>, filePath: string) {
	if (fs.existsSync(filePath)) {
		const contentType = determineContentType(filePath);
		res.writeHead(200, { 'Content-Type': contentType });
		fs.createReadStream(filePath).pipe(res);
	} else {
		console.log('Not found on filesystem: ', filePath);
		res.writeHead(404, { 'Content-Type': 'text/plain' });
		res.end('Not Found');
	}
}

function determineContentType(filePath: string) {
	const extension = path.extname(filePath).toLowerCase();
	switch (extension) {
		case '.jpg':
		case '.jpeg':
			return 'image/jpeg';
		case '.png':
			return 'image/png';
		case '.gif':
			return 'image/gif';
		case '.css':
			return 'text/css';
		case '.js':
			return 'text/javascript';
		case '.woff':
		case '.woff2':
			return 'font/woff2';
		case '.json':
			return 'application/json';
		case '.wasm':
			return 'application/wasm'; // Adding MIME type for WebAssembly files
		// Add more cases as needed
		default:
			return 'application/octet-stream';
	}
}

export const getBaseConfig = ({ command, mode }: ConfigEnv) =>
	({
		base: '/mop/',
		root: BASE_PATH,
		resolve: {
			alias: { ...UI_ALIASES },
		},
		build: {
			outDir: OUT_DIR,
			minify: mode === 'development' ? false : 'oxc',
			sourcemap: command === 'serve' ? 'inline' : false,
			target: ['es2020'],
		},
	}) satisfies Partial<UserConfigExport>;

export default defineConfig(({ command, mode }) => {
	const baseConfig = getBaseConfig({ command, mode });
	const watchedBackendFiles = [
		path.resolve(__dirname, 'sim/core/character_constants.go'),
		path.resolve(__dirname, 'sim/core/bulk/candidates.go'),
		path.resolve(__dirname, 'tools/database/gen_character_constants_ts.go'),
		path.resolve(__dirname, 'tools/database/gen_bulksim_constants.ts.go'),
	];

	return {
		...baseConfig,
		css: {
			preprocessorOptions: {
				scss: {
					loadPaths: [path.resolve(__dirname, 'ui', 'scss')],
					silenceDeprecations: ['import', 'global-builtin', 'color-functions', 'if-function'],
				},
			},
		},
		plugins: [
			i18nextLoader({ namespaceResolution: 'basename', paths: ['assets/locales'] }),
			watchAndRun([
				{
					name: 'Generate TypeScript from Go',
					watch: watchedBackendFiles,
					watchKind: ['ready', 'change'],
					run: 'go run ./tools/database/gen_db -gen=go-to-ts',
					delay: 0,
					logs: ['trigger', 'end'],
				},
			]),
			serveExternalAssets(),
			specPages(BASE_PATH),
			checker({
				root: BASE_PATH,
				typescript: { root: __dirname, tsconfigPath: 'tsconfig.json' },
				// Type-checking during build is redundant: the makefile runs `tsc --noEmit` right before `vite build`.
				enableBuild: false,
			}),
			stylelint({
				build: true,
				lintInWorker: process.env.NODE_ENV === 'production',
				include: ['ui/**/*.scss'],
				configFile: path.resolve(__dirname, 'stylelint.config.mjs'),
			}),
		],
		oxc: {
			// React owns the default. Files still building real DOM nodes opt out per-file with
			// `/** @jsxImportSource @jsx-vanilla */`; see ui/shared/jsx-vanilla/jsx-runtime.ts.
			jsx: {
				runtime: 'automatic',
				importSource: 'react',
			},
		},
		build: {
			...baseConfig.build,
			rollupOptions: {
				// The per-spec pages are added by the specPages plugin.
				input: {
					'ui/index.html': path.resolve(BASE_PATH, 'index.html'),
					// The single spec page. `specPages` copies the processed result to
					// `<class>/<spec>/index.html` and drops this path from the bundle; the key only
					// names the page's js/css ([name] in the *FileNames below), not its html output.
					spec_entry: path.resolve(BASE_PATH, SPEC_PAGE_TEMPLATE),
				},
				output: {
					assetFileNames: () => 'bundle/[name]-[hash].style.css',
					entryFileNames: () => 'bundle/[name]-[hash].entry.js',
					chunkFileNames: () => 'bundle/[name]-[hash].chunk.js',
				},
			},
			server: {
				origin: 'http://localhost:3000',
				// Adding custom middleware to serve 'dist' directory in development
			},
		},
	};
});

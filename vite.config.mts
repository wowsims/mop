/** @type {import('vite').UserConfig} */

import fs from 'fs';
import glob from 'glob';
import { IncomingMessage, ServerResponse } from 'http';
import path from 'path';
import { ConfigEnv, defineConfig, PluginOption, UserConfigExport } from 'vite';
import { checker } from 'vite-plugin-checker';

export const BASE_PATH = path.resolve(__dirname, 'ui');
export const OUT_DIR = path.join(__dirname, 'dist', 'mop');

function serveExternalAssets() {
	const workerMappings = {
		'/mop/sim_worker.js': '/mop/local_worker.js',
		'/mop/net_worker.js': '/mop/net_worker.js',
		'/mop/lib.wasm': '/mop/lib.wasm',
	};

	return {
		name: 'serve-external-assets',
		configureServer(server) {
			server.middlewares.use((req, res, next) => {
				const url = req.url!;
				const urlWithoutQuery = url.split('?')[0];
				const isImport = url.includes('?import');

				if (Object.keys(workerMappings).includes(urlWithoutQuery)) {
					const targetPath = workerMappings[urlWithoutQuery as keyof typeof workerMappings];
					const assetsPath = path.resolve(__dirname, './dist/mop');
					const requestedPath = path.join(assetsPath, targetPath.replace('/mop/', ''));

					serveFile(res, requestedPath, isImport);
					return;
				}

				if (url.includes('/mop/assets')) {
					const assetsPath = path.resolve(__dirname, './assets');
					const assetRelativePath = urlWithoutQuery.split('/mop/assets')[1];
					const requestedPath = path.join(assetsPath, assetRelativePath);

					serveFile(res, requestedPath, isImport);
					return;
				} else if (url.includes('/mop/locales')) {
					const localesPath = path.resolve(__dirname, './assets/locales');
					const localeRelativePath = urlWithoutQuery.split('/mop/locales')[1];
					const requestedPath = path.join(localesPath, localeRelativePath);

					serveFile(res, requestedPath, isImport);
					return;
				} else {
					next();
				}
			});
		},
	} satisfies PluginOption;
}

function serveFile(res: ServerResponse<IncomingMessage>, filePath: string, isImport = false) {
	if (fs.existsSync(filePath)) {
		const contentType = determineContentType(filePath, isImport);
		res.writeHead(200, { 'Content-Type': contentType });
		
		if (isImport && path.extname(filePath).toLowerCase() === '.json') {
			// For JSON imports, serve as ES module
			const jsonContent = fs.readFileSync(filePath, 'utf-8');
			res.end(`export default ${jsonContent}`);
		} else {
			fs.createReadStream(filePath).pipe(res);
		}
	} else {
		console.log('Not found on filesystem: ', filePath);
		res.writeHead(404, { 'Content-Type': 'text/plain' });
		res.end('Not Found');
	}
}

function determineContentType(filePath: string, isImport = false) {
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
			return isImport ? 'text/javascript' : 'application/json';
		case '.wasm':
			return 'application/wasm';
		default:
			return 'application/octet-stream';
	}
}

function copyLocales() {
	return {
		name: 'copy-locales',
		buildStart() {
			// add locales here to enable them in the UI
			const locales = [
				'en.json',
				'fr.json'
			];
			const srcDir = path.resolve(__dirname, 'assets/locales');
			const destDir = path.resolve(__dirname, 'dist/mop/assets/locales');
			if (!fs.existsSync(destDir)) {
				fs.mkdirSync(destDir, { recursive: true });
			}
			locales.forEach(file => {
				const src = path.join(srcDir, file);
				const dest = path.join(destDir, file);
				fs.copyFileSync(src, dest);
			});
		},
	} satisfies PluginOption;
}

export const getBaseConfig = ({ command, mode }: ConfigEnv) =>
	({
		base: '/mop/',
		root: path.join(__dirname, 'ui'),
		build: {
			outDir: OUT_DIR,
			minify: mode === 'development' ? false : 'terser',
			sourcemap: command === 'serve' ? 'inline' : false,
			target: ['es2020'],
		},
	}) satisfies Partial<UserConfigExport>;

export default defineConfig(({ command, mode }) => {
	const baseConfig = getBaseConfig({ command, mode });
	return {
		...baseConfig,
		plugins: [
			serveExternalAssets(),
			copyLocales(),
			checker({
				root: path.resolve(__dirname, 'ui'),
				typescript: true,
				enableBuild: true,
			}),
		],
		esbuild: {
			jsxInject: "import { element, fragment } from 'tsx-vanilla';",
		},
		build: {
			...baseConfig.build,
			rollupOptions: {
				input: {
					...glob.sync(path.resolve(BASE_PATH, '**/index.html').replace(/\\/g, '/')).reduce<Record<string, string>>((acc, cur) => {
						const name = path.relative(__dirname, cur).split(path.sep).join('/');
						acc[name] = cur;
						return acc;
					}, {}),
					// Add shared.scss as a separate entry if needed or handle it separately
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

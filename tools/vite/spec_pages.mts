import fs from 'fs';
import { IncomingMessage, ServerResponse } from 'http';
import path from 'path';
import { Connect, normalizePath, PluginOption, ViteDevServer } from 'vite';

/**
 * Generates one HTML page per sim from `ui/index_template.html`, so that no per-spec
 * `index.html` has to exist in the source tree.
 *
 * A directory `ui/<class>/<spec>` is a sim page iff it has both an `index.ts` entry point
 * and a stylesheet at `ui/scss/sims/<class>/<spec>/index.scss` -- exactly the two things the
 * template references per spec.
 */

export type SpecPage = {
	className: string;
	specName: string;
	/** '<class>/<spec>/index.html', the page's location relative to the site root. */
	outPath: string;
};

const TEMPLATE_NAME = 'index_template.html';

export function discoverSpecPages(uiRoot: string): SpecPage[] {
	const pages: SpecPage[] = [];

	for (const classDir of fs.readdirSync(uiRoot, { withFileTypes: true })) {
		if (!classDir.isDirectory()) continue;

		const className = classDir.name;
		for (const specDir of fs.readdirSync(path.join(uiRoot, className), { withFileTypes: true })) {
			if (!specDir.isDirectory()) continue;

			const specName = specDir.name;
			const hasEntry = fs.existsSync(path.join(uiRoot, className, specName, 'index.ts'));
			const hasStyles = fs.existsSync(path.join(uiRoot, 'scss', 'sims', className, specName, 'index.scss'));
			if (hasEntry && hasStyles) pages.push({ className, specName, outPath: `${className}/${specName}/index.html` });
		}
	}

	return pages.sort((a, b) => a.outPath.localeCompare(b.outPath));
}

/**
 * Fills in the template's `@@CLASS@@`/`@@SPEC@@` placeholders and rewrites its depth-relative
 * references to root-absolute ones, so the page renders identically no matter where it is served
 * from. Vite resolves root-absolute specifiers against its root in both dev and build.
 * Already-absolute URLs (`/mop/assets/...`) and CDN URLs are left alone.
 */
export function renderSpecPage(template: string, { className, specName }: SpecPage): string {
	return (
		template
			.replaceAll('@@CLASS@@', className)
			.replaceAll('@@SPEC@@', specName)
			// '../../scss/...' and '../../i18n/...' are relative to ui/, i.e. the vite root.
			.replace(/(["'])\.\.\/\.\.\//g, '$1/')
			// './index.ts' is this spec's own entry point.
			.replace(/(["'])\.\//g, `$1/${className}/${specName}/`)
	);
}

export function specPages(uiRoot: string): PluginOption {
	const templatePath = path.join(uiRoot, TEMPLATE_NAME);
	const readTemplate = () => fs.readFileSync(templatePath, 'utf-8');

	/**
	 * Absolute id of a page -> the spec it renders. The ids point at `ui/<class>/<spec>/index.html`,
	 * which is where the pages used to be generated on disk: rollup names an HTML output after the
	 * input's path relative to the vite root, so this is what puts each page at its final URL. The
	 * files themselves never exist -- the `load` hook below renders them on demand.
	 */
	const pageIds = new Map<string, SpecPage>();

	return {
		name: 'spec-pages',
		// Beat vite:resolve and vite:load-fallback to the (nonexistent) page files.
		enforce: 'pre',

		config(_userConfig, env) {
			if (env.command !== 'build') return;

			const input: Record<string, string> = {};
			for (const page of discoverSpecPages(uiRoot)) {
				const id = normalizePath(path.join(uiRoot, page.outPath));
				pageIds.set(id, page);
				// Keyed the same way as the landing page in vite.config.mts.
				input[`${path.basename(uiRoot)}/${page.outPath}`] = id;
			}

			return { build: { rollupOptions: { input } } };
		},

		resolveId(source) {
			const id = normalizePath(source);
			return pageIds.has(id) ? id : null;
		},

		load(id) {
			const page = pageIds.get(normalizePath(id));
			return page ? renderSpecPage(readTemplate(), page) : null;
		},

		configureServer(server) {
			server.middlewares.use(serveSpecPage(server, readTemplate, discoverSpecPages(uiRoot)));
		},
	} satisfies PluginOption;
}

function serveSpecPage(server: ViteDevServer, readTemplate: () => string, pages: SpecPage[]): Connect.NextHandleFunction {
	const byUrl = new Map(pages.map(page => [`${page.className}/${page.specName}`, page]));

	return (req: IncomingMessage, res: ServerResponse<IncomingMessage>, next: Connect.NextFunction) => {
		const base = server.config.base;
		const parsed = new URL(req.url!, 'http://localhost');
		if (!parsed.pathname.startsWith(base)) return next();

		const relativePath = parsed.pathname.slice(base.length).replace(/(^|\/)index\.html$/, '$1');
		const page = byUrl.get(relativePath.replace(/\/$/, ''));
		if (!page) return next();

		// '/mop/<class>/<spec>' -> '/mop/<class>/<spec>/', so relative URLs in the page keep working.
		if (!relativePath.endsWith('/')) {
			res.writeHead(301, { Location: `${base}${relativePath}/${parsed.search}` });
			res.end();
			return;
		}

		// transformIndexHtml keys its inline-script proxy modules off a root-relative url.
		server
			.transformIndexHtml(`/${page.outPath}`, renderSpecPage(readTemplate(), page), (req as Connect.IncomingMessage).originalUrl)
			.then(html => {
				res.writeHead(200, { 'Content-Type': 'text/html' });
				res.end(html);
			})
			.catch(next);
	};
}

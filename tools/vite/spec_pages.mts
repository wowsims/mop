// The 34 spec pages are one constant page served at 34 URLs.
//
// `ui/index_template.html` carries nothing per-spec — no placeholders, and every asset
// reference is root-absolute (`/mop/...` once vite rewrites it) — so the build processes it
// ONCE as an ordinary html input and this plugin copies the processed result to
// `<class>/<spec>/index.html` for every spec. Nothing per-spec is written into the source
// tree; in dev the same file is served through `transformIndexHtml` for the same URLs.
import fs from 'node:fs/promises';
import path from 'node:path';

import { glob } from 'glob';
import type { Plugin } from 'vite';

/** The one spec page, relative to vite's root (`ui/`). Also its build output path. */
export const SPEC_PAGE_TEMPLATE = 'index_template.html';

/**
 * Every spec that owns a page, as `<class>/<spec>`, from the same source of truth the
 * makefile's `PAGE_INDECES` used: `ui/sims/<class>/<spec>/spec.ts(x)`.
 */
export function discoverSpecPages(uiRoot: string): string[] {
	const specsRoot = path.join(uiRoot, 'sims');
	return glob
		.sync(path.join(specsRoot, '*/*/spec.{ts,tsx}').replace(/\\/g, '/'))
		.map(specFile => path.relative(specsRoot, path.dirname(specFile)).split(path.sep).join('/'))
		.sort();
}

export function specPages(uiRoot: string): Plugin {
	const specs = discoverSpecPages(uiRoot);
	const templatePath = path.resolve(uiRoot, SPEC_PAGE_TEMPLATE);

	return {
		name: 'spec-pages',
		// `vite:build-html` emits the processed page from its own `generateBundle`, which runs
		// after unenforced plugins' — only a `post` plugin sees it in the bundle.
		enforce: 'post',

		generateBundle(_options, bundle) {
			const processed = bundle[SPEC_PAGE_TEMPLATE];
			if (!processed || processed.type !== 'asset') {
				throw new Error(`spec-pages: ${SPEC_PAGE_TEMPLATE} is not a processed html input of this build.`);
			}
			// The template's own path is not a page; only its copies are.
			delete bundle[SPEC_PAGE_TEMPLATE];
			for (const spec of specs) {
				this.emitFile({ type: 'asset', fileName: `${spec}/index.html`, source: processed.source });
			}
		},

		configureServer(server) {
			const base = server.config.base;
			const pages = new Set(specs.flatMap(spec => [`${base}${spec}/`, `${base}${spec}/index.html`]));
			// The production static host answers the bare `${base}<class>/<spec>` with a 301 to the
			// trailing-slash form. Dev has to do the same: an unredirected bare url misses `pages`
			// and falls through to vite's SPA fallback, which serves the *landing* page.
			const bare = new Set(specs.map(spec => `${base}${spec}`));

			server.middlewares.use((req, res, next) => {
				const { pathname, search } = new URL(req.url!, 'http://localhost');
				if (bare.has(pathname)) {
					res.writeHead(301, { Location: `${pathname}/${search}` });
					res.end();
					return;
				}
				if (!pages.has(pathname)) {
					next();
					return;
				}
				// This middleware runs before vite's `base` middleware, so the path still carries
				// `/mop/`; `transformIndexHtml` wants it stripped (that is what vite's own
				// `indexHtmlMiddleware` passes, and the html-proxy ids for the page's inline
				// module scripts are keyed on it).
				const url = pathname.slice(base.length - 1).replace(/\/$/, '/index.html');
				fs.readFile(templatePath, 'utf-8')
					.then(html => server.transformIndexHtml(url, html, req.originalUrl))
					.then(html => {
						res.writeHead(200, { 'Content-Type': 'text/html' });
						res.end(html);
					})
					.catch(next);
			});
		},
	};
}

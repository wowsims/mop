// Shared plumbing for the React-migration checks. See README.md.
import { readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

// The repo has no Playwright dependency (the browser MCP normally drives it), so fall back to
// whatever `npx playwright-core` last cached rather than adding one for four scripts.
const loadChromium = async () => {
	try {
		return (await import('playwright-core')).chromium;
	} catch {
		const cache = join(homedir(), '.npm', '_npx');
		for (const dir of readdirSync(cache)) {
			const entry = join(cache, dir, 'node_modules', 'playwright-core', 'index.mjs');
			try {
				return (await import(entry)).chromium;
			} catch {
				// Not this cache entry.
			}
		}
		throw new Error('playwright-core not found. Run `npx playwright-core --help` once to cache it.');
	}
};

// A tank is in here deliberately: the list was all DPS, and `hide-healing-metrics` is computed from
// a tank-spec list, so a class that only ever appears on tanks went unchecked by every gate.
export const SPECS = ['warrior/arms', 'mage/fire', 'hunter/beast_mastery', 'monk/windwalker', 'priest/shadow', 'warrior/protection'];

// Two static servers: the parent branch's build and this one's. See README.md.
export const PORTS = { base: Number(process.env.BASE_PORT ?? 3401), react: Number(process.env.REACT_PORT ?? 3402) };

export const specsFromArgv = () => (process.argv[2] ? process.argv[2].split(',') : SPECS);

// Present identically on both sides under a static server: the Go host's /version endpoint does not
// exist, and GitHub rate-limits the unauthenticated release check.
export const ENVIRONMENTAL = /Failed to load resource/;

/**
 * Structure only: tag + sorted class list + depth, from the element matching `selector`. Text and
 * most attributes are excluded because ids, hrefs and tooltip contents carry generated values that
 * differ run-to-run, not build-to-build. Runs in the page — pass it to `page.evaluate`.
 */
export const SERIALIZE = selector => {
	const root = document.querySelector(selector);
	if (!root) return `NO ${selector}`;
	const out = [];
	const walk = (el, depth) => {
		if (el.nodeType !== 1) return;
		const cls = (el.getAttribute('class') || '').trim().split(/\s+/).filter(Boolean).sort().join('.');
		out.push(`${'  '.repeat(Math.min(depth, 40))}${el.tagName.toLowerCase()}${cls ? '.' + cls : ''}`);
		for (const c of el.children) walk(c, depth + 1);
	};
	walk(root, 0);
	return out.join('\n');
};

export const PRUNED_LINE = '[pruned]';

/**
 * Replaces every subtree whose serialised line matches `re` with a single `[pruned]` line at the
 * same indent, indentation deciding where each subtree ends. Keeping the placeholder preserves the
 * element's ordinal position under its parent, so a subtree that moves still shows up as a diff.
 *
 * `re` must not carry the `g` flag — `RegExp.test` is stateful with it.
 *
 * The indent SERIALIZE emits is capped at depth 40, so a pruned element must sit above that depth
 * or its own children would tie rather than exceed it. Both current uses sit at depth 3-4.
 */
export const pruneSubtrees = (dom, re) => {
	const out = [];
	let cutAt = null;
	for (const line of dom.split('\n')) {
		const indent = line.length - line.trimStart().length;
		if (cutAt !== null) {
			if (indent > cutAt) continue;
			cutAt = null;
		}
		if (re.test(line)) {
			cutAt = indent;
			out.push(line.slice(0, indent) + PRUNED_LINE);
			continue;
		}
		out.push(line);
	}
	return out.join('\n');
};

/**
 * Removes every line matching `re` inside each subtree matching `within`, lifting that line's own
 * children one level to close the gap — as if the element had never wrapped anything. Both patterns
 * are tested against the trimmed line, and neither may carry the `g` flag.
 *
 * This is how a port that *deletes* an element is compared. `INTENDED` in `parity.mjs` can only
 * describe a line that changed, because the comparison is index-aligned: drop an element and every
 * line below it shifts, and the two trees stop being comparable at all. Collapsing the wrapper out
 * of the baseline restores the alignment without giving up anything below it — the anchor, its
 * classes and its icon are still compared byte for byte, which pruning the subtree would not do.
 *
 * `dropped` is returned so the caller can require the wrapper to have been there. That is what keeps
 * this an assertion rather than an allowlist: put the wrapper back on the React side and the count
 * still says 3, but take it off the vanilla side and the count says 0 and the gate fails.
 */
export const collapseWrappers = (dom, within, re) => {
	const out = [];
	let dropped = 0;
	// The indent of the enclosing `within` element, and of the wrapper currently being removed.
	let scope = null;
	let cut = null;
	for (const line of dom.split('\n')) {
		const indent = line.length - line.trimStart().length;
		const trimmed = line.trim();
		if (scope !== null && indent <= scope) scope = null;
		if (cut !== null && indent <= cut) cut = null;
		if (scope === null) {
			if (within.test(trimmed)) scope = indent;
			out.push(line);
			continue;
		}
		if (cut === null && re.test(trimmed)) {
			cut = indent;
			dropped++;
			continue;
		}
		out.push(cut === null ? line : line.slice(2));
	}
	return { dom: out.join('\n'), dropped };
};

/**
 * Replaces the root element's own class list — SERIALIZE puts it on line 0 — with just its tag
 * name. A tab pane's root classes are exactly what the Base UI swap rewrites
 * (`sim-tab.gear-tab.tab-pane.fade.active.show` becomes `sim-tab.gear-tab.sim-tab-body`), so a
 * per-pane comparison has to normalise them or it is asserting the old shape. It also drops
 * genuinely interesting root classes — `rotation-type-auto` on the rotation pane — which is the
 * price of normalising line 0; everything below line 0 is still compared byte for byte.
 *
 * A `NO <selector>` result is left intact so a missing subtree still differs from a present one.
 */
export const dropRootClasses = dom => {
	const lines = dom.split('\n');
	if (lines[0].startsWith('NO ')) return dom;
	lines[0] = lines[0].replace(/\..*$/, '');
	return lines.join('\n');
};

/**
 * Shape-agnostic readers for the top-level tab strip, installed on `window.simTabsProbe` by
 * `openSpec`. Three shapes have to answer to the same code: the parent branch's Bootstrap strip,
 * this branch's React-authored copy of it, and the Base UI strip that replaces both. Anything a
 * gate reads about the strip or the panes goes through here, so the shape assumptions live in one
 * place instead of being spelled into five files' selectors.
 *
 * The one contract this places on the Base UI port: the tab identifier must stay a class token on
 * the `[role=tab]` element (or on an ancestor `<li>`, which is where it lives today).
 * `Tabs.Tab` emits no `data-value`, so `className={`sim-tab-link ${entry.id}`}` is what carries it.
 */
const PROBE = () => {
	const tabsOf = () => [...document.querySelectorAll('.sim-tabs [role=tab]')];

	// The identifier is a class on the <li> before the swap and on the <button> after it. It is also
	// the pane's DOM id, so requiring the token to name an element inside `.sim-main` picks it out of
	// the other classes without hard-coding either shape's class names.
	const idOf = el => {
		const tab = el?.closest?.('.sim-tabs [role=tab]');
		if (!tab) return null;
		const tokens = [...tab.classList, ...(tab.closest('li')?.classList ?? [])];
		return tokens.find(token => document.getElementById(token)?.closest('.sim-main')) ?? null;
	};

	// Every element from the pane's id-carrying root up to `.sim-main`. Before the swap that is just
	// the pane; after it, the pane plus Base UI's panel wrapper. Asking the whole chain is what keeps
	// "the wrapper is shown but the pane inside it kept `.fade`" from reading as open.
	const paneChain = id => {
		const root = document.getElementById(id);
		const main = document.querySelector('.sim-main');
		if (!root || !main || !main.contains(root)) return [];
		const out = [];
		for (let el = root; el !== main; el = el.parentElement) out.push(el);
		return out;
	};

	// "Open" is computed `display`, not `[hidden]` or `.active`: before the swap panes hide by losing
	// `.active` and after it by gaining `hidden`, and `[hidden]{display:none!important}`
	// (bootstrap/scss/_reboot.scss) makes display the superset of both.
	const displayed = id => {
		const chain = paneChain(id);
		return chain.length > 0 && chain.every(el => getComputedStyle(el).display !== 'none');
	};
	const opaque = id => paneChain(id).every(el => getComputedStyle(el).opacity === '1');

	window.simTabsProbe = {
		tabs: tabsOf,
		// Direct children only. The bulk, rotation and detailed-results panes each contain a Bootstrap
		// strip of their own, so `.sim-main [role=tabpanel]` matches 21 elements where this matches 6.
		panes: () => [...document.querySelectorAll('.sim-main > [role=tabpanel]')],
		ids: () => tabsOf().map(idOf),
		idOf,
		paneChain,
		// `SimUI.addTab` hangs aria-controls on the list item, `SimTab` on the button, and Base UI will
		// hang it on the button for every tab.
		controls: tab => tab.getAttribute('aria-controls') ?? tab.closest('li')?.getAttribute('aria-controls') ?? null,
		openIds: () =>
			tabsOf()
				.map(idOf)
				.filter(id => id && displayed(id)),
		shownIds: () =>
			tabsOf()
				.map(idOf)
				.filter(id => id && displayed(id) && opaque(id)),
		selectedIds: () =>
			tabsOf()
				.filter(tab => tab.getAttribute('aria-selected') === 'true')
				.map(idOf),
		focusedId: () => idOf(document.activeElement),
	};

	// The same treatment for the header's import/export dropdowns, ahead of the Base UI `Menu` swap
	// rather than after it — a gate that only understands the shape it is about to lose cannot say
	// whether the replacement behaves.
	//
	// Bootstrap's shape: a `[data-bs-toggle=dropdown]` button beside a `.dropdown-menu` that gains
	// `.show`, with `aria-expanded` on the toggle. Base UI's `Menu` will portal its popup out of the
	// dropdown entirely and link it by `aria-controls`, so "the menu" cannot stay a sibling lookup.
	// Both are covered below; `aria-expanded` is the one signal common to them.
	// Scoped: there are dropdowns outside the header too, and a gate asking about the header's two
	// must not silently start counting the sim title's.
	const togglesOf = (root = document) => [...root.querySelectorAll('[data-bs-toggle=dropdown], [aria-haspopup=menu]')];
	const menuOf = toggle => {
		const controlled = toggle.getAttribute('aria-controls');
		if (controlled) {
			const byId = document.getElementById(controlled);
			if (byId) return byId;
		}
		return toggle.parentElement?.querySelector('.dropdown-menu, [role=menu]') ?? null;
	};

	window.simDropdownProbe = {
		toggles: togglesOf,
		menuOf,
		// `.show` is Bootstrap's; `aria-expanded` is what both shapes agree on, and Base UI also
		// unmounts the popup entirely — so "no menu in the DOM" counts as closed rather than unknown.
		isOpen: toggle => {
			if (toggle.getAttribute('aria-expanded') !== 'true') return false;
			const menu = menuOf(toggle);
			return !menu || !menu.classList.contains('dropdown-menu') || menu.classList.contains('show');
		},
		items: toggle => [...(menuOf(toggle)?.querySelectorAll('.dropdown-item, [role=menuitem]') ?? [])],
		// Which dropdown this is, for a gate that names them: the toggle's own class carries it
		// (`import-link` / `export-link`) and must keep doing so through the swap.
		nameOf: toggle => [...toggle.classList].find(name => name.endsWith('-link')) ?? null,
	};
};

export const launch = async () => (await loadChromium()).launch({ headless: true, args: ['--no-sandbox'] });

/** Opens a spec page and waits for the shell. `errors` collects page errors and non-environmental console errors. */
export const openSpec = async (browser, port, spec, { selector = '.sim-ui', settle = 2500, route } = {}) => {
	const page = await browser.newPage();
	const errors = [];
	page.on('pageerror', e => errors.push(String(e)));
	page.on('console', m => {
		if (m.type() === 'error' && !ENVIRONMENTAL.test(m.text())) errors.push('console: ' + m.text());
	});
	// A modal dialog would block every later command.
	await page.addInitScript(() => {
		window.alert = () => {};
	});
	await page.addInitScript(PROBE);
	// Answered before navigation, for an endpoint the static servers do not have.
	if (route) await page.route(route[0], r => r.fulfill(route[1]));
	await page.goto(`http://localhost:${port}/mop/${spec}/`, { waitUntil: 'load', timeout: 60000 });
	await page.waitForSelector(selector, { timeout: 60000 });
	await page.waitForTimeout(settle);
	return { page, errors };
};

/**
 * The subtrees `pruneSubtrees` would replace, returned whole. Used where a region's *order* is an
 * implementation detail but its contents are not — modals, which are appended as their owner is
 * constructed, so porting a tab moves one without changing it.
 */
export const collectSubtrees = (dom, re) => {
	const lines = dom.split('\n');
	const out = [];
	for (let i = 0; i < lines.length; i++) {
		const indent = lines[i].search(/\S/);
		if (!re.test(lines[i])) continue;
		const subtree = [lines[i]];
		while (i + 1 < lines.length && lines[i + 1].search(/\S/) > indent) subtree.push(lines[++i]);
		out.push(subtree.join('\n'));
	}
	return out;
};

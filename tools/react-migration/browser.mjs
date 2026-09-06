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
		// Which signal is authoritative differs: for Bootstrap it is `.show` on the menu, for Base UI
		// it is `aria-expanded` plus a popup that exists at all. Requiring both is what covers the two
		// without a shape check — an unmounted popup reads closed rather than unknown.
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

	// And the same for modals, ahead of the Base UI `Dialog` swap.
	//
	// The one thing both shapes agree on is the caller's own class: `BaseModal` puts its
	// `rootCssClass` on the `.modal-dialog`, and `Dialog` puts the same `cssClass` on the popup. So a
	// gate finds its modal by that name and asks this for everything else — because everything else
	// moves. Bootstrap marks the `.modal` *wrapper* `.show` and the body `.modal-open`; Base UI marks
	// the popup `data-open` and writes an inline `overflow` on the body instead, and its backdrop is
	// a different element entirely.
	window.simModalProbe = {
		find: cssClass => document.querySelector('.' + cssClass),
		isOpen: dialog => {
			if (!dialog) return false;
			const wrapper = dialog.closest('.modal');
			return wrapper ? wrapper.classList.contains('show') : dialog.hasAttribute('data-open');
		},
		// Shown, not merely present. Bootstrap creates its backdrop on open and removes it on close, so
		// existence was the same question there; a Base UI dialog kept mounted leaves its backdrop in
		// the DOM permanently and marks it `data-open` only while it is up.
		backdrop: () => {
			const backdrop = document.querySelector('.modal-backdrop, .sim-dialog-backdrop');
			if (!backdrop) return false;
			return backdrop.classList.contains('modal-backdrop') || backdrop.hasAttribute('data-open');
		},
		bodyLocked: () => document.body.classList.contains('modal-open') || document.body.style.overflow === 'hidden',
	};
};

/**
 * Shared machinery for the divergences a port means to have.
 *
 * An entry names the exact `base` and `react` lines, or carries a `match(base, react)` predicate for
 * a line whose text varies per spec. It is **not** an allowlist: a caller is expected to check
 * afterwards that every entry was observed, so reverting the markup fails as loudly as making the
 * change unrecorded would have.
 *
 * `max` is what keeps a fixed pair from becoming one. `label.form-label` appears a dozen times in
 * the settings pane and exactly one of them is meant to become a `span`; without a ceiling, the
 * entry would quietly absorb the next eleven too.
 */
export const matchesIntended = (entry, base, react) => (entry.match ? entry.match(base, react) : base === entry.base && react === entry.react);

/**
 * Indices where the two serialised trees differ, minus the intended divergences. Observations are
 * tallied into `tally` (a Map keyed by entry) so the caller can check both directions: an entry that
 * was never observed, and one observed more often than its `max`.
 */
export const unexpectedLines = (baseLines, reactLines, intended, tally) => {
	const at = [];
	for (let i = 0; i < Math.max(baseLines.length, reactLines.length); i++) {
		const base = baseLines[i]?.trim() ?? '';
		const react = reactLines[i]?.trim() ?? '';
		if (base === react) continue;
		const entry = intended.find(e => matchesIntended(e, base, react));
		if (!entry) {
			at.push(i);
			continue;
		}
		tally.set(entry, (tally.get(entry) ?? 0) + 1);
	}
	return at;
};

/** Entries folded more often than they are allowed to be, as printable problems. */
export const overusedIntended = (intended, tally) =>
	intended
		.filter(entry => entry.max !== undefined && (tally.get(entry) ?? 0) > entry.max)
		.map(entry => `intended divergence folded ${tally.get(entry)} lines, at most ${entry.max} expected: ${entry.why}`);

export const unobservedIntended = (intended, seen) =>
	intended
		.filter(entry => !seen.has(entry))
		.map(entry => `intended divergence never observed: ${entry.describe ?? `${entry.base} -> ${entry.react}`} (${entry.why})`);

/**
 * Removes every subtree whose serialised line matches `re`, children and all, and reports how many
 * went. Unlike `pruneSubtrees` this leaves no placeholder: it is for a subtree that exists on one
 * side and *nowhere* on the other, where a placeholder would itself be the difference.
 *
 * The case is a portaled popup. Base UI renders the import/export menus into `<body>` and only while
 * they are open, so at load the React tree has no menu at all while the Bootstrap one has a
 * populated `<ul>`. Their contents are still compared — `header-toolbar.mjs` reads the item labels
 * with the menu open, which is the only moment both shapes have them.
 *
 * Scoped by `within` for the same reason `collapseWrappers` is: `ul.dropdown-menu` also describes
 * the sim title's dropdown and the language picker, and dropping those silently reduced the whole
 * shell comparison to noise the first time this ran unscoped.
 */
export const dropSubtrees = (dom, within, re) => {
	const out = [];
	let dropped = 0;
	let scope = null;
	let cutAt = null;
	for (const line of dom.split('\n')) {
		const indent = line.length - line.trimStart().length;
		const trimmed = line.trim();
		if (cutAt !== null) {
			if (indent > cutAt) continue;
			cutAt = null;
		}
		if (scope !== null && indent <= scope) scope = null;
		if (scope === null) {
			if (within.test(trimmed)) scope = indent;
			out.push(line);
			continue;
		}
		if (re.test(trimmed)) {
			cutAt = indent;
			dropped++;
			continue;
		}
		out.push(line);
	}
	return { dom: out.join('\n'), dropped };
};

/**
 * Rewrites every line equal to `from` into `to`, inside each subtree matching `within`, and reports
 * how many it changed. For an element that survives the port intact but under a different class —
 * where `collapseWrappers` would wrongly delete it and `dropSubtrees` would wrongly delete its
 * children.
 *
 * Scoped and counted for the same reason as the others: a bare rename would quietly relabel every
 * `ul.dropdown-menu` in the tree, and the caller is expected to assert the count against something
 * it computed rather than a number typed in.
 */
export const renameWithin = (dom, within, from, to) => {
	const out = [];
	let renamed = 0;
	let scope = null;
	for (const line of dom.split('\n')) {
		const indent = line.length - line.trimStart().length;
		const trimmed = line.trim();
		if (scope !== null && indent <= scope) scope = null;
		if (scope === null && within.test(trimmed)) scope = indent;
		if (scope !== null && trimmed === from) {
			renamed++;
			out.push(line.slice(0, indent) + to);
			continue;
		}
		out.push(line);
	}
	return { dom: out.join('\n'), renamed };
};

/**
 * Folds a ported `MultiIconPicker` back into the shape the Bootstrap one had, on the React side.
 *
 * Base UI's `Menu` cannot be arranged into `.dropend > a + ul`: `Menu.Portal` is mandatory,
 * `Positioner` must be its child and `Popup` the Positioner's, and each renders a real element. And
 * the `<ul>` cannot keep `.dropdown-menu`, because `shared/bootstrap_overrides.ts` binds a capturing
 * `mouseleave` to that class and reads `previousElementSibling` as the toggle — inside a positioner
 * that is null, and Bootstrap then throws.
 *
 * Every count is asserted against the number of pickers actually found rather than a number typed
 * in, so a wrapper appearing somewhere else, or one of these going missing, is a failure. Used by
 * both tree comparisons — `parity.mjs` sees these in the settings pane too — and **only on the React
 * side**: the baseline builds the same picker roots, so running it there reports it as missing
 * wrappers it never had.
 */
export const normaliseMultiIconMenus = dom => {
	const root = /\.multi-icon-picker-root(\.|$)/;
	const pickers = dom.split('\n').filter(line => root.test(line.trim())).length;
	const problems = [];
	if (!pickers) return { dom, problems };

	let current = dom;
	for (const wrapper of [/^div\.multi-icon-picker-portal$/, /^div\.multi-icon-picker-positioner$/]) {
		const collapsed = collapseWrappers(current, root, wrapper);
		if (collapsed.dropped !== pickers) problems.push(`collapsed ${collapsed.dropped} of ${pickers} ${wrapper.source}`);
		current = collapsed.dom;
	}
	const renamed = renameWithin(current, root, 'ul.multi-icon-picker-menu', 'ul.dropdown-menu');
	if (renamed.renamed !== pickers) problems.push(`renamed ${renamed.renamed} of ${pickers} multi-icon menus`);
	return { dom: renamed.dom, problems };
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

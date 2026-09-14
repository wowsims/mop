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
 * Structure only: tag + sorted tokens + depth, from the element matching `selector`. Tokens are the
 * class list unioned with the element's `data-testid` value, if it has one — so a class hook and its
 * eventual test-id replacement serialise to the same line and every class-anchored helper keeps
 * matching through the migration. Text and most attributes are excluded because ids, hrefs and
 * tooltip contents carry generated values that differ run-to-run, not build-to-build. Runs in the
 * page — pass it to `page.evaluate`.
 */
export const SERIALIZE = selector => {
	const root = document.querySelector(selector);
	if (!root) return `NO ${selector}`;
	const out = [];
	const walk = (el, depth) => {
		if (el.nodeType !== 1) return;
		const tokens = (el.getAttribute('class') || '').trim().split(/\s+/).filter(Boolean);
		const testId = el.getAttribute('data-testid');
		if (testId) tokens.push(testId);
		const cls = [...new Set(tokens)].sort().join('.');
		out.push(`${'  '.repeat(Math.min(depth, 40))}${el.tagName.toLowerCase()}${cls ? '.' + cls : ''}`);
		for (const c of el.children) walk(c, depth + 1);
	};
	walk(root, 0);
	return out.join('\n');
};

/** A selector matching the class on the parent branch and the `data-testid` on this one. */
export const q = name => `:is([data-testid="${name}"], .${name})`;

/**
 * Shape-agnostic readers for the top-level tab strip, installed on `window.simTabsProbe` by
 * `openSpec`. Three shapes have to answer to the same code: the parent branch's Bootstrap strip,
 * this branch's React-authored copy of it, and the Base UI strip that replaces both. Anything a
 * gate reads about the strip or the panes goes through here, so the shape assumptions live in one
 * place instead of being spelled into five files' selectors.
 *
 * The one contract this places on the Base UI port: the tab identifier must stay a class token on
 * the `[role=tab]` element (or on an ancestor `<li>`, which is where it lives today).
 * `Tabs.Tab` emits no `data-value`, so `className={entry.id}` is what carries it.
 */
const PROBE = () => {
	// Page-context copy: `q` from module scope does not survive `addInitScript`'s serialisation.
	const q = name => `:is([data-testid="${name}"], .${name})`;

	const tabsOf = () => [...document.querySelectorAll(`:is(${q('sim-tabs')}) [role=tab]`)];

	// The identifier is a class on the <li> before the swap and on the <button> after it. It is also
	// an element's DOM id somewhere inside `.sim-main`, so requiring the token to resolve there picks
	// it out of the tab's other classes without hard-coding either shape's names. Tried first, not
	// `aria-controls`: on the top-level strip the Base UI panel Bootstrap's pane used to be is an
	// unlabelled wrapper carrying its own auto id, and the semantic one now lives one level inside it
	// (`SimTabs.tsx`'s `Tabs.Panel` has no `id` prop, unlike the inner strips') — so `aria-controls`
	// resolves to a real, in-`.sim-main` element that is the *wrong* one. `aria-controls` still matters
	// as the fallback for a pane that carries no such token at all.
	const idOf = el => {
		const tab = el?.closest?.(`:is(${q('sim-tabs')}) [role=tab]`);
		if (!tab) return null;
		const tokens = [...tab.classList, ...(tab.closest('li')?.classList ?? [])];
		const byToken = tokens.find(token => document.getElementById(token)?.closest(q('sim-main')));
		if (byToken) return byToken;
		const controls = tab.getAttribute('aria-controls') ?? tab.closest('li')?.getAttribute('aria-controls');
		return controls && document.getElementById(controls)?.closest(q('sim-main')) ? controls : null;
	};

	// Every element from the pane's id-carrying root up to `.sim-main`. Before the swap that is just
	// the pane; after it, the pane plus Base UI's panel wrapper. Asking the whole chain is what keeps
	// "the wrapper is shown but the pane inside it kept `.fade`" from reading as open.
	const paneChain = id => {
		const root = document.getElementById(id);
		const main = document.querySelector(q('sim-main'));
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
		panes: () => [...document.querySelectorAll(`:is(${q('sim-main')}) > [role=tabpanel]`)],
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
		// (`import-link` / `export-link`) and must keep doing so through the swap, or its
		// `data-testid` once that replaces the class.
		nameOf: toggle => toggle.dataset.testid ?? [...toggle.classList].find(name => name.endsWith('-link')) ?? null,
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
		find: cssClass => document.querySelector(q(cssClass)),
		isOpen: dialog => {
			if (!dialog) return false;
			const wrapper = dialog.closest('.modal');
			return wrapper ? wrapper.classList.contains('show') : dialog.hasAttribute('data-open');
		},
		// Shown, not merely present. Bootstrap creates its backdrop on open and removes it on close, so
		// existence was the same question there; a Base UI dialog kept mounted leaves its backdrop in
		// the DOM permanently and marks it `data-open` only while it is up.
		//
		// Every kept-mounted backdrop, not the first one: the page has six now — five exporters plus
		// the advanced encounter modal — and `querySelector` answered for whichever happened to be
		// first, which is never the one a gate has just opened. Only one dialog is ever up at a time,
		// so "any backdrop is shown" is the question that was being asked when there was only one.
		backdrop: () =>
			[...document.querySelectorAll(`.modal-backdrop, ${q('sim-dialog-backdrop')}`)].some(
				backdrop => backdrop.classList.contains('modal-backdrop') || backdrop.hasAttribute('data-open'),
			),
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
const matches = (side, entry) => (typeof entry === 'string' ? side === entry : entry.test(side));

export const matchesIntended = (entry, base, react) => (entry.match ? entry.match(base, react) : matches(base, entry.base) && matches(react, entry.react));

/**
 * Indices where the two serialised trees differ, minus the intended divergences. Observations are
 * tallied into `tally` (a Map keyed by entry) so the caller can check both directions: an entry that
 * was never observed, and one observed more often than its `max`.
 */
export const unexpectedLines = (baseLines, reactLines, intended, tally, key = line => line) => {
	const at = [];
	for (let i = 0; i < Math.max(baseLines.length, reactLines.length); i++) {
		const base = baseLines[i]?.trim() ?? '';
		const react = reactLines[i]?.trim() ?? '';
		// `key` compares the two lines, once classes stop mattering; `matchesIntended` still sees the
		// untransformed, token-keyed lines, because an `intended` entry describing a tag change needs
		// the tokens to confirm it is the right one.
		if (key(base) === key(react)) continue;
		const entry = intended.find(e => matchesIntended(e, base, react));
		if (!entry) {
			at.push(i);
			continue;
		}
		tally.set(entry, (tally.get(entry) ?? 0) + 1);
	}
	return at;
};

/**
 * Removes every subtree whose serialised line matches `re`, children and all, and reports how many
 * went. This leaves no placeholder: it is for a subtree that exists on one side and *nowhere* on the
 * other, where a placeholder would itself be the difference.
 *
 * The case is a portaled popup. Base UI renders the import/export menus into `<body>` and only while
 * they are open, so at load the React tree has no menu at all while the Bootstrap one has a
 * populated `<ul>`. Their contents are still compared — `header-toolbar.mjs` reads the item labels
 * with the menu open, which is the only moment both shapes have them.
 *
 * Scoped by `within`: `ul.dropdown-menu` also describes the sim title's dropdown and the language
 * picker, and dropping those silently reduced the whole shell comparison to noise the first time
 * this ran unscoped.
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
 * Bootstrap's `hide`, which is `display: none !important`. Written by `Input.update()` from an
 * input's `showWhen`, and by hand in a few places. Anchored on the dots SERIALIZE joins class names
 * with, so `hide-healing-metrics` — a metrics-table modifier, and an intended divergence of its
 * own — does not match.
 */
export const HIDDEN = /(^|\.)hide(\.|$)/;

/** Line 0 of a serialised region: the only line at indent 0, so it scopes a drop to the whole region. */
const WHOLE_REGION = /^/;

/**
 * The number of *outermost* matches in `dom` — one nested inside another is not counted — found by
 * carrying the indents of the matched ancestors that are still open.
 *
 * This is the tally half of the pair `dropHiddenSubtrees` cross-checks: `dropSubtrees` answers the
 * same question by cutting at the first match and skipping everything deeper, so requiring the two
 * walks to agree is what keeps a nested match from being taken twice.
 */
export const countOutermost = (dom, re) => {
	let count = 0;
	// The indents of the still-open ancestors that matched, outermost first.
	const open = [];
	for (const line of dom.split('\n')) {
		const indent = line.length - line.trimStart().length;
		while (open.length && indent <= open[open.length - 1]) open.pop();
		if (!re.test(line.trim())) continue;
		if (!open.length) count++;
		open.push(indent);
	}
	return count;
};

/**
 * Drops every outermost `hide` subtree, from **both** sides, and reports how many went.
 *
 * The port unmounts what `showWhen` used to render with `class="hide"`, so the two trees hold
 * different numbers of hidden elements and neither a fixed subtraction nor a one-sided drop can
 * align them. Dropping symmetrically can: `hide` is `display: none !important`, so a hidden subtree
 * is on screen on neither side, and comparing only what each build *shows* is the honest comparison.
 * It also survives the transition — while some components still write the class, both sides drop the
 * same subtrees and nothing moves.
 *
 * Three assertions keep it from being an escape hatch:
 * - the tally and the removal walk the tree differently and must agree (see `countOutermost`);
 * - nothing matching may survive the drop, which catches a match the cut walked past;
 * - nothing matching may sit at SERIALIZE's depth cap of 40, where a child's indent ties its
 *   parent's and indentation can no longer tell a nested match from a sibling. That cap is what
 *   broke two earlier attempts at the dialog drop.
 *
 * What it deliberately does not assert is that the two sides hid the *same* elements — that is the
 * point of it — so a divergence living entirely inside a hidden subtree stops being visible to the
 * comparison. Two `INTENDED` entries were in exactly that position and came out with this.
 */
export const dropHiddenSubtrees = (dom, what) => {
	const problems = [];
	const expected = countOutermost(dom, HIDDEN);
	const result = dropSubtrees(dom, WHOLE_REGION, HIDDEN);
	if (result.dropped !== expected) problems.push(`${what}: dropped ${result.dropped} hidden subtrees, counted ${expected}`);
	const survived = result.dom.split('\n').filter(line => HIDDEN.test(line.trim())).length;
	if (survived) problems.push(`${what}: ${survived} hidden element(s) survived the drop`);
	const capped = dom.split('\n').filter(line => HIDDEN.test(line.trim()) && line.length - line.trimStart().length >= 80).length;
	if (capped) problems.push(`${what}: ${capped} hidden element(s) at SERIALIZE's depth cap, where indentation cannot bound a subtree`);
	return { dom: result.dom, dropped: result.dropped, problems };
};

/**
 * The combat replay's unshown half, which only the baseline builds.
 *
 * The vanilla constructor put both the "run a simulation" placeholder and the whole scene — arena,
 * HUD and transport — into the page up front and toggled `display` between them; React renders
 * whichever one applies and never both, because a scene with no run behind it has no playhead, no
 * fight length and no cards. So the baseline's hidden half comes off and the two shown halves are
 * compared. `hidden` is `cr-scene` before a run and `cr-empty` after one — the caller knows which
 * state its gate reads the pane in, and asserts the count, so a half that stops being built or one
 * the port starts building early fails here rather than folding quietly.
 *
 * What is *inside* the scene is `combat-replay.mjs`'s to gate, with a run in it.
 */
const REPLAY_ROOT = /\.combat-replay-root(\.|$)/;

export const dropReplayState = (dom, hidden) => dropSubtrees(dom, REPLAY_ROOT, new RegExp(`^div\\.(.*\\.)?${hidden}(\\.|$)`));

export const launch = async () => (await loadChromium()).launch({ headless: true, args: ['--no-sandbox'] });

/** Opens a spec page and waits for the shell. `errors` collects page errors and non-environmental console errors. */
export const openSpec = async (browser, port, spec, { selector = q('sim-ui'), settle = 2500, route } = {}) => {
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

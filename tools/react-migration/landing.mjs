// The landing page (`ui/index.html` + `ui/app/landing_entry.tsx`), which every other check misses —
// they all anchor at `.sim-ui` on a spec page. It has no sim and no spec, so nothing else looks at
// it at all.
//
// This compares what the page *says*, not how it is built, because how it is built is exactly what
// the port changed. The baseline renders static markup that `localization.ts` walks for `[data-i18n]`
// and rewrites in place, plus a `#sim-links` block assembled from an HTML string; this branch renders
// the page from React and translates at render time. The counts that used to stand in for "the page
// is intact" — `[data-i18n]` nodes, total elements — now differ by construction and say nothing, so
// they are gone. What replaces them is below, in two groups.
//
// Compared against the baseline (`SHARED`): everything the reader sees whose value does not depend
// on either the port or on sim data that has moved since the branch point.
//
// Checked on this branch alone, because the baseline disagrees for reasons that are not this port's:
//
//   - launch statuses. Spec launch data moved on the branch — death knight is Launched here and Beta
//     on master — so the text cannot be compared. `ROLLUP` checks the rule instead: a class row's
//     status is Launched only if every one of its specs is, Not Yet Supported only if none is, and
//     Beta otherwise. That is the logic this port carried over, and it is tested directly rather than
//     against a stale expected value.
//   - `<meta name="description">`. Empty on master: its `[data-i18n]` walk assigned `textContent`,
//     which a `<meta>` does not display. The branch already fixed that before this port.
//   - `data-lang` on the language links: see `LANGS`.
//   - `.navbar-toggler` contents: see `TOGGLERS`.
import { launch, PORTS, ENVIRONMENTAL } from './browser.mjs';

const READ = () => {
	const text = el => (el?.textContent ?? '').replace(/\s+/g, ' ').trim();
	const all = (sel, fn) => [...document.querySelectorAll(sel)].map(fn);
	const classRow = '.sim-links > .sim-link-dropdown > .sim-link';
	const specRow = '.sim-links a[href*="/mop/"]';
	return {
		title: document.title,
		htmlLang: document.documentElement.lang,
		brand: all('.wowsims-title, .expansion-title', text),
		description: text(document.querySelector('#description')),
		supportDevs: text(document.querySelector('.nav-link[href*="patreon"] span')),
		socials: all('.navbar-nav a[href^="http"]', a => a.getAttribute('href')).sort(),
		classTitles: all(`${classRow} .sim-link-title`, text),
		classIcons: all(`${classRow} .sim-link-icon`, i => `${i.getAttribute('src')}|${i.className}`).sort(),
		// Sorted: both builds emit the rows in the same order today, but that order is the class
		// list's and not something this check should pin.
		specLinks: all(specRow, a => new URL(a.href).pathname).sort(),
		specNames: all(specRow, a => `${text(a.querySelector('.sim-link-label'))} / ${text(a.querySelector('.sim-link-title'))}`).sort(),
		specIcons: all(`${specRow} .sim-link-icon`, i => i.getAttribute('src')).sort(),
		languages: all('.dropdown-item', text),

		metaDescription: document.querySelector('meta[name="description"]')?.getAttribute('content') ?? '',
		langCodes: all('[data-lang]', el => el.getAttribute('data-lang')),
		togglers: all('.navbar-toggler', b => ({ label: b.getAttribute('aria-label') ?? '', icon: !!b.querySelector('i[class*="fa-"]') })),
		rollup: [...document.querySelectorAll('.sim-links > .sim-link-dropdown')].map(row => ({
			name: text(row.querySelector(':scope > .sim-link .sim-link-title')),
			status: text(row.querySelector(':scope > .sim-link .launch-status-label')),
			specs: [...row.querySelectorAll('a[href*="/mop/"] .launch-status-label')].map(text),
		})),
	};
};

// The class menus open on hover — Bootstrap never did that on its own, `bootstrap_overrides.ts` added
// a capturing `mouseover`, and this branch asks Base UI for it with `openOnHover`. Read as shape, not
// as markup: the two builds draw different elements, and the point is that a hover still produces a
// menu of the right size beside the row it belongs to.
const HOVER = async page => {
	const trigger = page.locator('.sim-links > .sim-link-dropdown > .sim-link').first();
	await trigger.hover();
	await page.waitForTimeout(600);
	return page.evaluate(() => {
		const row = document.querySelector('.sim-links > .sim-link-dropdown');
		const t = row.querySelector(':scope > .sim-link').getBoundingClientRect();
		const links = [...row.querySelectorAll('a[href*="/mop/"]')];
		const visible = links.filter(a => {
			const r = a.getBoundingClientRect();
			return r.width > 0 && r.height > 0 && a.checkVisibility?.() !== false;
		});
		const box = visible[0]?.getBoundingClientRect();
		return {
			visibleLinks: visible.length,
			rightOfTrigger: box ? box.left >= t.right - 2 : null,
			alignedTop: box ? Math.abs(box.top - t.top) < 24 : null,
		};
	});
};

const browser = await launch();
const results = {};
for (const [side, port] of Object.entries(PORTS)) {
	const page = await browser.newPage();
	const errors = [];
	page.on('pageerror', e => errors.push(String(e)));
	page.on('console', m => {
		if (m.type() === 'error' && !ENVIRONMENTAL.test(m.text())) errors.push('console: ' + m.text());
	});
	await page.goto(`http://localhost:${port}/mop/`, { waitUntil: 'load', timeout: 60000 });
	await page.waitForTimeout(2000);
	results[side] = { ...(await page.evaluate(READ)), hover: await HOVER(page), errors };
	await page.close();
}
await browser.close();

const { base, react } = results;
const failures = [];
const eq = (label, a, b) => {
	if (JSON.stringify(a) !== JSON.stringify(b)) {
		failures.push(`${label}\n      base:  ${JSON.stringify(a).slice(0, 240)}\n      react: ${JSON.stringify(b).slice(0, 240)}`);
	}
};

const SHARED = [
	'title',
	'htmlLang',
	'brand',
	'description',
	'supportDevs',
	'socials',
	'classTitles',
	'classIcons',
	'specLinks',
	'specNames',
	'specIcons',
	'languages',
	'hover',
];
for (const key of SHARED) eq(key, base[key], react[key]);

// An empty read would pass every list above by comparing nothing to nothing, and the landing page is
// the only place these links exist: Base UI drops a closed menu's contents unless `keepMounted`.
if (react.specLinks.length !== 34) failures.push(`expected 34 spec links in the document, found ${react.specLinks.length}`);
if (react.rollup.length !== 11) failures.push(`expected 11 class rows, found ${react.rollup.length}`);

const LAUNCHED = 'Launched';
const UNLAUNCHED = 'Not Yet Supported';
const ROLLUP = specs => (specs.every(s => s === LAUNCHED) ? LAUNCHED : specs.every(s => s === UNLAUNCHED) ? UNLAUNCHED : 'Beta');
for (const row of react.rollup) {
	if (!row.specs.length) failures.push(`${row.name}: no spec rows under the class`);
	else if (row.status !== ROLLUP(row.specs)) {
		failures.push(`${row.name}: class row says "${row.status}", its specs ${JSON.stringify(row.specs)} roll up to "${ROLLUP(row.specs)}"`);
	}
}

if (!react.metaDescription) failures.push('<meta name="description"> is empty; it carries its text in `content`, not as a child node');

const LANGS = ['en', 'fr'];
if (JSON.stringify(react.langCodes) !== JSON.stringify(LANGS)) {
	failures.push(`data-lang on the language links: expected ${JSON.stringify(LANGS)}, got ${JSON.stringify(react.langCodes)}`);
}

// Both navbar togglers keep an icon and are named by `aria-label`. On the baseline neither is true:
// the `[data-i18n]` walk assigns `textContent`, which replaces the `<i>` with the string "Toggle
// navigation", and the `aria-label=""` the markup ships is never filled in.
const TOGGLERS = react.togglers.length === 2 && react.togglers.every(t => t.icon && t.label.length > 0);
if (!TOGGLERS) failures.push(`navbar togglers should each keep an icon and carry an aria-label, got ${JSON.stringify(react.togglers)}`);

const ok = failures.length === 0 && base.errors.length === 0 && react.errors.length === 0;
console.log(`${ok ? 'PASS' : 'FAIL'}  landing page   base: ${base.specLinks.length} spec links, ${base.classTitles.length} class rows, ${base.errors.length} errors`);
console.log(
	`                     react: ${react.specLinks.length} spec links, ${react.rollup.length} class rows, ${react.langCodes.length} data-lang, ${react.hover.visibleLinks} links on hover, ${react.errors.length} errors`,
);
failures.forEach(f => console.log('    diff:  ' + f));
[...base.errors, ...react.errors].slice(0, 4).forEach(e => console.log('    error: ' + e.slice(0, 140)));
process.exit(ok ? 0 : 1);

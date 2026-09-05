// What the port adds that `parity.mjs` cannot see. That probe compares structure and says so —
// attributes are not its job — so every accessible name, every `rel`, every `aria-hidden` the
// migration adds would otherwise be unasserted, and could be dropped by a later edit in silence.
//
// One region per area React owns. Add a region when a port takes one over; the checks themselves
// are the same everywhere, because they are properties of controls, not of a feature.
//
// Runs against the React build by default and exits non-zero if a check fails there. Point it at
// `PORT=3401` to read the baseline instead, where failing is the expected answer — that output is
// the list of findings the port is fixing.
import { ENVIRONMENTAL, launch, PORTS } from './browser.mjs';

const SPEC = process.argv[2] ?? 'warrior/arms';
const PORT = Number(process.env.PORT ?? PORTS.react);
const IS_BASE = PORT === PORTS.base;

const REGIONS = ['.sim-header .sim-toolbar', '.sim-header .import-export', '.sim-sidebar-socials', '.sim-sidebar-stats'];

// The tab strip is deliberately absent: it is Base UI's markup, and `useButton` does not default
// `type` either, which is its own question for whoever ports the last of it.
const CHECKS = regions => {
	const out = {};
	for (const selector of regions) {
		const scope = [...document.querySelectorAll(selector)];
		if (!scope.length) {
			out[selector] = [[false, 'region not found']];
			continue;
		}
		const within = sel => scope.flatMap(el => [...el.querySelectorAll(sel)]);
		const name = el => (el.getAttribute('aria-label') || el.textContent || '').trim();

		const controls = within('a, button');
		const unnamed = controls.filter(el => !name(el));
		const icons = within('i');
		const shown = icons.filter(el => el.getAttribute('aria-hidden') !== 'true');
		const blank = within('a[target="_blank"]');
		const unsafe = blank.filter(el => {
			const rel = (el.getAttribute('rel') || '').split(/\s+/);
			return !rel.includes('noopener') || !rel.includes('noreferrer');
		});
		const buttons = within('button');
		const untyped = buttons.filter(el => !el.getAttribute('type'));

		out[selector] = [
			[unnamed.length === 0, `${controls.length - unnamed.length}/${controls.length} controls have an accessible name`],
			[shown.length === 0, `${icons.length - shown.length}/${icons.length} icons are aria-hidden`],
			[unsafe.length === 0, `${blank.length - unsafe.length}/${blank.length} _blank links carry rel=noopener noreferrer`],
			[untyped.length === 0, `${buttons.length - untyped.length}/${buttons.length} buttons declare a type`],
		];
	}
	return out;
};

// A tooltip's content reaches assistive tech only through a chain that is entirely react-tooltip's
// doing, and entirely invisible to a static check: focusing the anchor has to *open* the tooltip
// (its default `openEvents` include `focus`), the open node has to carry `id` and `role="tooltip"`,
// and the library has to write `aria-describedby` on the anchor while it is shown. Every link is a
// default one, so any of them can be turned off from a call site — `openEvents={{mouseenter: true}}`
// alone would end keyboard reachability with nothing else changing.
//
// The baseline has nothing to select: tippy anchors carry `data-tippy-content`, not
// `data-tooltip-id`. So this half of the probe reads as skipped there rather than as findings —
// tippy does set `aria-describedby`, it just does not give the node a `role`.
const DESCRIBES = ([selector, index]) => {
	const el = document.querySelectorAll(selector)[index];
	const described = el?.getAttribute('aria-describedby');
	const target = described ? document.getElementById(described) : null;
	return { described, role: target?.getAttribute('role') ?? null, text: (target?.textContent ?? '').trim() };
};

const browser = await launch();
const context = await browser.newContext();
const page = await context.newPage();
const errors = [];
page.on('pageerror', e => errors.push(String(e)));
page.on('console', m => {
	if (m.type() === 'error' && !ENVIRONMENTAL.test(m.text())) errors.push('console: ' + m.text());
});
await page.goto(`http://localhost:${PORT}/mop/${SPEC}/`, { waitUntil: 'load', timeout: 60000 });
await page.waitForSelector('.sim-sidebar', { timeout: 60000 });
await page.waitForTimeout(2000);

console.log(`${SPEC} on :${PORT}${IS_BASE ? '  (baseline — failures here are the findings)' : ''}\n`);
let failed = 0;
for (const [region, checks] of Object.entries(await page.evaluate(CHECKS, REGIONS))) {
	console.log(`  ${region}`);
	for (const [ok, text] of checks) {
		if (!ok) failed++;
		console.log(`    ${ok ? 'PASS' : 'FAIL'}  ${text}`);
	}
}
// Focus, not hover: a keyboard user is the one this chain exists for.
for (const region of REGIONS) {
	// The first *visible* one: the toolbar's first anchor is the known-issues link, which ships
	// hidden on a launched spec and cannot be focused.
	const anchors = await page.locator(`${region} [data-tooltip-id]`).all();
	let index = -1;
	for (const [at, anchor] of anchors.entries())
		if (await anchor.isVisible()) {
			await anchor.focus();
			index = at;
			break;
		}
	if (index < 0) {
		console.log(`  ${region}\n    ----  no visible tooltip anchor to focus`);
		continue;
	}
	await page.waitForTimeout(700);
	const { described, role, text } = await page.evaluate(DESCRIBES, [`${region} [data-tooltip-id]`, index]);
	const ok = !!described && role === 'tooltip' && !!text;
	if (!ok) failed++;
	console.log(
		`  ${region}\n    ${ok ? 'PASS' : 'FAIL'}  focus describes the anchor (describedby=${described} role=${role} text=${JSON.stringify(text.slice(0, 30))})`,
	);
	await page.evaluate(() => document.activeElement?.blur());
	await page.waitForTimeout(300);
}

console.log(`\n${failed ? `${failed} checks fail` : 'all regions clean'}`);

if (errors.length) for (const e of errors) console.log(`  ERROR ${e}`);
await context.close();
await browser.close();
process.exit(errors.length || (!IS_BASE && failed) ? 1 : 0);

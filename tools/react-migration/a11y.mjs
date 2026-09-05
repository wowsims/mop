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
console.log(`\n${failed ? `${failed} checks fail` : 'all regions clean'}`);

if (errors.length) for (const e of errors) console.log(`  ERROR ${e}`);
await context.close();
await browser.close();
process.exit(errors.length || (!IS_BASE && failed) ? 1 : 0);

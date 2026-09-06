// Pane-content parity: open each top-level tab on both builds and compare what is inside it.
//
// parity.mjs is taken at load, so it only ever sees the gear tab's contents; the other five panes
// are built but never inspected. A tab body that renders differently once opened — or not at all —
// would pass every other check. Bootstrap's tab plugin also used to fire `shown.bs.tab`, which
// `deferUntilShown` components listen for; those listeners are on the *inner* strips, which still
// use the plugin, and this is what would catch it if that ever stopped being true.
//
// Selectors here go through `window.simTabsProbe` (browser.mjs) so that one script drives the
// Bootstrap strip on the parent branch and the Base UI strip that replaces it. Tabs are clicked by
// position rather than by class, which is why the tab-id lists are compared first.
import {
	dropRootClasses,
	launch,
	normaliseBaseUiMenus,
	normaliseLiftedSubtrees,
	openSpec,
	overusedIntended,
	PORTS,
	SERIALIZE,
	specsFromArgv,
	unexpectedLines,
} from './browser.mjs';
import { INTENDED } from './intended.mjs';

// Deferred tab bodies build on first show; the same wait applies to both sides.
const SETTLE = 1000;

const browser = await launch();
let fails = 0;
for (const spec of specsFromArgv()) {
	const sides = {};
	for (const [side, port] of Object.entries(PORTS)) sides[side] = await openSpec(browser, port, spec, { selector: '.sim-tabs [role=tab]' });

	const ids = await sides.react.page.evaluate(() => window.simTabsProbe.ids());
	const baseIds = await sides.base.page.evaluate(() => window.simTabsProbe.ids());
	const problems = [];
	if (ids.join() !== baseIds.join()) problems.push(`tab ids differ: base [${baseIds}] react [${ids}]`);
	if (!ids.length || ids.some(id => !id)) problems.push(`react tab identifiers unresolved: [${ids}]`);

	const sizes = [];
	// Clicking by position keeps one selector for both shapes; the id lists above prove the positions
	// line up. Asserting the pane that opened is the expected one is what stops a click that silently
	// does nothing from passing — both sides would otherwise serialise the same wrong pane and agree.
	if (!problems.length)
		for (const [index, id] of ids.entries()) {
			const dom = {};
			const levels = {};
			for (const side of Object.keys(PORTS)) {
				await sides[side].page.locator('.sim-tabs [role=tab]').nth(index).click();
				await sides[side].page.waitForTimeout(SETTLE);
				const open = await sides[side].page.evaluate(() => window.simTabsProbe.openIds());
				if (open.join() !== id) problems.push(`${side} ${id}: clicking it left [${open}] open`);
				// Both sides: see `normaliseLiftedSubtrees`. Its counts are compared across the two below.
				const lifted = normaliseLiftedSubtrees(dropRootClasses(await sides[side].page.evaluate(SERIALIZE, '#' + id)));
				problems.push(...lifted.problems.map(problem => `${id}: ${problem}`));
				levels[side] = lifted;
				dom[side] = lifted.dom;
				if (side === 'react') {
					const normalised = normaliseBaseUiMenus(dom[side]);
					dom[side] = normalised.dom;
					problems.push(...normalised.problems.map(problem => `${id}: ${problem}`));
				}
			}
			// What makes the lift an assertion rather than a fold: React must have nothing left to lift,
			// and both sides must hold the same number of level containers either way.
			if (levels.react.lifted) problems.push(`${id}: react still nests ${levels.react.lifted} level container(s) inside the picker anchor`);
			if (levels.base.total !== levels.react.total)
				problems.push(`${id}: ${levels.base.total} level containers on the baseline, ${levels.react.total} on react`);
			const la = dom.base.split('\n');
			const lb = dom.react.split('\n');
			sizes.push(`${id}=${lb.length}`);
			if (dom.base === dom.react) continue;
			// Tallied per pane, so `max` means "at most this many lines in one pane" rather than
			// across the whole run.
			const tally = new Map();
			const unexpected = unexpectedLines(la, lb, INTENDED, tally);
			problems.push(...overusedIntended(INTENDED, tally).map(problem => `${id}: ${problem}`));
			if (!unexpected.length && la.length === lb.length) continue;
			const first = unexpected[0] ?? la.findIndex((l, i) => l !== lb[i]);
			problems.push(
				`${id}: base ${la.length} elements, react ${lb.length}; first diff line ${first}\n      base : ${la[first]}\n      react: ${lb[first]}`,
			);
		}

	const errors = sides.react.errors;
	const ok = problems.length === 0 && errors.length === 0;
	if (!ok) fails++;
	console.log(`${ok ? 'PASS' : 'FAIL'}  ${spec.padEnd(22)} ${sizes.join(' ')}`);
	problems.forEach(x => console.log('    ! ' + x));
	errors.slice(0, 3).forEach(x => console.log('    error: ' + x.slice(0, 140)));
	for (const side of Object.keys(PORTS)) await sides[side].page.close();
}
await browser.close();

console.log(fails ? `\n${fails} spec(s) FAILED` : '\npane contents identical on every tab');
process.exit(fails ? 1 : 0);

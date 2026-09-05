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
import { dropRootClasses, launch, openSpec, PORTS, SERIALIZE, specsFromArgv } from './browser.mjs';

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
			for (const side of Object.keys(PORTS)) {
				await sides[side].page.locator('.sim-tabs [role=tab]').nth(index).click();
				await sides[side].page.waitForTimeout(SETTLE);
				const open = await sides[side].page.evaluate(() => window.simTabsProbe.openIds());
				if (open.join() !== id) problems.push(`${side} ${id}: clicking it left [${open}] open`);
				dom[side] = dropRootClasses(await sides[side].page.evaluate(SERIALIZE, '#' + id));
			}
			const la = dom.base.split('\n');
			const lb = dom.react.split('\n');
			sizes.push(`${id}=${lb.length}`);
			if (dom.base === dom.react) continue;
			const first = la.findIndex((l, i) => l !== lb[i]);
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

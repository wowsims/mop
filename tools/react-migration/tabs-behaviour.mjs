// Clicks every top-level tab on every spec and asserts the invariants Bootstrap used to keep:
// exactly one open pane, one faded-in pane and one selected tab, and that the pane that opened is
// the one whose tab was clicked. Runs against the React build only.
//
// "Open" is read as computed `display`, and "faded in" as computed `opacity`, on every element from
// the pane's id-carrying root up to `.sim-main` (see `paneChain` in browser.mjs). Class reads would
// only describe today's shape — panes hide by losing `.active` now and by gaining `hidden` after
// the Base UI port — and reading the panel wrapper alone would miss a pane that kept Bootstrap's
// `.fade` and is therefore inside a shown wrapper at opacity 0.
import { launch, openSpec, PORTS, specsFromArgv } from './browser.mjs';

const READ = () => ({
	openPanes: window.simTabsProbe.openIds(),
	shownPanes: window.simTabsProbe.shownIds(),
	selected: window.simTabsProbe.selectedIds(),
});

const browser = await launch();
let fails = 0;
for (const spec of specsFromArgv()) {
	const { page, errors } = await openSpec(browser, PORTS.react, spec, { selector: '.sim-tabs [role=tab]' });
	const ids = await page.evaluate(() => window.simTabsProbe.ids());
	const problems = [];
	if (!ids.length || ids.some(id => !id)) problems.push(`tab identifiers unresolved: [${ids}]`);

	// The tab open on load is the first one registered.
	const initial = (await page.evaluate(() => window.simTabsProbe.openIds()))[0];
	if (initial !== 'gear-tab') problems.push(`initial open pane is ${initial}, expected gear-tab`);

	// Clicked by position: one selector for the Bootstrap strip and the Base UI one.
	for (const [index, id] of ids.entries()) {
		await page.locator('.sim-tabs [role=tab]').nth(index).click();
		await page.waitForTimeout(250);
		const r = await page.evaluate(READ);
		if (r.openPanes.length !== 1) problems.push(`${id}: ${r.openPanes.length} open panes [${r.openPanes}]`);
		if (r.shownPanes.length !== 1) problems.push(`${id}: ${r.shownPanes.length} faded-in panes [${r.shownPanes}]`);
		if (r.selected.length !== 1) problems.push(`${id}: ${r.selected.length} tabs aria-selected`);
		if (r.openPanes[0] !== id) problems.push(`${id}: open pane is ${r.openPanes[0]}`);
		if (r.selected[0] !== id) problems.push(`${id}: selected tab is ${r.selected[0]}`);
	}

	// Returning to the gear tab, the way the bulk results renderer does. This clicks the tab;
	// SimHeader.activateTab's registry.activate path is covered by tabs-a11y.mjs and a unit test.
	await page.locator('.sim-tabs [role=tab]').nth(ids.indexOf('settings-tab')).click();
	await page.waitForTimeout(200);
	await page.locator('.sim-tabs [role=tab]').nth(ids.indexOf('gear-tab')).click();
	await page.waitForTimeout(250);
	const back = (await page.evaluate(() => window.simTabsProbe.openIds()))[0];
	if (back !== 'gear-tab') problems.push(`returning to the gear tab left ${back} open`);

	const ok = problems.length === 0 && errors.length === 0;
	if (!ok) fails++;
	console.log(`${ok ? 'PASS' : 'FAIL'}  ${spec.padEnd(22)} ${ids.length} tabs [${ids.join(', ')}]`);
	problems.forEach(x => console.log('    ! ' + x));
	errors.slice(0, 3).forEach(x => console.log('    error: ' + x.slice(0, 140)));
	await page.close();
}
await browser.close();
console.log(fails ? `\n${fails} spec(s) FAILED` : '\ntab behaviour correct on all specs');
process.exit(fails ? 1 : 0);

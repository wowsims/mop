// Clicks every top-level tab on every spec and asserts the invariants Bootstrap used to keep:
// exactly one active pane, one shown pane, one active link and one aria-selected link, and that the
// pane that opened is the one whose link was clicked. Runs against the React build only.
import { launch, openSpec, PORTS, specsFromArgv } from './browser.mjs';

const READ = () => ({
	activePanes: [...document.querySelectorAll('.sim-main > .tab-pane.active')].map(e => e.id),
	shownPanes: [...document.querySelectorAll('.sim-main > .tab-pane.active.show')].map(e => e.id),
	activeLinks: document.querySelectorAll('.sim-tabs .nav-link.active').length,
	selected: document.querySelectorAll('.sim-tabs .nav-link[aria-selected="true"]').length,
});

const browser = await launch();
let fails = 0;
for (const spec of specsFromArgv()) {
	const { page, errors } = await openSpec(browser, PORTS.react, spec, { selector: '.sim-tabs li .nav-link' });
	const ids = await page.$$eval('.sim-tabs > li', els => els.map(el => el.className.split(' ')[0]));
	const problems = [];

	// The tab open on load is the first one registered.
	const initial = await page.evaluate(() => document.querySelector('.sim-main > .tab-pane.active')?.id);
	if (initial !== 'gear-tab') problems.push(`initial active is ${initial}, expected gear-tab`);

	for (const id of ids) {
		await page.click(`.sim-tabs li.${id} .nav-link`);
		await page.waitForTimeout(250);
		const r = await page.evaluate(READ);
		if (r.activePanes.length !== 1) problems.push(`${id}: ${r.activePanes.length} active panes`);
		if (r.shownPanes.length !== 1) problems.push(`${id}: ${r.shownPanes.length} shown panes`);
		if (r.activeLinks !== 1) problems.push(`${id}: ${r.activeLinks} active links`);
		if (r.selected !== 1) problems.push(`${id}: ${r.selected} aria-selected`);
		if (r.activePanes[0] !== id) problems.push(`${id}: active pane is ${r.activePanes[0]}`);
	}

	// The "back to gear" path the bulk results renderer takes, through SimHeader.activateTab.
	await page.click('.sim-tabs li.settings-tab .nav-link');
	await page.waitForTimeout(200);
	await page.click('.sim-tabs li.gear-tab .nav-link');
	await page.waitForTimeout(250);
	const back = await page.evaluate(() => document.querySelector('.sim-main > .tab-pane.active')?.id);
	if (back !== 'gear-tab') problems.push(`returning to the gear tab left ${back} active`);

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

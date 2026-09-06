// Records the talents tab's behaviour, the same way sidebar-popover.mjs records the sidebar's:
// nothing else in this directory clicks anything, and a talent tree is almost entirely click
// behaviour — the DOM at load says nothing about whether spending a point works.
//
// Runs against `BASE_PORT` by default; set `PORT` to diff the React build once the tab ports. The
// whole output should be identical on both.
//
// The oracle is the autosaved settings blob rather than the rendered counters: a talents string is
// what actually has to survive, and reading it the same way on both stacks keeps the check honest
// even if the markup around it changes.
import { ENVIRONMENTAL, launch, PORTS } from './browser.mjs';

const SPEC = process.argv[2] ?? 'warrior/arms';
const PORT = Number(process.env.PORT ?? PORTS.base);
const TALENT = '.talent-picker-icon';

const readTalents = () => {
	for (const key of Object.keys(localStorage)) {
		if (!key.endsWith('__currentSettings__')) continue;
		try {
			const player = JSON.parse(localStorage.getItem(key))?.player;
			if (player) return { talents: player.talentsString ?? '', glyphs: JSON.stringify(player.glyphs ?? {}) };
		} catch {
			// Not the blob we are after.
		}
	}
	return null;
};

// Scoped to the pane: SavedDataManager and PresetConfigurationPicker have consumers in four tabs,
// so a page-wide count says nothing about this one.
const structure = () => {
	const pane = document.getElementById('talents-tab');
	const count = selector => pane.querySelectorAll(selector).length;
	return {
		trees: count('.talent-tree-main'),
		talents: count('.talent-picker-icon'),
		resetButtons: count('.talent-tree-reset'),
		glyphSlots: count('.glyph-picker-root a, .glyph-anchor'),
		savedDataManagers: count('.saved-data-manager-root'),
		presetPickers: count('.preset-configuration-picker-root'),
		leftPanelChildren: pane.querySelector('.talents-tab-left')?.children.length ?? 'NO LEFT PANEL',
		rightPanelChildren: pane.querySelector('.talents-tab-right')?.children.length ?? 'NO RIGHT PANEL',
	};
};

const browser = await launch();
const context = await browser.newContext();
const page = await context.newPage();
const errors = [];
page.on('pageerror', e => errors.push(String(e)));
page.on('console', m => {
	if (m.type() === 'error' && !ENVIRONMENTAL.test(m.text())) errors.push('console: ' + m.text());
});
await page.addInitScript(() => {
	window.alert = () => {};
});
await page.goto(`http://localhost:${PORT}/mop/${SPEC}/`, { waitUntil: 'load', timeout: 60000 });
await page.waitForSelector('.sim-ui', { timeout: 60000 });
await page.waitForTimeout(2500);

// The tab is not the one open on load, so this also exercises building its contents on first show.
await page.click('.sim-tabs .talents-tab, .sim-tabs li.talents-tab .nav-link');
await page.waitForSelector(TALENT, { state: 'visible', timeout: 10000 });
await page.waitForTimeout(500);

console.log(`${SPEC} on :${PORT}\n`);
console.log('structure');
for (const [k, v] of Object.entries(await page.evaluate(structure))) console.log(`  ${k.padEnd(18)} ${v}`);

const before = await page.evaluate(readTalents);
const icons = page.locator(TALENT);
const count = await icons.count();

// Spend a point on the first talent, then a second on the same one, then take both back. Left click
// adds and right click removes; the string is positional, so its shape is the assertion.
const step = async (label, action) => {
	await action();
	await page.waitForTimeout(400);
	const now = await page.evaluate(readTalents);
	console.log(`${label.padEnd(22)} talents=[${now.talents}]${now.glyphs !== before.glyphs ? ' glyphs CHANGED' : ''}`);
	return now;
};

console.log(`\n${count} talents, string starts as [${before.talents}]`);
await step('click first talent', () => icons.first().click());
await step('click it again', () => icons.first().click());
await step('right-click it', () => icons.first().click({ button: 'right' }));
await step('right-click again', () => icons.first().click({ button: 'right' }));
await step('reset the tree', () => page.locator('.talent-tree-reset').first().click());

if (errors.length) {
	for (const e of errors) console.log(`  ERROR ${e}`);
}
await context.close();
await browser.close();
process.exit(errors.length ? 1 : 0);

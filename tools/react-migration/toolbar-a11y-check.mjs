import { launch, openSpec, q } from './browser.mjs';

const PORT = Number(process.env.PORT || 3404);
const SPEC = process.argv[2] || 'warrior/arms';

const browser = await launch();
const { page } = await openSpec(browser, PORT, SPEC);
await page.waitForSelector('[data-testid="sim-ui"], .sim-ui', { timeout: 60000 });
await page.waitForTimeout(1500);

const results = {};

const rotationTabId = await page.evaluate(() => window.simTabsProbe.ids().find(id => id && /rotation/.test(id)));
if (rotationTabId) {
	await page.evaluate(id => window.simTabsProbe.tabs().find(t => window.simTabsProbe.idOf(t) === id).click(), rotationTabId);
	await page.waitForTimeout(800);
}
results.aplToolbarRole = await page.evaluate(sel => document.querySelector(sel)?.getAttribute('role'), q('apl-floating-action-bar-root'));
results.aplButtons = await page.evaluate(sel => document.querySelectorAll(`${sel} button`).length, q('apl-floating-action-bar-root'));

// Keyboard: Tab into it, then arrow key to move between the two toolbar buttons
await page.evaluate(sel => document.querySelector(sel).querySelector('button').focus(), q('apl-floating-action-bar-root'));
results.aplFirstFocused = await page.evaluate(sel => document.activeElement === document.querySelector(sel).querySelector('button'), q('apl-floating-action-bar-root'));
await page.keyboard.press('ArrowRight');
results.aplArrowMoved = await page.evaluate(sel => {
	const btns = [...document.querySelectorAll(`${sel} button`)];
	return document.activeElement === btns[1];
}, q('apl-floating-action-bar-root'));

results.rotationToolbarRole = await page.evaluate(sel => document.querySelector(sel)?.getAttribute('role'), q('rotation-fab-actions'));

const drToolbarId = await page.evaluate(() => window.simTabsProbe.ids().find(id => id && /detailed-results/.test(id)));
if (drToolbarId) {
	await page.evaluate(id => window.simTabsProbe.tabs().find(t => window.simTabsProbe.idOf(t) === id).click(), drToolbarId);
	await page.waitForTimeout(1200);
	await page.waitForSelector(`${q('detailed-results-1-iteration-button')}:not([disabled])`, { timeout: 60000 });
	await page.click(q('detailed-results-1-iteration-button'));
	await page.waitForFunction(() => !document.querySelector('[data-no-results]'), null, { timeout: 120000 });
	await page.waitForTimeout(500);
	await page.evaluate(toolbarSel => document.querySelector(`${toolbarSel} [role=tab][aria-controls=timelineTab]`).click(), q('dr-toolbar'));
	await page.waitForTimeout(800);

	results.rotationDrawerToolbarRole = await page.evaluate(sel => document.querySelector(sel)?.getAttribute('role'), q('rotation-fab-actions'));
	results.rotationPanelAbsentAtRest = await page.evaluate(sel => document.querySelector(sel) === null, q('rotation-fab-panel-inner'));

	await page.click(q('rotation-fab-toggle'));
	await page.waitForTimeout(300);
	results.rotationPanelOpensFromClick = await page.evaluate(sel => document.querySelector(sel) !== null, q('rotation-fab-panel-inner'));
	results.rotationToggleAriaExpandedTrue = await page.evaluate(sel => document.querySelector(sel)?.getAttribute('aria-expanded'), q('rotation-fab-toggle'));

	await page.keyboard.press('Escape');
	await page.waitForTimeout(400);
	results.rotationPanelClosesOnEscape = await page.evaluate(sel => document.querySelector(sel) === null, q('rotation-fab-panel-inner'));
	results.rotationFocusReturnsToToggle = await page.evaluate(sel => document.activeElement === document.querySelector(sel), q('rotation-fab-toggle'));

	await page.evaluate(toolbarSel => document.querySelector(`${toolbarSel} [role=tab][aria-controls=logTab]`).click(), q('dr-toolbar'));
	await page.waitForTimeout(800);

	results.logToolbarRole = await page.evaluate(sel => document.querySelector(sel)?.getAttribute('role'), q('log-fab-actions'));
	results.logPanelAbsentAtRest = await page.evaluate(sel => document.querySelector(sel) === null, q('log-fab-panel-inner'));

	await page.click(q('log-fab-toggle'));
	await page.waitForTimeout(300);
	results.logPanelOpensFromKeyboardClick = await page.evaluate(sel => document.querySelector(sel) !== null, q('log-fab-panel-inner'));
	results.logToggleAriaExpandedTrue = await page.evaluate(sel => document.querySelector(sel)?.getAttribute('aria-expanded'), q('log-fab-toggle'));

	await page.keyboard.press('Escape');
	await page.waitForTimeout(400);
	results.logPanelClosesOnEscape = await page.evaluate(sel => document.querySelector(sel) === null, q('log-fab-panel-inner'));
	results.logFocusReturnsToToggle = await page.evaluate(sel => document.activeElement === document.querySelector(sel), q('log-fab-toggle'));
}

await browser.close();
console.log(JSON.stringify(results, null, 2));

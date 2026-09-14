import { launch, openSpec, q } from './browser.mjs';

const OUT = '/home/lutz/personal/.tw-stage4/probe-toolbar-1';
const WIDTHS = [700, 1600, 2200];

const shootApl = async (page, port, label) => {
	for (const width of WIDTHS) {
		await page.setViewportSize({ width, height: 1000 });
		await page.waitForTimeout(200);
		const root = page.locator(q('apl-floating-action-bar-root')).first();
		await root.screenshot({ path: `${OUT}/apl-fab-${width}-${label}.png` }).catch(() => {});
	}
};

const shootRotation = async (page, width, label) => {
	await page.setViewportSize({ width, height: 1000 });
	await page.waitForTimeout(200);
	const root = page.locator(q('rotation-floating-action-bar-root')).first();
	await root.screenshot({ path: `${OUT}/rotation-fab-${width}-${label}.png` }).catch(() => {});
};

const shootLog = async (page, width, label) => {
	await page.setViewportSize({ width, height: 1000 });
	await page.waitForTimeout(200);
	const root = page.locator(q('log-floating-action-bar-root')).first();
	await root.screenshot({ path: `${OUT}/log-fab-${width}-${label}.png` }).catch(() => {});
	await page.click(q('log-fab-toggle'));
	await page.waitForTimeout(300);
	const panel = page.locator(q('log-fab-panel-inner')).first();
	await panel.screenshot({ path: `${OUT}/log-fab-drawer-${width}-${label}.png` }).catch(() => {});
	await page.keyboard.press('Escape');
	await page.waitForTimeout(300);
};

const run = async (port, label) => {
	const browser = await launch();
	const { page } = await openSpec(browser, port, 'warrior/arms');
	await page.waitForSelector('[data-testid="sim-ui"], .sim-ui', { timeout: 60000 });
	await page.waitForTimeout(1500);

	const rotationTabId = await page.evaluate(() => window.simTabsProbe.ids().find(id => id && /rotation/.test(id)));
	if (rotationTabId) {
		await page.evaluate(id => window.simTabsProbe.tabs().find(t => window.simTabsProbe.idOf(t) === id).click(), rotationTabId);
		await page.waitForTimeout(1000);
	}

	await shootApl(page, port, label);

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
		for (const width of WIDTHS) await shootRotation(page, width, label);

		await page.evaluate(toolbarSel => document.querySelector(`${toolbarSel} [role=tab][aria-controls=logTab]`).click(), q('dr-toolbar'));
		await page.waitForTimeout(800);
		for (const width of WIDTHS) await shootLog(page, width, label);
	}

	await browser.close();
};

await run(Number(process.argv[2]), process.argv[3]);
console.log('done', process.argv[2], process.argv[3]);

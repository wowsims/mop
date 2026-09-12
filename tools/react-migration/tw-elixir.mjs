// What the elixir row looks like on each of the three builds, by class name rather than by path.
import { launch } from './browser.mjs';

const READ = () => {
	const pick = sel => {
		const el = document.querySelector(sel);
		if (!el) return `${sel}: ABSENT`;
		const r = el.getBoundingClientRect();
		return `${sel}: display=${getComputedStyle(el).display} children=${el.children.length} rect=[${Math.round(r.x)},${Math.round(r.y)},${Math.round(r.width)},${Math.round(r.height)}] cls="${el.className}"`;
	};
	const row = document.querySelector('.consumes-battle-elixirs')?.parentElement;
	const rowRect = row?.getBoundingClientRect();
	return [
		pick('.consumes-flasks'),
		pick('.consumes-battle-elixirs'),
		pick('.consumes-guardian-elixirs'),
		row ? `row: gap=${getComputedStyle(row).gap} rect=[${Math.round(rowRect.x)},${Math.round(rowRect.y)},${Math.round(rowRect.width)},${Math.round(rowRect.height)}] kids=${row.children.length}` : 'row: ABSENT',
	].join('\n');
};

const main = async () => {
	const browser = await launch();
	for (const [label, port] of [['master  3401', 3401], ['react   3402', 3402], ['tailwind 3404', 3404]]) {
		const page = await browser.newPage();
		await page.addInitScript(() => {
			window.alert = () => {};
		});
		await page.setViewportSize({ width: 1600, height: 1000 });
		await page.goto(`http://localhost:${port}/mop/warrior/arms/`, { waitUntil: 'load', timeout: 60000 });
		await page.waitForSelector('[data-testid="sim-ui"], .sim-ui', { timeout: 60000 });
		await page.waitForTimeout(2500);
		await page.evaluate(() => {
			const link = [...document.querySelectorAll('a,button,[role="tab"]')].find(el => (el.textContent || '').trim().toLowerCase() === 'settings' && el.offsetParent !== null);
			link?.click();
		});
		await page.waitForTimeout(900);
		console.log(`\n=== ${label} ===\n${await page.evaluate(READ)}`);
		await page.close();
	}
	await browser.close();
};
main();

// The `bulk_tab.description` spans, on all three builds. `.bold` is carried by a TRANSLATION
// STRING, and `assets/locales/**` is shared across branches, so what each build renders for these
// spans is the merge-ordering question in one measurement.
import { launch } from './browser.mjs';

const READ = () => {
	const spans = [...document.querySelectorAll('.bulk-tab-content span, .bulk-settings-container span, span')]
		.filter(s => /Batch Simming|Simulation par lot|Top Gear|Alpha/.test(s.textContent || ''))
		.slice(0, 6);
	if (!spans.length) return 'NO DESCRIPTION SPANS FOUND';
	return spans
		.map(s => `"${(s.textContent || '').slice(0, 22)}" class="${s.getAttribute('class') ?? '<none>'}" classname="${s.getAttribute('classname') ?? '<none>'}" weight=${getComputedStyle(s).fontWeight}`)
		.join('\n  ');
};

const main = async () => {
	const browser = await launch();
	for (const [label, port] of [['master   3401', 3401], ['react    3402', 3402], ['tailwind 3404', 3404]]) {
		const page = await browser.newPage();
		await page.addInitScript(() => {
			window.alert = () => {};
		});
		await page.setViewportSize({ width: 1600, height: 1000 });
		await page.goto(`http://localhost:${port}/mop/warrior/arms/`, { waitUntil: 'load', timeout: 60000 });
		await page.waitForSelector('[data-testid="sim-ui"], .sim-ui', { timeout: 60000 });
		await page.waitForTimeout(2500);
		await page.evaluate(() => {
			const link = [...document.querySelectorAll('a,button,[role="tab"]')].find(el => /batch|bulk/i.test((el.textContent || '').trim()) && el.offsetParent !== null);
			link?.click();
		});
		await page.waitForTimeout(1200);
		console.log(`\n=== ${label} ===\n  ${await page.evaluate(READ)}`);
		await page.close();
	}
	await browser.close();
};
main();

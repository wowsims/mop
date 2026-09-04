// The landing page (`ui/index.html` + `ui/index.ts`), which every other check misses — they all
// anchor at `.sim-ui` on a spec page. It has no sim and no spec, so nothing about it is React yet,
// but it went through the JSX config swap and shares the same chunks, so a shared-module regression
// would land here first and be seen nowhere else.
import { launch, PORTS, ENVIRONMENTAL } from './browser.mjs';

const READ = () => ({
	specLinks: document.querySelectorAll('a[href*="/mop/"]').length,
	// The homepage is the page that still depends on localization's [data-i18n] DOM walk.
	i18nNodes: document.querySelectorAll('[data-i18n]').length,
	classes: [...document.querySelectorAll('body *')].length,
});

const browser = await launch();
const results = {};
for (const [side, port] of Object.entries(PORTS)) {
	const page = await browser.newPage();
	const errors = [];
	page.on('pageerror', e => errors.push(String(e)));
	page.on('console', m => {
		if (m.type() === 'error' && !ENVIRONMENTAL.test(m.text())) errors.push('console: ' + m.text());
	});
	await page.goto(`http://localhost:${port}/mop/`, { waitUntil: 'load', timeout: 60000 });
	await page.waitForTimeout(2000);
	results[side] = { ...(await page.evaluate(READ)), errors };
	await page.close();
}
await browser.close();

const { base, react } = results;
const same = base.specLinks === react.specLinks && base.i18nNodes === react.i18nNodes && base.classes === react.classes;
const ok = same && base.errors.length === 0 && react.errors.length === 0;
console.log(
	`${ok ? 'PASS' : 'FAIL'}  landing page   base: ${base.specLinks} spec links, ${base.i18nNodes} [data-i18n], ${base.classes} elements, ${base.errors.length} errors`,
);
console.log(
	`                     react: ${react.specLinks} spec links, ${react.i18nNodes} [data-i18n], ${react.classes} elements, ${react.errors.length} errors`,
);
[...base.errors, ...react.errors].slice(0, 4).forEach(e => console.log('    error: ' + e.slice(0, 140)));
process.exit(ok ? 0 : 1);

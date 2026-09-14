// Toggling a row in the rotation timeline moves the scroll position — a defect on MASTER, measured
// 2026-09-08, not introduced by the React port. It is invisible near the top of the view because
// scroll anchoring compensates, and obvious lower down:
//
//   scrolled to 500 : landmark row does not move (0px), scrollTop compensates by exactly the removed
//                     row's height, and the pane's document position is unchanged.
//   scrolled to max : scrollTop collapses 1613 -> 508 on a single chip click, an 1105px jump, while
//                     the content only shrank by one row (32px). The rendered row count *rises*
//                     (28 -> 37), which is the tell: the view is windowed, the rebuild empties the
//                     container, the browser clamps scrollTop to the momentarily-short content, and
//                     the height comes back afterwards with the scroll left where the clamp put it.
//
// So this asserts the invariant rather than the numbers: a row that is visible before the toggle and
// survives it must not move, from any scroll position. Run with PORT to pick a build.
import { launch, openSpec, q } from './browser.mjs';

const PORT = Number(process.env.PORT || 3401);
const SPEC = process.argv[2] || 'warrior/arms';
const ROW_SELECTOR = `${q('rotation-row')}, .rotation-timeline-row`;

const readLandmark = page =>
	page.evaluate(sel => {
		const rows = [...document.querySelectorAll(sel)];
		const visible = rows.find(row => {
			const box = row.getBoundingClientRect();
			return box.top > 60 && box.bottom < innerHeight;
		});
		if (!visible) return null;
		return { key: visible.dataset.rowKey || visible.className.slice(0, 40), top: Math.round(visible.getBoundingClientRect().top) };
	}, ROW_SELECTOR);

const browser = await launch();
let failed = false;
try {
	const { page } = await openSpec(browser, PORT, SPEC);
	const tabId = await page.evaluate(() => window.simTabsProbe.ids().find(id => id && /detailed-results/.test(id)));
	await page.evaluate(id => window.simTabsProbe.tabs().find(tab => window.simTabsProbe.idOf(tab) === id).click(), tabId);
	await page.waitForTimeout(1200);
	await page.waitForSelector('.detailed-results-1-iteration-button:not([disabled])', { timeout: 60000 });
	await page.click('.detailed-results-1-iteration-button');
	await page.waitForFunction(() => !document.querySelector('.dr-no-results'), null, { timeout: 120000 });
	await page.waitForTimeout(800);
	await page.evaluate(() => document.querySelector('.dr-toolbar [role=tab][aria-controls=timelineTab]').click());
	await page.waitForTimeout(1500);
	await page.evaluate(sel => {
		const toggle = document.querySelector(sel) || document.querySelector('.rotation-floating-action-bar button');
		toggle?.click();
	}, q('rotation-fab-toggle'));
	await page.waitForTimeout(500);

	console.log(`${SPEC} on :${PORT}`);
	for (const [name, position] of [
		['near the top', 500],
		['at the bottom', Number.MAX_SAFE_INTEGER],
	]) {
		await page.evaluate(top => {
			const scroller = document.querySelector('[data-testid="sim-ui"], .sim-ui');
			if (scroller && scroller.scrollHeight > scroller.clientHeight) scroller.scrollTop = top;
			else window.scrollTo(0, top);
		}, position);
		await page.waitForTimeout(400);

		const before = await readLandmark(page);
		if (!before) {
			console.log(`  ${name.padEnd(14)} no fully-visible row to anchor on — skipped`);
			continue;
		}
		await page.evaluate(sel => document.querySelector(sel)?.click(), q('rotation-fab-chip'));
		await page.waitForTimeout(700);
		const after = await page.evaluate(
			({ key, sel }) =>
				[...document.querySelectorAll(sel)].filter(row => (row.dataset.rowKey || row.className.slice(0, 40)) === key).map(row => Math.round(row.getBoundingClientRect().top))[0] ??
				null,
			{ key: before.key, sel: ROW_SELECTOR },
		);
		// Toggle it back so the two positions are measured against the same row set.
		await page.evaluate(sel => document.querySelector(sel)?.click(), q('rotation-fab-chip'));
		await page.waitForTimeout(400);

		if (after === null) {
			console.log(`  ${name.padEnd(14)} FAIL  the anchor row disappeared`);
			failed = true;
			continue;
		}
		const jump = after - before.top;
		console.log(`  ${name.padEnd(14)} ${Math.abs(jump) <= 2 ? 'PASS' : 'FAIL'}  anchor ${before.top} -> ${after}  jump ${jump}px`);
		if (Math.abs(jump) > 2) failed = true;
	}
	console.log(failed ? '\ntoggling a row moves the view' : '\ntoggling a row leaves the view where it was');
} finally {
	await browser.close();
}
process.exit(failed ? 1 : 0);

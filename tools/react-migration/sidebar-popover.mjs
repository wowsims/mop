// Records the bonus-stat popover's behaviour. Runs against the parent build (`BASE_PORT`) by
// default, which is pure vanilla; point `PORT` at the React build once the sidebar ports, and the
// two outputs are a diff.
//
// Three things nothing else in this directory can see, because the popover only exists after a
// click and happy-dom never advances a tippy instance to its shown state:
//
//   1. whether the sidebar's `overflow-y: auto` clips the popper. Answered by hit-testing a point
//      past the scroller's edge, not by comparing rectangles — the popper overhangs by ~123px and
//      is *not* clipped, because `position: absolute` resolves against `aside.sim-sidebar`
//      (`position: sticky`), which is outside the scroller. A scroll container does not clip a
//      descendant whose containing block is one of its own ancestors.
//   2. whether closing commits the half-typed value. The picker commits on the native `change`
//      event, so this rests on whether the close path takes focus off the input — and every one
//      does: Chrome blurs a focused element that is removed *or* hidden, and blur fires `change`
//      on a field the user edited. Only real key events set that flag, which is why this types.
//   3. that the three close paths (Escape, outside click, Enter) agree with each other and with a
//      plain Tab out.
//   4. that the sidebar re-renders after the write. The commit oracle below deliberately avoids the
//      worker, so it would pass just as well against a table frozen at its load-time numbers.
//   5. the attribution and crit-cap tooltips, which are the component's largest block of markup and
//      only exist while a stat value is hovered.
//
// The commit oracle is the autosaved settings blob rather than the sidebar's own number: the
// displayed stat needs a worker round trip, localStorage needs only 300 ms of autosave debounce.
import { ENVIRONMENTAL, launch, PORTS } from './browser.mjs';

const SPEC = process.argv[2] ?? 'warrior/arms';
const PORT = Number(process.env.PORT ?? PORTS.base);
// Both sides: tippy's box today, `Tooltip`'s `sim-tooltip` once a component ports.
const ANY_TOOLTIP = '.tippy-box, .sim-tooltip';
const STAT_ROW = '.character-stats-table-row';
// Both sides: tippy's themed box today, `Tooltip`'s `className` once the sidebar ports. Kept as
// parts because a selector list does not distribute over a descendant combinator.
const POPOVER_PARTS = [".tippy-box[data-theme='bonus-stats-popover']", '.sim-tooltip.bonus-stats-popover'];
const POPOVER = POPOVER_PARTS.join(', ');
const inside = suffix => POPOVER_PARTS.map(part => `${part} ${suffix}`).join(', ');
const TYPED = '123';

const readBonusStats = () => {
	for (const key of Object.keys(localStorage)) {
		if (!key.endsWith('__currentSettings__')) continue;
		try {
			const stats = JSON.parse(localStorage.getItem(key))?.player?.bonusStats?.stats;
			if (stats) return stats.map(Number);
		} catch {
			// Not the blob we are after.
		}
	}
	return null;
};

const geometry = selector => {
	const box = document.querySelector(selector);
	const popper = box?.closest('[data-tippy-root]') ?? box;
	const scroller = document.querySelector('.sim-sidebar-content');
	if (!popper || !scroller) return { error: `popper=${!!popper} scroller=${!!scroller}` };
	const b = popper.getBoundingClientRect();
	const f = scroller.getBoundingClientRect();
	// Well past the scroller's right edge, but inside the popover.
	const x = Math.round(f.right + (b.right - f.right) / 2);
	const y = Math.round(b.top + b.height / 2);
	const hit = document.elementFromPoint(x, y);
	let containingBlock = popper.parentElement;
	while (containingBlock && getComputedStyle(containingBlock).position === 'static') containingBlock = containingBlock.parentElement;
	return {
		mountedIn: popper.parentElement.tagName.toLowerCase() + '.' + popper.parentElement.className,
		containingBlock: containingBlock
			? `${containingBlock.tagName.toLowerCase()}.${containingBlock.className} ${getComputedStyle(containingBlock).position}`
			: 'initial',
		insideScroller: scroller.contains(popper),
		strategy: getComputedStyle(popper).position,
		overhangRight: Math.round(b.right - f.right),
		clipped: !(hit && box.contains(hit)),
	};
};

// The first row that offers a bonus-stat button — whichever stat that is, both builds agree on it.
const readFirstValue = () => document.querySelector('.character-stats-table-row .stat-value-link')?.textContent?.trim() ?? null;

const CLOSERS = {
	escape: page => page.keyboard.press('Escape'),
	'outside-click': page => page.click('.character-stats-label'),
	enter: page => page.keyboard.press('Enter'),
	tab: page => page.keyboard.press('Tab'),
};

const run = async (browser, name) => {
	// A context per scenario: the commit oracle is localStorage, which would otherwise carry over.
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

	const before = await page.evaluate(readBonusStats);
	const valueBefore = await page.evaluate(readFirstValue);
	await page.click(`${STAT_ROW} button.add-bonus-stats`);
	await page.waitForSelector(inside('.number-picker-input'), { state: 'visible', timeout: 5000 });
	const geo = await page.evaluate(geometry, POPOVER);

	const input = page.locator(inside('.number-picker-input'));
	await input.click();
	// Typed, not filled: `change` fires on blur only for a *user* edit, and only real key events
	// set that flag. A programmatic `.value =` write plus a synthetic InputEvent does not.
	await input.pressSequentially(TYPED, { delay: 20 });
	const midway = await page.evaluate(readBonusStats);

	await CLOSERS[name](page);
	await page.waitForTimeout(600);

	const after = await page.evaluate(readBonusStats);
	// Long enough for the stats recompute to come back from the worker and re-render the table.
	await page.waitForTimeout(2500);
	const valueAfter = await page.evaluate(readFirstValue);
	// react-tooltip unmounts its content, so a missing box is closed; tippy leaves a hidden root.
	const stillOpen = await page.evaluate(selector => {
		const box = document.querySelector(selector);
		if (!box) return false;
		const style = getComputedStyle(box);
		return box.closest('[data-tippy-root]')?.style.visibility !== 'hidden' && style.visibility !== 'hidden' && style.opacity !== '0';
	}, POPOVER);
	await context.close();
	return { name, geo, before, midway, after, stillOpen, valueBefore, valueAfter, errors };
};

const diff = (before, after) => {
	if (!before || !after) return `before=${JSON.stringify(before)} after=${JSON.stringify(after)}`;
	const changes = after.map((v, i) => [i, v - (before[i] ?? 0)]).filter(([, d]) => d !== 0);
	return changes.length ? changes.map(([i, d]) => `stat[${i}] ${d > 0 ? '+' : ''}${d}`).join(', ') : 'unchanged';
};

// The attribution breakdown and the crit-cap table are built only while their value is hovered, so
// every other check in this directory is blind to them — and they are where the display rules live.
const hoverTooltips = async browser => {
	const context = await browser.newContext();
	const page = await context.newPage();
	await page.goto(`http://localhost:${PORT}/mop/${SPEC}/`, { waitUntil: 'load', timeout: 60000 });
	await page.waitForSelector('.sim-ui', { timeout: 60000 });
	await page.waitForTimeout(2500);

	const read = async (selector, index) => {
		const link = page.locator(selector).nth(index);
		if (!(await link.count())) return null;
		await link.hover();
		await page.waitForTimeout(400);
		const shown = await page.evaluate(
			([tooltip]) => {
				const box = document.querySelector(tooltip);
				if (!box) return { open: false };
				return {
					open: true,
					opacity: getComputedStyle(box).opacity,
					rows: Array.from(box.querySelectorAll('.character-stats-tooltip-row')).map(row =>
						Array.from(row.children)
							.map(cell => cell.textContent.trim())
							.join(' = '),
					),
				};
			},
			[ANY_TOOLTIP],
		);
		// Off the anchor, so the next hover starts from closed.
		await page.mouse.move(0, 0);
		await page.waitForTimeout(400);
		return shown;
	};

	const first = await read(`${STAT_ROW} .stat-value-link`, 0);
	// The crit-cap row is the only one without a bonus-stat button, and it renders a different table.
	const critCap = await read(`${STAT_ROW}:not(:has(button.add-bonus-stats)) .stat-value-link`, 0);
	await context.close();
	return { first, critCap };
};

const browser = await launch();
let failed = false;
try {
	console.log(`${SPEC} on :${PORT}, typing "${TYPED}" into the bonus-stat popover then closing\n`);
	for (const name of Object.keys(CLOSERS)) {
		const r = await run(browser, name);
		if (name === 'escape') {
			console.log('popover geometry');
			for (const [k, v] of Object.entries(r.geo)) console.log(`  ${k.padEnd(16)} ${JSON.stringify(v)}`);
			console.log('');
		}
		const uncommitted = diff(r.before, r.midway) === 'unchanged';
		const rerendered = r.valueBefore !== r.valueAfter ? `yes [${r.valueBefore} -> ${r.valueAfter}]` : `NO [${r.valueAfter}]`;
		console.log(
			`${name.padEnd(14)} committed=${diff(r.before, r.after).padEnd(18)} stillOpen=${r.stillOpen} typingWasUncommitted=${uncommitted} rerendered=${rerendered}`,
		);
		if (r.errors.length) {
			failed = true;
			for (const e of r.errors) console.log(`  ERROR ${e}`);
		}
	}
	const hover = await hoverTooltips(browser);
	for (const [name, shown] of Object.entries(hover)) {
		if (!shown) {
			console.log(`\n${name} tooltip: no such link on this spec`);
			continue;
		}
		if (!shown.open) {
			failed = true;
			console.log(`\n${name} tooltip: DID NOT OPEN`);
			continue;
		}
		console.log(`\n${name} tooltip (opacity ${shown.opacity}), ${shown.rows.length} rows`);
		for (const row of shown.rows) console.log(`  ${row}`);
	}
} finally {
	await browser.close();
}
process.exit(failed ? 1 : 0);

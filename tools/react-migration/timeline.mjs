// The timeline pane, compared across the two builds. No other check reaches it: it only exists after
// a sim has run, `results-tabs.mjs` cuts its serialisation three levels above a row, and neither
// parity check ever opens it with data in it.
//
// The run is seeded the way `topline-metrics.mjs` seeds its: the base build's own autosaved settings
// blob is read back out of localStorage, `fixedRngSeed` and `iterations` are patched into it, and the
// same JSON is planted on both ports before load. Identical settings plus a fixed seed means the two
// rotations are the same rotation, so every difference left is the port's.
//
// Tooltips are read by hovering rather than by selector: vanilla appends `[data-tippy-root]` to the
// body, the port draws its own `.timeline-hover-tooltip`, and what matters is the text either shows.
import { launch, openSpec, PORTS } from './browser.mjs';

const SPECS = ['warrior/arms'];
const SEED = '1337';
const ITERATIONS = 100;
const SETTINGS_SUFFIX = '__currentSettings__';

const specs = () => (process.argv[2] ? process.argv[2].split(',') : SPECS);

const READ_ROTATION = () => {
	const pane = document.querySelector('.rotation-pane');
	if (!pane) return ['NO .rotation-pane'];
	const style = getComputedStyle(pane);
	const rows = [...pane.querySelectorAll('.rotation-row')];
	const spacers = [...pane.querySelectorAll('.rotation-content > .rotation-vspacer')];
	const ruler = [...pane.querySelectorAll('.rotation-ruler-label')];
	const cls = element => (element.getAttribute('class') || '').trim().split(/\s+/).filter(Boolean).sort().join('.');

	return [
		`pane pps=${style.getPropertyValue('--pps').trim()} duration=${style.getPropertyValue('--duration').trim()} label-w=${style.getPropertyValue('--label-w').trim()}`,
		`spacers ${spacers.map(spacer => spacer.style.getPropertyValue('--vspacer-h')).join('/')}`,
		`ruler ticks=${pane.querySelectorAll('.rotation-ruler-tick').length} labels=${ruler.map(label => label.textContent).join(',')}`,
		...rows.map(row => {
			const items = [...row.querySelectorAll('.rotation-row-track > .rotation-item')];
			return [
				`row ${row.dataset.rowKey}`,
				cls(row),
				`h=${row.style.getPropertyValue('--row-h')}`,
				`label=${row.querySelector('.rotation-label-text')?.textContent ?? ''}`,
				`items=${items.length}`,
				// Positions only: the port adds a `data-item-index` the vanilla items never carried, which
				// is how its delegated hover finds the model row without a per-item listener.
				`at=${items
					.slice(0, 6)
					.map(item => `${item.style.getPropertyValue('--t')}+${item.style.getPropertyValue('--dur')}`)
					.join(' ')}`,
			].join(' ');
		}),
	];
};

const READ_FAB = () => {
	const root = document.querySelector('.rotation-floating-action-bar-root');
	if (!root) return ['NO .rotation-floating-action-bar-root'];
	return [
		`summary ${root.querySelector('.rotation-fab-summary')?.textContent ?? ''} | ${root.querySelector('.rotation-fab-preview')?.textContent ?? ''}`,
		`showAll hidden=${root.querySelector('.rotation-fab-show-all')?.hidden}`,
		...[...root.querySelectorAll('.rotation-fab-group')].map(
			group =>
				`group ${group.querySelector('.rotation-fab-group-title')?.textContent} :: ${[...group.querySelectorAll('.rotation-fab-chip')]
					.map(chip => `${chip.textContent}=${chip.getAttribute('aria-checked')}`)
					.join(',')}`,
		),
	];
};

const READ_CHART = () => {
	const chart = document.querySelector('.timeline-chart');
	if (!chart) return ['NO .timeline-chart'];
	const canvas = chart.querySelector('canvas');
	const box = canvas?.getBoundingClientRect();
	return [
		`canvas hidden=${chart.querySelector('.timeline-chart-canvas').className.includes('hide')} empty=${chart.querySelector('.timeline-chart-empty').className.includes('hide')}`,
		`size ${box ? `${Math.round(box.width)}x${Math.round(box.height)}` : 'none'}`,
		`toolbar ${[...chart.querySelectorAll('.timeline-chart-toolbar button')].map(button => button.getAttribute('aria-label')).join(',')}`,
	];
};

// Four shapes across the two builds: tippy's body-level popper for a rotation item or a toolbar
// button, vanilla's own `.timeline-chart-tooltip` for a chart point, the port's one
// `.timeline-hover-tooltip` for item and chart alike, and react-tooltip for the toolbar.
const OPEN_TOOLTIP = () => {
	const open = [
		...document.querySelectorAll('[data-tippy-root] .tippy-content, .timeline-chart-tooltip, .timeline-hover-tooltip, .react-tooltip.sim-tooltip'),
	].find(element =>
		element.classList.contains('react-tooltip') ? element.classList.contains('react-tooltip__show') : !element.className.includes('hide'),
	);
	return open?.textContent.replace(/\s+/g, ' ').trim() || null;
};

/** Hovers one item — or one point on the chart canvas — and reads back whatever tooltip opens. */
const hoverText = async (page, hover, argument) => {
	await page.mouse.move(0, 0);
	await page.waitForTimeout(120);
	const box = await page.evaluate(hover, argument);
	if (!box) return 'no anchor';
	await page.mouse.move(box.x, box.y);
	await page.waitForTimeout(80);
	await page.mouse.move(box.x + 1, box.y);
	let text = null;
	for (let attempt = 0; attempt < 12 && text === null; attempt++) {
		await page.waitForTimeout(120);
		text = await page.evaluate(OPEN_TOOLTIP);
	}
	await page.mouse.move(0, 0);
	return text ?? 'no tooltip';
};

// The nth item the pointer can actually reach, one row at a time so the samples land on different
// kinds of row. The sticky row label overlays the start of every track, so a point inside an item's
// box is not necessarily a point on the item — `elementFromPoint` is what settles that.
const REACHABLE_ITEM = index => {
	let seen = 0;
	for (const row of document.querySelectorAll('.rotation-pane .rotation-row')) {
		for (const item of row.querySelectorAll('.rotation-row-track > .rotation-item')) {
			const box = item.getBoundingClientRect();
			if (box.width < 2 || box.right > window.innerWidth || box.bottom > window.innerHeight) continue;
			const x = Math.round(box.left + box.width / 2);
			const y = Math.round(box.top + box.height / 2);
			if (!item.contains(document.elementFromPoint(x, y))) continue;
			if (seen++ === index) return { x, y };
			break;
		}
	}
	return null;
};

const ZOOM_BUTTON = () => {
	const button = document.querySelector('.rotation-corner .rotation-zoom-button');
	if (!button) return null;
	const box = button.getBoundingClientRect();
	return { x: Math.round(box.left + box.width / 2), y: Math.round(box.top + box.height / 2) };
};

const CHART_POINT = fraction => {
	const canvas = document.querySelector('.timeline-chart canvas');
	if (!canvas) return null;
	const box = canvas.getBoundingClientRect();
	return { x: Math.round(box.left + box.width * fraction), y: Math.round(box.top + box.height / 2) };
};

const openResultsTab = async page => {
	const tabId = await page.evaluate(() => window.simTabsProbe.ids().find(id => id && /detailed-results/.test(id)));
	if (!tabId) throw new Error('no detailed-results tab in the top-level strip');
	await page.evaluate(id => window.simTabsProbe.tabs().find(tab => window.simTabsProbe.idOf(tab) === id).click(), tabId);
	await page.waitForTimeout(1200);
};

const settingsBlob = async (browser, spec) => {
	const { page } = await openSpec(browser, PORTS.base, spec);
	const stored = await page.evaluate(suffix => {
		const key = Object.keys(localStorage).find(candidate => candidate.endsWith(suffix));
		return key ? { key, value: localStorage.getItem(key) } : null;
	}, SETTINGS_SUFFIX);
	await page.close();
	if (!stored) throw new Error(`no ${SETTINGS_SUFFIX} entry after loading ${spec}`);

	const settings = JSON.parse(stored.value);
	settings.settings = { ...settings.settings, fixedRngSeed: SEED, iterations: ITERATIONS };
	return { key: stored.key, value: JSON.stringify(settings) };
};

const zoom = async (page, selector, times) => {
	for (let index = 0; index < times; index++) {
		await page.evaluate(button => document.querySelectorAll('.rotation-corner .rotation-zoom-button')[button].click(), selector);
		await page.waitForTimeout(200);
	}
	return page.evaluate(() => {
		const pane = document.querySelector('.rotation-pane');
		return `pps=${getComputedStyle(pane).getPropertyValue('--pps').trim()} density=${document.querySelector('.rotation-scroller').dataset.density} items=${pane.querySelectorAll('.rotation-item').length}`;
	});
};

const collect = async (browser, port, spec, seeded) => {
	const { page, errors } = await openSpec(browser, port, spec);
	await page.addInitScript(({ key, value }) => localStorage.setItem(key, value), seeded);
	await page.reload({ waitUntil: 'load', timeout: 60000 });
	await page.waitForSelector('.sim-ui', { timeout: 60000 });
	await page.waitForTimeout(2500);

	await page.waitForSelector('.dps-action:not([disabled])', { timeout: 60000 });
	await page.click('.dps-action');
	await page.waitForFunction(() => document.querySelectorAll('.results-content .results-metric').length > 0, null, { timeout: 180000 });
	await openResultsTab(page);
	await page.evaluate(() => document.querySelector('.dr-toolbar .nav-tabs [role=tab][aria-controls=timelineTab]').click());
	await page.waitForFunction(() => document.querySelectorAll('.rotation-pane .rotation-row').length > 0, null, { timeout: 60000 });
	await page.waitForTimeout(1500);

	const rotation = await page.evaluate(READ_ROTATION);
	const itemTooltips = [];
	for (const index of [0, 1, 2]) itemTooltips.push(`${index} ${await hoverText(page, REACHABLE_ITEM, index)}`);
	// The four toolbar buttons are the only stable tooltip anchors in the pane — vanilla tippies them
	// from their aria-label, the port hands them to react-tooltip — and nothing else hovers them.
	const toolbarTooltip = await hoverText(page, ZOOM_BUTTON);

	// Zoom is the pane's own state machine: a ladder in, the same ladder back out, and the density
	// switch that drops icons and stack counts on the way.
	const zoomed = [`in ${await zoom(page, 1, 2)}`, `out ${await zoom(page, 0, 4)}`, `reset ${await zoom(page, 3, 1)}`];

	await page.evaluate(() => document.querySelector('.rotation-fab-toggle').click());
	await page.waitForTimeout(400);
	const fabOpen = await page.evaluate(READ_FAB);
	await page.evaluate(() => document.querySelector('.rotation-fab-chip').click());
	await page.waitForTimeout(400);
	const fabToggled = [...(await page.evaluate(READ_FAB)), `rows=${await page.evaluate(() => document.querySelectorAll('.rotation-pane .rotation-row').length)}`];
	await page.evaluate(() => document.querySelector('.rotation-fab-show-all').click());
	await page.waitForTimeout(400);
	const fabRestored = [`rows=${await page.evaluate(() => document.querySelectorAll('.rotation-pane .rotation-row').length)}`, ...(await page.evaluate(READ_FAB))];

	await page.evaluate(() => document.querySelector('#timeline-chart-view-dps').click());
	await page.waitForTimeout(1500);
	const chart = await page.evaluate(READ_CHART);
	const chartTooltips = [];
	for (const fraction of [0.25, 0.5, 0.75]) {
		chartTooltips.push(`${fraction} ${await hoverText(page, CHART_POINT, fraction)}`);
	}

	// A second result over a chart that is already drawn: the port destroys the chart and builds a new
	// one on the same canvas from the same options object, which nothing else in the gate set reaches
	// because every other swap happens with the rotation showing.
	const beforeRebuild = await page.textContent('.results-sim-dps .topline-result-avg');
	await page.click('.detailed-results-1-iteration-button');
	await page
		.waitForFunction(previous => document.querySelector('.results-sim-dps .topline-result-avg')?.textContent !== previous, beforeRebuild, { timeout: 120000 })
		.catch(() => {});
	await page.waitForTimeout(2000);
	const rebuilt = [
		...(await page.evaluate(READ_CHART)),
		`tooltip ${await hoverText(page, CHART_POINT, 0.5)}`,
		`rows=${await page.evaluate(() => document.querySelectorAll('.rotation-pane .rotation-row').length)}`,
	];

	await page.close();
	return { rotation, itemTooltips, toolbarTooltip, zoomed, fabOpen, fabToggled, fabRestored, chart, chartTooltips, rebuilt, errors };
};

const diff = (label, base, react, problems) => {
	for (let index = 0; index < Math.max(base.length, react.length); index++) {
		if (base[index] !== react[index]) problems.push(`${label} line ${index}\n      base : ${base[index]}\n      react: ${react[index]}`);
	}
};

const browser = await launch();
let failures = 0;
try {
	for (const spec of specs()) {
		const seeded = await settingsBlob(browser, spec);
		const sides = {};
		for (const [side, port] of Object.entries(PORTS)) sides[side] = await collect(browser, port, spec, seeded);

		const problems = [];
		for (const part of ['rotation', 'zoomed', 'fabOpen', 'fabToggled', 'fabRestored', 'chart', 'chartTooltips', 'rebuilt', 'itemTooltips']) {
			diff(part, sides.base[part], sides.react[part], problems);
		}
		diff('toolbar tooltip', [sides.base.toolbarTooltip], [sides.react.toolbarTooltip], problems);
		// A console error on the port that the baseline does not also raise is a failure in its own right.
		if (sides.react.errors.length > sides.base.errors.length) problems.push(`errors base=${sides.base.errors.length} react=${sides.react.errors.length}`);

		const ok = problems.length === 0;
		if (!ok) failures++;
		console.log(`${ok ? 'PASS' : 'FAIL'}  ${spec.padEnd(20)} rows=${sides.react.rotation.length - 3} zoom=${sides.react.zoomed.length} chart=${sides.react.chart.length}`);
		// An agreeing pair of 'no tooltip's would also pass, so VERBOSE prints what the two sides read.
		if (process.env.VERBOSE) {
			for (const [side, read] of Object.entries(sides)) {
				read.itemTooltips.forEach(line => console.log(`    ${side} item: ${line}`));
				console.log(`    ${side} toolbar: ${read.toolbarTooltip}`);
				read.rebuilt.forEach(line => console.log(`    ${side} rebuilt: ${line}`));
			}
		}
		problems.forEach(problem => console.log('    ! ' + problem));
		sides.react.errors.slice(0, 3).forEach(error => console.log('    error: ' + error.slice(0, 140)));
	}
} finally {
	await browser.close();
}

console.log(failures ? `\n${failures} spec(s) differ` : '\nthe rotation, its zoom, its drawer, its tooltips and the chart all match the baseline');
process.exit(failures ? 1 : 0);

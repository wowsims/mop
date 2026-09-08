// The topline metric row, which no other gate can see: it exists only after a sim has run, and
// `results-tabs.mjs` cuts its serialisation at `PANE_DEPTH` — one level above the cells.
//
// One model feeds two renderers (`features/results/model/topline_metrics.ts`): the three
// detailed-results panes draw it as a one-row table, the sidebar draws it as a stacked list. The
// React port replaced the table renderer and left the list renderer vanilla, so this compares
// *both* across the two ports — the table because it changed, the list because it must not have.
//
// Values are compared digit for digit, which is normally unsound across ports because each build
// runs its own unseeded iteration. So the run is seeded: the base build's own autosaved settings
// blob is read back out of localStorage, `fixedRngSeed` and `iterations` are patched into it, and
// the same JSON is planted on both ports before load. Identical settings plus a fixed seed means
// identical numbers, and any difference left is the renderer's.
//
// Tooltips are read by hovering rather than by selector, because the two ports do not agree on the
// markup: tippy appends `[data-tippy-root]` to the body, react-tooltip renders `.sim-tooltip` and
// nothing at all while closed. Hovering asks the only question that matters — does this metric
// carry a tooltip, and what does it say.
import { launch, openSpec, PORTS } from './browser.mjs';

const SPECS = ['warrior/arms', 'warrior/protection', 'mage/fire'];
const PANES = ['#damageTab', '#healingTab', '#damageTakenTab'];
const SEED = '1337';
const ITERATIONS = 100;
const SETTINGS_SUFFIX = '__currentSettings__';

const specs = () => (process.argv[2] ? process.argv[2].split(',') : SPECS);

const READ = panes => {
	const cls = el => (el.getAttribute('class') || '').trim().split(/\s+/).filter(Boolean).sort().join('.');
	const text = el => (el ? el.textContent.replace(/\s+/g, ' ').trim() : null);

	const topline = pane => {
		const root = document.querySelector(`${pane} .topline-results-root`);
		if (!root) return `NO ${pane} .topline-results-root`;
		const headers = [...root.querySelectorAll('thead th')];
		const cells = [...root.querySelectorAll('tbody td')];
		// Both stylesheets moved out of the global cascade into co-located component files, so the
		// rules they carry are read back rather than assumed: table-layout and the padding are the
		// `.topline-results-root` block, the font size is the `.results-sim` block it used to import.
		const style = (el, property) => (el ? getComputedStyle(el)[property] : 'MISSING');
		return [
			`root ${cls(root)} pad=${style(root, 'paddingBottom')}`,
			`table ${cls(root.querySelector('table'))} layout=${style(root.querySelector('table'), 'tableLayout')} avg-size=${style(
				root.querySelector('.topline-result-avg'),
				'fontSize',
			)}`,
			...headers.map((header, index) => {
				const cell = cells[index];
				return [
					`${index} label=${text(header)}`,
					`th=${cls(header)}`,
					`td=${cell ? cls(cell) : 'MISSING'}`,
					`avg=${text(cell?.querySelector('.topline-result-avg'))}`,
					`stdev=${text(cell?.querySelector('.topline-result-stdev'))}`,
					`ref=${!!cell?.querySelector('.results-reference.hide > .results-reference-diff')}`,
				].join(' ');
			}),
		];
	};

	const sidebar = [...document.querySelectorAll('.results-content .results-metric')].map(
		(metric, index) =>
			`${index} ${cls(metric)} avg=${text(metric.querySelector('.topline-result-avg'))} stdev=${text(
				metric.querySelector('.topline-result-stdev'),
			)} ref=${!!metric.querySelector('.results-reference.hide > .results-reference-diff')}`,
	);

	const histogram = document.querySelector('#damageTab .dps-histogram-root');
	const chart = histogram
		? [
				`root ${cls(histogram)} h=${getComputedStyle(histogram).height} w=${getComputedStyle(histogram).width} mt=${
					getComputedStyle(histogram).marginTop
				}`,
				`canvas ${histogram.querySelector('canvas') ? 'present' : 'MISSING'}`,
			]
		: ['NO #damageTab .dps-histogram-root'];

	return { panes: Object.fromEntries(panes.map(pane => [pane, topline(pane)])), sidebar, chart };
};

const OPEN_TOOLTIP = () => {
	const el = document.querySelector('[data-tippy-root] .tippy-content') || document.querySelector('.sim-tooltip[role=tooltip]');
	if (!el) return null;
	return el.textContent.replace(/\s+/g, ' ').trim();
};

/**
 * Hovers each anchor in turn, parking the pointer off it in between so the previous tooltip closes.
 * A metric whose category is switched off is `display:none` and cannot be hovered on either port,
 * so it is recorded as hidden rather than skipped — losing one is still a diff.
 */
const tooltips = async (page, selector) => {
	const handles = await page.$$(selector);
	const out = [];
	for (const [index, handle] of handles.entries()) {
		if (!(await handle.isVisible())) {
			out.push(`${index} hidden`);
			continue;
		}
		await page.mouse.move(0, 0);
		await page.waitForTimeout(150);
		await handle.hover();
		let content = null;
		// react-tooltip mounts on the transition rather than on the event, so this polls instead of sleeping.
		for (let attempt = 0; attempt < 12 && content === null; attempt++) {
			await page.waitForTimeout(150);
			content = await page.evaluate(OPEN_TOOLTIP);
		}
		out.push(`${index} ${content}`);
	}
	await page.mouse.move(0, 0);
	return out;
};

const openResultsTab = async page => {
	const tabId = await page.evaluate(() => window.simTabsProbe.ids().find(id => id && /detailed-results/.test(id)));
	if (!tabId) throw new Error('no detailed-results tab in the top-level strip');
	await page.evaluate(
		id =>
			window.simTabsProbe
				.tabs()
				.find(tab => window.simTabsProbe.idOf(tab) === id)
				.click(),
		tabId,
	);
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

const collect = async (browser, port, spec, seeded) => {
	const { page, errors } = await openSpec(browser, port, spec);
	// An init script, not an evaluate: the first load's own debounced autosave flushes on `pagehide`,
	// which would overwrite a planted blob after the reload had already been asked for.
	await page.addInitScript(({ key, value }) => localStorage.setItem(key, value), seeded);
	await page.reload({ waitUntil: 'load', timeout: 60000 });
	await page.waitForSelector('.sim-ui', { timeout: 60000 });
	await page.waitForTimeout(2500);

	const loadedSeed = await page.evaluate(key => JSON.parse(localStorage.getItem(key) ?? '{}').settings?.fixedRngSeed, seeded.key);
	if (String(loadedSeed) !== SEED) throw new Error(`${port} loaded seed ${loadedSeed}, not ${SEED} — the run would not be comparable`);

	await page.waitForSelector('.dps-action:not([disabled])', { timeout: 60000 });
	await page.click('.dps-action');
	await page.waitForFunction(() => document.querySelectorAll('.results-content .results-metric').length > 0, null, { timeout: 180000 });
	await openResultsTab(page);
	await page.waitForFunction(() => !document.querySelector('.dr-no-results'), null, { timeout: 60000 });
	await page.waitForTimeout(500);

	const dom = await page.evaluate(READ, PANES);
	const paneTooltips = await tooltips(page, '#damageTab .topline-results-root thead th');
	const sidebarTooltips = await tooltips(page, '.results-content .results-metric');
	await page.close();
	return { dom, paneTooltips, sidebarTooltips, errors };
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
		for (const pane of PANES) diff(pane, sides.base.dom.panes[pane], sides.react.dom.panes[pane], problems);
		diff('sidebar', sides.base.dom.sidebar, sides.react.dom.sidebar, problems);
		diff('dps-histogram', sides.base.dom.chart, sides.react.dom.chart, problems);
		diff('damage-pane tooltip', sides.base.paneTooltips, sides.react.paneTooltips, problems);
		diff('sidebar tooltip', sides.base.sidebarTooltips, sides.react.sidebarTooltips, problems);

		// The three panes render one model, so they must agree with each other as well as with the baseline.
		const [first, ...rest] = PANES.map(pane => sides.react.dom.panes[pane]);
		rest.forEach((pane, index) => diff(`${PANES[index + 1]} vs ${PANES[0]}`, first, pane, problems));

		const ok = problems.length === 0;
		if (!ok) failures++;
		console.log(
			`${ok ? 'PASS' : 'FAIL'}  ${spec.padEnd(22)} metrics=${sides.react.dom.panes[PANES[0]].length - 2} sidebar=${sides.react.dom.sidebar.length} tooltips=${
				sides.react.paneTooltips.length
			}/${sides.react.sidebarTooltips.length}`,
		);
		problems.forEach(problem => console.log('    ! ' + problem));
		sides.react.errors.slice(0, 3).forEach(error => console.log('    error: ' + error.slice(0, 140)));
	}
} finally {
	await browser.close();
}

console.log(failures ? `\n${failures} spec(s) differ` : '\nthe topline row and the sidebar list match the baseline, metric for metric');
process.exit(failures ? 1 : 0);

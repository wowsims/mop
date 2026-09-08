// The log pane, which no other gate opens. `parity.mjs` and `panes-parity.mjs` see it at load, where
// it holds no rows at all; `results-tabs.mjs` runs a sim and opens the tab but cuts its serialisation
// at `PANE_DEPTH`, one level above the list. Nothing anywhere scrolls it, searches it, or opens its
// filter drawer.
//
// So this runs a seeded single iteration on both builds and compares, in order: the lines rendered at
// rest, the same lines after a deep scroll (which is what proves the window moves rather than the
// whole log being in the DOM), the stripe attributes at both ends of the window, a free-text search
// that narrows the list, the filter drawer opening and where its menu lands, an outcome filter
// applied through that menu, and clearing it again.
//
// Seeded because the two builds otherwise run their own unseeded iteration and the logs are different
// text. The base build's own autosaved settings blob is read back out of localStorage, `fixedRngSeed`
// is patched into it, and the same JSON is planted on both ports before load — the recipe
// `topline-metrics.mjs` established.
//
// The list DOM is deliberately **not** compared shape for shape: `@tanstack/react-virtual` positions
// rows with a transform where the vanilla list uses spacers, and the two window different numbers of
// rows around the same viewport. What has to match is the *content* — which lines, in which order,
// with which timestamps — and that is what is compared.
import { launch, openSpec, PORTS } from './browser.mjs';

const SPECS = ['warrior/arms'];
const SEED = '1337';
const SETTINGS_SUFFIX = '__currentSettings__';
// Deep enough that the first window is long gone: ~120 rows at any row height either build measures.
const SCROLL_BY = 4000;
const COMPARE_ROWS = 12;

const specs = () => (process.argv[2] ? process.argv[2].split(',') : SPECS);

/**
 * The lines the reader can actually see, top-down. Sorted by position rather than taken in document
 * order, because a React row sits inside a transformed wrapper; and cut at the sticky header's bottom
 * edge, because the *rendered* window starts above it and the two builds keep a different number of
 * overscan rows up there. What both builds owe is the same first visible line, not the same overscan.
 */
const ROWS = () => {
	const top = document.querySelector('.log-runner-sticky')?.getBoundingClientRect().bottom ?? 0;
	return [...document.querySelectorAll('.log-runner-logs .log-runner-row')]
		.map(row => ({ row, box: row.getBoundingClientRect() }))
		.filter(entry => entry.box.top >= top - 1)
		.sort((a, b) => a.box.top - b.box.top)
		.map(({ row }) => {
			const time = row.querySelector('.log-timestamp')?.textContent ?? '';
			const event = (row.querySelector('.log-event')?.textContent ?? '').replace(/\s+/g, ' ').trim();
			return `${time} | ${event}`;
		});
};

const STATE = () => {
	const list = document.querySelector('.log-runner-list');
	const logs = document.querySelector('.log-runner-logs');
	const scroller = document.querySelector('.sim-ui');
	const row = document.querySelector('.log-runner-row');
	const rowHeight = row ? Math.round(row.getBoundingClientRect().height * 2) / 2 : 0;
	const contentHeight = logs ? Math.round(logs.getBoundingClientRect().height) : 0;
	return {
		// Every build reserves the full height of the log so the scrollbar is honest; the row count it
		// implies is the one number that says both builds hold the same list.
		lines: rowHeight ? Math.round(contentHeight / rowHeight) : 0,
		rowHeight,
		rendered: document.querySelectorAll('.log-runner-row').length,
		listWidth: list?.style.getPropertyValue('--log-runner-list-width') || 'unset',
		scrollTop: Math.round(scroller?.scrollTop ?? -1),
		fab: document.querySelector('.log-floating-action-bar-root')?.className ?? 'MISSING',
	};
};

/** The stripe attribute at both ends of the window, and whether it follows the absolute index. */
const STRIPES = () => {
	const rows = [...document.querySelectorAll('.log-runner-logs [data-index]')];
	if (!rows.length) return 'no data-index (vanilla list: stripes are :nth-child there)';
	const indexes = rows.map(row => Number(row.getAttribute('data-index'))).sort((a, b) => a - b);
	const wrong = rows.filter(row => row.getAttribute('data-stripe') !== (Number(row.getAttribute('data-index')) % 2 === 0 ? 'even' : 'odd'));
	return `first=${indexes[0]} last=${indexes[indexes.length - 1]} mismatched=${wrong.length}`;
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
	settings.settings = { ...settings.settings, fixedRngSeed: SEED };
	return { key: stored.key, value: JSON.stringify(settings) };
};

const search = async (page, text) => {
	await page.fill('.log-search-input', text);
	// The box debounces at 150 ms on both builds.
	await page.waitForTimeout(500);
};

const collect = async (browser, port, spec, seeded) => {
	const { page, errors } = await openSpec(browser, port, spec);
	await page.addInitScript(({ key, value }) => localStorage.setItem(key, value), seeded);
	await page.reload({ waitUntil: 'load', timeout: 60000 });
	await page.waitForSelector('.sim-ui', { timeout: 60000 });
	await page.waitForTimeout(2500);

	const loadedSeed = await page.evaluate(key => JSON.parse(localStorage.getItem(key) ?? '{}').settings?.fixedRngSeed, seeded.key);
	if (String(loadedSeed) !== SEED) throw new Error(`${port} loaded seed ${loadedSeed}, not ${SEED} — the logs would not be comparable`);

	await openResultsTab(page);
	await page.waitForSelector('.detailed-results-1-iteration-button:not([disabled])', { timeout: 60000 });
	await page.click('.detailed-results-1-iteration-button');
	await page.waitForFunction(() => !document.querySelector('.dr-no-results'), null, { timeout: 120000 });
	await page.waitForTimeout(500);
	await page.evaluate(() => document.querySelector('.dr-toolbar .nav-tabs [role=tab][aria-controls=logTab]').click());
	await page.waitForFunction(() => getComputedStyle(document.getElementById('logTab')).opacity === '1', null, { timeout: 10000 });
	await page.waitForTimeout(800);

	const out = {};
	out.restState = await page.evaluate(STATE);
	out.restRows = (await page.evaluate(ROWS)).slice(0, COMPARE_ROWS);
	out.restStripes = await page.evaluate(STRIPES);

	// The scroller is `.sim-ui`, the one element above the pane with `overflow-y: auto`; the log
	// shares it with the whole tab rather than scrolling itself.
	await page.evaluate(by => document.querySelector('.sim-ui').scrollBy({ top: by }), SCROLL_BY);
	await page.waitForTimeout(600);
	out.deepState = await page.evaluate(STATE);
	out.deepRows = (await page.evaluate(ROWS)).slice(0, COMPARE_ROWS);
	out.deepStripes = await page.evaluate(STRIPES);
	await page.evaluate(() => document.querySelector('.sim-ui').scrollTo({ top: 0 }));
	await page.waitForTimeout(400);

	await search(page, 'Mortal Strike');
	out.searchState = await page.evaluate(STATE);
	out.searchRows = (await page.evaluate(ROWS)).slice(0, COMPARE_ROWS);
	await search(page, '');
	out.clearedSearch = (await page.evaluate(STATE)).lines;

	// The drawer, and where its menu lands: it is inside an overflow-clipped panel, so a menu that is
	// not taken out of flow is cut off at the panel's edge instead of opening past it.
	await page.click('.log-fab-toggle');
	await page.waitForTimeout(400);
	out.expanded = await page.evaluate(() => {
		const root = document.querySelector('.log-floating-action-bar-root');
		const panel = document.querySelector('.log-fab-panel-inner');
		return `expanded=${root?.dataset.expanded} inert=${panel?.hasAttribute('inert')} filters=${!!document.querySelector('.log-fab-filters .log-search-bar')}`;
	});

	await page.click('.log-search-add-field .dropdown-picker-button');
	await page.waitForTimeout(500);
	out.addFieldMenu = await page.evaluate(() => {
		const menu = document.querySelector('.log-search-add-field .dropdown-picker-list');
		if (!menu) return 'NO MENU';
		const trigger = document.querySelector('.log-search-add-field .dropdown-picker-button').getBoundingClientRect();
		const box = menu.getBoundingClientRect();
		const clip = document.querySelector('.log-fab-filters').getBoundingClientRect();
		const positioned = menu.closest('[style*="position"]') ?? menu;
		return [
			`items=${[...menu.querySelectorAll('li')].map(item => item.textContent.trim()).join(',')}`,
			`opensUpwards=${Math.round(box.bottom) <= Math.round(trigger.top) + 4}`,
			`escapesTheClip=${Math.round(box.top) < Math.round(clip.top) || Math.round(box.bottom) > Math.round(clip.bottom)}`,
			`inViewport=${box.top >= 0 && box.bottom <= window.innerHeight + 1}`,
			`strategy=${getComputedStyle(positioned).position}`,
		].join(' ');
	});

	// Outcome, because its values come from a fixed list rather than from the run. Vanilla puts a
	// `<button>` inside each `<li>` and hangs the handler on it; React's `<li>` *is* the menu item.
	await page.evaluate(() => {
		const item = [...document.querySelectorAll('.log-search-add-field .dropdown-picker-list li')].find(li => li.textContent.trim() === 'Outcome');
		(item.querySelector('button') ?? item).click();
	});
	await page.waitForTimeout(500);
	out.group = await page.evaluate(() => {
		const group = document.querySelector('.log-search-group');
		if (!group) return 'NO GROUP';
		return `field=${group.querySelector('.log-search-group-field')?.textContent} joins=${[...group.querySelectorAll('.log-search-group-join .btn')]
			.map(button => `${button.textContent}:${button.getAttribute('aria-pressed')}`)
			.join(',')}`;
	});

	await page.click('.log-search-group-items .dropdown-picker-button');
	await page.waitForTimeout(500);
	out.valueMenu = await page.evaluate(
		() =>
			[...document.querySelectorAll('.log-search-group-items .dropdown-picker-list li')]
				.map(item => item.textContent.trim())
				.join(',') || 'NO MENU',
	);
	await page.evaluate(() => {
		const item = [...document.querySelectorAll('.log-search-group-items .dropdown-picker-list li')].find(li => li.textContent.trim() === 'Crit');
		(item.querySelector('button') ?? item).click();
	});
	await page.waitForTimeout(700);
	out.filteredState = await page.evaluate(STATE);
	out.filteredRows = (await page.evaluate(ROWS)).slice(0, COMPARE_ROWS);
	out.chips = await page.evaluate(() => [...document.querySelectorAll('.log-search-chip .saved-data-set-name')].map(chip => chip.textContent).join(','));
	out.summary = await page.evaluate(
		() =>
			`${document.querySelector('.log-fab-summary')?.textContent} / ${document.querySelector('.log-fab-preview')?.textContent} / clearHidden=${document.querySelector('.log-fab-clear')?.hidden}`,
	);

	await page.click('.log-fab-clear');
	await page.waitForTimeout(700);
	out.clearedState = await page.evaluate(STATE);
	out.clearedRows = (await page.evaluate(ROWS)).slice(0, COMPARE_ROWS);
	out.clearedGroups = await page.evaluate(() => document.querySelectorAll('.log-search-group').length);

	await page.close();
	return { out, errors };
};

const lines = value => (Array.isArray(value) ? value : Object.entries(value).map(([key, item]) => `${key}=${item}`));

const compare = (label, base, react, problems, { only } = {}) => {
	const a = lines(base).filter(line => !only || only.some(key => line.startsWith(key)));
	const b = lines(react).filter(line => !only || only.some(key => line.startsWith(key)));
	for (let index = 0; index < Math.max(a.length, b.length); index++) {
		if (a[index] !== b[index]) problems.push(`${label}[${index}]\n      base : ${a[index]}\n      react: ${b[index]}`);
	}
};

const browser = await launch();
let failures = 0;
try {
	for (const spec of specs()) {
		const seeded = await settingsBlob(browser, spec);
		const base = await collect(browser, PORTS.base, spec, seeded);
		const react = await collect(browser, PORTS.react, spec, seeded);
		const problems = [];

		// `rendered` is deliberately excluded from every state comparison: the two lists window a
		// different number of rows around the same viewport, which is the one difference this port
		// means to have. `lines` — the count the reserved height implies — is compared to within one,
		// because vanilla's reserved height is two spacers sized at the rounded row height with the
		// real, fractional rows in between, and React's is the row count times that same rounded
		// height. Same list, and the derived count can land a row apart.
		const STATE_KEYS = ['rowHeight', 'listWidth', 'fab'];
		const countsMatch = (label, a, b) => {
			if (Math.abs(a.lines - b.lines) > 1) problems.push(`${label} lines\n      base : ${a.lines}\n      react: ${b.lines}`);
		};
		for (const [label, key] of [
			['at rest', 'restState'],
			['after a deep scroll', 'deepState'],
			['searching', 'searchState'],
			['outcome filter', 'filteredState'],
			['cleared', 'clearedState'],
		]) {
			countsMatch(label, base.out[key], react.out[key]);
		}
		compare('at rest', base.out.restState, react.out.restState, problems, { only: STATE_KEYS });
		compare('at rest rows', base.out.restRows, react.out.restRows, problems);
		compare('after a deep scroll', base.out.deepState, react.out.deepState, problems, { only: STATE_KEYS });
		compare('after a deep scroll rows', base.out.deepRows, react.out.deepRows, problems);
		compare('searching', base.out.searchState, react.out.searchState, problems, { only: STATE_KEYS });
		compare('searching rows', base.out.searchRows, react.out.searchRows, problems);
		compare('outcome filter', base.out.filteredState, react.out.filteredState, problems, { only: STATE_KEYS });
		compare('outcome filter rows', base.out.filteredRows, react.out.filteredRows, problems);
		compare('cleared', base.out.clearedState, react.out.clearedState, problems, { only: STATE_KEYS });
		compare('cleared rows', base.out.clearedRows, react.out.clearedRows, problems);
		if (Math.abs(base.out.clearedSearch - react.out.clearedSearch) > 1) {
			problems.push(`clearedSearch\n      base : ${base.out.clearedSearch}\n      react: ${react.out.clearedSearch}`);
		}
		for (const key of ['expanded', 'addFieldMenu', 'group', 'valueMenu', 'chips', 'summary', 'clearedGroups']) {
			if (String(base.out[key]) !== String(react.out[key])) {
				problems.push(`${key}\n      base : ${base.out[key]}\n      react: ${react.out[key]}`);
			}
		}

		// Assertions rather than comparisons: two builds that are both broken the same way would agree.
		const invariants = [
			[`the run produced a log`, base.out.restState.lines > 100 && react.out.restState.lines > 100],
			[`the list is windowed, not fully rendered`, react.out.restState.rendered > 0 && react.out.restState.rendered < react.out.restState.lines / 10],
			[`a deep scroll moved the window`, react.out.deepRows[0] !== react.out.restRows[0]],
			[`the search narrowed the list`, react.out.searchState.lines > 0 && react.out.searchState.lines < react.out.restState.lines],
			[`clearing the search restored it`, react.out.clearedSearch === react.out.restState.lines],
			[`the first visible line is the first line of the log`, /^00:00:000/.test(react.out.restRows[0] ?? '')],
			[`the outcome filter narrowed the list`, react.out.filteredState.lines > 0 && react.out.filteredState.lines < react.out.restState.lines],
			[`clearing the filter restored it`, react.out.clearedState.lines === react.out.restState.lines],
			[`the filtered list is all crits`, react.out.filteredRows.every(row => / Crit /.test(row))],
			[`stripes alternate at both ends of the window`, /mismatched=0/.test(react.out.deepStripes) && /mismatched=0/.test(react.out.restStripes)],
			[`the drawer menu opens upwards and escapes its clip`, /opensUpwards=true/.test(react.out.addFieldMenu) && /escapesTheClip=true/.test(react.out.addFieldMenu)],
			[`the drawer menu lands inside the viewport`, /inViewport=true/.test(react.out.addFieldMenu)],
		];
		for (const [what, ok] of invariants) if (!ok) problems.push(`invariant: ${what}`);

		const ok = problems.length === 0 && react.errors.length === 0;
		if (!ok) failures++;
		console.log(`${ok ? 'PASS' : 'FAIL'}  ${spec}`);
		console.log(`  lines=${react.out.restState.lines} rendered base=${base.out.restState.rendered} react=${react.out.restState.rendered}`);
		console.log(`  stripes at rest ${react.out.restStripes}`);
		console.log(`  stripes deep    ${react.out.deepStripes}`);
		console.log(`  drawer menu     ${react.out.addFieldMenu}`);
		console.log(`  base menu       ${base.out.addFieldMenu}`);
		console.log(`  search ${react.out.searchState.lines} / outcome ${react.out.filteredState.lines} / cleared ${react.out.clearedState.lines}`);
		problems.forEach(problem => console.log('    ! ' + problem));
		react.errors.slice(0, 3).forEach(error => console.log('    react error: ' + error.slice(0, 160)));
	}
} finally {
	await browser.close();
}

console.log(failures ? `\n${failures} spec(s) differ` : '\nthe log pane renders, scrolls, searches and filters identically');
process.exit(failures ? 1 : 0);

// The detailed-results target filter, which nothing else looks at: it only has options once a sim
// has run, no gate opens its dropdown, and `parity.mjs` sees the closed picker alone. This opens it.
//
// The filter decides which target's damage every metrics table counts, so the comparison is not the
// menu's markup — it is the numbers the menu produces. The run is therefore seeded the way
// `topline-metrics.mjs` seeds its own: the base build's autosaved settings blob is read back out of
// localStorage, `fixedRngSeed` and `iterations` are patched into it, the encounter is widened to
// three targets so the options and the per-target numbers actually differ, and the same JSON is
// planted on both ports with `addInitScript` — an `evaluate` loses the race against the first
// load's debounced autosave flushing on `pagehide`. Identical settings plus a fixed seed means
// identical numbers, so anything left is the port.
//
// The two stacks do not agree on the option element — vanilla builds `li > button.dropdown-item`,
// Base UI puts the role on the `<li>` itself — so an option is read as "the button inside the item,
// or the item", which is the only shape-independent way to ask what it says and what it draws.
import { launch, openSpec, PORTS } from './browser.mjs';

const SPECS = ['warrior/arms', 'mage/fire'];
const SEED = '1337';
const ITERATIONS = 100;
const TARGETS = 3;
const SETTINGS_SUFFIX = '__currentSettings__';
// The third option, so both "All Targets" above it and a target below it stay reachable.
const PICKED = 2;

const specs = () => (process.argv[2] ? process.argv[2].split(',') : SPECS);

const FILTER = '.dr-toolbar .target-filter-root';
const TRIGGER = `${FILTER} .dropdown-picker-button`;
const ITEM = `${FILTER} .dropdown-picker-item`;

const READ_TRIGGER = selector => {
	const button = document.querySelector(selector);
	if (!button) return [`NO ${selector}`];
	const text = button.textContent.replace(/\s+/g, ' ').trim();
	const colour = (button.getAttribute('class') || '').split(/\s+/).filter(name => name.startsWith('text-'));
	const image = button.querySelector('img');
	const glyph = button.querySelector('i');
	const box = button.getBoundingClientRect();
	return [
		`text=${text}`,
		`colour=${colour.join(',') || 'none'}`,
		`img=${image ? image.getAttribute('src') : 'none'}`,
		`glyph=${glyph ? (glyph.getAttribute('class') || '').trim() : 'none'}`,
		// The React root drops `input-root`, whose flex column used to size this button.
		`box=${Math.round(box.width)}x${Math.round(box.height)}`,
		`hidden=${button.closest('.target-filter-root').classList.contains('d-none')}`,
	];
};

const READ_OPTIONS = selector =>
	[...document.querySelectorAll(selector)].map((item, index) => {
		const option = item.querySelector('button.dropdown-item') || item;
		const colour = (option.getAttribute('class') || '').split(/\s+/).filter(name => name.startsWith('text-'));
		const image = option.querySelector('img');
		const glyph = option.querySelector('i');
		return [
			`${index}`,
			`text=${option.textContent.replace(/\s+/g, ' ').trim()}`,
			`colour=${colour.join(',') || 'none'}`,
			`img=${image ? image.getAttribute('src') : 'none'}`,
			`glyph=${glyph ? (glyph.getAttribute('class') || '').trim() : 'none'}`,
		].join(' ');
	});

// What the filter is for: the numbers every table shows for the current selection.
const READ_TABLES = () => {
	const text = el => (el ? el.textContent.replace(/\s+/g, ' ').trim() : 'MISSING');
	const topline = [...document.querySelectorAll('#damageTab .topline-results-root tbody td')].map(
		(cell, index) => `${index} ${text(cell.querySelector('.topline-result-avg'))} ± ${text(cell.querySelector('.topline-result-stdev'))}`,
	);
	const rows = [...document.querySelectorAll('#damageTab .damage-metrics-root tbody tr')]
		.slice(0, 8)
		.map((row, index) => `${index} ${[...row.querySelectorAll('td')].map(text).join(' | ')}`);
	const taken = [...document.querySelectorAll('#damageTakenTab .dtps-metrics-root tbody tr')]
		.slice(0, 8)
		.map((row, index) => `${index} ${[...row.querySelectorAll('td')].map(text).join(' | ')}`);
	return { topline, rows, taken };
};

const openMenu = async page => {
	await page.click(TRIGGER);
	await page.waitForFunction(selector => document.querySelectorAll(selector).length > 0, ITEM, { timeout: 10000 });
	await page.waitForTimeout(200);
};

const pick = async (page, index) => {
	await openMenu(page);
	const options = await page.$$(ITEM);
	if (!options[index]) throw new Error(`no option ${index} in the target filter`);
	// The vanilla option is a button inside the item; the Base UI one is the item.
	const clickable = (await options[index].$('button.dropdown-item')) ?? options[index];
	await clickable.click();
	await page.waitForTimeout(800);
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
	const targets = settings.encounter?.targets;
	if (!targets?.length) throw new Error(`${spec}'s autosaved encounter has no targets to widen`);
	settings.encounter.targets = Array.from({ length: TARGETS }, () => JSON.parse(JSON.stringify(targets[0])));
	return { key: stored.key, value: JSON.stringify(settings) };
};

const collect = async (browser, port, spec, seeded) => {
	const { page, errors } = await openSpec(browser, port, spec);
	await page.addInitScript(({ key, value }) => localStorage.setItem(key, value), seeded);
	await page.reload({ waitUntil: 'load', timeout: 60000 });
	await page.waitForSelector('.sim-ui', { timeout: 60000 });
	await page.waitForTimeout(2500);

	const loadedSeed = await page.evaluate(key => JSON.parse(localStorage.getItem(key) ?? '{}').settings?.fixedRngSeed, seeded.key);
	if (String(loadedSeed) !== SEED) throw new Error(`${port} loaded seed ${loadedSeed}, not ${SEED} — the run would not be comparable`);

	await openResultsTab(page);
	const beforeRun = await page.evaluate(READ_TRIGGER, TRIGGER);

	await page.waitForSelector('.dps-action:not([disabled])', { timeout: 60000 });
	await page.click('.dps-action');
	await page.waitForFunction(() => document.querySelectorAll('.results-content .results-metric').length > 0, null, { timeout: 180000 });
	await page.waitForFunction(() => !document.querySelector('.dr-no-results'), null, { timeout: 60000 });
	await page.waitForTimeout(600);

	const shown = await page.evaluate(READ_TRIGGER, TRIGGER);
	await openMenu(page);
	const options = await page.evaluate(READ_OPTIONS, ITEM);
	await page.keyboard.press('Escape');
	await page.waitForTimeout(300);
	const allTargets = await page.evaluate(READ_TABLES);

	await pick(page, PICKED);
	const picked = { trigger: await page.evaluate(READ_TRIGGER, TRIGGER), ...(await page.evaluate(READ_TABLES)) };

	await pick(page, 0);
	const cleared = { trigger: await page.evaluate(READ_TRIGGER, TRIGGER), ...(await page.evaluate(READ_TABLES)) };

	await page.close();
	return { beforeRun, shown, options, allTargets, picked, cleared, errors };
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
		diff('trigger before the run', sides.base.beforeRun, sides.react.beforeRun, problems);
		diff('trigger after the run', sides.base.shown, sides.react.shown, problems);
		diff('options', sides.base.options, sides.react.options, problems);
		for (const [state, label] of [
			['allTargets', 'all targets'],
			['picked', `target ${PICKED}`],
			['cleared', 'cleared'],
		]) {
			diff(`${label} topline`, sides.base[state].topline, sides.react[state].topline, problems);
			diff(`${label} damage rows`, sides.base[state].rows, sides.react[state].rows, problems);
			diff(`${label} damage-taken rows`, sides.base[state].taken, sides.react[state].taken, problems);
		}
		diff('trigger while a target is picked', sides.base.picked.trigger, sides.react.picked.trigger, problems);
		diff('trigger once cleared', sides.base.cleared.trigger, sides.react.cleared.trigger, problems);

		// Without these the comparison above would pass on two filters that both do nothing.
		for (const [side, read] of Object.entries(sides)) {
			if (read.options.length !== TARGETS + 1) problems.push(`${side}: ${read.options.length} options, expected ${TARGETS + 1}`);
			// The damage tables are the ones a DPS spec fills; damage-taken is empty for one and is
			// compared but not asserted on.
			if (read.picked.topline.join('\n') === read.allTargets.topline.join('\n')) {
				problems.push(`${side}: picking target ${PICKED} left the topline row unchanged, so the filter is not reaching the tables`);
			}
			if (read.picked.rows.join('\n') === read.allTargets.rows.join('\n')) {
				problems.push(`${side}: picking target ${PICKED} left the damage table unchanged`);
			}
			if (read.cleared.topline.join('\n') !== read.allTargets.topline.join('\n')) {
				problems.push(`${side}: clearing the filter did not restore the all-targets topline row`);
			}
			if (read.cleared.rows.join('\n') !== read.allTargets.rows.join('\n')) {
				problems.push(`${side}: clearing the filter did not restore the all-targets damage table`);
			}
			if (!read.beforeRun.includes('hidden=true')) problems.push(`${side}: the filter is visible before the first run`);
			if (!read.shown.includes('hidden=false')) problems.push(`${side}: the filter is still hidden after a run`);
		}

		const ok = problems.length === 0;
		if (!ok) failures++;
		console.log(`${ok ? 'PASS' : 'FAIL'}  ${spec.padEnd(16)} options=${sides.react.options.length} rows=${sides.react.allTargets.rows.length}`);
		console.log(`      options: ${sides.react.options.join('   ')}`);
		console.log(`      trigger: ${sides.react.picked.trigger.join(' ')}`);
		console.log(`      all targets: ${sides.react.allTargets.topline.join(' | ')}`);
		console.log(`      target ${PICKED}:   ${sides.react.picked.topline.join(' | ')}`);
		console.log(`      cleared:     ${sides.react.cleared.topline.join(' | ')}`);
		problems.forEach(problem => console.log('    ! ' + problem));
		sides.react.errors.slice(0, 3).forEach(error => console.log('    error: ' + error.slice(0, 140)));
	}
} finally {
	await browser.close();
}

console.log(failures ? `\n${failures} spec(s) differ` : '\nthe target filter offers, selects and clears the same targets on both builds, and the tables agree digit for digit');
process.exit(failures ? 1 : 0);

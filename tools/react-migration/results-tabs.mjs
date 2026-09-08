// The detailed-results sub-tab strip, which is the one region the React port takes off Bootstrap's
// tab plugin without a gate that can see it. `parity.mjs` and `panes-parity.mjs` both read the pane
// with no sim run and with the damage tab open, so the nine other panes are compared empty and the
// switch itself is never exercised; `tabs-a11y.mjs` and `tabs-behaviour.mjs` are scoped to
// `.sim-tabs`, the *top-level* strip, on purpose — the inner strips match `[role=tablist]` too and
// would double-count.
//
// So this runs a sim on both builds, clicks all ten sub-tabs in turn, and compares — per tab — the
// class list, computed display and settled opacity of every pane, the toolbar's classes and every
// button's active/selected/tabindex state, plus the *scaffolding* of the pane that opened.
//
// Scaffolding, not contents: the two builds run their own unseeded iteration, so a populated table
// or timeline differs by crit rolls rather than by markup — `results-tables.mjs` is what asserts the
// populated state, as invariants on one build at a time. The serialisation is therefore cut at
// `PANE_DEPTH`, which reaches each `.dr-row`, the metrics container inside it and the component root
// the island or table mounts as, and stops above the rows. A pane whose deferred component never
// built still shows up, because its root is the line that goes missing.
//
// The opacity read waits for the fade to settle rather than sampling it: Bootstrap adds `show` only
// after the pane's own 150 ms transition has already run (`_queueCallback`), so the baseline is
// ~305 ms from click to opaque where the React strip — `active` now, `show` next frame, the same
// transition — is ~155 ms. Same classes, same end state, half the latency.
//
// Keyboard is recorded rather than asserted: Bootstrap only instantiates `Tab` for a toggle that is
// active at `window load` or has since been clicked, so arrow keys on the baseline work from the
// damage tab and from nowhere else. The React strip owns one keydown handler on the `<ul>`, so it
// answers from every tab. The recorded lines make that delta visible instead of silent.
import { dropReplayState, launch, openSpec, overusedIntended, PORTS, SERIALIZE, specsFromArgv, unexpectedLines } from './browser.mjs';
import { INTENDED } from './intended.mjs';

const SETTLE = 300;
// Indents are two spaces per level, and the pane itself is level 0.
const PANE_DEPTH = 4;

const TAB_IDS = [
	'damageTab',
	'healingTab',
	'damageTakenTab',
	'buffsTab',
	'debuffsTab',
	'castsTab',
	'resourcesTab',
	'timelineTab',
	'replayTab',
	'logTab',
];

const STATE = () => {
	const cls = el => (el.getAttribute('class') || '').trim().split(/\s+/).filter(Boolean).sort().join('.');
	const root = document.querySelector('.detailed-results-manager-root');
	const drRoot = document.querySelector('.dr-root');
	const toolbar = document.querySelector('.dr-toolbar');
	const buttons = [...document.querySelectorAll('.dr-toolbar .nav-tabs [role=tab]')];
	return {
		root: root ? cls(root) : 'MISSING',
		drRoot: drRoot ? cls(drRoot) : 'MISSING',
		toolbar: toolbar ? cls(toolbar) : 'MISSING',
		items: buttons.map(button => `${cls(button.closest('li'))}|${cls(button)}|sel=${button.getAttribute('aria-selected')}|tab=${button.tabIndex}`),
		panes: [...document.querySelectorAll('.dr-root > .tab-content > [id]')].map(pane => {
			const style = getComputedStyle(pane);
			return `#${pane.id} ${cls(pane)} display=${style.display} opacity=${style.opacity} role=${pane.getAttribute('role')}`;
		}),
	};
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

const runOneIteration = async page => {
	await page.waitForSelector('.detailed-results-1-iteration-button:not([disabled])', { timeout: 60000 });
	await page.click('.detailed-results-1-iteration-button');
	await page.waitForFunction(() => !document.querySelector('.dr-no-results'), null, { timeout: 120000 });
	await page.waitForFunction(() => document.querySelectorAll('.damage-metrics-root tbody tr').length > 0, null, { timeout: 60000 });
	await page.waitForTimeout(500);
};

const clickSubTab = async (page, tabId) => {
	await page.evaluate(id => document.querySelector(`.dr-toolbar .nav-tabs [role=tab][aria-controls=${id}]`).click(), tabId);
	await page.waitForFunction(id => getComputedStyle(document.getElementById(id)).opacity === '1', tabId, { timeout: 5000 });
};

/** The pane's own scaffolding: everything down to a component root, nothing of what the component then filled it with. */
const scaffolding = dom =>
	dom
		.split('\n')
		.filter(line => line.length - line.trimStart().length <= PANE_DEPTH * 2)
		.join('\n');

// Focus the strip's first tab and press an arrow, then repeat from a tab the run has never opened.
const keyboard = async page => {
	const selected = () => page.evaluate(() => document.querySelector('.dr-toolbar .nav-tabs [aria-selected=true]')?.getAttribute('aria-controls') ?? null);
	const out = [];
	await page.evaluate(() => document.querySelector('.dr-toolbar .nav-tabs [role=tab][aria-controls=damageTab]').focus());
	await clickSubTab(page, 'damageTab');
	await page.waitForTimeout(SETTLE);
	await page.keyboard.press('ArrowRight');
	await page.waitForTimeout(SETTLE);
	out.push(`from damageTab ArrowRight -> ${await selected()}`);
	await page.evaluate(() => document.querySelector('.dr-toolbar .nav-tabs [role=tab][aria-controls=buffsTab]').focus());
	await page.keyboard.press('ArrowRight');
	await page.waitForTimeout(SETTLE);
	out.push(`focus buffsTab (never clicked) ArrowRight -> ${await selected()}`);
	return out;
};

const collect = async (browser, port, spec) => {
	const { page, errors } = await openSpec(browser, port, spec);
	await openResultsTab(page);
	await runOneIteration(page);
	const perTab = {};
	for (const tabId of TAB_IDS) {
		await clickSubTab(page, tabId);
		await page.waitForTimeout(SETTLE);
		perTab[tabId] = { state: await page.evaluate(STATE), pane: await page.evaluate(SERIALIZE, `#${tabId}`) };
	}
	const keys = await keyboard(page);
	await page.close();
	return { perTab, keys, errors };
};

const lines = state => [`root ${state.root}`, `dr-root ${state.drRoot}`, `toolbar ${state.toolbar}`, ...state.items, ...state.panes];

const browser = await launch();
let failures = 0;
try {
	for (const spec of specsFromArgv()) {
		const sides = {};
		for (const [side, port] of Object.entries(PORTS)) sides[side] = await collect(browser, port, spec);

		const problems = [];
		for (const tabId of TAB_IDS) {
			const base = lines(sides.base.perTab[tabId].state);
			const react = lines(sides.react.perTab[tabId].state);
			for (let index = 0; index < Math.max(base.length, react.length); index++) {
				if (base[index] !== react[index]) problems.push(`${tabId} state line ${index}\n      base : ${base[index]}\n      react: ${react[index]}`);
			}
			// See `dropReplayState`. A run has finished by the time the panes are read, so the half the
			// baseline is hiding here is the placeholder, and the port has none to drop.
			const baseReplay = dropReplayState(scaffolding(sides.base.perTab[tabId].pane), 'cr-empty');
			const reactReplay = dropReplayState(scaffolding(sides.react.perTab[tabId].pane), 'cr-empty');
			const expected = tabId === 'replayTab' ? 1 : 0;
			if (baseReplay.dropped !== expected || reactReplay.dropped !== 0) {
				problems.push(`${tabId}: base hid ${baseReplay.dropped} replay placeholders (expected ${expected}), react ${reactReplay.dropped} (expected 0)`);
			}
			const basePane = baseReplay.dom.split('\n');
			const reactPane = reactReplay.dom.split('\n');
			const tally = new Map();
			const unexpected = unexpectedLines(basePane, reactPane, INTENDED, tally);
			problems.push(...overusedIntended(INTENDED, tally).map(problem => `${tabId}: ${problem}`));
			if (unexpected.length || basePane.length !== reactPane.length) {
				const first = unexpected[0] ?? basePane.findIndex((line, index) => line !== reactPane[index]);
				problems.push(
					`${tabId} scaffolding: base ${basePane.length} elements, react ${reactPane.length}; first diff ${first}\n      base : ${basePane[first]}\n      react: ${reactPane[first]}`,
				);
			}
		}

		const ok = problems.length === 0;
		if (!ok) failures++;
		console.log(
			`${ok ? 'PASS' : 'FAIL'}  ${spec.padEnd(22)} ${TAB_IDS.map(id => `${id}=${scaffolding(sides.react.perTab[id].pane).split('\n').length}`).join(' ')}`,
		);
		problems.forEach(problem => console.log('    ! ' + problem));
		console.log('  keyboard base :', sides.base.keys.join('  '));
		console.log('  keyboard react:', sides.react.keys.join('  '));
		sides.react.errors.slice(0, 3).forEach(error => console.log('    error: ' + error.slice(0, 140)));
	}
} finally {
	await browser.close();
}

console.log(failures ? `\n${failures} spec(s) differ` : '\nevery detailed-results sub-tab matches the baseline');
process.exit(failures ? 1 : 0);

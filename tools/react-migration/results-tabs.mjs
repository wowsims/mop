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
// `PANE_DEPTH`, which reaches each result row, the metrics container inside it and the component root
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
import { dropHiddenSubtrees, dropReplayState, launch, openSpec, overusedIntended, PORTS, q, SERIALIZE, specsFromArgv, unexpectedLines } from './browser.mjs';
import { INTENDED } from './intended.mjs';

const SETTLE = 300;
// Indents are two spaces per level, and the pane itself is level 0.
const PANE_DEPTH = 4;

const DR_ROOT = q('dr-root');
const DR_TOOLBAR = q('dr-toolbar');
// Retired class hooks: filtered out of the literal class-list comparison below so the check still
// catches a real styling regression instead of flagging their own removal.
const DROPPED_HOOKS = new Set([
	'dr-root',
	'dr-toolbar',
	'dr-no-results',
	'sticky-toolbar-root',
	'stuck',
	'dr-tab-content',
	'damage-content',
	'healing-content',
	'damage-taken-content',
	'buffs-content',
	'debuffs-content',
	'casts-content',
	'resources-content',
	'timeline-content',
	'replay-content',
	'log-content',
	// A testid now (STATE()'s own `cls()` reads only the class attribute, unlike `SERIALIZE`, which
	// unions in `data-testid`), so it is filtered the same way as an unread hook.
	'detailed-results-manager-root',
	'detailed-results-death-iteration-button',
	'tabs-filler',
	'damage-metrics-tab',
	'healing-metrics-tab',
	'threat-metrics-tab',
	// Additive, not a hook: `dr-row` renamed to this co-located `ui-*` class, with `dr-row` kept as a
	// `data-testid` for readers. Base has no counterpart, so it is filtered the same way.
	'ui-dr-row',
]);

/** Strips the same retired tokens out of a `SERIALIZE` dump, so the scaffolding diff below does not
 * flag their own removal either. */
const stripDroppedHooks = text => [...DROPPED_HOOKS].reduce((acc, name) => acc.split(`.${name}`).join(''), text);

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

const STATE = ({ managerRootSel, drRootSel, toolbarSel, dropped }) => {
	const cls = el => (el.getAttribute('class') || '').trim().split(/\s+/).filter(name => name && !dropped.includes(name)).sort().join('.');
	const root = document.querySelector(managerRootSel);
	const drRoot = document.querySelector(drRootSel);
	const toolbar = document.querySelector(toolbarSel);
	const buttons = [...document.querySelectorAll(`${toolbarSel} [role=tab]`)];
	return {
		root: root ? cls(root) : 'MISSING',
		drRoot: drRoot ? cls(drRoot) : 'MISSING',
		toolbar: toolbar ? cls(toolbar) : 'MISSING',
		items: buttons.map(button => `${cls(button.closest('li'))}|${cls(button)}|sel=${button.getAttribute('aria-selected')}|tab=${button.tabIndex}`),
		panes: [...document.querySelectorAll(`${drRootSel} > .tab-content > [id]`)].map(pane => {
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
	await page.waitForSelector(`${q('detailed-results-1-iteration-button')}:not([disabled])`, { timeout: 60000 });
	await page.click(q('detailed-results-1-iteration-button'));
	await page.waitForFunction(() => !document.querySelector('[data-no-results]'), null, { timeout: 120000 });
	await page.waitForFunction(
		() => document.querySelectorAll(':is([data-testid="damage-metrics-root"], .damage-metrics-root) tbody tr').length > 0,
		null,
		{ timeout: 60000 },
	);
	await page.waitForTimeout(500);
};

// A metrics toggle off (`useDisplayMetrics`) drops damageTab/healingTab/damageTakenTab from the tree
// entirely rather than hiding them, so a spec's default settings can leave one of TAB_IDS absent on
// both builds. Returns false without clicking when that tab's button is not in the strip.
const clickSubTab = async (page, tabId) => {
	const clicked = await page.evaluate(
		({ id, toolbarSel }) => {
			const button = document.querySelector(`${toolbarSel} [role=tab][aria-controls=${id}]`);
			if (!button) return false;
			button.click();
			return true;
		},
		{ id: tabId, toolbarSel: DR_TOOLBAR },
	);
	if (clicked) await page.waitForFunction(id => getComputedStyle(document.getElementById(id)).opacity === '1', tabId, { timeout: 5000 });
	return clicked;
};

/** The pane's own scaffolding: everything down to a component root, nothing of what the component then filled it with. */
const scaffolding = dom =>
	dom
		.split('\n')
		.filter(line => line.length - line.trimStart().length <= PANE_DEPTH * 2)
		.join('\n');

// Focus the strip's first tab and press an arrow, then repeat from a tab the run has never opened.
const keyboard = async page => {
	const selected = () =>
		page.evaluate(toolbarSel => document.querySelector(`${toolbarSel} [aria-selected=true]`)?.getAttribute('aria-controls') ?? null, DR_TOOLBAR);
	const focusTab = tabId =>
		page.evaluate(({ toolbarSel, id }) => document.querySelector(`${toolbarSel} [role=tab][aria-controls=${id}]`).focus(), {
			toolbarSel: DR_TOOLBAR,
			id: tabId,
		});
	const out = [];
	await focusTab('damageTab');
	await clickSubTab(page, 'damageTab');
	await page.waitForTimeout(SETTLE);
	await page.keyboard.press('ArrowRight');
	await page.waitForTimeout(SETTLE);
	out.push(`from damageTab ArrowRight -> ${await selected()}`);
	await focusTab('buffsTab');
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
		const clicked = await clickSubTab(page, tabId);
		if (!clicked) {
			perTab[tabId] = null;
			continue;
		}
		await page.waitForTimeout(SETTLE);
		perTab[tabId] = {
			state: await page.evaluate(STATE, {
				managerRootSel: q('detailed-results-manager-root'),
				drRootSel: DR_ROOT,
				toolbarSel: DR_TOOLBAR,
				dropped: [...DROPPED_HOOKS],
			}),
			pane: await page.evaluate(SERIALIZE, `#${tabId}`),
		};
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
			const baseTab = sides.base.perTab[tabId];
			const reactTab = sides.react.perTab[tabId];
			if (!baseTab && !reactTab) continue;
			if (!baseTab || !reactTab) {
				problems.push(`${tabId}: present on ${baseTab ? 'base' : 'react'} only (a metrics toggle disagrees between the two builds)`);
				continue;
			}
			const base = lines(baseTab.state);
			const react = lines(reactTab.state);
			for (let index = 0; index < Math.max(base.length, react.length); index++) {
				if (base[index] !== react[index]) problems.push(`${tabId} state line ${index}\n      base : ${base[index]}\n      react: ${react[index]}`);
			}
			// See `dropReplayState`. `PORTS.base` is a React build too (not the retired vanilla stack), so
			// a finished run leaves no hidden placeholder behind on either side.
			const baseReplay = dropReplayState(scaffolding(stripDroppedHooks(baseTab.pane)), 'cr-empty');
			const reactReplay = dropReplayState(scaffolding(stripDroppedHooks(reactTab.pane)), 'cr-empty');
			if (baseReplay.dropped !== 0 || reactReplay.dropped !== 0) {
				problems.push(`${tabId}: base hid ${baseReplay.dropped} replay placeholders (expected 0), react ${reactReplay.dropped} (expected 0)`);
			}
			// Both sides, and after the replay drop so the placeholder is still there to be counted: see
			// `dropHiddenSubtrees`. The two builds hold different numbers of hidden metrics roots and
			// resource containers, and none of them is on screen on either.
			const baseVisible = dropHiddenSubtrees(baseReplay.dom, `${tabId}: base`);
			const reactVisible = dropHiddenSubtrees(reactReplay.dom, `${tabId}: react`);
			problems.push(...baseVisible.problems, ...reactVisible.problems);
			const basePane = baseVisible.dom.split('\n');
			const reactPane = reactVisible.dom.split('\n');
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
			`${ok ? 'PASS' : 'FAIL'}  ${spec.padEnd(22)} ${TAB_IDS.map(id => `${id}=${sides.react.perTab[id] ? scaffolding(sides.react.perTab[id].pane).split('\n').length : 'absent'}`).join(' ')}`,
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

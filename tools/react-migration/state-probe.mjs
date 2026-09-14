// Computed-style + geometry probe for panes tw-probe.mjs never opens: Detailed Results sub-tabs,
// an expanded metrics-table row, the Rotation tab's APL sub-panes + Auto rotation type, the Bulk
// tab's sub-tabs, the gear selector modal (items/gems/enchants), the settings encounter Advanced
// dialog, and the EP weights dialog.
//
// tw-probe.mjs only ever captures each top-level tab at rest (plus a scrolled "results-stuck"
// state) — it never opens a sub-pane, a dialog, or a modal. That gap is exactly how the log
// runner's row height regressed from 32.5px to 34px: a real `@utility` (`icon-sm`) got deleted as
// if it were a retired class hook, tw-probe's default-pane run stayed green, and only this probe
// (or a behaviour script) opens the log tab to see it. Run both — tw-probe for the shell and
// default panes, this one for everything a click or a sim run reveals.
//
// Reuses tw-probe.mjs's SNAP/normalise/diff scheme (copied — tw-probe.mjs is a standalone script,
// not a module, so nothing is importable from it) and browser.mjs's launch()/q() boilerplate.
//
// Usage:
//   REACT_PORT=3402 TW_PORT=3404 node tools/react-migration/state-probe.mjs
// Both ports must already be served (see README.md's PORT section); this script drives Playwright
// against them and never starts a server itself. No env var may point outside this worktree.
import { mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { launch, q } from './browser.mjs';

const OUT = process.env.OUT ?? path.join(tmpdir(), 'state-probe-out');
const PORTS = { react: Number(process.env.REACT_PORT ?? 3402), tw: Number(process.env.TW_PORT ?? 3404) };

const PROPS = [
	'display','position','top','right','bottom','left','float','clear',
	'width','height','min-width','min-height','max-width','max-height',
	'margin-top','margin-right','margin-bottom','margin-left',
	'padding-top','padding-right','padding-bottom','padding-left',
	'border-top-width','border-right-width','border-bottom-width','border-left-width',
	'border-top-style','border-top-color','border-left-color','border-radius',
	'overflow-x','overflow-y','visibility','opacity','pointer-events','cursor','z-index','order',
	'flex-grow','flex-shrink','flex-basis','flex-direction','flex-wrap','align-items','align-self','justify-content','gap',
	'grid-template-columns','grid-template-rows',
	'font-size','font-weight','font-variant-numeric','line-height','color','background-color',
	'text-align','text-overflow','white-space','text-transform','letter-spacing','vertical-align','user-select','filter','transform',
];

// Snapshots from a given root selector (falls back to document.body if not found), not the whole
// page — the point here is the visible pane in each state, not the static shell around it.
const SNAP = ({ props, root: rootSel }) => {
	const normalizeColor = value => {
		const m = value.match(/^color\(srgb\s+([\d.]+|none)\s+([\d.]+|none)\s+([\d.]+|none)(?:\s*\/\s*([\d.]+|none))?\)$/);
		if (!m) return value;
		const chan = v => Math.round((v === 'none' ? 0 : Number(v)) * 255 + 1e-4);
		const [r, g, b] = [chan(m[1]), chan(m[2]), chan(m[3])];
		if (m[4] === undefined) return `rgb(${r}, ${g}, ${b})`;
		const a = m[4] === 'none' ? 0 : Number(m[4]);
		if (a === 1) return `rgb(${r}, ${g}, ${b})`;
		return `rgba(${r}, ${g}, ${b}, ${String(Math.round(a * 1000) / 1000)})`;
	};
	const root = document.querySelector(rootSel) || document.body;
	const out = [];
	const walk = (el, path) => {
		const cs = getComputedStyle(el);
		const r = el.getBoundingClientRect();
		const vals = props.map(p => normalizeColor(cs.getPropertyValue(p))).join('|');
		out.push(`${path} ${el.tagName.toLowerCase()} [${Math.round(r.x)},${Math.round(r.y)},${Math.round(r.width)},${Math.round(r.height)}] ${vals}`);
		let i = 0;
		for (const c of el.children) walk(c, `${path}/${i++}`);
	};
	walk(root, '');
	return out;
};

// Same three normalisations tw-probe.mjs applies, so known-equivalent renders don't show up here either.
const normalise = line =>
	line
		.replace(/\b(700px|3\.35544e\+07px|9999px)\b/g, 'PILL')
		.replace(/rgba\(224, 163, 53, 0\)/g, 'rgba(0, 0, 0, 0)')
		.replace(/\|0px\|0px\|0px\|0px\|(none|solid)\|/g, '|0px|0px|0px|0px|NOBORDER|');

const diff = (a, b) => {
	const out = [];
	const n = Math.max(a.length, b.length);
	for (let i = 0; i < n; i++) {
		const x = a[i] === undefined ? '<missing>' : normalise(a[i]);
		const y = b[i] === undefined ? '<missing>' : normalise(b[i]);
		if (x !== y) out.push(`  a: ${x}\n  b: ${y}`);
		if (out.length > 60) {
			out.push(`  ... truncated, ${n - i} lines left`);
			break;
		}
	}
	return out;
};

const settle = (page, ms) => page.waitForTimeout(ms);

const openTopTab = async (page, name) => {
	const ok = await page.evaluate(n => {
		const tab = [...document.querySelectorAll('[role="tab"]')].find(
			el => el.offsetParent !== null && (el.classList.contains(n) || el.getAttribute('aria-controls') === n),
		);
		if (!tab) return false;
		tab.click();
		return true;
	}, name);
	if (ok) await settle(page, 700);
	return ok;
};

const BULK_TABS = q('bulk-tab-tabs');
const DR_TOOLBAR = q('dr-toolbar');
const DR_SUBTABS = ['damageTab', 'healingTab', 'damageTakenTab', 'buffsTab', 'debuffsTab', 'castsTab', 'resourcesTab', 'timelineTab', 'replayTab', 'logTab'];
const clickDrSubTab = async (page, tabId) => {
	const clicked = await page.evaluate(
		({ id, toolbarSel }) => {
			const button = document.querySelector(`${toolbarSel} [role=tab][aria-controls=${id}]`);
			if (!button) return false;
			button.click();
			return true;
		},
		{ id: tabId, toolbarSel: DR_TOOLBAR },
	);
	if (clicked) {
		await page
			.waitForFunction(id => getComputedStyle(document.getElementById(id)).opacity === '1', tabId, { timeout: 5000 })
			.catch(() => {});
	}
	return clicked;
};

// Pins the RNG seed before any sim run so both ports roll identical crits/hits — otherwise the
// data-driven tables (row widths, text) diverge on unseeded iteration noise that has nothing to do
// with styling, exactly the trap results-tabs.mjs calls out for its own scaffolding-only diff.
const SEED = '918273645';
const setFixedSeed = async page => {
	const btn = `:is(${q('sim-toolbar')}) button:is(${q('sim-options')})`;
	if (!(await page.locator(btn).count())) return;
	await page.click(btn);
	const input = page.locator(`${q('fixed-rng-seed')} input`).first();
	if (await input.count()) {
		await input.fill(SEED);
		await input.press('Enter');
		await settle(page, 200);
	}
	await page.keyboard.press('Escape').catch(() => {});
	await settle(page, 300);
};

const runSim = async page => {
	const ok = await openTopTab(page, 'detailed-results-tab-tab');
	if (!ok) return false;
	await page.waitForSelector(`${q('detailed-results-1-iteration-button')}:not([disabled])`, { timeout: 60000 });
	await page.click(q('detailed-results-1-iteration-button'));
	await page.waitForFunction(() => !document.querySelector('[data-no-results]'), null, { timeout: 120000 }).catch(() => {});
	await page
		.waitForFunction(
			() => document.querySelectorAll(':is([data-testid="damage-metrics-root"], .damage-metrics-root) tbody tr').length > 0,
			null,
			{ timeout: 60000 },
		)
		.catch(() => {});
	await settle(page, 700);
	return true;
};

const snap = (page, rootSel) => page.evaluate(SNAP, { props: PROPS, root: rootSel });

// Collects every named state for one (spec, width) on one port. Returns { stateName: lines[] }.
const captureStates = async (browser, port, spec, width) => {
	const page = await browser.newPage();
	await page.addInitScript(() => {
		window.alert = () => {};
	});
	await page.setViewportSize({ width, height: 1000 });
	await page.goto(`http://localhost:${port}/mop/${spec}/`, { waitUntil: 'load', timeout: 60000 });
	await page.waitForSelector(q('sim-ui'), { timeout: 60000 });
	await settle(page, 2500);

	const states = {};

	await setFixedSeed(page);

	// --- Detailed Results sub-tabs, then one expanded metrics-table row ---
	if (await runSim(page)) {
		for (const tabId of DR_SUBTABS) {
			const clicked = await clickDrSubTab(page, tabId);
			if (!clicked) continue;
			await settle(page, 400);
			states[`results:${tabId}`] = await snap(page, `#${tabId}`);
		}
		// Return to the damage tab and expand its biggest parent row, if any.
		if (await clickDrSubTab(page, 'damageTab')) {
			await settle(page, 400);
			const expanded = await page.evaluate(() => {
				const rows = [...document.querySelectorAll('#damageTab tbody tr')];
				const parents = rows.filter(r => r.hasAttribute('data-parent'));
				if (!parents.length) return false;
				parents[0].click();
				return true;
			});
			if (expanded) {
				await settle(page, 400);
				states['results:damageTab-row-expanded'] = await snap(page, '#damageTab');
			}
		}
	}

	// --- Rotation tab: APL sub-panes, then Auto rotation type ---
	if (await openTopTab(page, 'rotation-tab')) {
		await page.waitForSelector('#apl-priority-list', { state: 'visible', timeout: 15000 }).catch(() => {});
		await settle(page, 400);
		const NAVBAR = q('apl-rotation-navbar');
		for (const paneId of ['apl-priority-list', 'apl-action-groups', 'apl-variables']) {
			const has = (await page.locator(`#${paneId}`).count()) > 0;
			if (!has) continue;
			if (paneId !== 'apl-priority-list') {
				await page.evaluate(({ navbar, id }) => document.querySelector(`${navbar} [aria-controls="${id}"]`)?.click(), { navbar: NAVBAR, id: paneId });
				await settle(page, 400);
			}
			states[`rotation:${paneId}`] = await snap(page, `#${paneId}`);
		}
		// Switch rotation type to Auto via the navbar dropdown.
		const opened = await page.evaluate(navbar => {
			const picker = document.querySelector(`${navbar} :is([data-testid="rotation-type-container"], .rotation-type-container) :is([data-testid="dropdown-picker-button"], .dropdown-picker-button)`);
			if (!picker) return false;
			picker.click();
			return true;
		}, NAVBAR);
		if (opened) {
			await settle(page, 300);
			const picked = await page.evaluate(() => {
				const opts = [...document.querySelectorAll(':is([data-testid="dropdown-picker-list"], .dropdown-picker-list) li, :is([data-testid="dropdown-picker-item"], .dropdown-picker-item)')];
				const auto = opts.find(o => /auto/i.test(o.textContent ?? ''));
				if (!auto) return false;
				(auto.querySelector('button, a') ?? auto).click();
				return true;
			});
			if (picked) {
				await settle(page, 500);
				states['rotation:auto-type'] = await snap(page, '#rotation-tab');
			}
		}
	}

	// --- Bulk tab sub-tabs ---
	if (await openTopTab(page, 'bulk-tab')) {
		await settle(page, 500);
		for (const tabId of ['bulkSetupTab', 'bulkResultsTab']) {
			const clicked = await page.evaluate(
				({ toolbarSel, id }) => {
					const btn = document.querySelector(`${toolbarSel} :is([role="tab"], .nav-link)[aria-controls=${id}]`);
					if (!btn) return false;
					btn.click();
					return true;
				},
				{ toolbarSel: BULK_TABS, id: tabId },
			);
			if (!clicked) continue;
			await settle(page, 500);
			states[`bulk:${tabId}`] = await snap(page, `#${tabId}`);
		}
	}

	// --- Gear selector modal: items, then gems, then enchants ---
	if (await openTopTab(page, 'gear-tab')) {
		await page.waitForSelector(`#gear-tab ${q('gear-picker-root')} ${q('item-picker-root')}`, { timeout: 20000 }).catch(() => {});
		await settle(page, 500);
		const cell0icon = `#gear-tab ${q('gear-picker-root')} ${q('item-picker-root')}:nth-of-type(1) ${q('item-picker-icon')}`;
		const opened = (await page.locator(cell0icon).count()) > 0;
		if (opened) {
			await page.locator(cell0icon).first().click();
			const MODAL_SEL = '.modal.show .selector-modal, [data-testid="sim-dialog-popup"].selector-modal[data-open], [data-testid="selector-modal"][data-open]';
			await page.waitForSelector(MODAL_SEL, { timeout: 20000 }).catch(() => {});
			await settle(page, 600);
			states['gear-modal:items'] = await snap(page, MODAL_SEL);
			// MODAL_SEL is a comma-separated selector list: appending a descendant to the string binds
			// only to its LAST alternative, so a match on an earlier alternative (older markup) would be
			// unconstrained by the suffix. Chain .locator() instead — it scopes the descendant lookup to
			// every element any alternative matched.
			const gemTab = page
				.locator(MODAL_SEL)
				.locator(`${q('selector-modal-tabs')} [data-label^="Gem"]`)
				.first();
			if (await gemTab.count()) {
				await gemTab.click();
				await settle(page, 600);
				states['gear-modal:gems'] = await snap(page, MODAL_SEL);
			}
			const enchantsTab = page
				.locator(MODAL_SEL)
				.locator(`${q('selector-modal-tabs')} .nav-link`, { hasText: 'Enchants' })
				.first();
			if (await enchantsTab.count()) {
				await enchantsTab.click();
				await settle(page, 600);
				states['gear-modal:enchants'] = await snap(page, MODAL_SEL);
			}
			await page.keyboard.press('Escape').catch(() => {});
			await settle(page, 300);
		}
	}

	// --- Settings -> Encounter Advanced dialog ---
	if (await openTopTab(page, 'settings-tab')) {
		await settle(page, 500);
		const advBtn = `.encounter-picker-root ${q('advanced-button')}`;
		if ((await page.locator(advBtn).count()) > 0) {
			await page.click(advBtn);
			const ADV_MODAL = q('advanced-encounter-picker-modal');
			await page.waitForSelector(ADV_MODAL, { timeout: 15000 }).catch(() => {});
			await settle(page, 500);
			states['settings:encounter-advanced'] = await snap(page, ADV_MODAL);
			await page.keyboard.press('Escape').catch(() => {});
			await settle(page, 300);
		}
	}

	// --- EP weights dialog ---
	const epBtn = `:is(${q('sim-sidebar-actions')}) :is(${q('ep-weights-action')})`;
	if ((await page.locator(epBtn).count()) > 0) {
		await page.click(epBtn);
		const EP_MENU = q('ep-weights-menu');
		await page.waitForSelector(EP_MENU, { timeout: 15000 }).catch(() => {});
		await settle(page, 600);
		states['settings:ep-weights'] = await snap(page, EP_MENU);
		await page.keyboard.press('Escape').catch(() => {});
		await settle(page, 300);
	}

	await page.close();
	return states;
};

const main = async () => {
	mkdirSync(OUT, { recursive: true });
	const browser = await launch();
	const jobs = [
		['warrior/arms', 1600],
		['warrior/arms', 700],
		['mage/fire', 1600],
		['warrior/protection', 1600],
	];
	let elements = 0;
	let sections = 0;
	const report = [];
	for (const [spec, width] of jobs) {
		console.log(`>>> ${spec} @${width}`);
		const a = await captureStates(browser, PORTS.react, spec, width);
		const b = await captureStates(browser, PORTS.tw, spec, width);
		const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
		for (const key of keys) {
			const av = a[key];
			const bv = b[key];
			const tag = `${spec} @${width} ${key}`;
			if (!av || !bv) {
				report.push(`ABSENT ${tag}  a=${av ? av.length : 'missing'} b=${bv ? bv.length : 'missing'}`);
				continue;
			}
			elements += av.length;
			const d = diff(av, bv);
			if (d.length) {
				sections++;
				report.push(`\n### DIFF ${tag}  (${av.length} vs ${bv.length} elements)\n${d.join('\n')}`);
			} else {
				report.push(`OK   ${tag}  ${av.length} elements identical`);
			}
		}
	}
	await browser.close();
	const text = `elements compared: ${elements}\nsections with a diff: ${sections}\n${report.join('\n')}\n`;
	writeFileSync(`${OUT}/report.txt`, text);
	console.log(text.slice(0, 20000));
};

main();

// The sidebar's sim-progress display: transient state that no tree gate has ever observed.
//
// `parity.mjs` serialises `.sim-ui` at load and `SERIALIZE` records tag + sorted classes only, so the
// sidebar panel is compared as nine structural lines and nothing else — not the three inline
// `display: none` writes the constructor makes, not the tippy contents, not a single character of
// text. Neither tree gate ever clicks Simulate, so the running states (the spinner, the dps/hps
// numbers, the iteration counter, the Stop button, the abort unwind) are observed by **zero** existing
// checks. `panes-parity.mjs` does not even have the sidebar in scope, and `sidebar-popover.mjs`
// deliberately avoids the worker. This gate is that missing half.
//
// `stat-weights.mjs` does run a sim, but not this one: `PROGRESS()` there is scoped to
// `.progress-tracker-dialog`, its `.results-pending-overlay` reads are the baseline's *stat-weights*
// overlay (a different element, in a different feature, with zero occurrences on this branch), and it
// never clicks `.dps-action` nor looks at `.results-viewer`. No overlap.
//
// `PORT` picks a build. The `check` assertions are invariants expected to hold on **both** — on the
// baseline because that is what proves the invariants describe today's behaviour, and on the port
// because that is what proves the rebuild kept them. There is no cross-build number comparison: no
// handle exposes the sim, so the seed cannot be fixed and two builds sim different fights.
//
// The `defect` assertions are the three fixes this port carries, all of them invisible to `parity.mjs`
// (a `type`, an `aria-label` and a text string), so `INTENDED` cannot hold them and they are asserted
// here instead. They are expected to FAIL on the baseline — that output is the list — so `defect`
// failures are fatal only off `BASE_PORT`. Unlike `stat-weights.mjs`, that tolerance does **not**
// extend to the invariants: a red `check` fails on either port, or the baseline would stop being a
// gate at all.
//
// Deliberately shape-agnostic where the port will differ:
//
//   - A hidden zone is judged by computed `display`, never by the mechanism. Vanilla writes
//     `style.display = 'none'`; the port uses the `hidden` attribute. Both compute to `none`.
//   - The running block is found as `.results-viewer .results-sim`, never
//     `.results-content .results-sim`. The port moves it into `.results-pending` so that
//     `.results-content` stays vanilla-owned (its finished-result builder has three consumers, one of
//     them the bulk renderer, and must not port with the sidebar). The *parent* is printed, not
//     asserted; the block's visibility is asserted.
//   - The warnings tooltip is counted as `.warning-zone li`. tippy mounts with `appendTo: 'parent'`
//     and react-tooltip renders in place, so both land inside the zone and one selector reads either.
//
// Ordering note: the run is driven first and the warnings toggle last, because the cheapest warnings
// driver is a talent change, and a sim on a talent build the gate just edited is a worse oracle than
// one on the spec's defaults.
import { readFileSync } from 'node:fs';

import { launch, PORTS, SERIALIZE } from './browser.mjs';

const SPEC = process.argv[2] ?? 'warrior/arms';
const PORT = Number(process.env.PORT ?? PORTS.react);
const IS_BASE = PORT === PORTS.base;
// Long enough that a run is still counting when the gate reaches the Stop button; short enough that
// the completion run finishes inside the timeout.
const LONG_RUN = '100000';
const SHORT_RUN = '1000';

const problems = [];
const defects = [];
const record = (into, name, ok, detail) => {
	if (!ok) into.push(name);
	console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}${detail === undefined ? '' : `  ${detail}`}`);
};
const check = (name, ok, detail) => record(problems, name, ok, detail);
const defect = (name, ok, detail) => record(defects, name, ok, detail);

// Read out of this worktree's catalogue rather than off the page: `en`'s value for the new key is the
// literal the hardcoded label already used, so only a French load can tell the two apart.
const FR = JSON.parse(readFileSync(new URL('../../assets/locales/fr/translation.json', import.meta.url), 'utf8'));

// Everything below runs in the page.

// Computed `display`, not `.hide` and not the `style` attribute: the port swaps the inline style for
// the `hidden` attribute, and a gate that read the mechanism would fail the port for the right change.
const ZONES = () => {
	const viewer = document.querySelector('.results-viewer');
	if (!viewer) return { missing: true };
	const shown = selector => {
		const el = viewer.querySelector(selector);
		return el ? getComputedStyle(el).display !== 'none' : null;
	};
	const item = viewer.querySelector('.warning-zone .sim-toolbar-item');
	const sim = viewer.querySelector('.results-sim');
	return {
		zones: [...viewer.children].map(el => [...el.classList].sort().join('.')),
		pending: shown('.results-pending'),
		content: shown('.results-content'),
		buttons: shown('.button-zone'),
		warningZone: shown('.warning-zone'),
		loader: !!viewer.querySelector('.results-pending .loader'),
		warningItemHidden: item ? item.classList.contains('hide') : null,
		warningTrigger: !!viewer.querySelector('.warning-zone .sim-toolbar-item button.warning.link-warning i'),
		// Printed, never asserted: which zone holds the running block is the one deliberate divergence.
		simBlockParent: sim ? [...sim.parentElement.classList].sort().join('.') : null,
	};
};

// The click happens *inside* the evaluate so the read is in the same task. `addAction`'s handler runs
// synchronously through `addAbortButton()` and `runSim()`'s `setPending()` before its first `await`,
// so the pending state is deterministic here — and a click/evaluate round trip would eventually lose
// the race against the first progress tick.
const START = () => {
	const button = document.querySelector('.sim-sidebar-actions .dps-action');
	if (!button) return { missing: true };
	button.click();
	const viewer = document.querySelector('.results-viewer');
	const shown = selector => {
		const el = viewer.querySelector(selector);
		return el ? getComputedStyle(el).display !== 'none' : null;
	};
	const stop = viewer.querySelector('.button-zone button');
	return {
		pending: shown('.results-pending'),
		content: shown('.results-content'),
		buttons: shown('.button-zone'),
		loaderVisible: !!viewer.querySelector('.results-pending .loader')?.offsetParent,
		stop: !!stop,
		simulateDisabled: button.disabled,
	};
};

const RUNNING = () => {
	const viewer = document.querySelector('.results-viewer');
	const sim = viewer?.querySelector('.results-sim');
	if (!sim) return { present: false };
	const text = selector => sim.querySelector(selector)?.textContent?.trim() ?? null;
	const stop = viewer.querySelector('.button-zone button');
	const shown = selector => {
		const el = viewer.querySelector(selector);
		return el ? getComputedStyle(el).display !== 'none' : null;
	};
	return {
		present: true,
		visible: sim.offsetParent !== null,
		parent: [...sim.parentElement.classList].sort().join('.'),
		dps: text('.results-sim-dps.damage-metrics .topline-result-avg'),
		hps: text('.results-sim-hps.healing-metrics .topline-result-avg'),
		// The third child: either the presim string or `completed / total`, then the localised
		// "iterations complete".
		counter: sim.lastElementChild?.textContent?.replace(/\s+/g, ' ').trim() ?? null,
		buttons: shown('.button-zone'),
		stopLabel: stop ? stop.textContent.trim() : null,
		stopDisabled: stop ? stop.disabled : null,
		stopType: stop ? stop.getAttribute('type') : null,
	};
};

const STOPPED = () => {
	const viewer = document.querySelector('.results-viewer');
	const shown = selector => {
		const el = viewer.querySelector(selector);
		return el ? getComputedStyle(el).display !== 'none' : null;
	};
	const simulate = document.querySelector('.sim-sidebar-actions .dps-action');
	return {
		pending: shown('.results-pending'),
		content: shown('.results-content'),
		buttons: shown('.button-zone'),
		stop: !!viewer.querySelector('.button-zone button'),
		simulateDisabled: simulate ? simulate.disabled : null,
	};
};

const FINISHED = () => {
	const viewer = document.querySelector('.results-viewer');
	const shown = selector => {
		const el = viewer.querySelector(selector);
		return el ? getComputedStyle(el).display !== 'none' : null;
	};
	const simulate = document.querySelector('.sim-sidebar-actions .dps-action');
	return {
		pending: shown('.results-pending'),
		content: shown('.results-content'),
		buttons: shown('.button-zone'),
		stop: !!viewer.querySelector('.button-zone button'),
		metrics: viewer.querySelectorAll('.results-content .results-metric').length,
		simulateDisabled: simulate ? simulate.disabled : null,
	};
};

const WARNINGS = () => {
	const viewer = document.querySelector('.results-viewer');
	const item = viewer?.querySelector('.warning-zone .sim-toolbar-item');
	const trigger = viewer?.querySelector('.warning-zone button');
	return {
		hidden: item ? item.classList.contains('hide') : null,
		itemDisplay: item ? getComputedStyle(item).display : null,
		zoneDisplay: viewer ? getComputedStyle(viewer.querySelector('.warning-zone')).display : null,
		triggerText: trigger ? trigger.textContent.trim() : null,
		triggerName: trigger ? (trigger.getAttribute('aria-label') ?? '') || trigger.textContent.trim() : null,
		// Counted only while the tooltip is open: tippy has no node in the document until it shows.
		items: viewer ? [...viewer.querySelectorAll('.warning-zone li')].map(li => li.textContent.trim()) : [],
	};
};

// The autosaved settings blob, `talents.mjs`'s oracle: the talents round trip has to come back to the
// exact string it started from, or the warnings assertions ran on a character the gate broke.
const TALENTS = () => {
	for (const key of Object.keys(localStorage)) {
		if (!key.endsWith('__currentSettings__')) continue;
		try {
			const player = JSON.parse(localStorage.getItem(key))?.player;
			if (player) return player.talentsString ?? '';
		} catch {
			// Not the blob we are after.
		}
	}
	return null;
};

const browser = await launch();
try {
	const page = await browser.newPage();
	const errors = [];
	page.on('pageerror', e => errors.push(String(e)));
	// An aborted run reports an `ErrorOutcome` that carries no message. Counted rather than pushed to
	// `errors`, so a build that logs one is reported without the run's own noise deciding the exit.
	let emptyErrors = 0;
	page.on('console', m => {
		if (m.type() !== 'error' || /Failed to load resource/.test(m.text())) return;
		if (!m.text().trim()) emptyErrors++;
		else errors.push('console: ' + m.text());
	});
	await page.addInitScript(() => {
		window.alert = () => {};
	});
	await page.goto(`http://localhost:${PORT}/mop/${SPEC}/`, { waitUntil: 'load', timeout: 60000 });
	await page.waitForSelector('.sim-sidebar-actions .dps-action', { timeout: 60000 });
	await page.waitForTimeout(2500);

	console.log(`${SPEC} on :${PORT}\n`);

	console.log('the panel at load');
	console.log(
		(await page.evaluate(SERIALIZE, '.results-viewer'))
			.split('\n')
			.map(line => `  ${line}`)
			.join('\n'),
	);
	const load = await page.evaluate(ZONES);
	console.log(`  ----  ${JSON.stringify(load)}\n`);
	check(
		'the panel holds the four zones in order',
		JSON.stringify(load.zones) === JSON.stringify(['results-pending', 'results-content', 'button-zone.text-center', 'text-center.warning-zone']),
		JSON.stringify(load.zones),
	);
	check('the pending zone holds the loader', load.loader);
	check('the warning zone holds an icon trigger', load.warningTrigger);
	// `hideAll()` in the constructor. Three zones down, and the warning zone is deliberately not one of
	// them: a warning is a statement about the character, not about a run.
	check('all three run zones start hidden', load.pending === false && load.content === false && load.buttons === false, JSON.stringify(load));
	check('the warning zone is not hidden with them', load.warningZone === true);
	check('nothing has rendered a running block yet', load.simBlockParent === null, String(load.simBlockParent));

	const setIterations = async value => {
		await page.fill('#simui-iterations', value);
		await page.dispatchEvent('#simui-iterations', 'change');
	};

	console.log('\nstarting a run');
	await setIterations(LONG_RUN);
	const started = await page.evaluate(START);
	console.log(`  ----  ${JSON.stringify(started)}`);
	// Read in the click's own task: `setPending()` shows the spinner and hides the content, and
	// `addAbortButton()` has already put the Stop button up, before the handler ever yields.
	check('the click shows the spinner and hides the content in the same task', started.pending === true && started.content === false, JSON.stringify(started));
	check('the loader is on screen while pending', started.loaderVisible === true);
	check('the Stop button is up before the first tick', started.stop === true && started.buttons === true);
	check('the Simulate button is disabled for the run', started.simulateDisabled === true);

	// Waited for, never slept: the Go sim reports at most once per 100 ms and the wasm pool decimates by
	// worker count, so a fixed sleep either reads before the first tick or after the run has ended.
	console.log('\nrunning');
	await page
		.waitForFunction(() => document.querySelector('.results-viewer .results-sim .results-sim-dps .topline-result-avg')?.textContent.trim(), null, {
			timeout: 90000,
		})
		.catch(() => problems.push('no progress arrived within 90s'));
	const running = await page.evaluate(RUNNING);
	console.log(`  ----  ${JSON.stringify(running)}`);
	check('a running block is on screen', running.present === true && running.visible === true, `parent=${running.parent}`);
	check('it carries a dps number', Number.isFinite(parseFloat(running.dps)), String(running.dps));
	check('it carries an hps number', Number.isFinite(parseFloat(running.hps)), String(running.hps));
	// `damage-metrics` / `healing-metrics` are what `_shared.scss`'s `.hide-damage-metrics` rules key
	// on, so the two rows following the sim's metric toggles depends on both classes surviving. They
	// are part of the two selectors above.
	// The `<br/>` between the two halves contributes no whitespace to `textContent`, so the separator is
	// optional rather than asserted: it is a line break, not a space, on either build.
	check(
		'the counter reads either the presim string or completed / total, over the localised caption',
		/^(\d+ \/ \d+|presimulations running)\s*iterations complete$/.test(running.counter ?? ''),
		JSON.stringify(running.counter),
	);
	check('the Stop button is still up while running', running.buttons === true && running.stopLabel === 'Stop' && running.stopDisabled === false);

	console.log('\nstopping');
	await page.click('.results-viewer .button-zone button');
	const stopping = await page.evaluate(() => {
		const stop = document.querySelector('.results-viewer .button-zone button');
		return stop ? { label: stop.textContent.trim(), disabled: stop.disabled } : { missing: true };
	});
	console.log(`  ----  ${JSON.stringify(stopping)}`);
	check(
		'the Stop button disables itself and relabels',
		stopping.disabled === true && stopping.label !== running.stopLabel && !!stopping.label,
		JSON.stringify(stopping),
	);
	// The abort unwinds through the worker, so how long it takes is load-dependent. A timeout here
	// leaves the state for the check below to report rather than throwing.
	//
	// The Simulate button is waited on separately from the zones because it re-enables *later*: the run
	// unwinds first and skips its own re-enable while `waitAbort` is still true, leaving it to the abort
	// handler's `finally`, which runs only once `signalManager.abortType` resolves. Measured at more
	// than 500 ms behind `hideAll()` on this build.
	await page
		.waitForFunction(
			() => {
				const viewer = document.querySelector('.results-viewer');
				const hidden = selector => getComputedStyle(viewer.querySelector(selector)).display === 'none';
				return (
					hidden('.results-pending') &&
					hidden('.results-content') &&
					hidden('.button-zone') &&
					!document.querySelector('.sim-sidebar-actions .dps-action').disabled
				);
			},
			null,
			{ timeout: 60000 },
		)
		.catch(() => {});
	await page.waitForTimeout(500);
	const stopped = await page.evaluate(STOPPED);
	console.log(`  ----  ${JSON.stringify(stopped)}`);
	// `hideAll()` on the aborted outcome takes all three zones down — the Stop button among them,
	// before `removeAbortButton()` ever runs.
	check('an aborted run hides all three zones', stopped.pending === false && stopped.content === false && stopped.buttons === false, JSON.stringify(stopped));
	check('the Stop button is gone', stopped.stop === false);
	check('the Simulate button is usable again', stopped.simulateDisabled === false);

	console.log('\nrunning to completion');
	await setIterations(SHORT_RUN);
	await page.click('.sim-sidebar-actions .dps-action');
	await page
		.waitForFunction(() => document.querySelectorAll('.results-viewer .results-content .results-metric').length > 0, null, { timeout: 120000 })
		.catch(() => problems.push('no result arrived within 120s'));
	await page.waitForTimeout(500);
	const finished = await page.evaluate(FINISHED);
	console.log(`  ----  ${JSON.stringify(finished)}`);
	check('the finished result replaces the spinner', finished.content === true && finished.pending === false, JSON.stringify(finished));
	check('the result carries its metric tiles', finished.metrics > 0, String(finished.metrics));
	check('the Stop button is removed and its zone hidden', finished.stop === false && finished.buttons === false);
	check('the Simulate button is enabled again', finished.simulateDisabled === false);

	// Last, and on purpose: the driver is a talent change, and a sim on a talent build the gate edited
	// would be a worse oracle than one on the spec's defaults.
	console.log('\nwarnings');
	const before = await page.evaluate(WARNINGS);
	const talentsBefore = await page.evaluate(TALENTS);
	console.log(`  ----  ${JSON.stringify(before)} talents=[${talentsBefore}]`);
	check('no warning is active on the default character', before.hidden === true && before.itemDisplay === 'none', JSON.stringify(before));

	await page.click('.sim-tabs .talents-tab, .sim-tabs li.talents-tab .nav-link');
	await page.waitForSelector('.talent-picker-icon', { state: 'visible', timeout: 10000 });
	await page.waitForTimeout(500);
	// Right-click clears the talent in its row, which is what `hasRequiredTalents` reads; left-click on
	// the same anchor puts it back, so the round trip is two clicks and the build is unchanged.
	//
	// Held by index, not by `[data-selected="true"]`: the right click is what makes that attribute
	// false, so a lazily re-resolved selector would put the point back in a *different* row and leave
	// the warning up.
	const at = await page.evaluate(() => [...document.querySelectorAll('a.talent-picker-root')].findIndex(anchor => anchor.dataset.selected === 'true'));
	check('the spec has a selected talent to clear', at >= 0, `index ${at}`);
	const talent = page.locator('a.talent-picker-root').nth(Math.max(at, 0));
	await talent.click({ button: 'right' });
	await page.waitForTimeout(600);
	const raised = await page.evaluate(WARNINGS);
	console.log(`  ----  raised ${JSON.stringify(raised)} talents=[${await page.evaluate(TALENTS)}]`);
	check('clearing a required talent raises the warning', raised.hidden === false && raised.itemDisplay !== 'none', JSON.stringify(raised));

	await page.locator('.results-viewer .warning-zone button').hover({ timeout: 5000 });
	await page.waitForTimeout(700);
	const open = await page.evaluate(WARNINGS);
	console.log(`  ----  open ${JSON.stringify(open)}`);
	check('the tooltip lists exactly the one active warning', open.items.length === 1 && !!open.items[0], JSON.stringify(open.items));
	await page.mouse.move(0, 0);
	await page.waitForTimeout(400);

	await talent.click();
	await page.waitForTimeout(600);
	const cleared = await page.evaluate(WARNINGS);
	const talentsAfter = await page.evaluate(TALENTS);
	console.log(`  ----  cleared ${JSON.stringify(cleared)} talents=[${talentsAfter}]`);
	check('restoring the talent lowers it again', cleared.hidden === true && cleared.itemDisplay === 'none', JSON.stringify(cleared));
	check('the talents string came back to where it started', talentsAfter === talentsBefore, `${talentsBefore} -> ${talentsAfter}`);

	check('the run logs no empty console.error', emptyErrors === 0, `${emptyErrors} empty`);
	await page.close();

	// The three fixes `parity.mjs` cannot see. Expected red on the baseline.
	console.log(`\ndefects${IS_BASE ? '  (baseline — all three are expected to fail here)' : ''}`);
	defect('the Stop button declares a type', running.stopType === 'button', String(running.stopType));
	defect('the warning trigger has an accessible name', !!open.triggerName, JSON.stringify(open.triggerName));

	// A second page, in French: the Stop button's label was the one hardcoded English string in this
	// panel, and `en`'s catalogue value for it is that same literal, so an English page cannot tell a
	// localised label from the one that was baked in.
	const fr = await browser.newPage();
	fr.on('pageerror', e => errors.push(String(e)));
	fr.on('console', m => {
		if (m.type() === 'error' && m.text().trim() && !/Failed to load resource/.test(m.text())) errors.push('console(fr): ' + m.text());
	});
	await fr.addInitScript(() => {
		window.alert = () => {};
		localStorage.setItem('lang', 'fr');
	});
	await fr.goto(`http://localhost:${PORT}/mop/${SPEC}/`, { waitUntil: 'load', timeout: 60000 });
	await fr.waitForSelector('.sim-sidebar-actions .dps-action', { timeout: 60000 });
	await fr.waitForTimeout(2500);
	await fr.fill('#simui-iterations', LONG_RUN);
	await fr.dispatchEvent('#simui-iterations', 'change');
	// `addAbortButton` runs synchronously in the Simulate handler, and the Stop button's own handler
	// writes its label before calling the abort, so both clicks and the read are same-task.
	await fr.evaluate(() => document.querySelector('.sim-sidebar-actions .dps-action').click());
	const frLabel = await fr.evaluate(() => {
		const stop = document.querySelector('.results-viewer .button-zone button');
		if (!stop) return null;
		stop.click();
		return stop.textContent.trim();
	});
	defect(
		'the Stop button relabels in the page language',
		frLabel === FR.sidebar.results.stopping,
		`${JSON.stringify(frLabel)} vs ${JSON.stringify(FR.sidebar.results.stopping)}`,
	);
	await fr.waitForFunction(() => !document.querySelector('.sim-sidebar-actions .dps-action').disabled, null, { timeout: 60000 }).catch(() => {});
	await fr.close();

	console.log(
		`\n${problems.length ? `${problems.length} checks fail` : 'all checks pass'}${defects.length ? `, ${defects.length} defects unfixed${IS_BASE ? ' (expected)' : ''}` : ''}`,
	);
	for (const error of errors) console.log(`  ERROR ${error}`);
	process.exitCode = problems.length || errors.length || (!IS_BASE && defects.length) ? 1 : 0;
} catch (error) {
	console.log(`\nFAILED  ${error}`);
	process.exitCode = 1;
} finally {
	await browser.close();
}

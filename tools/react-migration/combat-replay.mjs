// The combat replay, compared across the two builds. Nothing else opens it: `parity.mjs` snapshots
// the pane at load, where it holds only the "run a simulation" placeholder, `results-tabs.mjs` cuts
// its serialisation above the scene, and no gate anywhere presses play.
//
// The run is seeded the way `timeline.mjs` seeds its: the base build's own autosaved settings blob is
// read back out of localStorage, `fixedRngSeed` and `iterations` are patched into it, and the same
// JSON is planted on both ports before load. Identical settings plus a fixed seed means the two
// replays are the same fight, which is what makes a frame-for-frame comparison mean anything.
//
// Playback is wall-clock, so the two builds are never at the same instant under "press play". Every
// value comparison is taken by *seeking* to a fixed scrubber position; play and pause are asserted
// only as "the clock moved" and "the clock stopped".
//
// Frame cost is read two ways over the same five seconds of playback, because neither alone is
// honest. The `requestAnimationFrame` wrapper times what runs *inside* the callback, which on the
// vanilla is the whole redraw but on the port is only the imperative writes — a structural commit is
// scheduled by React and runs in a later task. So CDP's `Performance.getMetrics` is read across the
// same window as well: `TaskDuration` and `ScriptDuration` catch every task whoever scheduled it,
// and `RecalcStyleDuration` / `LayoutDuration` catch the work neither wrapper can see.
import { launch, openSpec, PORTS } from './browser.mjs';

const SPECS = ['warrior/arms'];
const SEED = '1337';
const ITERATIONS = 100;
const SETTINGS_SUFFIX = '__currentSettings__';
/** Scrubber positions, out of 1000, read on both builds. */
const STOPS = [120, 333, 700];
/** How long playback runs while the frame cost is measured. */
const MEASURE_MS = 5000;

const specs = () => (process.argv[2] ? process.argv[2].split(',') : SPECS);

const READ_REPLAY = () => {
	const root = document.querySelector('.combat-replay-root');
	if (!root) return ['NO .combat-replay-root'];
	const text = (scope, selector) => [...scope.querySelectorAll(selector)].map(element => element.textContent.trim());
	const width = element => (element ? Math.round(parseFloat(getComputedStyle(element).width)) : -1);
	const icon = element => (element.style.backgroundImage.match(/([^/"']+\.(?:jpg|png|webp))/) ?? ['none'])[0];
	const cards = [...root.querySelectorAll('.cr-enemy-card')];

	return [
		`player ${root.querySelector('.cr-cdm-player-label')?.textContent}`,
		`time ${root.querySelector('.cr-time-display')?.textContent}`,
		`scrubber ${root.querySelector('.cr-scrubber')?.value}`,
		`castbar "${root.querySelector('.cr-cast-bar-label')?.textContent}" "${root.querySelector('.cr-cast-bar-time')?.textContent}" w=${width(root.querySelector('.cr-cast-bar-fill'))}`,
		`ticker n=${root.querySelectorAll('.cr-strip-icon').length} active=${root.querySelectorAll('.cr-strip-icon-active').length} crit=${root.querySelectorAll('.cr-crit-badge').length}`,
		`ticker-dmg ${text(root, '.cr-dmg-badge').join(',')}`,
		`ticker-icons ${[...root.querySelectorAll('.cr-strip-icon')].map(icon).join(',')}`,
		`ticker-fade ${[...root.querySelectorAll('.cr-strip-icon')].map(element => Number(getComputedStyle(element).opacity).toFixed(2)).join(',')}`,
		`buffs n=${root.querySelectorAll('.cr-buff-icons .cr-aura-icon').length} fresh=${root.querySelectorAll('.cr-buff-icons .cr-aura-icon-active').length}`,
		`buff-icons ${[...root.querySelectorAll('.cr-buff-icons .cr-aura-icon')].map(icon).join(',')}`,
		`buff-timers ${text(root, '.cr-buff-icons .cr-aura-time-badge').join(',')}`,
		`buff-stacks ${text(root, '.cr-buff-icons .cr-aura-stack-badge').join(',')}`,
		`res-labels ${text(root, '.cr-bar-label').join(',')}`,
		`res-values ${text(root, '.cr-bar-val').join(',')}`,
		`res-widths ${[...root.querySelectorAll('.cr-res-bar-fill')].map(width).join(',')}`,
		`pip-labels ${text(root, '.cr-dot-label').join(',')}`,
		`pip-values ${text(root, '.cr-dot-val').join(',')}`,
		// A lit pip carries a gradient, an empty one a flat colour — read off the computed style, because
		// the port moves the gradient out of an inline style and into a class fed by custom properties.
		`pips ${[...root.querySelectorAll('.cr-segment')].map(element => (getComputedStyle(element).backgroundImage === 'none' ? '.' : '#')).join('')}`,
		`pip-lit ${[...root.querySelectorAll('.cr-segment')].map(element => getComputedStyle(element).backgroundImage.replace(/\s+/g, '')).filter(value => value !== 'none')[0] ?? 'none'}`,
		`grid n=${root.querySelectorAll('.cr-action-icon').length} active=${root.querySelectorAll('.cr-action-icon-active').length}`,
		`grid-icons ${[...root.querySelectorAll('.cr-action-icon')].map(icon).join(',')}`,
		...cards.map(card =>
			[
				`card ${card.dataset.idx}`,
				`name="${card.querySelector('.cr-enemy-name')?.textContent}"`,
				`x=${card.style.getPropertyValue('--cr-card-x')}`,
				`w=${card.style.getPropertyValue('--cr-card-w')}`,
				`scale=${card.style.getPropertyValue('--cr-card-scale')}`,
				`z=${card.style.getPropertyValue('--cr-card-z')}`,
				`bright=${card.style.getPropertyValue('--cr-card-brightness')}`,
				`hp="${card.querySelector('.cr-hp-text')?.textContent}"`,
				`hpw=${width(card.querySelector('.cr-hp-fill'))}`,
				`debuffs=${text(card, '.cr-debuff-row .cr-aura-time-badge').join('/')}`,
				`hits=${card.querySelectorAll('.cr-hit-effect').length}`,
				`nums=${text(card, '.cr-dmg-num').join('/')}`,
				`flash=${[...card.querySelectorAll('.cr-hit-flash')].map(width).join('/')}`,
				`ring=${[...card.querySelectorAll('.cr-hit-ring')].map(width).join('/')}`,
			].join(' '),
		),
		`speeds ${[...root.querySelectorAll('.cr-speed-btn')].map(button => `${button.textContent.trim()}${button.classList.contains('active') ? '*' : ''}`).join(' ')}`,
		`play ${root.querySelector('.cr-play-btn i')?.className}`,
	];
};

/**
 * The wowhead payload each family of icon carries, which is what a hover would show. `rel` is not in
 * here: this branch hardens every outbound anchor through `externalRel`, which master does not do at
 * all outside the log, so it is asserted on the port instead of compared.
 */
const READ_TOOLTIPS = () => {
	const first = selector => {
		const element = document.querySelector(selector);
		return element ? `${element.dataset.wowhead ?? 'none'} | ${element.getAttribute('href') ?? 'none'}` : 'NO ' + selector;
	};
	return [`ticker ${first('.cr-strip-icon')}`, `buff ${first('.cr-buff-icons .cr-aura-icon')}`, `grid ${first('.cr-action-icon')}`];
};

const READ_ANCHOR_REL = () =>
	['.cr-strip-icon', '.cr-buff-icons .cr-aura-icon', '.cr-action-icon'].map(selector => document.querySelector(selector)?.getAttribute('rel') ?? 'none');

/** Set through the native setter so React's value tracker sees the change, then fire the event both builds listen for. */
const SEEK = value => {
	const scrubber = document.querySelector('.cr-scrubber');
	Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(scrubber, String(value));
	scrubber.dispatchEvent(new Event('input', { bubbles: true }));
};

const FRAME_TIMING = () => {
	window.__replayFrames = { count: 0, total: 0, max: 0 };
	const request = window.requestAnimationFrame.bind(window);
	window.requestAnimationFrame = callback =>
		request(timestamp => {
			const started = performance.now();
			callback(timestamp);
			const elapsed = performance.now() - started;
			const stats = window.__replayFrames;
			stats.count++;
			stats.total += elapsed;
			if (elapsed > stats.max) stats.max = elapsed;
		});
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

const timeDisplay = page => page.evaluate(() => document.querySelector('.cr-time-display')?.textContent ?? '');

const TIMERS = ['TaskDuration', 'ScriptDuration', 'RecalcStyleDuration', 'LayoutDuration'];

const metricsOf = reply => Object.fromEntries(reply.metrics.map(metric => [metric.name, metric.value]));

/** Milliseconds spent in each timer across the window, since CDP reports them as cumulative seconds. */
const spent = (before, after) => Object.fromEntries(TIMERS.map(name => [name, ((after[name] ?? 0) - (before[name] ?? 0)) * 1000]));

const collect = async (browser, port, spec, seeded) => {
	const { page, errors } = await openSpec(browser, port, spec);
	await page.addInitScript(({ key, value }) => localStorage.setItem(key, value), seeded);
	await page.addInitScript(FRAME_TIMING);
	await page.reload({ waitUntil: 'load', timeout: 60000 });
	await page.waitForSelector('.sim-ui', { timeout: 60000 });
	await page.waitForTimeout(2500);

	await page.waitForSelector('.dps-action:not([disabled])', { timeout: 60000 });
	await page.click('.dps-action');
	await page.waitForFunction(() => document.querySelectorAll('.results-content .results-metric').length > 0, null, { timeout: 180000 });
	await openResultsTab(page);

	// The pane before the tab is opened: a finished run is held, not drawn. Read as what is on screen
	// rather than what is in the tree — the vanilla builds both the placeholder and an empty scene and
	// toggles `display`, and the port renders whichever of the two it is showing.
	const beforeOpen = await page.evaluate(() => {
		const shown = selector => {
			const element = document.querySelector(selector);
			return !!element && getComputedStyle(element).display !== 'none';
		};
		return `placeholder=${shown('.cr-empty')} scene=${shown('.cr-scene')} cards=${document.querySelectorAll('.cr-enemy-card').length}`;
	});

	await page.evaluate(() => document.querySelector('.dr-toolbar .nav-tabs [role=tab][aria-controls=replayTab]').click());
	await page.waitForFunction(() => document.querySelectorAll('.cr-enemy-card').length > 0, null, { timeout: 60000 });
	await page.waitForTimeout(800);

	const atRest = await page.evaluate(READ_REPLAY);

	const stops = [];
	for (const stop of STOPS) {
		await page.evaluate(SEEK, stop);
		await page.waitForTimeout(250);
		stops.push(`--- stop ${stop} ---`, ...(await page.evaluate(READ_REPLAY)));
	}

	const tooltips = await page.evaluate(READ_TOOLTIPS);
	const rel = await page.evaluate(READ_ANCHOR_REL);

	// Seeking by dragging the track: mousedown pauses, the input that follows moves the playhead.
	await page.evaluate(SEEK, 0);
	const box = await page.locator('.cr-scrubber').boundingBox();
	await page.mouse.click(box.x + box.width * 0.4, box.y + box.height / 2);
	await page.waitForTimeout(300);
	const dragged = [`play ${await page.evaluate(() => document.querySelector('.cr-play-btn i')?.className)}`, ...(await page.evaluate(READ_REPLAY))];

	// Playback itself: the clock has to move while playing and stop dead on pause. The values are
	// wall-clock, so only the direction of travel is compared.
	await page.evaluate(SEEK, 0);
	await page.evaluate(() => (window.__replayFrames = { count: 0, total: 0, max: 0 }));
	await page.evaluate(() => document.querySelectorAll('.cr-speed-btn')[2].click());
	const cdp = await page.context().newCDPSession(page);
	await cdp.send('Performance.enable');
	const before = metricsOf(await cdp.send('Performance.getMetrics'));
	await page.click('.cr-play-btn');
	const started = await timeDisplay(page);
	await page.waitForTimeout(MEASURE_MS);
	const running = await timeDisplay(page);
	const frames = await page.evaluate(() => window.__replayFrames);
	const tasks = spent(before, metricsOf(await cdp.send('Performance.getMetrics')));
	await cdp.detach();
	await page.click('.cr-play-btn');
	const paused = await timeDisplay(page);
	await page.waitForTimeout(600);
	const stillPaused = await timeDisplay(page);

	const playback = [
		`advances ${running !== started}`,
		`freezes ${paused === stillPaused}`,
		`play ${await page.evaluate(() => document.querySelector('.cr-play-btn i')?.className)}`,
		`speeds ${await page.evaluate(() => [...document.querySelectorAll('.cr-speed-btn')].map(button => (button.classList.contains('active') ? '*' : '-')).join(''))}`,
	];

	// Back to the tab it came from, then in again: the vanilla stopped playback on hide and held the
	// next result until the tab was shown, and the port's `active` prop has to do the same.
	await page.evaluate(SEEK, 500);
	await page.evaluate(() => document.querySelector('.dr-toolbar .nav-tabs [role=tab][aria-controls=timelineTab]').click());
	await page.waitForTimeout(400);
	await page.evaluate(() => document.querySelector('.dr-toolbar .nav-tabs [role=tab][aria-controls=replayTab]').click());
	await page.waitForTimeout(600);
	const reopened = [`time ${await timeDisplay(page)}`, `cards ${await page.evaluate(() => document.querySelectorAll('.cr-enemy-card').length)}`];

	// A second run while the tab is open: the scene is rebuilt and the playhead goes back to the start.
	await page.evaluate(SEEK, 400);
	await page.click('.detailed-results-1-iteration-button');
	await page.waitForFunction(() => document.querySelector('.cr-time-display')?.textContent?.startsWith('0:00.0'), null, { timeout: 120000 }).catch(() => {});
	await page.waitForTimeout(1200);
	const rerun = [`time ${await timeDisplay(page)}`, ...(await page.evaluate(READ_REPLAY)).slice(0, 4)];

	await page.close();
	return { beforeOpen, atRest, stops, tooltips, rel, dragged, playback, reopened, rerun, frames, tasks, errors };
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
		for (const part of ['atRest', 'stops', 'tooltips', 'dragged', 'playback', 'reopened', 'rerun']) {
			diff(part, sides.base[part], sides.react[part], problems);
		}
		diff('before open', [sides.base.beforeOpen], [sides.react.beforeOpen], problems);
		// Not a comparison — the port is expected to differ here, and what it owes is the hardening itself.
		if (sides.react.rel.some(value => value !== 'noopener noreferrer')) problems.push(`react anchors not hardened: ${sides.react.rel.join(', ')}`);
		if (sides.react.errors.length > sides.base.errors.length) problems.push(`errors base=${sides.base.errors.length} react=${sides.react.errors.length}`);

		const cost = side => {
			const stats = sides[side].frames;
			return `${side}: ${stats.count} frames in ${MEASURE_MS}ms, in-callback ${(stats.total / Math.max(1, stats.count)).toFixed(3)}ms mean / ${stats.max.toFixed(2)}ms max`;
		};
		const whole = side => `${side}: ${TIMERS.map(name => `${name.replace('Duration', '')}=${sides[side].tasks[name].toFixed(0)}ms`).join(' ')}`;

		const ok = problems.length === 0;
		if (!ok) failures++;
		console.log(`${ok ? 'PASS' : 'FAIL'}  ${spec.padEnd(20)} stops=${STOPS.length} cards=${sides.react.atRest.filter(line => line.startsWith('card ')).length}`);
		console.log(`    frame cost  ${cost('base')}`);
		console.log(`    frame cost  ${cost('react')}`);
		console.log(`    whole page  ${whole('base')}`);
		console.log(`    whole page  ${whole('react')}`);
		if (process.env.VERBOSE) {
			for (const [side, read] of Object.entries(sides)) {
				read.atRest.forEach(line => console.log(`    ${side} rest: ${line}`));
				read.tooltips.forEach(line => console.log(`    ${side} tip:  ${line}`));
				read.playback.forEach(line => console.log(`    ${side} play: ${line}`));
			}
		}
		problems.forEach(problem => console.log('    ! ' + problem));
		sides.react.errors.slice(0, 3).forEach(error => console.log('    error: ' + error.slice(0, 140)));
	}
} finally {
	await browser.close();
}

console.log(failures ? `\n${failures} spec(s) differ` : '\nthe scene, its bars, its icons, its scrubber and its playback all match the baseline');
process.exit(failures ? 1 : 0);

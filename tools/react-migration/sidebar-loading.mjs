// The stat-weights button's loading state, which is invisible to every other gate.
//
// The button used to be appended from inside `sim.waitForInit().then(...)`, so it did not exist
// until the sim was ready and then popped into the sidebar — pushing `.suggest-reforges-settings-group`
// (`order: 20`) down by a button height as it landed. It is built up front now and wears
// `.sim-sidebar-action-button.loading` until init resolves, which reserves the slot and removes the
// shift. Nothing else can see that: `parity.mjs` and `panes-parity.mjs` serialise after a settle, by
// which time the class is long gone and `SERIALIZE` records no attributes anyway; `stat-weights.mjs`
// waits for `:not(.loading)` precisely so it never observes it. Revert the button to the async
// append and the whole suite still passes — which is what this file is for.
//
// The window is a few hundred milliseconds on a static server, so it has to be opened deliberately:
// the database request is routed and *held* until the reads are done, rather than delayed by a
// number that then has to be raced. **It is `db.json`, not `db.bin`** — `READ_JSON` in
// `ui/sim/proto_utils/database.ts` is `true`, so a route pattern aimed at `db.bin` intercepts
// nothing, the page loads at full speed and every assertion below reads the settled state and
// passes for the wrong reason. `**/assets/database/db.*` covers both and cannot go stale. The
// interception is asserted for the same reason.
//
// `PORT` picks a build. The baseline is **expected to fail**: nothing on it ever adds the class, so
// the button is simply absent for the whole window and the loading assertions have nothing to read.
// That output is the behaviour this change adds, and only the React run exits non-zero.
import { ENVIRONMENTAL, launch, PORTS } from './browser.mjs';

const SPEC = process.argv[2] ?? 'warrior/arms';
const PORT = Number(process.env.PORT ?? PORTS.react);
const IS_BASE = PORT === PORTS.base;
const DB = '**/assets/database/db.*';

// Everything the state is made of, in one read. `focusable` is the check that "disabled" is real
// rather than a class that only looks like it: a control that still takes focus is still reachable
// by keyboard, whatever it is painted like.
const READ = () => {
	const button = document.querySelector('.sim-sidebar-actions .ep-weights-action');
	if (!button) return { present: false };
	const icon = button.querySelector('.sim-sidebar-action-button-loading-icon');
	return {
		present: true,
		loading: button.classList.contains('loading'),
		disabled: button.disabled,
		ariaBusy: button.getAttribute('aria-busy'),
		spinnerShown: !!icon && getComputedStyle(icon).display !== 'none',
		spinnerHidden: icon?.querySelector('i')?.getAttribute('aria-hidden') === 'true',
		label: button.textContent.trim(),
		focusable: (() => {
			button.focus();
			return document.activeElement === button;
		})(),
	};
};

const problems = [];
const check = (name, ok, detail) => {
	if (!ok) problems.push(name);
	console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}${detail === undefined ? '' : `  ${detail}`}`);
};

// One page per scenario, because each needs its own route handler and its own load.
const open = async (browser, handle) => {
	const page = await browser.newPage();
	const errors = [];
	page.on('console', m => {
		if (m.type() === 'error' && !ENVIRONMENTAL.test(m.text())) errors.push('console: ' + m.text());
	});
	await page.addInitScript(() => {
		window.alert = () => {};
	});
	await page.route(DB, handle);
	// `domcontentloaded`, not `load`, and not a preference: the document head carries
	// `<link rel="preload" href="/mop/assets/database/db.json" as="fetch">`, so `load` cannot fire
	// while the request is held — and the hold is only released after the reads that come after this
	// returns. Waiting on `load` here deadlocks the run.
	await page.goto(`http://localhost:${PORT}/mop/${SPEC}/`, { waitUntil: 'domcontentloaded', timeout: 60000 });
	// The shell has to have rendered for any of this to mean anything, and that is not the thing
	// under test — so it is waited for, while the button itself is not.
	await page.waitForSelector('.sim-sidebar-actions', { timeout: 30000 });
	return { page, errors };
};

const browser = await launch();
let intercepted = 0;
console.log(`${SPEC} on :${PORT}${IS_BASE ? '  (baseline — the loading assertions are expected to fail here)' : ''}\n`);

// Held open until the reads below are done, so "the sim has not initialised yet" is a guarantee
// rather than a bet on a sleep outrunning a fetch. Every match is held and all are released
// together, so the preload link and the app's own request cannot get out of step.
let release;
const held = new Promise(resolve => (release = resolve));
const slow = await open(browser, async route => {
	intercepted++;
	await held;
	await route.continue();
});
// The route landing is itself asserted: a pattern that matches nothing would leave every read below
// looking at a settled button, and every assertion would pass while gating nothing.
check('the database request was intercepted', intercepted > 0, `${intercepted} request(s)`);

const during = await slow.page.evaluate(READ);
console.log(`\nwhile the sim initialises\n  ${JSON.stringify(during)}`);
check('the button is in the sidebar before the sim is ready', during.present);
check('it carries the loading class', during.loading === true);
check('it is disabled', during.disabled === true);
check('it is marked aria-busy', during.ariaBusy === 'true');
check('its spinner is shown', during.spinnerShown === true);
check('the spinner is hidden from assistive tech', during.spinnerHidden === true);
check('it cannot take focus', during.focusable === false);

release();
await slow.page.waitForSelector('.sim-sidebar-actions .ep-weights-action:not(.loading)', { timeout: 60000 }).catch(() => {});
await slow.page.waitForTimeout(500);
const after = await slow.page.evaluate(READ);
console.log(`\nonce the sim is ready\n  ${JSON.stringify(after)}`);
check('the loading class is gone', after.loading === false);
check('aria-busy is gone', after.ariaBusy === null);
check('its spinner is hidden again', after.spinnerShown === false);
// `warrior/arms` is launched. An unlaunched spec's button is disabled for good, and settling must
// not enable it — which is why the resolve writes `this.disabled` back rather than `false`.
check('a launched spec ends up usable', after.disabled === false && after.focusable === true);
check('the label is intact', after.label === during.label && !!after.label, JSON.stringify(after.label));
await slow.page.close();

// A failed init must not leave the button spinning forever. It stays disabled — there is nothing to
// open — but it stops claiming to be loading, so it reads as a plainly unavailable control.
const dead = await open(browser, route => route.abort('failed'));
await dead.page.waitForTimeout(9000);
const failed = await dead.page.evaluate(READ);
console.log(`\nafter a failed init\n  ${JSON.stringify(failed)}`);
check('the button is still there', failed.present);
check('it is not stuck in the loading state', failed.loading === false);
check('its spinner has stopped', failed.spinnerShown === false);
check('aria-busy is cleared', failed.ariaBusy === null);
check('it stays disabled and unfocusable', failed.disabled === true && failed.focusable === false);
check('the label is readable again', !!failed.label, JSON.stringify(failed.label));
await dead.page.close();

// Only the slow page's console is judged: aborting the database breaks the rest of the app, so the
// dead page logs a crowd of unrelated failures by design.
for (const error of slow.errors) console.log(`  ERROR ${error}`);

await browser.close();
console.log(`\n${problems.length ? `${problems.length} checks fail` : 'all checks pass'}`);
process.exit(slow.errors.length || (!IS_BASE && problems.length) ? 1 : 0);

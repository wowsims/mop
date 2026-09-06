// The EP weights dialog: the one region no tree gate can see.
//
// `parity.mjs` pulls every ported dialog out of the comparison by exact count, so the dialog's own
// markup is compared against nothing — and `SERIALIZE` records tag and classes only, never an id.
// Three of the port's defect fixes are therefore invisible to `INTENDED`, which is why they are
// asserted here instead: the duplicate `ep-ratio-N` ids, the dialog size following the
// threat-metrics toggle, and the tank rule that used to select `.modal-footer`.
//
// It also runs the sim. The dialog's whole reason to exist is a stat-weights run, and the run is
// what replaced the blurred app and the sibling Stop button with a progress-tracker dialog.
//
// `PORT` picks a build. On the baseline the three assertions above are expected to FAIL — that
// output is the list of defects this port fixes — so a red baseline run is the point, and only the
// React run exits non-zero.
import { ENVIRONMENTAL, launch, PORTS } from './browser.mjs';

const SPEC = process.argv[2] ?? 'warrior/arms';
const PORT = Number(process.env.PORT ?? PORTS.react);
const IS_BASE = PORT === PORTS.base;
const ITERATIONS = '5000';

// `.ep-weights-menu` is on the Bootstrap `.modal-dialog` on one side and on the Base UI popup on the
// other, so everything below keys on that class and asks the DOM rather than the shape.
const DIALOG = () => {
	const dialog = document.querySelector('.ep-weights-menu');
	if (!dialog) return { present: false };
	const table = dialog.querySelector('.results-ep-table');
	const ratioIds = [...dialog.querySelectorAll('.ep-ratios input')].map(input => input.id);
	const size = [...dialog.classList].find(name => /^(modal-|sim-dialog-popup--)(sm|md|lg|xl)$/.test(name)) ?? 'default';
	return {
		present: true,
		open: dialog.closest('.modal') ? dialog.closest('.modal').classList.contains('show') : dialog.hasAttribute('data-open'),
		size: size.replace(/^(modal-|sim-dialog-popup--)/, ''),
		columns: [...table.querySelectorAll('thead tr:first-child th')].map(th => th.className || '-'),
		rows: [...table.querySelectorAll('tbody tr')].map(row => row.firstElementChild.textContent),
		ratioIds,
		duplicateRatioIds: ratioIds.length - new Set(ratioIds).size,
		toggleIds: [...dialog.querySelectorAll('.swcalc-include-toggle input')].map(input => input.id),
		untypedButtons: [...dialog.querySelectorAll('button')].filter(button => !button.getAttribute('type')).map(button => button.className || '(no class)'),
		unnamedRefSelects: [...dialog.querySelectorAll('.ref-stat-select select, select.ref-stat-select')].filter(select => {
			const label = select.id && dialog.querySelector(`label[for="${CSS.escape(select.id)}"]`);
			return !(select.getAttribute('aria-label') || (label && label.textContent.trim()));
		}).length,
		unnamedTypeSelect: (() => {
			const select = dialog.querySelector('#ep-type-select');
			if (!select) return 'missing';
			const label = dialog.querySelector('label[for="ep-type-select"]');
			return select.getAttribute('aria-label') || label?.textContent.trim() ? 0 : 1;
		})(),
		optionsWithValue: [...dialog.querySelectorAll('.ref-stat-select option, select.ref-stat-select option')].filter(option => option.hasAttribute('value'))
			.length,
		footerDisplay: getComputedStyle(dialog.querySelector('.sim-dialog-footer, .modal-footer')).display,
		ratiosDisplay: getComputedStyle(dialog.querySelector('.ep-ratios')).display,
		referenceDisplay: getComputedStyle(dialog.querySelector('.ep-reference-options')).display,
	};
};

// A `position: sticky` computed style says nothing about whether the right element scrolls. Scroll
// the container the rule names and watch the header stay where it is.
const STICKY = () => {
	const container = document.querySelector('.ep-weights-menu .results-ep-table-container');
	if (!container) return { error: 'no container' };
	const th = container.querySelector('thead th');
	// Whichever ancestor actually scrolls. `.modal-scroll-table` set `overflow-y: auto` on the
	// container, but nothing constrains its height, so on both builds the dialog body is the scroller
	// and the sticky `<th>` resolves against that.
	let scroller = container;
	while (scroller && scroller.scrollHeight <= scroller.clientHeight + 1) scroller = scroller.parentElement;
	if (!scroller) return { error: 'nothing between the table and the page scrolls' };
	scroller.scrollTop = 0;
	const before = Math.round(th.getBoundingClientRect().top);
	scroller.scrollTop = 200;
	const scrolled = scroller.scrollTop;
	const after = Math.round(th.getBoundingClientRect().top);
	scroller.scrollTop = 0;
	return {
		scroller: scroller.className.split(/\s+/)[0],
		position: getComputedStyle(th).position,
		containerOverflowY: getComputedStyle(container).overflowY,
		scrolled,
		before,
		after,
		held: before === after,
	};
};

// Scoped to `.progress-tracker-dialog`: the reforge optimiser builds a *vanilla* `ProgressTrackerModal`
// at load, it shares every `.progress-tracker-modal-*` class name, and it is earlier in the document,
// so an unscoped `querySelector` answers for it and reports an empty bar forever.
const PROGRESS = () => {
	const progress = document.querySelector('.progress-tracker-dialog, .results-pending-overlay');
	const dialog = document.querySelector('.ep-weights-menu');
	const within = selector => document.querySelector(`.progress-tracker-dialog ${selector}`)?.textContent ?? null;
	return {
		shown: !!progress && !progress.hasAttribute('hidden'),
		caption: within('.progress-tracker-modal-progress-title'),
		text: within('.progress-tracker-modal-progress-text'),
		// The baseline writes both counters into one `.results-sim` block in the sibling overlay.
		vanillaText: document.querySelector('.results-pending-overlay .results-sim')?.textContent?.replace(/\s+/g, ' ').trim() ?? null,
		elapsed: within('.time-elapsed'),
		blurredRoot: !!document.querySelector('.sim-ui.blurred'),
		epDialogOpen: !!dialog && (dialog.closest('.modal') ? dialog.closest('.modal').classList.contains('show') : dialog.hasAttribute('data-open')),
	};
};

const EP_VALUES = () =>
	[...document.querySelectorAll('.ep-weights-menu tbody tr')].slice(0, 4).map(row => ({
		stat: row.firstElementChild.textContent,
		weight: row.querySelector('.type-weight .results-avg')?.textContent ?? null,
		ep: row.querySelector('.type-ep .results-avg')?.textContent ?? null,
	}));

const problems = [];
const check = (name, ok, detail) => {
	if (!ok) problems.push(name);
	console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}${detail === undefined ? '' : `  ${detail}`}`);
};

const browser = await launch();
const page = await browser.newPage();
const errors = [];
page.on('pageerror', e => errors.push(String(e)));
let emptyErrors = 0;
page.on('console', m => {
	if (m.type() !== 'error' || ENVIRONMENTAL.test(m.text())) return;
	// An aborted run used to log `ErrorOutcome.message`, which an abort does not carry. Counted
	// rather than pushed to `errors`, so the baseline still exits 0 while React asserts it is gone.
	if (!m.text().trim()) emptyErrors++;
	else errors.push('console: ' + m.text());
});
await page.addInitScript(() => {
	window.alert = () => {};
});
await page.goto(`http://localhost:${PORT}/mop/${SPEC}/`, { waitUntil: 'load', timeout: 60000 });
await page.waitForSelector('.sim-sidebar-actions .ep-weights-action', { timeout: 60000 });
await page.waitForTimeout(2500);

console.log(`${SPEC} on :${PORT}${IS_BASE ? '  (baseline — the three defect assertions are expected to fail here)' : ''}\n`);

const setIterations = async value => {
	await page.fill('#simui-iterations', value);
	await page.dispatchEvent('#simui-iterations', 'change');
};
const openDialog = async () => {
	await page.click('.sim-sidebar-actions .ep-weights-action');
	await page.waitForTimeout(700);
};
const closeDialog = async () => {
	await page.keyboard.press('Escape');
	await page.waitForTimeout(700);
};

await setIterations(ITERATIONS);
await openDialog();
const dialog = await page.evaluate(DIALOG);
console.log('structure');
console.log(`  columns    ${JSON.stringify(dialog.columns)}`);
console.log(`  rows       ${JSON.stringify(dialog.rows)}`);
console.log(`  ratio ids  ${JSON.stringify(dialog.ratioIds)}`);
console.log(`  toggle ids ${JSON.stringify(dialog.toggleIds)}`);
console.log(`  size       ${dialog.size}\n`);

console.log('defects');
check('every EP-ratio picker has its own id', dialog.duplicateRatioIds === 0, `${dialog.duplicateRatioIds} duplicates`);
check('no include-toggle id carries a space', !dialog.toggleIds.some(id => /\s/.test(id)));
check('every button the dialog renders declares a type', dialog.untypedButtons.length === 0, JSON.stringify(dialog.untypedButtons));
check('every reference select has an accessible name', dialog.unnamedRefSelects === 0, `${dialog.unnamedRefSelects} unnamed`);
check('the EP/Weights type select has an accessible name', dialog.unnamedTypeSelect === 0, String(dialog.unnamedTypeSelect));
check('every reference option carries a value', dialog.optionsWithValue > 0, `${dialog.optionsWithValue} with a value`);

// `.modal .modal-scroll-table` had exactly one consumer and dies with the Bootstrap markup, so the
// re-keyed rule has to put the same two declarations on the same element. It does not put the header
// on the screen: nothing constrains the container's height, so it never scrolls, the dialog body does
// — and a sticky element's view rectangle is its nearest scroll container's scrollport, which is the
// container. Measured identical on both builds (baseline: modal-body, 319 -> 152, not held), so this
// asserts the declarations survived the move rather than an effect neither build has.
const sticky = await page.evaluate(STICKY);
console.log('\nsticky header');
check('the sticky declarations survive the re-key', sticky.position === 'sticky' && sticky.containerOverflowY === 'auto', JSON.stringify(sticky));

console.log('\ntank rule');
check(
	'the tank layout hides the footer, the ratios and the reference options',
	SPEC.endsWith('/protection') || SPEC.endsWith('/blood') || SPEC.endsWith('/brewmaster') || SPEC.endsWith('/guardian')
		? dialog.footerDisplay === 'none' && dialog.ratiosDisplay === 'none' && dialog.referenceDisplay === 'none'
		: dialog.footerDisplay !== 'none',
	`footer=${dialog.footerDisplay} ratios=${dialog.ratiosDisplay} reference=${dialog.referenceDisplay}`,
);

// The dialog is its own tooltip container now: `react-tooltip` renders in place, so a header tooltip
// lives inside `.sim-dialog-body`, which is `position: relative; overflow: auto`. tippy appended to
// `<body>` and could never be clipped, so this is the one place the port can lose a tooltip.
const TOOLTIP = async () => {
	// `:visible` because `stats-type-ep` hides the weight columns, and their headers are first.
	const anchor = page.locator('.ep-weights-menu thead th span[data-tooltip-content]:visible').first();
	if (!(await anchor.count())) return { error: 'no header tooltip anchor' };
	const hovered = await anchor
		.hover({ timeout: 5000 })
		.then(() => true)
		.catch(() => false);
	if (!hovered) return { error: 'the header tooltip anchor is not hoverable' };
	await page.waitForTimeout(600);
	return page.evaluate(() => {
		const tip = document.querySelector('.sim-tooltip[style*="opacity: 1"], .sim-tooltip.react-tooltip__show');
		const popup = document.querySelector('.ep-weights-menu');
		if (!tip) return { error: 'no tooltip opened' };
		const t = tip.getBoundingClientRect();
		const p = popup.getBoundingClientRect();
		return {
			text: tip.textContent.replace(/\s+/g, ' ').trim().slice(0, 40),
			visible: t.width > 0 && t.height > 0,
			insidePopup: t.top >= p.top - 1 && t.bottom <= p.bottom + 1 && t.left >= p.left - 1 && t.right <= p.right + 1,
			onScreen: t.top >= 0 && t.left >= 0 && t.bottom <= window.innerHeight && t.right <= window.innerWidth,
		};
	});
};

// React-only: tippy appends to `<body>`, so the baseline has nothing to clip a tooltip with and no
// `data-tooltip-content` anchor to hover either.
if (!IS_BASE) {
	console.log('\nheader tooltip');
	const tooltip = await TOOLTIP();
	check('a header tooltip opens unclipped inside the dialog', tooltip.visible && tooltip.insidePopup && tooltip.onScreen, JSON.stringify(tooltip));
	await page.mouse.move(0, 0);
}

// `.ep-weights-menu:not(.hide-threat-metrics)` was always true: the class is on the sim root, so every
// spec got the tank-mode compact layout below `lg`. The re-keyed selector reads the root, so the
// compact rules apply exactly when threat metrics are shown -- which is the whole point of the block.
// Invisible at the 1280px default viewport, so this narrows it first.
await page.setViewportSize({ width: 900, height: 800 });
await page.waitForTimeout(400);
const compact = await page.evaluate(() => ({
	rootHidesThreat: !!document.querySelector('.sim-ui.hide-threat-metrics'),
	notTiny: getComputedStyle(document.querySelector('.ep-weights-menu .compute-ep .not-tiny')).display,
}));
console.log('\ncompact layout at 900px');
check(
	'the compact block follows the sim root, not the dialog',
	compact.rootHidesThreat ? compact.notTiny === 'inline' : compact.notTiny === 'none',
	JSON.stringify(compact),
);
await page.setViewportSize({ width: 1280, height: 900 });
await page.waitForTimeout(400);

// `getModalConfig` read `getShowThreatMetrics()` once, at construction, and the modal is never
// disposed — so on the baseline the size does not move even across a close and a reopen.
await closeDialog();
await page.click('.sim-toolbar button.sim-options');
await page.waitForTimeout(700);
const toggle = page.locator('#simui-show-threat-metrics');
const hadThreat = await toggle.isChecked();
await toggle.setChecked(!hadThreat);
await page.waitForTimeout(400);
await page.keyboard.press('Escape');
await page.waitForTimeout(700);
await openDialog();
const toggled = await page.evaluate(DIALOG);
console.log('\nthreat-metrics toggle');
check('the dialog size follows the threat-metrics toggle', toggled.size !== dialog.size, `${dialog.size} -> ${toggled.size}`);
await closeDialog();
await page.click('.sim-toolbar button.sim-options');
await page.waitForTimeout(700);
await page.locator('#simui-show-threat-metrics').setChecked(hadThreat);
await page.keyboard.press('Escape');
await page.waitForTimeout(700);

// The only external consumer of the opener. `buildEPWeightsToggle` runs inside a tippy `onShow`, so
// this is also the check that the reforge panel still finds a modal to open now that the field is a
// controller rather than a `BaseModal`.
console.log('\nreforge opener');
await closeDialog();
const cog = page.locator('.sim-sidebar-actions .suggest-reforges-button-settings');
if (await cog.count()) {
	await cog.click();
	await page.waitForTimeout(900);
	const edit = page.locator('[data-tippy-root] button.btn-outline-primary');
	if (await edit.count()) {
		await edit.first().click();
		await page.waitForTimeout(900);
		check('the reforge popover opens the EP dialog', (await page.evaluate(DIALOG)).open);
		await closeDialog();
	} else {
		console.log('  ----  no Edit weights button in the reforge popover');
		await page.keyboard.press('Escape');
	}
} else {
	console.log('  ----  this spec has no reforge optimiser');
}

// A tank has no Calculate button: `.sim-type--tank` hides the whole footer, because reforge results
// on a tank are inaccurate enough to confuse. That is the tank rule above, asserted rather than
// worked around.
await openDialog();
if ((await page.evaluate(DIALOG)).footerDisplay === 'none') {
	console.log('\nrunning\n  ----  skipped: the tank layout hides the Calculate button');
	console.log(`\n${problems.length ? `${problems.length} checks fail` : 'all checks pass'}`);
	for (const error of errors) console.log(`  ERROR ${error}`);
	await page.close();
	await browser.close();
	check('the wasm worker logs no empty console.error', emptyErrors === 0, `${emptyErrors} empty`);
	process.exit(errors.length || (!IS_BASE && problems.length) ? 1 : 0);
}

console.log('\nrunning');
await page.click('.ep-weights-menu .calc-weights');
// Waited for rather than sampled: the Go sim reports at most once per 100 ms and the wasm pool
// decimates by worker count, so the first tick is not instant — and a fixed sleep either reads
// before it or after the run has finished.
await page
	.waitForFunction(
		() =>
			[...document.querySelectorAll('.progress-tracker-dialog .progress-tracker-modal-progress-text, .results-pending-overlay .results-sim')].some(el =>
				el.textContent.trim(),
			),
		null,
		{ timeout: 60000 },
	)
	.catch(() => problems.push('no progress arrived within 60s'));
const during = await page.evaluate(PROGRESS);
console.log(`  during   ${JSON.stringify(during)}`);
check('a run shows its progress', during.shown);
check('the EP dialog stays open behind it', during.epDialogOpen);

// The popup is centred by the stylesheet rather than by Base UI, and only a rendered run can say
// whether that landed. Skipped on the baseline, which has no popup to centre.
if (!IS_BASE) {
	const centred = await page.evaluate(() => {
		const popup = document.querySelector('.progress-tracker-dialog');
		if (!popup) return { error: 'no progress popup' };
		const box = popup.getBoundingClientRect();
		return { offset: Math.round(box.top + box.height / 2 - window.innerHeight / 2), width: Math.round(box.width), height: Math.round(box.height) };
	});
	check('the progress popup is vertically centred', Math.abs(centred.offset ?? 999) <= 50, JSON.stringify(centred));
}

const cancel = page.locator('.progress-tracker-dialog .progress-tracker-modal-cancel-btn, .results-pending-overlay button');
if (await cancel.count()) {
	await cancel.first().click();
	// The abort unwinds through the worker, so how long it takes is load-dependent: a fixed wait
	// made this assertion flaky (~1 run in 3 caught the dialog still counting). A timeout here
	// leaves the state for the check below to report rather than throwing.
	await page
		.waitForFunction(
			() => {
				const running = document.querySelector('.progress-tracker-dialog, .results-pending-overlay');
				return !running || running.hasAttribute('hidden');
			},
			null,
			{ timeout: 30000 },
		)
		.catch(() => {});
	await page.waitForTimeout(300);
} else {
	problems.push('no cancel control while running');
}
const cancelled = await page.evaluate(PROGRESS);
console.log(`  cancelled ${JSON.stringify(cancelled)}`);
check('cancelling ends the run', !cancelled.shown);
check('cancelling leaves the EP dialog open', cancelled.epDialogOpen);

await page.click('.ep-weights-menu .calc-weights');
await page.waitForFunction(() => !document.querySelector('.progress-tracker-dialog') && !document.querySelector('.sim-ui.blurred'), null, { timeout: 180000 });
await page.waitForTimeout(800);
const values = await page.evaluate(EP_VALUES);
console.log(`  completed ${JSON.stringify(values)}`);
check(
	'a completed run fills the table',
	values.some(row => row.weight && row.weight !== 'N/A' && row.weight !== '0.00'),
);
check('the Calculate button is usable again', await page.locator('.ep-weights-menu .calc-weights').isEnabled());

check('the wasm worker logs no empty console.error', emptyErrors === 0, `${emptyErrors} empty`);

console.log(`\n${problems.length ? `${problems.length} checks fail` : 'all checks pass'}`);
for (const error of errors) console.log(`  ERROR ${error}`);
await page.close();
await browser.close();
process.exit(errors.length || (!IS_BASE && problems.length) ? 1 : 0);

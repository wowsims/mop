// Records the reforge settings popover, which no tree gate can see: `parity.mjs` and
// `panes-parity.mjs` never open it, and both stacks build its contents lazily — tippy in `onShow`,
// React by mounting the popup's children. Set `PORT` to pick a build; the whole output should be
// identical on both, so the two runs are a diff.
//
// What only exists after the click:
//
//   1. where the popup mounts and whether the sidebar's `overflow-y: auto` clips it — tippy appended
//      to <body>, Base UI portals into `.sim-ui`, so the containing block changed and the answer has
//      to be measured rather than reasoned about.
//   2. every control in it, keyed on the `reforge-optimizer-*` id both stacks spell the same way,
//      in document order, with its value and whether a `hide`/`d-none` ancestor is covering it.
//   3. the three conditional sections — the hard-cap table, the breakpoint-limit table and the
//      frozen-slot table — each of which is *hidden*, not unmounted, on both sides.
//   4. that "use custom EP values" swaps the EP block between presets-only and the full manager.
//      The block is a React `SavedEpWeights` on this branch and the vanilla `SavedDataManager` on
//      master, so its chip markup is expected to differ; what must not differ is the presets-only
//      rule, which is read as "is there a create row".
//   5. that closing and reopening rebuilds the body with the settings that were just written —
//      tippy's `setContent(<></>)`/`onShow` pair, and React's unmount/remount, in one assertion.
//   6. that "Edit weights" opens the EP dialog and closes the popover. On master that was
//      `hideAll()`; there is no `hideAll` for a Base UI popover, so it is a `setOpen(false)`.
import { ENVIRONMENTAL, launch, PORTS } from './browser.mjs';

const SPEC = process.argv[2] ?? 'warrior/arms';
const PORT = Number(process.env.PORT ?? PORTS.base);

// Both sides: tippy's themed box on master, `Popover`'s popup on this branch.
const POPOVER_PARTS = [".tippy-box[data-theme='reforge-optimiser-popover']", '.sim-popover-popup.reforge-optimiser-popover'];
const POPOVER = POPOVER_PARTS.join(', ');
// A selector list does not distribute over a descendant combinator, so each part gets its own.
const inside = suffix => POPOVER_PARTS.map(part => `${part} ${suffix}`).join(', ');
const TRIGGER = '.suggest-reforges-button-settings';
const GROUP = '.suggest-reforges-settings-group';
const RUN = '.suggest-reforges-action-button';
const TOAST = '.suggest-reforges-toast';
const PROGRESS = '.progress-tracker-modal, .progress-tracker-dialog';
const HIT_CAP = '#reforge-optimizer-Melee\\ Hit-percentage';
const CUSTOM_EP = '#reforge-optimizer-enable-custom-ep-weights';
const FREEZE = '#reforge-optimizer-freeze-item-slots';
const FROZEN_SLOT = '#reforge-optimizer-freeze-ItemSlotHead';
const EP_DIALOG = '.ep-weights-menu';

const inspect = selector => {
	const box = document.querySelector(selector);
	if (!box) return { open: false };
	// Declared inside, because `page.evaluate` ships this function's source and nothing around it.
	const hidden = element => {
		if (!element) return null;
		const style = getComputedStyle(element);
		return style.display === 'none' || style.visibility === 'hidden';
	};

	// The id is the one key both stacks agree on: it comes from the picker config, not the markup.
	const controls = [...box.querySelectorAll('[id^="reforge-optimizer-"]')].map(el => ({
		id: el.id,
		tag: el.tagName.toLowerCase(),
		type: el.getAttribute('type') ?? '',
		value: el.type === 'checkbox' ? String(el.checked) : (el.value ?? ''),
		disabled: !!el.disabled,
		covered: hidden(el.closest('table') ?? el.parentElement ?? el),
	}));

	const tables = [...box.querySelectorAll('table')].map(table => ({
		cls: [...table.classList].sort().join('.') || '(none)',
		hidden: hidden(table),
		rows: table.querySelectorAll('tr').length,
	}));

	// The three-paragraph note that swaps with the hard-cap table.
	const note = [...box.querySelectorAll('div')].find(div => div.children.length === 3 && [...div.children].every(child => child.tagName === 'P'));

	const saved = box.querySelector('.saved-data-manager-root');
	return {
		open: true,
		controls,
		tables,
		note: note ? { hidden: hidden(note) } : null,
		ep: saved
			? {
					presets: saved.querySelectorAll('.saved-data-presets > *').length,
					custom: saved.querySelectorAll('.saved-data-custom > *').length,
					customHidden: hidden(saved.querySelector('.saved-data-custom')),
					// `presetsOnly` is "load only", so this row is the whole difference at the DOM level.
					createRow: !!saved.querySelector('.saved-data-create-container'),
				}
			: null,
		buttons: [...box.querySelectorAll('button')].map(button => button.textContent.trim()).filter(Boolean),
	};
};

// Every tooltip standing open, minus the popover itself — which is a `.tippy-box` on master, so it
// has to come out or the two sides are counting different things.
const openTooltips = selector =>
	[...document.querySelectorAll('.tippy-box, .sim-tooltip')]
		.filter(el => !el.matches(selector) && !el.closest(selector))
		.filter(el => {
			const style = getComputedStyle(el);
			return (
				style.visibility !== 'hidden' &&
				style.opacity !== '0' &&
				el.closest('[data-tippy-root]')?.style.visibility !== 'hidden' &&
				el.getBoundingClientRect().height > 0
			);
		})
		.map(el => el.textContent.trim().slice(0, 30));

const geometry = selector => {
	const box = document.querySelector(selector);
	const popper = box?.closest('[data-tippy-root]') ?? box;
	const scroller = document.querySelector('.sim-sidebar-content');
	if (!popper || !scroller) return { error: `popper=${!!popper} scroller=${!!scroller}` };
	const b = popper.getBoundingClientRect();
	const f = scroller.getBoundingClientRect();
	// Well past the scroller's right edge, but inside the popover.
	const x = Math.round(f.right + (b.right - f.right) / 2);
	const y = Math.round(b.top + b.height / 2);
	const hit = document.elementFromPoint(x, y);
	let containingBlock = popper.parentElement;
	while (containingBlock && getComputedStyle(containingBlock).position === 'static') containingBlock = containingBlock.parentElement;
	return {
		mountedIn: popper.parentElement.tagName.toLowerCase() + '.' + popper.parentElement.className,
		containingBlock: containingBlock ? `${containingBlock.tagName.toLowerCase()} ${getComputedStyle(containingBlock).position}` : 'initial',
		insideScroller: scroller.contains(popper),
		strategy: getComputedStyle(popper).position,
		width: Math.round(b.width),
		minWidth: getComputedStyle(box).minWidth,
		maxWidth: getComputedStyle(box).maxWidth,
		clipped: !(hit && box.contains(hit)),
	};
};

const dialogOpen = selector => {
	const dialog = document.querySelector(selector);
	if (!dialog) return false;
	const style = getComputedStyle(dialog);
	return style.display !== 'none' && style.visibility !== 'hidden' && dialog.getBoundingClientRect().height > 0;
};

const openPopover = async page => {
	await page.click(TRIGGER);
	await page.waitForSelector(POPOVER, { state: 'visible', timeout: 5000 });
	// After the fade, so nothing below reads a transition mid-flight.
	await page.waitForTimeout(500);
};

// A checkbox's own label is what a user clicks; both stacks put the input first and the label after.
const toggle = async (page, selector) => {
	await page.click(selector);
	await page.waitForTimeout(300);
};

const show = (title, value) => {
	console.log(`\n${title}`);
	if (!value.open) {
		console.log('  CLOSED');
		return;
	}
	for (const control of value.controls) {
		console.log(
			`  ${control.id.padEnd(46)} ${control.tag}/${control.type || '-'} = ${control.value}  disabled=${control.disabled} covered=${control.covered}`,
		);
	}
	for (const table of value.tables) console.log(`  table ${table.cls.padEnd(44)} hidden=${table.hidden} rows=${table.rows}`);
	console.log(`  note ${value.note ? `hidden=${value.note.hidden}` : 'ABSENT'}`);
	console.log(
		`  ep   ${value.ep ? `presets=${value.ep.presets} custom=${value.ep.custom} customHidden=${value.ep.customHidden} createRow=${value.ep.createRow}` : 'ABSENT'}`,
	);
	console.log(`  buttons ${JSON.stringify(value.buttons)}`);
};

// The done toast is the one place React content goes into imperative DOM — a `createPortal` into a
// div handed to the Bootstrap `Toast` — and the one place a `Tooltip` lands inside `.toast-body`.
// Runs on a page nothing else has touched, so the solve is the default one, and it is the whole
// run when `RUN_SOLVE` is set: the popover walk above would leave settings behind that change it.
const solve = async page => {
	// The shipped gear is already optimally reforged, so a default run reports no changes and the
	// toast is a plain string on both sides. Lowering the hit cap is the smallest edit that makes the
	// solve move slots, and both builds get the same one.
	await openPopover(page);
	await page.click(CUSTOM_EP);
	await page.waitForTimeout(300);
	const hitCap = page.locator(HIT_CAP);
	await hitCap.click();
	await hitCap.fill('');
	await hitCap.pressSequentially('3.00', { delay: 20 });
	await hitCap.press('Enter');
	await page.waitForTimeout(400);
	await page.keyboard.press('Escape');
	await page.waitForTimeout(500);

	// Armed before the click: the solve can finish in under a second, and the no-change toast
	// autohides after three, so anything that polls first can miss the toast entirely.
	const appeared = page.waitForSelector(TOAST, { state: 'attached', timeout: 300000 });
	await page.click(RUN);
	let progressShown = false;
	for (let tick = 0; tick < 8 && !progressShown; tick++) {
		progressShown = await page.evaluate(dialogOpen, PROGRESS);
		if (!progressShown) await page.waitForTimeout(120);
	}
	await appeared;
	// One paint for the portal's children, no more: the no-change toast is gone at three seconds.
	await page.waitForTimeout(400);
	const toast = await page.evaluate(selector => {
		const box = document.querySelector(selector);
		if (!box) return { shown: false };
		const copy = box.querySelector('button:not(.btn-close)');
		return {
			shown: true,
			body: box.querySelector('.toast-body').textContent.trim().slice(0, 40),
			icons: box.querySelectorAll('.gear-change-icon').length,
			withIcon: box.querySelectorAll('.item-picker-icon-wrapper[style*="background-image"]').length,
			links: box.querySelectorAll('.gear-change-icon-link[href]').length,
			reforgeMarkers: box.querySelectorAll('.gear-change-icon-reforge:not(.d-none)').length,
			sockets: box.querySelectorAll('.gem-socket-container').length,
			changedSockets: box.querySelectorAll('.gem-socket-container.interactive').length,
			copyButton: copy ? { cls: [...copy.classList].sort().join('.'), text: copy.textContent.trim() } : null,
		};
	}, TOAST);
	console.log(`\nprogress dialog seen during the solve: ${progressShown}`);
	console.log(`done toast ${JSON.stringify(toast)}`);

	// A tooltip inside `.toast-body`: a container no `Tooltip` has been in before.
	const marker = page.locator(`${TOAST} .gear-change-icon-reforge:not(.d-none)`).first();
	if (await marker.count()) {
		await marker.hover();
		await page.waitForTimeout(700);
		const shown = await page.evaluate(() =>
			[...document.querySelectorAll('.tippy-box, .sim-tooltip')]
				.filter(el => {
					const style = getComputedStyle(el);
					return style.visibility !== 'hidden' && style.opacity !== '0' && el.getBoundingClientRect().height > 0;
				})
				.map(el => el.textContent.trim())
				.slice(0, 2),
		);
		console.log(`reforge marker tooltip ${JSON.stringify(shown)}`);
		await page.mouse.move(0, 0);
		await page.waitForTimeout(400);
	}

	const copyButton = page.locator(`${TOAST} button:not(.btn-close)`).first();
	if (!(await copyButton.count())) {
		console.log('copy button: ABSENT');
		return;
	}
	await copyButton.dispatchEvent('click');
	await page.waitForTimeout(1200);
	const clipboard = await page.evaluate(() =>
		navigator.clipboard
			.readText()
			.then(text => text.length)
			.catch(() => -1),
	);
	const toastGone = await page.evaluate(selector => {
		const box = document.querySelector(selector);
		return !box || getComputedStyle(box).opacity === '0';
	}, TOAST);
	console.log(`copy button: clipboard chars > 0 = ${clipboard > 0}   toast hidden after the copy = ${toastGone}`);
};

const browser = await launch();
let failed = false;
try {
	const context = await browser.newContext({ permissions: ['clipboard-read', 'clipboard-write'] });
	const page = await context.newPage();
	const errors = [];
	page.on('pageerror', e => errors.push(String(e)));
	page.on('console', m => {
		if (m.type() === 'error' && !ENVIRONMENTAL.test(m.text())) errors.push('console: ' + m.text());
	});
	await page.addInitScript(() => {
		window.alert = () => {};
	});
	await page.goto(`http://localhost:${PORT}/mop/${SPEC}/`, { waitUntil: 'load', timeout: 60000 });
	await page.waitForSelector('.sim-ui', { timeout: 60000 });
	await page.waitForTimeout(2500);

	console.log(`${SPEC} on :${PORT}, reforge settings popover`);

	if (process.env.RUN_SOLVE) {
		await solve(page);
		if (errors.length) {
			failed = true;
			for (const error of errors) console.log(`  ERROR ${error}`);
		}
		await context.close();
		await browser.close();
		process.exit(failed ? 1 : 0);
	}

	const groupClosed = await page.evaluate(selector => document.querySelector(selector)?.offsetHeight ?? null, GROUP);
	await openPopover(page);
	const groupOpen = await page.evaluate(selector => document.querySelector(selector)?.offsetHeight ?? null, GROUP);
	// The group is `display: grid` with two columns. tippy appended its popper here as a third child
	// and Base UI's portal wrapper takes the same place, so this says whether either one is laid out
	// as a grid item and pushes the sidebar around.
	console.log(`\naction group height  closed=${groupClosed} open=${groupOpen}`);
	const geo = await page.evaluate(geometry, POPOVER);
	// Opening the popover must not leave the cog's own hover tooltip standing behind it. tippy's
	// `hideOnClick` covered a click on the reference itself; on the React side the panel suppresses
	// that tooltip with `Tooltip`'s `hidden` while it is open.
	geo.openTooltips = await page.evaluate(openTooltips, POPOVER);
	console.log('\npopover geometry');
	for (const [key, value] of Object.entries(geo)) console.log(`  ${key.padEnd(16)} ${JSON.stringify(value)}`);

	show('opened', await page.evaluate(inspect, POPOVER));

	await toggle(page, CUSTOM_EP);
	show('after use-custom-ep-values ON', await page.evaluate(inspect, POPOVER));

	await toggle(page, FREEZE);
	show('after freeze-item-slots ON', await page.evaluate(inspect, POPOVER));

	await toggle(page, FROZEN_SLOT);
	const slotChecked = await page.evaluate(selector => document.querySelector(selector)?.checked ?? null, FROZEN_SLOT);
	console.log(`\nfrozen head slot stays checked after the write: ${slotChecked}`);

	await page.keyboard.press('Escape');
	await page.waitForTimeout(600);
	const closed = await page.evaluate(inspect, POPOVER);
	const tooltipsAfterClose = await page.evaluate(openTooltips, POPOVER);
	console.log(`\nescape closes: ${!closed.open}   tooltips left open: ${JSON.stringify(tooltipsAfterClose)}`);
	await page.mouse.move(0, 0);
	await page.waitForTimeout(500);
	console.log(`after moving the pointer away: ${JSON.stringify(await page.evaluate(openTooltips, POPOVER))}`);

	await openPopover(page);
	show('reopened', await page.evaluate(inspect, POPOVER));

	// The run button's own tooltip: a breakpoint table on a spec that has soft caps, and nothing at
	// all on one that does not — which is how tippy's `onShow: () => false` is expressed as a
	// `render` returning nothing. It also carries the one width tippy set on the instance.
	await page.keyboard.press('Escape');
	await page.waitForTimeout(400);
	await page.hover('.suggest-reforges-action-button');
	await page.waitForTimeout(700);
	const softCaps = await page.evaluate(() => {
		const box = document.querySelector(".tippy-box[data-theme='suggest-reforges-softcaps'], .sim-tooltip.suggest-reforges-softcaps");
		if (!box) return { drawn: false };
		const style = getComputedStyle(box);
		if (style.visibility === 'hidden' || style.opacity === '0') return { drawn: false };
		return {
			drawn: true,
			maxWidth: style.maxWidth,
			rows: box.querySelectorAll('tr').length,
			headings: [...box.querySelectorAll('th')].map(th => th.textContent.trim()),
		};
	});
	console.log(`\nsoft-cap tooltip ${JSON.stringify(softCaps)}`);
	await page.mouse.move(0, 0);
	await page.waitForTimeout(400);
	await openPopover(page);

	// Dispatched rather than clicked: with every section open the popover runs past the viewport, and
	// the button below it is what a user scrolls to. Actionability is not what this step is checking.
	await page.locator(inside('button')).last().dispatchEvent('click');
	await page.waitForTimeout(800);
	const afterEdit = await page.evaluate(inspect, POPOVER);
	const epOpen = await page.evaluate(dialogOpen, EP_DIALOG);
	console.log(`\nedit weights: dialog open=${epOpen}  popover closed=${!afterEdit.open}`);

	if (errors.length) {
		failed = true;
		for (const error of errors) console.log(`  ERROR ${error}`);
	}
	await context.close();
} finally {
	await browser.close();
}
process.exit(failed ? 1 : 0);

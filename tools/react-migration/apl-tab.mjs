// The APL editor's behaviour, the way talents.mjs records the talent tree's: the DOM at load says
// nothing about whether editing a rotation works, and the APL cluster is almost entirely editing.
//
//   PORT=3401 node tools/react-migration/apl-tab.mjs warrior/protection
//   PORT=3402 node tools/react-migration/apl-tab.mjs warrior/protection
//
// The whole output should be identical on both.
//
// The oracle is the autosaved rotation blob, not the rendered pickers: what has to survive an edit
// is the proto, and reading it the same way on both stacks keeps the check honest even when the
// markup around it changes. Structure counts come second, and only for elements both stacks name
// the same way.
//
// Three things this had to learn the hard way, all still true:
//  - `page.hover()` times out on `.list-picker-item-actions`; move the mouse to its box instead.
//  - Playwright's `dragTo` reports success without reordering anything. Synthetic `DragEvent`s with
//    a real `DataTransfer` are what both stacks actually listen for.
//  - A synthetic reorder leaves the *vanilla* list inert to the next popover, so delete first and
//    drag last.
import { ENVIRONMENTAL, launch, PORTS } from './browser.mjs';

const SPEC = process.argv[2] ?? 'warrior/protection';
const PORT = Number(process.env.PORT ?? PORTS.base);

// The pane holds two lists; every step names the priority one, because that is the list whose order
// and length the saved rotation reports back.
const LIST = '#apl-priority-list .apl-priority-list-picker-root';
const ITEM = `${LIST} > .list-picker-root > .list-picker-items > .list-picker-item-container`;

/** The saved rotation, as the shape an edit has to move. */
const readRotation = () => {
	for (const key of Object.keys(localStorage)) {
		if (!key.endsWith('__currentSettings__')) continue;
		try {
			const rotation = JSON.parse(localStorage.getItem(key))?.player?.rotation;
			if (rotation) {
				// Most rows are `castSpell`, so the kind alone cannot see a reorder. A digest per row can.
				const digest = value => {
					let hash = 5381;
					const text = JSON.stringify(value ?? null);
					for (let index = 0; index < text.length; index++) hash = ((hash * 33) ^ text.charCodeAt(index)) >>> 0;
					return hash.toString(36).slice(0, 4);
				};
				const list = rotation.priorityList ?? [];
				return {
					type: rotation.type ?? '-',
					items: list.length,
					prepull: (rotation.prepullActions ?? []).length,
					kinds: list.map(item => Object.keys(item.action ?? {}).find(name => name !== 'condition') ?? '-').join(','),
					head: list.slice(0, 5).map(digest).join(' '),
				};
			}
		} catch {
			// Not the blob we are after.
		}
	}
	return null;
};

const structure = () => {
	const pane = document.getElementById('apl-priority-list');
	const count = selector => pane.querySelectorAll(selector).length;
	return {
		lists: count('.list-picker-root'),
		items: count('.apl-list-item-picker .list-picker-item-container'),
		actionPickers: count('.apl-action-picker-root'),
		valuePickers: count('.apl-value-picker-root'),
		hideButtons: count('.hide-picker-button'),
		validations: count('.apl-validations'),
		dropdownTriggers: count('.dropdown-picker-button'),
		actionBars: count('.apl-floating-action-bar-root'),
	};
};

/** Vanilla opens the per-item menu on `mouseover`, and Playwright's own hover never lands on it. */
const openItemMenu = async (page, index) => {
	const button = page.locator(`${ITEM} >> nth=${index} >> .list-picker-item-actions`).first();
	const box = await button.boundingBox();
	if (!box) return false;
	await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
	await page.waitForTimeout(400);
	return true;
};

/**
 * A reorder as the two stacks actually receive one. Playwright's `dragTo` moves the pointer without
 * ever producing a `dragstart`, so nothing reorders and it still reports success.
 */
const dragItem = ([from, to]) => {
	const list = document.querySelector('#apl-priority-list .apl-priority-list-picker-root > .list-picker-root > .list-picker-items');
	const items = [...(list?.children ?? [])].filter(child => child.classList.contains('list-picker-item-container'));
	const source = items[from];
	const target = items[to];
	if (!source || !target) return 'NO ITEMS';
	const data = new DataTransfer();
	const rect = target.getBoundingClientRect();
	// Below the midpoint inserts after the target, which is the rule both lists share.
	const clientY = rect.top + rect.height * 0.75;
	const fire = (element, type, extra = {}) => element.dispatchEvent(new DragEvent(type, { bubbles: true, cancelable: true, dataTransfer: data, ...extra }));
	source.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
	return { fire: () => (fire(source, 'dragstart', { clientY: rect.top }), fire(target, 'dragenter', { clientY }), fire(target, 'dragover', { clientY }), fire(target, 'drop', { clientY }), fire(source, 'dragend', { clientY })) };
};

const browser = await launch();
const context = await browser.newContext();
const page = await context.newPage();
const errors = [];
page.on('pageerror', error => errors.push(String(error)));
page.on('console', message => {
	if (message.type() === 'error' && !ENVIRONMENTAL.test(message.text())) errors.push('console: ' + message.text());
});
await page.addInitScript(() => {
	window.alert = () => {};
});

try {
	await page.goto(`http://localhost:${PORT}/mop/${SPEC}/`, { waitUntil: 'load', timeout: 60000 });
	await page.waitForSelector('.sim-ui', { timeout: 60000 });
	await page.waitForTimeout(2500);

	await page.click('.sim-tabs .rotation-tab, .sim-tabs li.rotation-tab .nav-link');
	await page.waitForSelector('#apl-priority-list', { state: 'visible', timeout: 15000 });
	await page.waitForTimeout(1200);

	console.log(`${SPEC} on :${PORT}\n`);
	console.log('structure');
	for (const [key, value] of Object.entries(await page.evaluate(structure))) console.log(`  ${key.padEnd(18)} ${value}`);

	// One failing step must not hide the rest: the output is the comparison, and a missing line reads
	// as a difference between the two stacks rather than as a broken probe.
	const step = async (label, action) => {
		let outcome;
		try {
			outcome = await action();
		} catch (error) {
			outcome = `THREW ${String(error).split('\n')[0]}`;
		}
		await page.waitForTimeout(1200);
		const now = await page.evaluate(readRotation);
		const live = await page.evaluate(
			selector => document.querySelectorAll(selector).length,
			`${LIST} > .list-picker-root > .list-picker-items > .list-picker-item-container`,
		);
		console.log(
			`${label.padEnd(24)} items=${now?.items ?? '-'} rendered=${live} head=[${now?.head ?? '-'}] type=${now?.type ?? '-'}${outcome === undefined ? '' : ` (${outcome})`}`,
		);
		return now;
	};

	console.log('');
	const before = await page.evaluate(readRotation);
	console.log(`start                    items=${before?.items} prepull=${before?.prepull} type=${before?.type} head=[${before?.head}]`);
	console.log(`kinds                    ${before?.kinds}`);

	// 1. add — the floating action bar's own button, not the list's.
	await step('add action', () => page.locator(`${LIST} .apl-floating-action-bar-root .btn-primary`).first().click());

	// 2. edit — the first numeric or text field in the pane, committed on `change` as both stacks require.
	await step('edit a value', () =>
		page.evaluate(() => {
			const input = [...document.querySelectorAll('#apl-priority-list .apl-priority-list-picker-root input[type=text]')].find(
				element => element.offsetParent && element.value !== '',
			);
			if (!input) return 'NO INPUT';
			const was = input.value;
			input.value = /^-?[\d.]+s?$/.test(was) ? '7' : `${was}7`;
			input.dispatchEvent(new Event('change', { bubbles: true }));
			return `"${was}" -> "${input.value}"`;
		}),
	);

	// 3. delete — before the drag, because a synthetic reorder leaves the vanilla list inert.
	await step('delete item 0', async () => {
		if (!(await openItemMenu(page, 0))) return 'NO ACTIONS BUTTON';
		// Clicked in the page: moving the pointer from the actions button to the popover crosses the
		// gap between them, and the popover closes on `mouseleave` before the click lands.
		// The row's OWN delete, named through its own header: with `inlineMenuBar` the header comes
		// after the body, so a plain descendant query finds a nested value list's delete button first.
		return page.evaluate(selector => {
			const button = document.querySelector(selector);
			if (!button) return 'NO DELETE BUTTON';
			button.click();
			return 'clicked';
		}, `${ITEM}:first-of-type > .list-picker-item-header > .list-picker-item-popover > .list-picker-item-delete`);
	});

	// 4. reorder — first item to third position.
	await step('drag 0 -> 2', async () => {
		const handle = await page.evaluateHandle(dragItem, [0, 2]);
		const ready = await page.evaluate(state => (typeof state === 'string' ? state : 'armed'), handle);
		if (ready !== 'armed') return ready;
		// Vanilla sets `draggable` inside the mousedown handler and React from state, so the attribute
		// lands a render later there. The wait covers both; the reorder itself is what is compared.
		await page.waitForTimeout(100);
		await page.evaluate(state => state.fire(), handle);
		return 'dragged';
	});

	// 5. a nested value picker — open the first item's condition kind menu and count what it offers.
	await step('open a value menu', async () => {
		const trigger = page.locator(`${LIST} .apl-action-condition .dropdown-picker-button`).locator('visible=true').first();
		if (!(await trigger.count())) return 'NO CONDITION PICKER';
		await trigger.click({ timeout: 10000 });
		await page.waitForTimeout(500);
		const options = await page.evaluate(() => document.querySelectorAll('.dropdown-picker-item, .dropdown-picker-list li').length);
		await page.keyboard.press('Escape');
		return `${options > 0 ? 'menu opened' : 'MENU EMPTY'}`;
	});

	// 6. rotation type — away from APL and back, which rebuilds the whole pane on both stacks.
	await step('type -> Auto', () =>
		page.evaluate(() => {
			const picker = document.querySelector('.apl-rotation-navbar .rotation-type-container .dropdown-picker-button');
			picker?.click();
		}),
	);
	await page.waitForTimeout(400);
	await step('pick the first type', async () => {
		const option = page.locator('.dropdown-picker-list li, .dropdown-picker-item').locator('visible=true').first();
		if (!(await option.count())) return 'NO TYPE MENU';
		await option.click({ timeout: 10000 });
		return 'clicked';
	});

	const after = await page.evaluate(readRotation);
	console.log(`\nend                      items=${after?.items} prepull=${after?.prepull} type=${after?.type} head=[${after?.head}]`);
	console.log(`kinds                    ${after?.kinds}`);
} finally {
	for (const error of errors) console.log(`  ERROR ${error}`);
	await context.close();
	await browser.close();
}
process.exit(errors.length ? 1 : 0);

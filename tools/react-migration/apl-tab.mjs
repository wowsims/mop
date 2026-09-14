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
import { ENVIRONMENTAL, launch, PORTS, q } from './browser.mjs';

const SPEC = process.argv[2] ?? 'warrior/protection';
const PORT = Number(process.env.PORT ?? PORTS.base);

// The pane holds two lists; every step names the priority one, because that is the list whose order
// and length the saved rotation reports back.
const LIST = '#apl-priority-list :is([data-testid="apl-priority-list-picker-root"], .apl-priority-list-picker-root)';
const ITEM = `${LIST} > ${q('list-picker-root')} > ${q('list-picker-items')} > ${q('list-picker-item-container')}`;
const NAVBAR = q('apl-rotation-navbar');

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

const structure = actionBarSelector => {
	const pane = document.getElementById('apl-priority-list');
	const count = selector => pane.querySelectorAll(selector).length;
	return {
		lists: count(':is([data-testid="list-picker-root"], .list-picker-root)'),
		// Scoped to the priority-list pane, so this already excludes any non-APL list picker; the
		// old `.apl-list-item-picker` ancestor prefix is gone from the markup this round.
		items: count(':is([data-testid="list-picker-item-container"], .list-picker-item-container)'),
		actionPickers: count(':is([data-testid="apl-action-picker-root"], .apl-action-picker-root)'),
		// Condition value pickers override their testid to `apl-action-condition` (ActionPicker.tsx), so
		// they no longer carry `apl-value-picker-root` at all — count both testids.
		valuePickers: count(':is([data-testid="apl-value-picker-root"], [data-testid="apl-action-condition"], .apl-value-picker-root)'),
		hideButtons: count(':is([data-testid="hide-picker-button"], .hide-picker-button)'),
		validations: count(':is([data-testid="apl-validations"], .apl-validations)'),
		dropdownTriggers: count(':is([data-testid="dropdown-picker-button"], .dropdown-picker-button)'),
		actionBars: count(actionBarSelector),
	};
};

/** Vanilla opens the per-item menu on `mouseover`, and Playwright's own hover never lands on it. */
const openItemMenu = async (page, index) => {
	const button = page.locator(ITEM).nth(index).locator(`:scope > ${q('list-picker-item-header')} > ${q('list-picker-item-actions')}`);
	await button.scrollIntoViewIfNeeded();
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
	const list = document.querySelector(
		'#apl-priority-list :is([data-testid="apl-priority-list-picker-root"], .apl-priority-list-picker-root) > :is([data-testid="list-picker-root"], .list-picker-root) > :is([data-testid="list-picker-items"], .list-picker-items)',
	);
	const items = [...(list?.children ?? [])].filter(child => child.matches(':is([data-testid="list-picker-item-container"], .list-picker-item-container)'));
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
	window.__aplLongTasks = [];
	new PerformanceObserver(list => {
		for (const entry of list.getEntries()) window.__aplLongTasks.push(entry.duration);
	}).observe({ entryTypes: ['longtask'] });

	// A safe point to drop onto `row`: scans down its left gutter for the first point whose
	// `elementFromPoint` nearest `[data-list-item]` ancestor is `row` itself and is not inside an
	// interactive control — row heights and nested pickers vary too much to trust a fixed offset.
	window.findDropPoint = row => {
		row.scrollIntoView({ block: 'nearest' });
		const rect = row.getBoundingClientRect();
		for (const xFraction of [0.15, 0.5, 0.85]) {
			const x = rect.x + rect.width * xFraction;
			for (let yFraction = 0.1; yFraction <= 0.9; yFraction += 0.1) {
				const y = rect.y + rect.height * yFraction;
				const atPoint = document.elementFromPoint(x, y);
				if (!atPoint) continue;
				if (atPoint.closest('[data-list-item]') !== row) continue;
				if (atPoint.closest('button, input, select, textarea, [role="combobox"], [role="button"]')) continue;
				return { x, y };
			}
		}
		return null;
	};
});

try {
	await page.goto(`http://localhost:${PORT}/mop/${SPEC}/`, { waitUntil: 'load', timeout: 60000 });
	await page.waitForSelector('[data-testid="sim-ui"], .sim-ui', { timeout: 60000 });
	await page.waitForTimeout(2500);

	await page.click(':is([data-testid="sim-tabs"], .sim-tabs) .rotation-tab, :is([data-testid="sim-tabs"], .sim-tabs) li.rotation-tab .nav-link');
	await page.waitForTimeout(600);

	// Some specs (monk/windwalker among them) default to a non-APL rotation type, so the APL pane
	// exists in the DOM but stays on the inactive tab until something switches to it. The dropdown
	// itself is still mid fade-in right after the tab click, so its current text is read straight off
	// the DOM rather than through a locator, which would otherwise wait on visibility that never
	// resolves before the transition settles.
	const currentType = await page.evaluate(() => document.getElementById('rotation-tab-rotation-type')?.textContent?.trim());
	if (currentType && currentType !== 'APL') {
		await page.locator('#rotation-tab-rotation-type').first().click({ timeout: 10000 });
		await page.waitForTimeout(300);
		await page.locator(`${q('dropdown-picker-list')} li, ${q('dropdown-picker-item')}`).locator('visible=true').getByText('APL', { exact: true }).first().click({ timeout: 10000 });
		await page.waitForTimeout(600);
	}

	await page.waitForSelector('#apl-priority-list', { state: 'visible', timeout: 15000 });
	await page.waitForTimeout(1200);

	console.log(`${SPEC} on :${PORT}\n`);
	console.log('structure');
	for (const [key, value] of Object.entries(await page.evaluate(structure, q('apl-floating-action-bar-root')))) console.log(`  ${key.padEnd(18)} ${value}`);

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
		const live = await page.evaluate(selector => document.querySelectorAll(selector).length, ITEM);
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
	await step('add action', () => page.locator(`${LIST} ${q('apl-floating-action-bar-root')} .ui-button-primary`).first().click());

	// 2. edit — the first numeric or text field in the pane, committed on `change` as both stacks require.
	await step('edit a value', () =>
		page.evaluate(() => {
			const input = [
				...document.querySelectorAll(
					'#apl-priority-list :is([data-testid="apl-priority-list-picker-root"], .apl-priority-list-picker-root) input[type=text]',
				),
			].find(
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
		}, `${ITEM}:first-of-type > ${q('list-picker-item-header')} ${q('list-picker-item-popover')} > ${q('list-picker-item-delete')}`);
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
		const trigger = page.locator(`${LIST} ${q('apl-action-condition')} :is([data-testid="dropdown-picker-button"], .dropdown-picker-button)`).locator('visible=true').first();
		if (!(await trigger.count())) return 'NO CONDITION PICKER';
		await trigger.click({ timeout: 10000 });
		await page.waitForTimeout(500);
		const options = await page.evaluate(() => document.querySelectorAll(':is([data-testid="dropdown-picker-item"], .dropdown-picker-item), :is([data-testid="dropdown-picker-list"], .dropdown-picker-list) li').length);
		await page.keyboard.press('Escape');
		return `${options > 0 ? 'menu opened' : 'MENU EMPTY'}`;
	});

	// 6. the sub-tab strip. Bootstrap's tab plugin drives it on the baseline and React state on the
	// branch, and the three things they have to agree on are which pane is open, which tab says so,
	// and that `show` has caught up with `active` once the .15s fade has run.
	await step('walk the sub-tabs', async () => {
		const seen = [];
		for (const id of ['apl-action-groups', 'apl-variables', 'apl-priority-list']) {
			await page.click(`${NAVBAR} [aria-controls="${id}"]`, { timeout: 10000 });
			await page.waitForTimeout(400);
			seen.push(
				await page.evaluate(navbar => {
					const rotationTabApl = ':is([data-testid="rotation-tab-apl"], .rotation-tab-apl)';
					const ids = selector => [...document.querySelectorAll(`${rotationTabApl} :is(${selector})`)].map(pane => pane.id.replace('apl-', '')).join('+');
					const pane = ':is([data-testid="tab-pane"], .tab-pane)';
					const active = `${pane}.active, ${pane}:not([hidden]):not([data-ending-style])`;
					const show = `${pane}.show, ${pane}:not([hidden]):not([data-starting-style]):not([data-ending-style])`;
					const selected = [...document.querySelectorAll(`${navbar} [role=tab][aria-selected="true"]`)]
						.map(tab => tab.getAttribute('aria-controls').replace('apl-', ''))
						.join('+');
					return `${ids(active)}/${ids(show)}/${selected}`;
				}, NAVBAR),
			);
		}
		return seen.join(' ');
	});

	// 6b. the same walk by key. The strip's arrows were Bootstrap's, then a hand-rolled handler, and
	// are Base UI's composite now; a unit test cannot hold them, because happy-dom does not answer the
	// composite's key events. Each entry reads `key:selected`, and names the pane or the focus
	// separately only when one of them has failed to follow the selection.
	await step('walk the sub-tabs by key', async () => {
		await page.evaluate(navbar => document.querySelector(`${navbar} [role=tab][aria-selected="true"]`)?.focus(), NAVBAR);
		const seen = [];
		for (const key of ['ArrowRight', 'ArrowRight', 'ArrowRight', 'End', 'Home', 'ArrowLeft']) {
			await page.keyboard.press(key);
			await page.waitForTimeout(400);
			seen.push(
				await page.evaluate(
					({ pressed, navbar }) => {
						const short = value => (value ?? '-').replace('apl-', '');
						const selected = short(document.querySelector(`${navbar} [role=tab][aria-selected="true"]`)?.getAttribute('aria-controls'));
						const paneSel = ':is([data-testid="tab-pane"], .tab-pane)';
						const activeSel = `${paneSel}.active, ${paneSel}:not([hidden]):not([data-ending-style])`;
						const rotationTabApl = ':is([data-testid="rotation-tab-apl"], .rotation-tab-apl)';
						const active = [...document.querySelectorAll(`${rotationTabApl} :is(${activeSel})`)].map(pane => short(pane.id)).join('+');
						const focused = short(document.activeElement?.getAttribute?.('aria-controls'));
						return `${pressed}:${selected}${active === selected ? '' : `/PANE=${active}`}${focused === selected ? '' : `/FOCUS=${focused}`}`;
					},
					{ pressed: key, navbar: NAVBAR },
				),
			);
		}
		return seen.join(' ');
	});

	// 7. rotation type — away from APL and back, which rebuilds the whole pane on both stacks.
	await step('type -> Auto', () =>
		page.evaluate(navbar => {
			const picker = document.querySelector(`${navbar} :is([data-testid="rotation-type-container"], .rotation-type-container) :is([data-testid="dropdown-picker-button"], .dropdown-picker-button)`);
			picker?.click();
		}, NAVBAR),
	);
	await page.waitForTimeout(400);
	await step('pick the first type', async () => {
		const option = page.locator(`${q('dropdown-picker-list')} li, ${q('dropdown-picker-item')}`).locator('visible=true').first();
		if (!(await option.count())) return 'NO TYPE MENU';
		await option.click({ timeout: 10000 });
		return 'clicked';
	});

	const after = await page.evaluate(readRotation);
	console.log(`\nend                      items=${after?.items} prepull=${after?.prepull} type=${after?.type} head=[${after?.head}]`);
	console.log(`kinds                    ${after?.kinds}`);

	// 8. a REAL mouse drag on the Default preset — the freeze this guards against only shows up under
	// native HTML5 DnD (per-pixel `dragover`s), never under the synthetic `DragEvent`s step 4 fires.
	// A fresh navigation, rather than reusing the page steps 1-7 left mutated, is what makes this
	// deterministic: it starts from the same clean state as the manual repro that first found the bug.
	console.log('');
	await page.goto(`http://localhost:${PORT}/mop/${SPEC}/`, { waitUntil: 'load', timeout: 60000 });
	await page.waitForSelector('[data-testid="sim-ui"], .sim-ui', { timeout: 60000 });
	await page.waitForTimeout(2500);
	await page.click(':is([data-testid="sim-tabs"], .sim-tabs) .rotation-tab, :is([data-testid="sim-tabs"], .sim-tabs) li.rotation-tab .nav-link');
	await page.waitForTimeout(600);

	await step('load Default preset', async () => {
		const currentType = await page.evaluate(() => document.getElementById('rotation-tab-rotation-type')?.textContent?.trim());
		if (currentType && currentType !== 'APL') {
			await page.locator('#rotation-tab-rotation-type').first().click({ timeout: 10000 });
			await page.waitForTimeout(300);
			await page.locator(`${q('dropdown-picker-list')} li, ${q('dropdown-picker-item')}`).locator('visible=true').getByText('APL', { exact: true }).first().click({ timeout: 10000 });
			await page.waitForTimeout(600);
		}
		await page.waitForSelector('#apl-priority-list', { state: 'visible', timeout: 15000 });
		const preset = page.locator(':is([data-testid="saved-data-set-name"], .saved-data-set-name):has-text("Default")').locator('visible=true').first();
		if (!(await preset.count())) return 'NO DEFAULT PRESET';
		await preset.click();
		await page.waitForTimeout(1200);
		return 'loaded';
	});

	// A safe drop point on item index `targetIndex`: scanned in the page, not guessed by a fixed
	// offset — row heights and nested pickers vary, and a blind offset can land on a nested picker
	// with a different itemLabel (silently rejected) or an interactive control (never reached).
	const dropPointFor = targetIndex =>
		page.evaluate(([sel, index]) => {
			const items = [...document.querySelectorAll(sel)];
			const row = items[index];
			if (!row) return null;
			return findDropPoint(row);
		}, [ITEM, targetIndex]);

	const boxOf = index =>
		page.evaluate(([sel, i]) => {
			const el = document.querySelectorAll(sel)[i];
			if (!el) return null;
			const rect = el.getBoundingClientRect();
			return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
		}, [ITEM, index]);

	await step('real mouse drag 0 -> 6 (freeze check)', async () => {
		// The drop point's own scan scrolls the target into view first, so read the source's box only
		// after that settles — scrolling to center the 6th row can move the 0th row too.
		let point = await dropPointFor(6);
		for (let attempt = 0; attempt < 8 && !point; attempt++) {
			await page.waitForTimeout(300);
			point = await dropPointFor(6);
		}
		if (!point) return 'NO SAFE DROP POINT ON TARGET ROW';
		const fromBox = await boxOf(0);
		if (!fromBox) return 'NO SOURCE ROW';
		const before = await page.evaluate(readRotation);
		await page.evaluate(() => {
			window.__aplLongTasks = [];
		});
		await page.mouse.move(fromBox.x + fromBox.width / 2, fromBox.y + 10);
		await page.mouse.down();
		await page.waitForTimeout(150);
		const steps = 40;
		for (let index = 1; index <= steps; index++) {
			const x = fromBox.x + fromBox.width / 2 + ((point.x - fromBox.x - fromBox.width / 2) * index) / steps;
			const y = fromBox.y + 10 + ((point.y - fromBox.y - 10) * index) / steps;
			await page.mouse.move(x, y, { steps: 1 });
			await page.waitForTimeout(15);
		}
		await page.mouse.up();
		// The page must answer within 3s of the drop — that is the "frozen until reload" symptom made
		// measurable: a real freeze never answers this at all.
		const responsive = await Promise.race([
			page.evaluate(() => 1).then(() => true),
			new Promise(resolve => setTimeout(() => resolve(false), 3000)),
		]);
		if (!responsive) {
			errors.push('FROZEN: page did not respond within 3s of a real drag drop');
			return 'FROZEN: page did not respond within 3s of drop';
		}
		await page.waitForTimeout(300);
		const after = await page.evaluate(readRotation);
		if (before?.head === after?.head) errors.push('drag 0 -> 6 landed on a safe point but did not reorder');
		const longTasks = await page.evaluate(() => window.__aplLongTasks);
		const maxTask = Math.max(0, ...longTasks);
		return `responsive, reordered=${before?.head !== after?.head}, longest main-thread block ${Math.round(maxTask)}ms (${longTasks.length} long tasks)`;
	});

	// 9. the sticky toolbar under the list must not swallow a drop meant for the row underneath it —
	// the freeze this unit actually found. Once the toolbar goes `pointer-events-none` mid-drag, a
	// safe point on the row the toolbar overlaps must resolve to that row, and the drop must commit.
	await step('drop at the sticky toolbar reaches the row underneath', async () => {
		const barRow = await page.evaluate(([sel]) => {
			const bar = document.querySelector('[data-testid="apl-floating-action-bar-root"]');
			const items = [...document.querySelectorAll(sel)];
			if (!bar) return null;
			const barRect = bar.getBoundingClientRect();
			const overlapping = items.findIndex(item => {
				const r = item.getBoundingClientRect();
				return barRect.y < r.y + r.height && barRect.y + barRect.height > r.y;
			});
			return overlapping;
		}, [ITEM]);
		if (barRow == null || barRow < 0) return 'NO ROW UNDER THE TOOLBAR';
		let point = await dropPointFor(barRow);
		for (let attempt = 0; attempt < 8 && !point; attempt++) {
			await page.waitForTimeout(300);
			point = await dropPointFor(barRow);
		}
		if (!point) return `NO SAFE DROP POINT ON ROW ${barRow} (under the toolbar)`;
		const fromBox = await boxOf(0);
		if (!fromBox) return 'NO SOURCE ROW';
		const before = await page.evaluate(readRotation);
		await page.mouse.move(fromBox.x + fromBox.width / 2, fromBox.y + 10);
		await page.mouse.down();
		await page.waitForTimeout(150);
		const steps = 25;
		for (let index = 1; index <= steps; index++) {
			const x = fromBox.x + fromBox.width / 2 + ((point.x - fromBox.x - fromBox.width / 2) * index) / steps;
			const y = fromBox.y + 10 + ((point.y - fromBox.y - 10) * index) / steps;
			await page.mouse.move(x, y, { steps: 1 });
			await page.waitForTimeout(15);
		}
		await page.mouse.up();
		await page.waitForTimeout(500);
		const after = await page.evaluate(readRotation);
		if (before?.head === after?.head) errors.push(`drop at the toolbar's row (index ${barRow}) did not reorder`);
		return `target row=${barRow}, reordered=${before?.head !== after?.head}`;
	});
} finally {
	for (const error of errors) console.log(`  ERROR ${error}`);
	await context.close();
	await browser.close();
}
process.exit(errors.length ? 1 : 0);

// The gear tab's behaviour — what its blocks and cells do once you operate them.
//
// `parity.mjs` and `panes-parity.mjs` both compare this pane element for element (it is the one pane
// they both see), so the shape at rest is covered and nothing here repeats it. `SERIALIZE` emits tag
// plus sorted classes and excludes text and attributes, so item names, item levels, enchant labels,
// wowhead hrefs, gem icons and everything that only happens after a click are invisible to it.
//
// The whole output should be identical on both builds. Two things it therefore reads rather than
// asserts a fixed value for: the spec's default gear, and the selector modal's row counts.
//
// The item selector, its list and its filters menu are still vanilla on both builds. They are
// exercised here anyway, because the cycle between the gear picker and the modal was cut for this
// port: the modal used to read `gearPicker.itemPickers[i]` for the rail's icons and for its
// ArrowUp/ArrowDown navigation, and now takes a `SlotRailEntry[]`. Opening the modal from a cell and
// walking the rail is what proves that cut on both builds.
import { launch, openSpec, PORTS } from './browser.mjs';

const SPEC = process.argv[2] ?? 'warrior/arms';
const PORT = Number(process.env.PORT ?? PORTS.base);

const INSTALL = () => {
	const pane = () => document.getElementById('gear-tab');
	const text = el => (el?.textContent ?? '').replace(/\s+/g, ' ').trim();

	window.gearProbe = {
		// Each summary block by its own modifier class, so a block that stops rendering reads as
		// missing rather than as empty.
		summaries: () =>
			[...pane().querySelectorAll('.summary-table-root')].map(root => {
				const block = root.querySelector('.content-block');
				const modifier = [...(block?.classList ?? [])].find(name => name.startsWith('summary-table--')) ?? '?';
				return {
					modifier,
					hidden: root.classList.contains('hide'),
					title: text(root.querySelector('.content-block-title')),
					reset: text(root.querySelector('.summary-table-reset-button')) || null,
					rows: [...root.querySelectorAll('.summary-table-row')].map(row => text(row)),
					footer: [...root.querySelectorAll('.content-block-body > div:not(.summary-table-row) button')].map(button => text(button)),
				};
			}),
		// One line per equipped-item cell. Everything here is text or an attribute, which is exactly
		// what the two tree gates cannot see.
		cells: () =>
			[...pane().querySelectorAll('.gear-picker-root .item-picker-root')].map(cell => {
				const label = el => (el && !el.classList.contains('hide') ? text(el) : null);
				const icon = cell.querySelector('.item-picker-icon');
				return {
					ilvl: text(cell.querySelector('.item-picker-ilvl')),
					name: text(cell.querySelector('.item-picker-name-container')),
					quality: [...(cell.querySelector('.item-picker-name-container')?.classList ?? [])].find(name => name.startsWith('text-')) ?? null,
					icon: (icon?.getAttribute('style') ?? '').includes('url(') ? 'set' : 'unset',
					linked: !!icon?.getAttribute('href'),
					wowhead: !!icon?.getAttribute('data-wowhead'),
					enchant: label(cell.querySelector('.item-picker-enchant')),
					tinker: label(cell.querySelector('.item-picker-tinker')),
					reforge: label(cell.querySelector('.item-picker-reforge')),
					sockets: [...cell.querySelectorAll('.gem-socket-container')].map(socket => (socket.classList.contains('hide') ? 'hidden' : 'shown')),
				};
			}),
		modal: () => {
			// `.selector-modal` is on the `.modal-dialog`; `.show` lands on the `.modal` root above it.
			const modal = document.querySelector('.modal.show .selector-modal');
			if (!modal) return { open: false };
			return {
				open: true,
				title: text(modal.querySelector('.selector-modal-title')),
				tabs: [...modal.querySelectorAll('.selector-modal-tabs .nav-link')].map(tab => text(tab)),
				activeTab: text(modal.querySelector('.selector-modal-tabs .nav-link.active')),
				railSlots: modal.querySelectorAll('.gear-picker-modal-slots .item-picker-icon-wrapper').length,
				railActive: modal.querySelector('.gear-picker-modal-slots .item-picker-icon-wrapper.active')?.getAttribute('data-slot') ?? null,
				rows: modal.querySelectorAll('.selector-modal-tab-pane.active .selector-modal-list-item').length,
			};
		},
		// The autosaved blob is the oracle, the same one settings-tab.mjs and talents.mjs read: what
		// the picker shows and what the sim will run are two different questions.
		gear: () => {
			let saved = null;
			for (const key of Object.keys(localStorage)) {
				if (!key.endsWith('__currentSettings__')) continue;
				try {
					saved = JSON.parse(localStorage.getItem(key));
				} catch {
					// Not the blob we are after.
				}
			}
			const items = saved?.player?.equipment?.items ?? [];
			return items.map(item =>
				item?.id
					? `${item.id}${item.enchant ? `e${item.enchant}` : ''}${item.gems ? `g${item.gems.join(',')}` : ''}${item.reforging ? `r${item.reforging}` : ''}${item.upgradeStep ? `u${item.upgradeStep}` : ''}`
					: '-',
			);
		},
		// `navigator.clipboard` does not exist under a headless origin, and the copy button falls back
		// to `alert` there, which openSpec stubs to a noop. Recording the write is the only way to see
		// the payload at all.
		// Both write paths, because the button has used each: the vanilla class called
		// `navigator.clipboard.writeText`, and `react-use` copies through `copy-to-clipboard`, which
		// selects a detached node and runs `document.execCommand('copy')` without touching
		// `navigator.clipboard` at all. Stubbing only one makes this read `null` and blames the button
		// for a probe that missed.
		stubClipboard: () => {
			window.__copied = null;
			Object.defineProperty(navigator, 'clipboard', {
				configurable: true,
				value: { writeText: value => ((window.__copied = value), Promise.resolve()) },
			});
			const execCommand = document.execCommand?.bind(document);
			document.execCommand = command => {
				if (command === 'copy') window.__copied = String(window.getSelection());
				return execCommand ? execCommand(command) : true;
			};
		},
		copied: () => window.__copied,
		// Offsets down each column, so a popover that lands in the flow between two cells — and moves
		// the `:nth-child(6)` weapon separator with it — reads as a cell that moved.
		cellTops: () => {
			const root = pane().querySelector('.gear-picker-root');
			const origin = root.getBoundingClientRect().top;
			return [...root.querySelectorAll('.item-picker-root')].map(cell => Math.round(cell.getBoundingClientRect().top - origin));
		},
		popoverStyle: () => {
			const box = document.querySelector('.sim-tooltip.tooltip-quick-swap, .tippy-box[data-theme="tooltip-quick-swap"]');
			if (!box) return null;
			const align = el => (el ? getComputedStyle(el).textAlign : 'missing');
			return `box=${align(box)} empty=${align(box.querySelector('.tooltip-quick-swap__empty'))} footer=${align(box.querySelector('.tooltip-quick-swap__footer'))}`;
		},
		quickSwap: () => {
			const popover = document.querySelector('.sim-tooltip.tooltip-quick-swap, .tippy-box[data-theme="tooltip-quick-swap"]');
			if (!popover) return { open: false };
			return {
				open: true,
				title: text(popover.querySelector('.tooltip-quick-swap__title')),
				entries: [...popover.querySelectorAll('.tooltip-quick-swap__label')].map(label => text(label)),
				active: [...popover.querySelectorAll('.tooltip-quick-swap__anchor')].map(anchor => anchor.classList.contains('active')),
				empty: text(popover.querySelector('.tooltip-quick-swap__empty')) || null,
				footer: text(popover.querySelector('.tooltip-quick-swap__footer button')),
			};
		},
	};
};

const browser = await launch();
const { page, errors } = await openSpec(browser, PORT, SPEC, { selector: '.sim-tabs' });
await page.addInitScript(INSTALL);
await page.evaluate(INSTALL);
await page.evaluate(() =>
	window.simTabsProbe
		.tabs()
		.find(tab => window.simTabsProbe.idOf(tab) === 'gear-tab')
		?.click(),
);
await page.waitForSelector('#gear-tab .gear-picker-root .item-picker-root', { timeout: 60000, state: 'visible' });
// The cells fill their icons and wowhead datasets asynchronously, and the summaries wait for the
// spec's default gear to land.
await page.waitForTimeout(2500);

const problems = [];
const say = line => console.log(line);

say(`${SPEC} on :${PORT}\n`);

// ---------------------------------------------------------------------------
say('summary blocks at rest');
const summaries = await page.evaluate(() => window.gearProbe.summaries());
for (const summary of summaries) {
	say(`  ${summary.modifier.padEnd(28)} hidden=${String(summary.hidden).padEnd(5)} reset=${JSON.stringify(summary.reset)}`);
	for (const row of summary.rows) say(`    row    ${row}`);
	for (const button of summary.footer) say(`    footer ${button}`);
}
const byModifier = Object.fromEntries(summaries.map(summary => [summary.modifier, summary]));
for (const modifier of ['summary-table--gems', 'summary-table--reforge', 'summary-table--upgrade-costs']) {
	const summary = byModifier[modifier];
	if (!summary) problems.push(`${modifier} is missing from the pane`);
	else if (!summary.hidden && !summary.reset) problems.push(`${modifier} is shown with no reset button`);
	else if (summary.hidden && summary.reset) problems.push(`${modifier} is hidden but still built its reset button`);
}

// ---------------------------------------------------------------------------
say('\nequipped-item cells');
const cells = await page.evaluate(() => window.gearProbe.cells());
if (cells.length !== 16) problems.push(`${cells.length} item cells, expected 16`);
for (const [index, cell] of cells.entries()) {
	say(
		`  ${String(index).padStart(2)} ilvl=${cell.ilvl.padEnd(6)} ${cell.quality ?? 'none'} icon=${cell.icon} link=${Number(cell.linked)} wh=${Number(cell.wowhead)} sockets=[${cell.sockets}] ${cell.name}`,
	);
	if (cell.enchant) say(`     enchant ${cell.enchant}`);
	if (cell.tinker) say(`     tinker  ${cell.tinker}`);
	if (cell.reforge) say(`     reforge ${cell.reforge}`);
}
const filled = cells.filter(cell => cell.quality);
if (!filled.length) problems.push('no cell shows an equipped item — the whole readout above is empty');
for (const cell of filled) {
	if (cell.icon !== 'set') problems.push(`${cell.name}: the icon has no background image`);
	if (!cell.linked) problems.push(`${cell.name}: the icon anchor has no wowhead href`);
	if (!cell.wowhead) problems.push(`${cell.name}: the icon anchor has no wowhead tooltip dataset`);
	if (!cell.ilvl) problems.push(`${cell.name}: no item level`);
}

// ---------------------------------------------------------------------------
// The cut this port made: the modal used to reach into the gear picker's cells for the rail and for
// its keyboard navigation.
say('\nselector modal, opened from a cell');
// The cells are the left column then the right one, and each column's slot list is fixed, so a
// cell's position in the DOM is not its `ItemSlot`. The rail and the equipment array are both in
// slot order, so the two readouts only line up through this.
const SLOT_OF_CELL = [0, 1, 2, 3, 4, 5, 14, 15, 6, 7, 8, 9, 10, 11, 12, 13];
const cell = index => page.locator('#gear-tab .gear-picker-root .item-picker-root').nth(index);
await cell(0).locator('.item-picker-icon').click();
await page.waitForSelector('.modal.show .selector-modal', { timeout: 20000 });
await page.waitForTimeout(600);
const opened = await page.evaluate(() => window.gearProbe.modal());
say(
	`  opened      title=${JSON.stringify(opened.title)} tab=${JSON.stringify(opened.activeTab)} rail=${opened.railSlots} active=${opened.railActive} rows=${opened.rows}`,
);
say(`  tabs        ${opened.tabs.join(' | ')}`);
if (opened.railSlots !== 16) problems.push(`the slot rail has ${opened.railSlots} icons, expected 16`);
if (opened.railActive !== '0') problems.push(`opening the head cell left rail slot ${opened.railActive} active, expected 0`);
if (!opened.rows) problems.push('the items tab opened with no rows');

await page.keyboard.press('ArrowDown');
await page.waitForTimeout(600);
const stepped = await page.evaluate(() => window.gearProbe.modal());
say(`  ArrowDown   title=${JSON.stringify(stepped.title)} active=${stepped.railActive} rows=${stepped.rows}`);
if (stepped.railActive !== '1') problems.push(`ArrowDown left rail slot ${stepped.railActive} active, expected 1`);
await page.keyboard.press('ArrowUp');
await page.waitForTimeout(600);
const back = await page.evaluate(() => window.gearProbe.modal());
say(`  ArrowUp     title=${JSON.stringify(back.title)} active=${back.railActive}`);
if (back.railActive !== '0') problems.push(`ArrowUp left rail slot ${back.railActive} active, expected 0`);

// Wrapping is what tells an index walk apart from an enum walk: both land on 15 here today, because
// gear's rail is all 16 slots in enum order, but only the index walk still wraps on a sparse rail.
await page.keyboard.press('ArrowUp');
await page.waitForTimeout(600);
const wrapped = await page.evaluate(() => window.gearProbe.modal());
say(`  ArrowUp     active=${wrapped.railActive} (wrapped)`);
if (wrapped.railActive !== '15') problems.push(`ArrowUp from the first slot left ${wrapped.railActive} active, expected it to wrap to 15`);

// Clicking a rail icon is the third reader of the entry, and the one a cell never triggers.
await page.click('.modal.show .gear-picker-modal-slots .item-picker-icon-wrapper:nth-of-type(3) .item-picker-icon');
await page.waitForTimeout(700);
const railClicked = await page.evaluate(() => window.gearProbe.modal());
say(`  rail click  title=${JSON.stringify(railClicked.title)} active=${railClicked.railActive} rows=${railClicked.rows}`);
if (railClicked.railActive !== '2') problems.push(`clicking the third rail icon left slot ${railClicked.railActive} active, expected 2`);

await page.keyboard.press('Escape');
await page.waitForTimeout(600);

// ---------------------------------------------------------------------------
// The favourites popover, end to end: favourite an enchant in the modal, then equip it from the
// popover the enchant label opens.
say('\nquick swap: favourite an enchant, then equip it from the popover');
const enchanted = cells.findIndex(cell => cell.enchant);
if (enchanted < 0) {
	problems.push('no cell shows an enchant, so the quick-swap path was not exercised');
} else {
	const enchantLabel = cell(enchanted).locator('.item-picker-enchant');
	await enchantLabel.click();
	await page.waitForSelector('.modal.show .selector-modal', { timeout: 20000 });
	await page.waitForTimeout(700);
	const enchantTab = await page.evaluate(() => window.gearProbe.modal());
	say(`  modal       tab=${JSON.stringify(enchantTab.activeTab)} rows=${enchantTab.rows}`);

	// The first row that is not the equipped one — `.active` marks that — so equipping the favourite
	// afterwards is a change rather than a no-op. Favouriting the equipped enchant is how the first
	// draft of this check passed while proving nothing.
	const rows = page.locator('.modal.show .selector-modal-tab-pane.active .selector-modal-list-item');
	const rowCount = await rows.count();
	let target = -1;
	for (let index = 0; index < rowCount; index++) {
		if (!(await rows.nth(index).evaluate(row => row.classList.contains('active')))) {
			target = index;
			break;
		}
	}
	if (target < 0) problems.push('every enchant row is the equipped one — nothing to favourite');
	const favouriteName = target < 0 ? null : (await rows.nth(target).locator('.selector-modal-list-item-name').textContent())?.replace(/\s+/g, ' ').trim();
	if (target >= 0) await rows.nth(target).locator('.selector-modal-list-item-favorite').click();
	await page.keyboard.press('Escape');
	await page.waitForTimeout(700);

	const topsBefore = await page.evaluate(() => window.gearProbe.cellTops());
	await enchantLabel.hover();
	await page.waitForTimeout(900);
	const popover = await page.evaluate(() => window.gearProbe.quickSwap());
	const topsDuring = await page.evaluate(() => window.gearProbe.cellTops());
	const shifted = topsDuring.map((top, index) => (top === topsBefore[index] ? null : index)).filter(index => index !== null);
	say(`  layout      cells moved while the popover is open: ${JSON.stringify(shifted)}`);
	if (shifted.length) problems.push(`opening the popover moved cells ${JSON.stringify(shifted)} — it is rendering into the column's flow`);
	say(
		`  popover     open=${popover.open} title=${JSON.stringify(popover.title ?? null)} entries=${JSON.stringify(popover.entries ?? [])} footer=${JSON.stringify(popover.footer ?? null)}`,
	);
	if (!popover.open) problems.push('hovering the enchant label opened no favourites popover');
	else if (!popover.entries.includes(favouriteName))
		problems.push(`the popover lists ${JSON.stringify(popover.entries)}, which does not include the enchant just favourited (${favouriteName})`);

	const before = await page.evaluate(() => window.gearProbe.gear());
	await page.click('.tooltip-quick-swap__anchor');
	await page.waitForTimeout(900);
	const after = await page.evaluate(() => window.gearProbe.gear());
	const moved = after.map((entry, index) => (entry === before[index] ? null : index)).filter(index => index !== null);
	say(`  equipped    slots changed: ${JSON.stringify(moved)}`);
	if (moved.length !== 1) problems.push(`clicking the favourite changed ${moved.length} slots, expected exactly one`);
	else if (moved[0] !== SLOT_OF_CELL[enchanted])
		problems.push(`clicking the favourite changed slot ${moved[0]}, expected ${SLOT_OF_CELL[enchanted]} — the popover wrote back a stale item`);

	// The right column, which is the other half of the popover's placement. `:nth-child(6)` is a
	// left-column rule; `text-align: right` on the labels container is a right-column one, and a
	// popover rendered inside the cell inherits it. One hover cannot see both.
	await page.keyboard.press('Escape');
	await page.mouse.move(0, 0);
	await page.waitForTimeout(600);
	const rightEnchanted = cells.findIndex((entry, index) => index >= 8 && entry.enchant);
	if (rightEnchanted < 0) {
		problems.push('no right-column cell shows an enchant, so the popover was only opened in the left column');
	} else {
		const rightTopsBefore = await page.evaluate(() => window.gearProbe.cellTops());
		await cell(rightEnchanted).locator('.item-picker-enchant').hover();
		await page.waitForTimeout(900);
		const rightTopsDuring = await page.evaluate(() => window.gearProbe.cellTops());
		const rightShifted = rightTopsDuring.map((top, index) => (top === rightTopsBefore[index] ? null : index)).filter(index => index !== null);
		say(`  right col   cell ${rightEnchanted}, cells moved: ${JSON.stringify(rightShifted)}, ${await page.evaluate(() => window.gearProbe.popoverStyle())}`);
		if (rightShifted.length) problems.push(`opening a right-column popover moved cells ${JSON.stringify(rightShifted)}`);
	}
}

// ---------------------------------------------------------------------------
say('\nreforge summary: the copy button');
await page.evaluate(() => window.gearProbe.stubClipboard());
if (await page.locator('#gear-tab .reforge-summary-footer .copy-button').count()) {
	await page.click('#gear-tab .reforge-summary-footer .copy-button');
	await page.waitForTimeout(400);
	const copied = await page.evaluate(() => window.gearProbe.copied());
	let parsed = null;
	try {
		parsed = JSON.parse(copied ?? '');
	} catch {
		// Reported below.
	}
	say(`  payload     ${copied === null ? 'nothing was copied' : `${copied.length} chars, keys ${JSON.stringify(Object.keys(parsed ?? {}).sort())}`}`);
	if (!parsed?.player) problems.push('the copy button did not write a settings blob carrying a player');
} else {
	problems.push('no copy button in the reforge summary — that half of the block was not exercised');
}

// ---------------------------------------------------------------------------
// Destructive, so last, and in an order where each step still has something to act on.
say('\nthe four gear-writing buttons');
const step = async (label, action) => {
	const before = await page.evaluate(() => window.gearProbe.gear());
	await action();
	await page.waitForTimeout(900);
	const after = await page.evaluate(() => window.gearProbe.gear());
	const moved = after.filter((entry, index) => entry !== before[index]).length;
	const summary = await page.evaluate(() => window.gearProbe.summaries());
	say(
		`  ${label.padEnd(20)} slots changed=${String(moved).padEnd(3)} hidden=[${summary.map(block => `${block.modifier.replace('summary-table--', '')}:${Number(block.hidden)}`).join(' ')}]`,
	);
	return { moved, summary: Object.fromEntries(summary.map(block => [block.modifier, block])) };
};

// Reset first: the shipped gear sets are already fully upgraded, so "upgrade all" is a no-op until
// something has been reset, and asserting it in the other order asserts nothing.
const resetUpgrades = await step('reset upgrades', () => page.click('#gear-tab .summary-table--upgrade-costs .summary-table-reset-button'));
if (!resetUpgrades.moved) problems.push('resetting upgrades changed no slot');
const upgradeAll = await step('upgrade all', () => page.click('#gear-tab .upgrade-costs-summary-footer button'));
if (upgradeAll.moved !== resetUpgrades.moved)
	problems.push(`"upgrade all" changed ${upgradeAll.moved} slots, and resetting upgrades had changed ${resetUpgrades.moved}`);
const resetReforges = await step('reset reforges', () => page.click('#gear-tab .summary-table--reforge .summary-table-reset-button'));
if (!resetReforges.moved) problems.push('resetting reforges changed no slot');
if (!resetReforges.summary['summary-table--reforge'].hidden) problems.push('the reforge summary is still shown after every reforge was removed');
const resetGems = await step('reset gems', () => page.click('#gear-tab .summary-table--gems .summary-table-reset-button'));
if (!resetGems.moved) problems.push('resetting gems changed no slot');
if (!resetGems.summary['summary-table--gems'].hidden) problems.push('the gem summary is still shown after every gem was removed');

say('');
for (const problem of problems) say(`  PROBLEM ${problem}`);
for (const error of errors) say(`  ERROR ${error}`);
say(problems.length || errors.length ? `${problems.length} problem(s), ${errors.length} error(s)` : 'ok');
await page.close();
await browser.close();
process.exit(problems.length || errors.length ? 1 : 0);

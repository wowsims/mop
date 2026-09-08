// The item selector modal, opened and operated — the region no other gate reaches.
//
// `gear-tab.mjs` opens it and walks the slot rail, and stops there: it reads a row count and never
// a row. Everything below the rail is invisible to every other check, because `parity.mjs` removes
// the modal from both trees by count and `panes-parity.mjs` only ever sees the six tab bodies.
//
// So this one operates it: which tabs a slot's data earns, the search box, both sortable headers,
// the virtual list under a deep scroll, equipping a row, and what the tab set becomes afterwards.
//
// Selectors are dual-shape, the way `gear-tab.mjs`'s popover readers are: the gear modal is a Base
// UI dialog on the port and a Bootstrap one on the baseline, and every other consumer of
// `SelectorModal` is still Bootstrap on both. Class names inside it are the contract, and they are
// what this reads.
//
// Row *counts* are deliberately never asserted across builds: the two virtual lists window
// differently, so what is in the DOM at a given scroll offset is an implementation detail. Row
// *names*, read by geometry from the rows overlapping the scroller's box, are data and must match.
//
// Set `PORT` to pick a build; the whole output should be identical on both.
import { launch, openSpec, PORTS } from './browser.mjs';

const SPEC = process.argv[2] ?? 'warrior/arms';
const PORT = Number(process.env.PORT ?? PORTS.base);

const INSTALL = () => {
	const text = el => (el?.textContent ?? '').replace(/\s+/g, ' ').trim();
	const modalRoot = () => document.querySelector('.modal.show .selector-modal, .sim-dialog-popup.selector-modal[data-open]');

	window.selectorProbe = {
		open: () => !!modalRoot(),
		head: () => {
			const modal = modalRoot();
			if (!modal) return { open: false };
			return {
				open: true,
				title: text(modal.querySelector('.selector-modal-title')),
				tabs: [...modal.querySelectorAll('.selector-modal-tabs .nav-link')].map(
					tab => text(tab) || (tab.classList.contains('selector-modal-tab-gem') ? '<gem>' : '?'),
				),
				activeTab: text(modal.querySelector('.selector-modal-tabs .nav-link.active')),
				gemTabs: modal.querySelectorAll('.selector-modal-tabs .selector-modal-tab-gem').length,
				railSlots: modal.querySelectorAll('.gear-picker-modal-slots .item-picker-icon-wrapper').length,
				railActive: modal.querySelector('.gear-picker-modal-slots .item-picker-icon-wrapper.active')?.getAttribute('data-slot') ?? null,
			};
		},
		// The controls in the active pane's filter row, by class rather than by position.
		filters: () => {
			const pane = modalRoot()?.querySelector('.selector-modal-tab-pane.active');
			if (!pane) return null;
			const shown = selector => {
				const el = pane.querySelector(selector);
				if (!el) return 'absent';
				return el.classList.contains('hide') || getComputedStyle(el).display === 'none' ? 'hidden' : 'shown';
			};
			return {
				search: !!pane.querySelector('.selector-modal-search'),
				filtersButton: text(pane.querySelector('.selector-modal-filters-button')) || null,
				phase: shown('.selector-modal-phase-selector'),
				weapons1h: shown('.selector-modal-show-1h-weapons'),
				weapons2h: shown('.selector-modal-show-2h-weapons'),
				matchingGems: shown('.selector-modal-show-matching-gems'),
				epValues: shown('.selector-modal-show-ep-values'),
				remove: text(pane.querySelector('.selector-modal-remove-button')) || null,
				headers: [...pane.querySelectorAll('.selector-modal-list-labels h6')].map(
					label => `${[...label.classList].sort().join('.')}:${text(label) || '-'}:${getComputedStyle(label).display === 'none' ? 'hidden' : 'shown'}`,
				),
				hideEp: !!pane.querySelector('.selector-modal-list.hide-ep'),
			};
		},
		// Geometry, not DOM order: the rows overlapping the scroller's box, top to bottom. Identical
		// on any windowing strategy, which row counts are not.
		visible: () => {
			const pane = modalRoot()?.querySelector('.selector-modal-tab-pane.active');
			const list = pane?.querySelector('.selector-modal-list');
			if (!list) return null;
			const box = list.getBoundingClientRect();
			const rows = [...pane.querySelectorAll('.selector-modal-list-item')]
				.map(row => ({ row, rect: row.getBoundingClientRect() }))
				.filter(({ rect }) => rect.height > 0 && rect.bottom > box.top + 1 && rect.top < box.bottom - 1)
				.sort((a, b) => a.rect.top - b.rect.top);
			return {
				scrollTop: Math.round(list.scrollTop),
				scrollHeight: Math.round(list.scrollHeight),
				clientHeight: Math.round(list.clientHeight),
				rendered: pane.querySelectorAll('.selector-modal-list-item').length,
				names: rows.map(({ row }) => text(row.querySelector('.selector-modal-list-item-name'))),
				ilvls: rows.map(({ row }) => text(row.querySelector('.selector-modal-list-item-ilvl-container')) || '-'),
				eps: rows.map(({ row }) => text(row.querySelector('.selector-modal-list-item-ep-value')) || '-'),
				active: rows.map(({ row }) => row.classList.contains('active')),
				heights: [...new Set(rows.map(({ rect }) => Math.round(rect.height)))].sort((a, b) => a - b),
			};
		},
		// Striping survives virtualisation only if every rendered row alternates with the one above it
		// — `:nth-child` parity on the baseline, `[data-stripe]` on the port. Reported as the shape of
		// the sequence rather than as colours, so a theme change does not read as a regression.
		stripes: () => {
			const pane = modalRoot()?.querySelector('.selector-modal-tab-pane.active');
			if (!pane) return null;
			const rows = [...pane.querySelectorAll('.selector-modal-list-item')]
				.map(row => ({ row, rect: row.getBoundingClientRect() }))
				.filter(({ rect }) => rect.height > 0)
				.sort((a, b) => a.rect.top - b.rect.top)
				.map(({ row }) => getComputedStyle(row).backgroundColor);
			const distinct = [...new Set(rows)];
			return {
				rows: rows.length,
				distinct: distinct.length,
				alternates: rows.every((colour, index) => index === 0 || colour !== rows[index - 1]),
				firstIsOdd: rows.length > 1 ? rows[0] !== rows[1] : null,
			};
		},
		// The equipped gear, out of the autosaved blob rather than the picker — the same oracle
		// `gear-tab.mjs` uses.
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
		scrollList: to => {
			const list = modalRoot()?.querySelector('.selector-modal-tab-pane.active .selector-modal-list');
			if (!list) return null;
			list.scrollTop = to === 'bottom' ? list.scrollHeight : to;
			list.dispatchEvent(new Event('scroll'));
			return Math.round(list.scrollTop);
		},
	};
};

const browser = await launch();
const { page, errors } = await openSpec(browser, PORT, SPEC, { selector: '.sim-tabs' });
await page.addInitScript(INSTALL);
await page.evaluate(INSTALL);

const problems = [];
const say = line => console.log(line);
// Two roots, so a descendant selector has to be spelled out under each — a bare comma between them
// binds looser than the combinator and matches the modal root itself.
const ROOTS = ['.modal.show .selector-modal', '.sim-dialog-popup.selector-modal[data-open]'];
const modalRoot = ROOTS.join(', ');
const sel = suffix => ROOTS.map(root => `${root} ${suffix}`).join(', ');
const pane = () => page.locator(sel('.selector-modal-tab-pane.active')).first();
const rows = () => pane().locator('.selector-modal-list-item');
const settle = (ms = 700) => page.waitForTimeout(ms);
const head = () => page.evaluate(() => window.selectorProbe.head());

say(`${SPEC} on :${PORT}\n`);

await page.evaluate(() =>
	window.simTabsProbe
		.tabs()
		.find(tab => window.simTabsProbe.idOf(tab) === 'gear-tab')
		?.click(),
);
await page.waitForSelector('#gear-tab .gear-picker-root .item-picker-root', { timeout: 60000, state: 'visible' });
await page.waitForTimeout(2500);

// ---------------------------------------------------------------------------
// The head slot: sockets, an upgrade track and a reforge are all available there, so it is the one
// cell whose tab set exercises every conditional branch at once.
say('opened from the head cell');
await page.locator('#gear-tab .gear-picker-root .item-picker-root').first().locator('.item-picker-icon').click();
await page.waitForSelector(modalRoot, { timeout: 20000 });
await settle();
const opened = await head();
say(`  title       ${JSON.stringify(opened.title)}  active=${JSON.stringify(opened.activeTab)}  rail=${opened.railSlots}/${opened.railActive}`);
say(`  tabs        ${JSON.stringify(opened.tabs)}  gemTabs=${opened.gemTabs}`);
if (!opened.open) problems.push('the head cell opened no modal');
if (opened.railSlots !== 16) problems.push(`the rail has ${opened.railSlots} icons, expected 16`);
if (opened.activeTab !== opened.tabs[0]) problems.push(`the modal opened on ${JSON.stringify(opened.activeTab)}, expected the first tab ${JSON.stringify(opened.tabs[0])}`);

say('\nthe items pane at rest');
const atRest = await page.evaluate(() => window.selectorProbe.filters());
say(`  controls    filters=${JSON.stringify(atRest.filtersButton)} remove=${JSON.stringify(atRest.remove)} search=${atRest.search}`);
say(`  options     phase=${atRest.phase} 1h=${atRest.weapons1h} 2h=${atRest.weapons2h} gems=${atRest.matchingGems} ep=${atRest.epValues} hideEp=${atRest.hideEp}`);
for (const header of atRest.headers) say(`  header      ${header}`);
if (!atRest.search) problems.push('the items pane has no search box');
if (atRest.matchingGems !== 'hidden') problems.push(`the matching-gems option is ${atRest.matchingGems} on the items tab, expected hidden`);

const first = await page.evaluate(() => window.selectorProbe.visible());
say(`  list        scroll=${first.scrollTop}/${first.scrollHeight} client=${first.clientHeight} rowHeights=${JSON.stringify(first.heights)}`);
say(`  top rows    ${JSON.stringify(first.names.slice(0, 4))}`);
if (!first.names.length) problems.push('the items tab opened with no rows');
if (first.heights.length > 1) say(`  NOTE        rows in this pane are not all one height: ${JSON.stringify(first.heights)}`);

// ---------------------------------------------------------------------------
// Which tabs a slot earns, and only those. Sockets, reforges and upgrades are all per-item, so the
// four slots below are the ones whose data differs: a helm has sockets, a neck has none, a ring has
// no enchant on this class, and a weapon does.
say('\nthe tab set each slot earns');
const tabsForSlot = async slot => {
	await page.locator(sel(`.gear-picker-modal-slots .item-picker-icon-wrapper[data-slot="${slot}"] .item-picker-icon`)).first().click();
	await settle();
	return page.evaluate(() => window.selectorProbe.head());
};
const perSlot = {};
for (const slot of [0, 1, 4, 9, 12, 14]) {
	const state = await tabsForSlot(slot);
	perSlot[slot] = state;
	say(`  slot ${String(slot).padStart(2)}     ${JSON.stringify(state.title)} rail=${state.railActive} gems=${state.gemTabs} ${JSON.stringify(state.tabs)}`);
	if (state.railActive !== String(slot)) problems.push(`opening slot ${slot} left rail slot ${state.railActive} active`);
	if (state.activeTab !== state.tabs[0]) problems.push(`slot ${slot} opened on ${JSON.stringify(state.activeTab)}, expected the first tab ${JSON.stringify(state.tabs[0])}`);
	// The one rule that is data rather than layout: a gem tab exists per socket and no more.
	if (state.gemTabs !== state.tabs.filter(tab => tab === '<gem>').length) problems.push(`slot ${slot}: ${state.gemTabs} gem tabs among ${state.tabs.length} tabs`);
}
await tabsForSlot(12);
const trinketFilters = await page.evaluate(() => window.selectorProbe.filters());
say(`  trinket     ep option=${trinketFilters.epValues} headers=${JSON.stringify(trinketFilters.headers)}`);
if (trinketFilters.epValues !== 'absent') problems.push(`a trinket slot offers the EP-values option (${trinketFilters.epValues}), which it computes no EP for`);

// ---------------------------------------------------------------------------
say('\nsearch, on the head slot');
await tabsForSlot(0);
const before = await page.evaluate(() => window.selectorProbe.visible());
await pane().locator('.selector-modal-search').fill('helm');
await settle(900);
const searched = await page.evaluate(() => window.selectorProbe.visible());
say(`  "helm"      rows ${before.scrollHeight} -> ${searched.scrollHeight}px of list, top ${JSON.stringify(searched.names.slice(0, 3))}`);
if (searched.scrollHeight >= before.scrollHeight) problems.push('searching did not shorten the list');
if (searched.names.some(name => !name.toLowerCase().includes('helm'))) problems.push(`a search result does not match: ${JSON.stringify(searched.names)}`);
await pane().locator('.selector-modal-search').fill('');
await settle(900);
const cleared = await page.evaluate(() => window.selectorProbe.visible());
say(`  cleared     ${cleared.scrollHeight}px, top ${JSON.stringify(cleared.names.slice(0, 3))}`);
if (cleared.scrollHeight !== before.scrollHeight) problems.push(`clearing the search left ${cleared.scrollHeight}px, was ${before.scrollHeight}px`);

// ---------------------------------------------------------------------------
// EP values ship off, which hides the column, its header and the delta beside every value. Turned
// on here rather than at the top so the readouts above are the pane as it first opens, and left on
// for everything below.
say('\nthe EP option, and the two sortable headers');
await pane().locator('.selector-modal-show-ep-values input').check();
await settle();
const withEp = await page.evaluate(() => window.selectorProbe.filters());
const epRows = await page.evaluate(() => window.selectorProbe.visible());
say(`  ep on       hideEp=${withEp.hideEp} header=${withEp.headers.find(header => header.startsWith('ep-label'))}`);
say(`  ep values   ${JSON.stringify(epRows.eps.slice(0, 4))}`);
if (withEp.hideEp) problems.push('checking the EP option left the list still marked hide-ep');
if (epRows.eps.every(value => value === '-')) problems.push('no row shows an EP value with the option on');
// Item levels rather than names, because equal ones are ordered differently on the two builds and
// that difference is deliberate: the vanilla list re-sorted the array it was already showing, so a
// tie kept whatever order the *previous* sort left it in, and the same list state came out
// differently depending on which headers had been clicked before. The React one sorts the filtered
// set every time, so ties fall in item-database order whatever the history.
await pane().locator('.ilvl-label').click();
await settle();
const byIlvlAsc = await page.evaluate(() => window.selectorProbe.visible());
say(`  ilvl once   ${JSON.stringify(byIlvlAsc.ilvls.slice(0, 4))}`);
await pane().locator('.ilvl-label').click();
await settle();
const byIlvlDesc = await page.evaluate(() => window.selectorProbe.visible());
say(`  ilvl twice  ${JSON.stringify(byIlvlDesc.ilvls.slice(0, 4))}`);
if (byIlvlAsc.ilvls[0] === byIlvlDesc.ilvls[0]) problems.push('clicking the ilvl header twice did not reverse the order');
await pane().locator('.ep-label').click();
await settle();
const byEp = await page.evaluate(() => window.selectorProbe.visible());
say(`  ep once     ${JSON.stringify(byEp.eps.slice(0, 4))} ${JSON.stringify(byEp.names.slice(0, 2))}`);

// ---------------------------------------------------------------------------
// The virtual list. Scrolling to the bottom is what proves rows are windowed at all: an unwindowed
// list has every row in the DOM at every offset, and a broken window has none at the far end.
say('\nthe virtual list under a deep scroll');
const top = await page.evaluate(() => window.selectorProbe.visible());
const topStripes = await page.evaluate(() => window.selectorProbe.stripes());
// The number of rows in the DOM is not compared across builds — the two lists window differently —
// but it is asserted here to be fewer than the list holds, which is what windowing means.
say(`  at top      scroll=${top.scrollTop} of ${top.scrollHeight}, ${top.names.length} rows in view`);
say(`  stripes     distinct=${topStripes.distinct} alternates=${topStripes.alternates} firstIsOdd=${topStripes.firstIsOdd}`);
if (top.rendered >= Math.floor(top.scrollHeight / Math.max(1, top.heights[0] ?? 1)))
	problems.push(`${top.rendered} rows are in the DOM for a ${top.scrollHeight}px list — nothing is being windowed`);
if (topStripes.distinct !== 2) problems.push(`the rows at the top of the list use ${topStripes.distinct} background colours, expected 2`);
if (!topStripes.alternates) problems.push('the stripes at the top of the list do not alternate row by row');

const landed = await page.evaluate(() => window.selectorProbe.scrollList('bottom'));
await settle(900);
const bottom = await page.evaluate(() => window.selectorProbe.visible());
const bottomStripes = await page.evaluate(() => window.selectorProbe.stripes());
say(`  at bottom   scroll=${landed}, ${bottom.names.length} rows in view`);
say(`  last rows   ${JSON.stringify(bottom.names.slice(-3))}`);
say(`  stripes     distinct=${bottomStripes.distinct} alternates=${bottomStripes.alternates}`);
if (!bottom.names.length) problems.push('scrolling to the bottom of the list left no rows in view');
if (bottom.names[0] === top.names[0]) problems.push('scrolling to the bottom showed the same first row as the top');
if (!bottomStripes.alternates) problems.push('the stripes stop alternating once the list is scrolled — the window moved the parity');
if (bottomStripes.distinct !== 2) problems.push(`the rows at the bottom of the list use ${bottomStripes.distinct} background colours, expected 2`);

const backUp = await page.evaluate(() => window.selectorProbe.scrollList(0));
await settle(900);
const returned = await page.evaluate(() => window.selectorProbe.visible());
say(`  back to top scroll=${backUp}, top ${JSON.stringify(returned.names.slice(0, 3))}`);
if (returned.names.join('|') !== top.names.join('|')) problems.push('scrolling back to the top did not restore the same rows');

// ---------------------------------------------------------------------------
// Destructive from here: equipping a helm rewrites the slot the rest of this reads.
say('\nequipping a row, and the tabs it earns afterwards');
const beforeTabs = (await head()).tabs;
const beforeGear = await page.evaluate(() => window.selectorProbe.gear());
const count = await rows().count();
let target = -1;
for (let index = 0; index < count; index++) {
	if (!(await rows().nth(index).evaluate(row => row.classList.contains('active')))) {
		target = index;
		break;
	}
}
if (target < 0) problems.push('every row is the equipped one — nothing to equip');
const targetName = target < 0 ? null : (await rows().nth(target).locator('.selector-modal-list-item-name').textContent())?.replace(/\s+/g, ' ').trim();
if (target >= 0) await rows().nth(target).locator('.selector-modal-list-item-link').click();
await settle(1200);
const afterTabs = await head();
const afterGear = await page.evaluate(() => window.selectorProbe.gear());
const moved = afterGear.map((entry, index) => (entry === beforeGear[index] ? null : index)).filter(index => index !== null);
say(`  equipped    ${JSON.stringify(targetName)}`);
say(`  slots       changed ${JSON.stringify(moved)}`);
say(`  tabs        ${JSON.stringify(beforeTabs)} -> ${JSON.stringify(afterTabs.tabs)} gems ${afterTabs.gemTabs}`);
if (moved.length !== 1 || moved[0] !== 0) problems.push(`equipping a helm changed slots ${JSON.stringify(moved)}, expected [0]`);
if (afterTabs.activeTab !== afterTabs.tabs[0]) problems.push(`equipping a row left ${JSON.stringify(afterTabs.activeTab)} active, expected ${JSON.stringify(afterTabs.tabs[0])}`);
const activeAfter = await page.evaluate(() => window.selectorProbe.visible());
say(`  active row  ${activeAfter.active.filter(Boolean).length} of ${activeAfter.active.length} rows in view marked active`);

// ---------------------------------------------------------------------------
// Each of the three data-driven tabs, opened by its own label so a missing one reads as missing.
say('\nthe data-driven tabs');
const openTab = async label => {
	const tab = page.locator(sel('.selector-modal-tabs .nav-link'), { hasText: label }).first();
	if (!(await tab.count())) return null;
	await tab.click();
	await settle(900);
	const state = await head();
	const view = await page.evaluate(() => window.selectorProbe.visible());
	const filters = await page.evaluate(() => window.selectorProbe.filters());
	return { state, view, filters };
};
for (const label of ['Enchants', 'Reforging', 'Upgrades']) {
	const result = await openTab(label);
	if (!result) {
		say(`  ${label.padEnd(11)} not offered`);
		continue;
	}
	say(
		`  ${label.padEnd(11)} active=${JSON.stringify(result.state.activeTab)} rows=${result.view.names.length} rowHeights=${JSON.stringify(result.view.heights)} remove=${JSON.stringify(result.filters.remove)} headers=${result.filters.headers.length}`,
	);
	say(`  ${''.padEnd(11)} top ${JSON.stringify(result.view.names.slice(0, 3))}`);
	if (result.state.activeTab !== label) problems.push(`clicking ${label} left ${JSON.stringify(result.state.activeTab)} active`);
	if (!result.view.names.length) problems.push(`the ${label} tab has no rows`);
}
// The gem tabs carry a socket icon instead of a label, so they are reached by position.
const gemTab = page.locator(sel('.selector-modal-tabs .selector-modal-tab-gem')).first();
if (await gemTab.count()) {
	await gemTab.click();
	await settle(900);
	const gemState = await head();
	const gemView = await page.evaluate(() => window.selectorProbe.visible());
	const gemFilters = await page.evaluate(() => window.selectorProbe.filters());
	say(`  Gem1        rows=${gemView.names.length} rowHeights=${JSON.stringify(gemView.heights)} matchingGems=${gemFilters.matchingGems} remove=${JSON.stringify(gemFilters.remove)}`);
	say(`  ${''.padEnd(11)} top ${JSON.stringify(gemView.names.slice(0, 3))}`);
	if (!gemView.names.length) problems.push('the first gem tab has no rows');
	if (gemFilters.matchingGems !== 'shown') problems.push(`the matching-gems option is ${gemFilters.matchingGems} on a gem tab, expected shown`);
	if (gemState.activeTab) problems.push(`the gem tab reports the label ${JSON.stringify(gemState.activeTab)}, expected none`);
} else {
	problems.push('the equipped helm has sockets but no gem tab was built');
}

// ---------------------------------------------------------------------------
say('\nclosing');
await page.keyboard.press('Escape');
await settle(900);
const closed = await page.evaluate(() => window.selectorProbe.open());
say(`  escape      open=${closed}`);
if (closed) problems.push('Escape did not close the modal');
await page.locator('#gear-tab .gear-picker-root .item-picker-root').first().locator('.item-picker-icon').click();
await page.waitForSelector(modalRoot, { timeout: 20000 });
await settle(900);
const reopened = await page.evaluate(() => window.selectorProbe.visible());
const reopenedState = await head();
say(`  reopened    active=${JSON.stringify(reopenedState.activeTab)} scroll=${reopened.scrollTop} search=${JSON.stringify(await pane().locator('.selector-modal-search').inputValue())}`);
if (reopenedState.activeTab !== reopenedState.tabs[0]) problems.push(`reopening left ${JSON.stringify(reopenedState.activeTab)} active, expected ${JSON.stringify(reopenedState.tabs[0])}`);
if (reopened.scrollTop !== 0) problems.push(`reopening left the list scrolled to ${reopened.scrollTop}`);
await page.keyboard.press('Escape');
await settle(600);

// ---------------------------------------------------------------------------
// Last, because it leaves a second dialog on screen and Escape here takes the selector modal with it
// on one of the two builds. What is asserted is the part the port changes: it is a dialog opening
// over another dialog, so a press inside it must not read as an outside press and dismiss the one
// underneath. On the baseline that is a Bootstrap modal built inside the other modal's body; on the
// port both are Base UI dialogs, nested through the React tree rather than the DOM, with the popup
// portaled out to the sim root as a sibling of the parent's portal.
//
// `>` and not a descendant combinator, and this is not a nicety: on the baseline the filters menu's
// own `.modal` sits INSIDE the selector modal's, so `.modal.show .filters-menu` matches through the
// OUTER one and reads "open" whether or not this menu is. Under the descendant form this file
// recorded the baseline's close button as broken; it is not, and neither was the menu open before
// Filters was ever clicked.
const FILTERS_ROOT = '.modal.show > .filters-menu, .sim-dialog-popup.filters-menu[data-open]';

say('\nthe filters menu, opened over the modal');
await page.locator('#gear-tab .gear-picker-root .item-picker-root').first().locator('.item-picker-icon').click();
await page.waitForSelector(modalRoot, { timeout: 20000 });
await settle(900);
await pane().locator('.selector-modal-filters-button').click();
await settle(900);
const filtersMenu = await page.evaluate(root => {
	const menu = document.querySelector(root);
	return {
		open: !!menu,
		selectorStillOpen: window.selectorProbe.open(),
		sections: [...(menu?.querySelectorAll('.menu-section-title') ?? [])].map(title => (title.textContent ?? '').replace(/\s+/g, ' ').trim()),
		pickers: [...(menu?.querySelectorAll('[id^=filter]') ?? [])].map(el => `${el.id}=${el.type === 'checkbox' ? el.checked : el.value}`),
	};
}, FILTERS_ROOT);
say(`  opened      ${filtersMenu.open} modalStillOpen=${filtersMenu.selectorStillOpen}`);
say(`  sections    ${JSON.stringify(filtersMenu.sections)}`);
say(`  pickers     ${filtersMenu.pickers.length}`);
for (const picker of filtersMenu.pickers) say(`              ${picker}`);
if (!filtersMenu.pickers.length) problems.push('the filters menu built no pickers');
if (!filtersMenu.open) problems.push('the Filters button opened no filters menu');
if (!filtersMenu.selectorStillOpen) problems.push('opening the filters menu closed the selector modal underneath it');
await pane().locator('.selector-modal-search').fill('helm');
await settle(700);
if (!(await page.evaluate(() => window.selectorProbe.open()))) problems.push('typing behind the filters menu closed the selector modal');
say(`  typing      modalStillOpen=${await page.evaluate(() => window.selectorProbe.open())}`);

// Both builds close on their own close button — `BaseModal`'s `btn-close` calls `Modal.hide()`,
// `Dialog`'s is a controlled `onOpenChange(false)`.
const menuClosed = await page.evaluate(root => {
	document.querySelector(root)?.querySelector('.btn-close, .sim-dialog-close')?.click();
	return new Promise(resolve => setTimeout(() => resolve(!document.querySelector(root)), 700));
}, FILTERS_ROOT);
say(`  close       closed=${menuClosed}`);
if (!menuClosed) problems.push('the filters menu did not close on its own close button');

// The second recorded divergence, and the reason the menu is re-opened for it. `BaseModal.open()`
// puts an Escape handler on `document` for every modal it opens and never scopes it to the topmost
// one, so on the baseline Escape takes the selector modal down with the filters menu. Base UI
// dismisses the innermost dialog of the floating tree and leaves the one underneath open.
if (!(await page.evaluate(() => window.selectorProbe.open()))) {
	await page.locator('#gear-tab .gear-picker-root .item-picker-root').first().locator('.item-picker-icon').click();
	await page.waitForSelector(modalRoot, { timeout: 20000 });
	await settle(900);
}
// Clicked through the DOM, not the locator: on the baseline the menu is still up from the step
// above and its backdrop makes the button fail Playwright's actionability check.
await page.evaluate(
	({ roots, filtersRoot }) => {
		if (document.querySelector(filtersRoot)) return;
		document.querySelector(roots.map(root => `${root} .selector-modal-tab-pane.active .selector-modal-filters-button`).join(', '))?.click();
	},
	{ roots: ROOTS, filtersRoot: FILTERS_ROOT },
);
await settle(900);
await page.keyboard.press('Escape');
await settle(700);
const afterEscape = await page.evaluate(root => ({ filters: !!document.querySelector(root), selector: window.selectorProbe.open() }), FILTERS_ROOT);
const expectedEscape = { filters: false, selector: PORT !== PORTS.base };
say(`  escape      ${JSON.stringify(afterEscape) === JSON.stringify(expectedEscape) ? 'as-recorded' : `UNEXPECTED ${JSON.stringify(afterEscape)}`}`);
if (JSON.stringify(afterEscape) !== JSON.stringify(expectedEscape)) {
	problems.push(`Escape over the filters menu left ${JSON.stringify(afterEscape)}, recorded as ${JSON.stringify(expectedEscape)}`);
}

say('');
for (const problem of problems) say(`  PROBLEM ${problem}`);
for (const error of errors) say(`  ERROR ${error}`);
say(problems.length || errors.length ? `${problems.length} problem(s), ${errors.length} error(s)` : 'ok');
await page.close();
await browser.close();
process.exit(problems.length || errors.length ? 1 : 0);

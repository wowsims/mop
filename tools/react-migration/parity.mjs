// Structural DOM parity: render the same spec from two builds and compare the rendered tree.
// This is the gate the shell port is held to — every SCSS selector depends on that structure.
//
// Two regions are compared under a different rule than the rest, because the Base UI tab port
// rewrites them on purpose: the strip's markup is replaced outright, and each pane gains a panel
// wrapper that shifts every line below it by one level of indent. A whole-tree byte comparison
// cannot survive either, and widening the allowlist this file used to carry is how a gate stops
// being one. So the strip and `.sim-main` are pruned out of the tree comparison and each pane is
// compared on its own, keyed by the id that survives the swap on the `SimTab` root, with its root
// class list normalised away. Everything else — header, sidebar, modals, toasts — stays strict.
import {
	collapseWrappers,
	collectSubtrees,
	compareKey,
	dropClosedItemMenus,
	dropEagerMenus,
	dropHiddenSubtrees,
	dropReplayState,
	dropSubtrees,
	normaliseBaseUiMenus,
	normaliseLogSearch,
	normaliseSelectorModalTabs,
	normaliseLiftedSubtrees,
	normaliseSortButtons,
	normaliseSwapIcons,
	dropRootClasses,
	launch,
	openSpec,
	PORTS,
	PRUNED_LINE,
	pruneSubtrees,
	overusedIntended,
	q,
	SERIALIZE,
	SHOWN_COUNT,
	specsFromArgv,
	unexpectedLines,
	unobservedIntended,
	VISIBLE_DESPITE_HIDE,
	withTokens,
} from './browser.mjs';
import { INTENDED } from './intended.mjs';

// Attributes are not covered here — tabs-a11y.mjs does that. The serialiser lives in browser.mjs.

// The strip (`.sim-tabs` today, `.sim-tabs-mount` wrapping it after the swap) and the pane
// container, whose own class list loses `tab-content`. No `g` flag: `RegExp.test` is stateful.
const PRUNED = /\.(sim-tabs(-mount)?|sim-main)(\.|$)/;
// Modals are appended to `.sim-ui` as their owner is constructed, so their *order* tracks
// construction order — and porting a tab moves its construction from the shell's constructor into a
// React effect. That reorders them without changing one of them, which a positional diff reports as
// dozens of differing lines. So they are compared as a set: same count, same contents, order free.
// Only the order is given up; each modal is still byte-compared against its twin.
// `sim-dialog-portal` is the Base UI equivalent — with a `container`, the portal wraps the backdrop
// and the viewport in one element, and `Dialog` names it. Matching both keeps the placeholder count
// aligned as modals port one at a time: each side has exactly one per dialog either way.
const MODAL = /\.(modal|sim-dialog-portal)(\.|$)/;

// The dialogs whose shape the port changes. Their markup is Base UI's rather than Bootstrap's, so
// the set comparison below cannot compare them against their twins — they are removed from both
// sides by exact count, so reverting a port fails here rather than passing quietly. `encounter.mjs`
// gates the advanced encounter modal; `header-toolbar.mjs` and a browser probe gate the exporters
// and the importers.
//
// `exporter` is six baseline modals, all of which have ported: the five the header builds plus the
// results tab's log exporter, which the React `LogRunner` renders as a `keepMounted` dialog of its
// own now that it no longer takes a factory from the shell.
//
// `importer` is three baseline modals, the ones the header builds at load. All four importers have
// ported, so React builds none of them as a Bootstrap modal and there is nothing left on that side
// to assert against a twin. The fourth is the batch's gear importer, and it is why this reads three
// and not four: neither build carries it at load — master constructs it on click, and React mounts
// its dialog only while it is open, the way the batch's progress tracker is mounted only mid-run.
const PORTED_DIALOGS = [
	['advanced-encounter-picker-modal', 1],
	['exporter', 6],
	['importer', 3],
	['ep-weights-menu', 1],
	['glyph-modal', 1],
	// Two on the baseline: the gear picker's and the bulk tab's railless copy. Both have ported, so
	// both leave the baseline and neither has a Bootstrap twin left on the React side. The item-swap
	// surplus is already off by then; `dropSwapModals` runs first.
	['selector-modal', 2],
	// The batch's progress tracker, built in the vanilla `BulkTab` constructor and so present on the
	// baseline from load. React mounts its dialog only while a batch is running.
	['bulk-sim-progress-tracker', 1],
	// The options dialog behind the header's cog. `SimHeader` built it in its constructor and never
	// disposed it, so the baseline carries it from load and React holds a `keepMounted` portal.
	['settings-menu', 1],
];

// Zero, and that is the assertion: React mounts a dialog when it opens and unmounts it when it
// closes, so a page at rest holds none of them. It used to hold 16 — one portal per ported dialog,
// because `Dialog`'s `keepMounted` reproduced vanilla's `disposeOnClose: false` — and this count
// froze that carry-over in place. Now a `keepMounted` creeping back onto any of them, or a dialog
// rendered outside its `open` guard, puts a portal in the page at load and fails here.
//
// Nothing is given up by it. These dialogs never had a twin to be compared against: `PORTED_DIALOGS`
// takes the baseline's Bootstrap modals off by exact count because their markup is Base UI's now, so
// the pairing was always a count rather than a comparison. What is *inside* each one is gated where
// it can be opened — `encounter.mjs`, `selector-modal.mjs`, `stat-weights.mjs`, `gear-tab.mjs`,
// `bulk-tab.mjs` and the header-toolbar probe — plus their unit tests.
const PORTED_DIALOG_REACT = ['sim-dialog-portal', 0];

const PORTED_DIALOG_TOTAL = PORTED_DIALOGS.reduce((total, [, count]) => total + count, 0);

// The reforge progress tracker, whose count is per spec rather than fixed: only a spec that
// configures `reforge` builds one, and the sidebar group React renders is the same condition. Taken
// off the baseline by that count, so reverting the port — which would build the modal on both sides
// — leaves the two multisets a modal apart and fails here.
const REFORGE_PROGRESS = 'reforge-optimizer-progress-tracker';
const REFORGE_GROUP = q('suggest-reforges-settings-group');

// mage/fire's combustion feature is the one spec behaviour that owns dialogs. The vanilla class
// built its results modal and its progress tracker in the constructor, so the baseline carries both
// from load; the React feature mounts each only while it is open. Per spec rather than fixed, and
// counted off by the sidebar button both sides render — the same shape as the reforge tracker above,
// so deleting the feature leaves the counts a button apart and fails here.
const COMBUSTION_DIALOGS = 'combustion-thresholds';
const COMBUSTION_DIALOG_COUNT = 2;
const COMBUSTION_BUTTON = q('mage-calculate-combustion-threshold-group');

// Matched on the subtree's first two lines — the `.modal` wrapper and the box inside it, or the
// portal and its backdrop. A class deeper in the contents must not pick a modal out by accident:
// the React exporters carry `.exporter` on their popup, three levels below their portal.
const takeModals = (grabbed, [marker, expected], side, problems) => {
	const taken = grabbed.modals.filter(modal => modal.split('\n').slice(0, 2).join('\n').includes(marker));
	if (taken.length !== expected) problems.push(`${side}: ${taken.length} modals matching "${marker}", expected ${expected}`);
	grabbed.modals = grabbed.modals.filter(modal => !taken.includes(modal));
	return taken;
};

// Item swap owns one selector modal instead of one per slot. On the baseline every swap icon built
// its own inside its constructor (`icon_item_swap_picker.tsx`) and never disposed it; React asks the
// shell for a single modal, built on first open, so at load it has none at all. Nothing inside a
// selector modal is built until it is opened, so the surplus copies serialise identically to the one
// bulk still builds and cannot be told apart from it — they can only be counted, and the count comes
// off the page as the number of swap icons the pane rendered. Dropping that many from the baseline
// stays an assertion: revert the port and both sides hold the same N, so taking N off one of them
// fails the count comparison instead of passing quietly.
// `:is(...)` groups the alternation before the descendant combinator applies — `${q(...)} .icon-group`
// without it would read the `[data-testid]` half as its own top-level selector, not a scoped ancestor.
const SWAP_ICONS = `:is(${q('item-swap-picker-root')}) .icon-group > *`;
const SELECTOR_MODAL = 'selector-modal';
// The gear picker's is the one selector modal with a slot rail, so its markup differs and it must
// not be counted among the interchangeable ones.
const SLOT_RAIL = 'gear-picker-modal-slots';

const dropSwapModals = (grabbed, count, problems) => {
	if (!count) return;
	const railless = grabbed.modals.filter(modal => modal.split('\n').slice(0, 2).join('\n').includes(SELECTOR_MODAL) && !modal.includes(SLOT_RAIL));
	if (railless.length < count) {
		problems.push(`base: ${railless.length} railless selector modals, expected at least ${count} — one per item-swap icon`);
		return;
	}
	if (new Set(railless).size > 1) {
		problems.push('base: the railless selector modals are not all the same markup, so the item-swap surplus cannot be counted off');
		return;
	}
	for (let taken = 0; taken < count; taken++) grabbed.modals.splice(grabbed.modals.indexOf(railless[0]), 1);

	// The shell keeps one pruned line per modal, and the swap ones are appended to `simUI.rootElem`
	// last, so they are its final lines. Dropping them by count stays the same assertion the modal
	// multiset is: revert the port and react grows the same lines back, so the shells stop matching.
	const lines = grabbed.shell.split('\n');
	const tail = lines.slice(-count);
	if (tail.some(line => line.trim() !== PRUNED_LINE)) {
		problems.push(`base: the last ${count} shell lines are not all pruned modals, so the item-swap surplus cannot be counted off`);
		return;
	}
	grabbed.shell = lines.slice(0, -count).join('\n');
};

// The reforge progress tracker's placeholder. `ReforgeOptimizer` was constructed after every tab and
// before the stat-weights action, so on the baseline its modal is `simUI.rootElem`'s last child once
// the item-swap surplus above has been taken off. Same trade as that one: the line is asserted to be
// a pruned modal, and reverting the port grows it back on both sides so the shells stop matching.
const dropTrailingPrunedLines = (grabbed, count, problems, what) => {
	if (!count) return;
	const lines = grabbed.shell.split('\n');
	if (lines.slice(-count).some(line => line.trim() !== PRUNED_LINE)) {
		problems.push(`base: the last ${count} shell line(s) are not pruned modals, so ${what} cannot be counted off`);
		return;
	}
	grabbed.shell = lines.slice(0, -count).join('\n');
};

// The one divergence that is a deletion rather than a changed line, so `INTENDED` cannot hold it.
//
// Each social link used to be `div.sim-toolbar-item > button > a`. `SimToolbarItem` produced that by
// accident — `SocialLinks` handed it a finished anchor as a *child* and no `href` of its own, and
// the no-href branch renders a `<button>` — and it is invalid: `<button>`'s content model has no
// room for interactive descendants. The React toolbar drops the wrapper, so the baseline's three
// bare `<button>` lines are collapsed out before the trees are compared.
const SOCIALS = /\.sim-toolbar-socials(\.|$)/;
// Bare: the socials' buttons are the only ones under that container with no class at all.
const SOCIAL_WRAPPER = /^button(\.|$)/;
const SOCIAL_COUNT = 3;

// Base UI portals the import/export popups to `<body>` and renders them only while open, so at load
// the React tree has no menu where the Bootstrap one has a populated `<ul>`. Dropped from the
// baseline outright rather than replaced with a placeholder — a placeholder would be the difference.
// The contents are covered by `header-toolbar.mjs`, which reads the item labels with the menu open.
const IMPORT_EXPORT = /\.import-export(\.|$)/;
const DROPDOWN_MENU = /^ul\.(.*\.)?dropdown-menu(\.|$)/;
const DROPDOWN_COUNT = 2;

// Same story for the sim title, and a much bigger subtree: Bootstrap built all eleven classes and
// every one of their specs into the page up front. One drop takes the lot, because the class
// submenus are nested inside the root `<ul>`. `sim-title.mjs` compares them opened instead — which
// is the only way the spec links, the way every other sim is reached, get looked at at all.
const SIM_TITLE = /\.sim-title(\.|$)/;
const SIM_TITLE_MENU_COUNT = 1;

// The native-sim notice, which the stat-weights button now has to be compared without.
//
// Both are children of `.sim-sidebar-actions`, and on the baseline their order is an accident of
// microtask registration: each was appended from a `.then` on `waitForInit`, and `SimUI`'s handler
// is registered first because it runs during `super()`. The button is built synchronously now, so
// that it can be on screen in a loading state while the sim initialises, and the toast — still
// async — lands after it rather than before. Nothing moves on screen either way:
// `.toast-notice-native-download` carries `order: 100` and is painted last from either position.
//
// Dropped from both sides rather than pruned to a placeholder, because a placeholder preserves the
// ordinal position and the position is the only thing that differs. The count is asserted per side
// so what stops being gated is the toast's place among its siblings — the same trade the modal set
// comparison makes.
//
// The two subtrees are no longer compared against each other. The baseline's notice is a Bootstrap
// `.toast` built by the vanilla `ui-kit/toast.tsx`; the port's is a Base UI toast inside its own
// inline `ToastArea`, so the two share no class below the notice's own and a line-for-line
// comparison would only assert that the rewrite happened. `ui-kit/Toast/Toast.test.tsx` pins the new
// shape; what is still asserted here is that each side raises exactly one notice and that it still
// carries the download link the notice exists for.
const SIDEBAR_ACTIONS = /\.sim-sidebar-actions(\.|$)/;
const NATIVE_SIM_NOTICE = /\.toast-notice-native-download(\.|$)/;
const NATIVE_SIM_NOTICE_COUNT = 1;
const NATIVE_SIM_NOTICE_LINK = withTokens('a', 'ui-button', 'ui-button-outline-light');

// Base UI's toast portal renders a wrapper element of its own around each viewport, which the
// baseline has no counterpart for — an insertion, so `INTENDED` cannot hold it. Collapsed on the
// React side only, which puts both viewports back at the depth the baseline's containers were:
// the standard area at the end of `.sim-ui`, and the notice's inline area in the sidebar actions.
// The viewports themselves and everything under them are still compared.
const SIM_UI_ROOT = /\.sim-ui(\.|$)/;
const TOAST_PORTAL = /^div\.(.*\.)?sim-toast-portal(\.|$)/;
const TOAST_PORTAL_COUNT = 2;

// The standard toast area at the end of `.sim-ui`. On the baseline it is a static child of the shell
// markup and the modals `IndividualSimUI` builds are appended after it; the port's is Base UI's
// viewport, portaled into that same root from a layout effect and so appended after them. Both are
// empty at rest and both are `position: fixed` at the bottom right, so the ordinal position is the
// only difference — dropped from both sides by count, exactly as the native-sim notice above is, and
// each side's area is asserted to be the single empty line that makes the position meaningless.
const TOAST_AREA = /^div\.(?:(?=(?:.*\.)?sim-toast-container(?:\.|$))|(?=(?:.*\.)?sim-toast-viewport(?:\.|$)))/;
const TOAST_AREA_COUNT = 1;

const grab = async (browser, port, spec) => {
	// The baseline has the same picker roots; only the React one has Base UI's wrappers around their
	// menus, so normalising both sides would report the baseline as missing what it never had.
	const isReact = port === PORTS.react;
	const { page, errors } = await openSpec(browser, port, spec, { selector: `${q('sim-sidebar')}, ${q('sim-ui')}` });
	const ids = await page.evaluate(() => window.simTabsProbe.ids());
	const tree = await page.evaluate(SERIALIZE, q('sim-ui'));
	// The premise of every hidden drop below, checked in the page rather than in the tree.
	const visibleDespiteHide = await page.evaluate(VISIBLE_DESPITE_HIDE);
	const pruned = pruneSubtrees(pruneSubtrees(tree, MODAL), PRUNED);
	// Both sides, and before everything else: see `dropHiddenSubtrees`. Ahead of the drops and folds
	// below so each of them sees the same *visible* tree on both sides, which is what keeps their
	// cross-side counts comparable as components stop rendering their hidden halves.
	const hidden = dropHiddenSubtrees(pruned, 'shell');
	// Before the notice drop: the notice's class rides on the viewport, one level under the portal.
	const portals = isReact ? collapseWrappers(hidden.dom, SIM_UI_ROOT, TOAST_PORTAL) : { dom: hidden.dom, dropped: 0 };
	const notice = dropSubtrees(portals.dom, SIDEBAR_ACTIONS, NATIVE_SIM_NOTICE);
	const area = dropSubtrees(notice.dom, SIM_UI_ROOT, TOAST_AREA);
	const shell = area.dom;
	// Each modal's own subtree, keyed by nothing: sorted and compared as a multiset below.
	const modalProblems = [];
	const modals = collectSubtrees(tree, MODAL)
		.map((modal, index) => {
			const dropped = dropHiddenSubtrees(modal, `modal ${index}`);
			modalProblems.push(...dropped.problems);
			return dropped.dom;
		})
		.sort();
	// Shown rather than built: see `SHOWN_COUNT`. Every one of these is compared across the two sides.
	const swapIcons = await page.evaluate(SHOWN_COUNT, SWAP_ICONS);
	// The exception, and the reason both numbers are taken: the baseline builds one selector modal per
	// swap icon whether or not the row is shown, so the modals come off by what it *built*.
	const swapIconsBuilt = await page.evaluate(selector => document.querySelectorAll(selector).length, SWAP_ICONS);
	const reforgeGroups = await page.evaluate(SHOWN_COUNT, REFORGE_GROUP);
	const combustionButtons = await page.evaluate(SHOWN_COUNT, COMBUSTION_BUTTON);
	const panes = {};
	const levels = {};
	const swap = { active: 0, sockets: 0 };
	let replayScenes = 0;
	let eagerMenus = 0;
	const paneProblems = [];
	for (const id of ids) {
		if (!id) continue;
		const serialised = await page.evaluate(SERIALIZE, '#' + id);
		// Both sides, and first: see `dropHiddenSubtrees`.
		const visible = dropHiddenSubtrees(serialised, id);
		paneProblems.push(...visible.problems);
		// The baseline only: see `dropEagerMenus`. Before the lift below, because those menus hold
		// `IconPicker`s whose level containers the two sides are counted against each other on.
		const eager = isReact ? { dom: visible.dom, dropped: 0, problems: [] } : dropEagerMenus(visible.dom);
		paneProblems.push(...eager.problems.map(problem => `${id}: base ${problem}`));
		eagerMenus += eager.dropped;
		// Both sides: see `normaliseLiftedSubtrees`. Its counts are compared across the two below.
		const lifted = normaliseLiftedSubtrees(dropRootClasses(eager.dom));
		paneProblems.push(...lifted.problems.map(problem => `${id}: ${problem}`));
		levels[id] = { lifted: lifted.lifted, total: lifted.total };
		// Both sides: see `normaliseSwapIcons`. The baseline's counts are asserted to be zero below.
		const swapped = normaliseSwapIcons(lifted.dom);
		swap.active += swapped.active;
		swap.sockets += swapped.sockets;
		// Both sides: see `dropReplayState`. The counts are asserted per side below.
		const replay = dropReplayState(swapped.dom, 'cr-scene');
		replayScenes += replay.dropped;
		// Both sides: see `dropClosedItemMenus`. The baseline must hold one per trigger, React none.
		const menus = dropClosedItemMenus(replay.dom);
		if (isReact ? menus.dropped : menus.dropped !== menus.triggers)
			paneProblems.push(`${id}: ${isReact ? 'react' : 'base'} holds ${menus.dropped} closed item menus for ${menus.triggers} triggers`);
		// The React side only: see `normaliseBaseUiMenus` and `normaliseSortButtons`. On the baseline
		// the first is a no-op and the second would report every header cell as missing a button.
		if (!isReact) {
			panes[id] = menus.dom;
			continue;
		}
		const normalised = normaliseBaseUiMenus(menus.dom);
		paneProblems.push(...normalised.problems.map(problem => `${id}: ${problem}`));
		const buttons = normaliseSortButtons(normalised.dom);
		paneProblems.push(...buttons.problems.map(problem => `${id}: ${problem}`));
		const search = normaliseLogSearch(buttons.dom);
		paneProblems.push(...search.problems.map(problem => `${id}: ${problem}`));
		const tabsRoot = normaliseSelectorModalTabs(search.dom, id);
		paneProblems.push(...tabsRoot.problems.map(problem => `${id}: ${problem}`));
		panes[id] = tabsRoot.dom;
	}
	await page.close();
	return {
		ids,
		shell,
		panes,
		levels,
		modals,
		swapIcons,
		swapIconsBuilt,
		reforgeGroups,
		combustionButtons,
		swap,
		replayScenes,
		eagerMenus,
		hiddenDropped: hidden.dropped,
		visibleDespiteHide,
		notices: collectSubtrees(tree, NATIVE_SIM_NOTICE),
		noticesDropped: notice.dropped,
		toastPortals: portals.dropped,
		toastAreas: collectSubtrees(tree, TOAST_AREA),
		toastAreasDropped: area.dropped,
		paneProblems: [...paneProblems, ...hidden.problems, ...modalProblems],
		errors,
	};
};

const browser = await launch();
const seen = new Set();
let pass = 0;
let fail = 0;
for (const spec of specsFromArgv()) {
	const a = await grab(browser, PORTS.base, spec);
	const b = await grab(browser, PORTS.react, spec);
	const problems = [...a.paneProblems, ...b.paneProblems];

	const socials = collapseWrappers(a.shell, SOCIALS, SOCIAL_WRAPPER);
	a.shell = socials.dom;
	if (socials.dropped !== SOCIAL_COUNT) problems.push(`collapsed ${socials.dropped} social wrappers out of the baseline, expected ${SOCIAL_COUNT}`);

	const menus = dropSubtrees(a.shell, IMPORT_EXPORT, DROPDOWN_MENU);
	a.shell = menus.dom;
	if (menus.dropped !== DROPDOWN_COUNT) problems.push(`dropped ${menus.dropped} dropdown menus from the baseline, expected ${DROPDOWN_COUNT}`);

	const title = dropSubtrees(a.shell, SIM_TITLE, DROPDOWN_MENU);
	a.shell = title.dom;
	if (title.dropped !== SIM_TITLE_MENU_COUNT) problems.push(`dropped ${title.dropped} sim-title menus, expected ${SIM_TITLE_MENU_COUNT}`);

	// See `SHOWN_COUNT`: a spec that ships item swap *off* by default has the baseline build this
	// block present-but-hidden (`.hide`) where React does not mount it at all — a real behaviour
	// difference (TAILWIND-DIVERGENCE.md) that `dropHiddenSubtrees` also takes off both trees above,
	// so what is left to assert is what each side *shows*, which is what `SHOWN_COUNT` counts.
	if (a.swapIcons !== b.swapIcons) problems.push(`base shows ${a.swapIcons} item-swap icons, react ${b.swapIcons}`);
	// See `normaliseSwapIcons`. The fold is only sound while the baseline paints nothing at rest.
	if (a.swap.active || a.swap.sockets) {
		problems.push(`base paints ${a.swap.active} active swap icon(s) and ${a.swap.sockets} socket line(s) at rest, so the fold hides a real difference`);
	}
	dropSwapModals(a, a.swapIconsBuilt, problems);
	// See `REFORGE_PROGRESS`. Both sides must render the same reforge sidebar group; only the
	// baseline's progress modal comes off, because React builds one only while a solve is running.
	if (a.reforgeGroups !== b.reforgeGroups) problems.push(`base renders ${a.reforgeGroups} reforge action group(s), react ${b.reforgeGroups}`);
	dropTrailingPrunedLines(a, b.reforgeGroups, problems, 'the reforge progress tracker');
	// See `COMBUSTION_DIALOGS`. Both sides must render the same combustion button; only the
	// baseline's two dialogs come off.
	if (a.combustionButtons !== b.combustionButtons) {
		problems.push(`base renders ${a.combustionButtons} combustion threshold button(s), react ${b.combustionButtons}`);
	}
	// After the reforge drop, not before: `features` slots run ahead of `config.reforge`, so the
	// combustion dialogs sit *earlier* in the baseline's modal tail than the reforge tracker.
	if (b.combustionButtons) dropTrailingPrunedLines(a, COMBUSTION_DIALOG_COUNT, problems, 'the combustion threshold dialogs');

	// React mounts a dialog when it opens and unmounts it when it closes, so it holds no placeholder
	// for any of the ported ones. The baseline's come off by the same count — before the shells are
	// compared below, which is what the other drops above are placed here for too. It stays an
	// assertion twice over: the lines are asserted to be pruned modals, and putting `keepMounted` back
	// on one grows a placeholder on the React side that the baseline no longer has.
	dropTrailingPrunedLines(a, PORTED_DIALOG_TOTAL, problems, 'the dialogs React unmounts when closed');

	// What keeps the drop above an assertion: the notice has to have been in the sidebar actions on
	// both sides, and the two copies have to be the same markup.
	for (const [side, grabbed] of [
		['base', a],
		['react', b],
	]) {
		if (grabbed.noticesDropped !== NATIVE_SIM_NOTICE_COUNT) {
			problems.push(`${side}: dropped ${grabbed.noticesDropped} native-sim notices from the sidebar actions, expected ${NATIVE_SIM_NOTICE_COUNT}`);
		}
		if (!grabbed.notices.some(notice => notice.split('\n').some(line => NATIVE_SIM_NOTICE_LINK.test(line.trim())))) {
			problems.push(`${side}: the native-sim notice carries no download link`);
		}
		if (grabbed.toastAreasDropped !== TOAST_AREA_COUNT) {
			problems.push(`${side}: dropped ${grabbed.toastAreasDropped} standard toast areas from the shell, expected ${TOAST_AREA_COUNT}`);
		}
		if (grabbed.toastAreas.some(toastArea => toastArea.includes('\n'))) {
			problems.push(`${side}: the standard toast area is not empty at rest`);
		}
		// See `dropHiddenSubtrees`: dropping a hidden subtree is only honest while `hide` really is
		// `display: none`, so a stylesheet that stops hiding one has to fail here.
		if (grabbed.visibleDespiteHide) {
			problems.push(`${side}: ${grabbed.visibleDespiteHide} element(s) carry hide and are still displayed, so dropping their subtrees hides a real difference`);
		}
	}
	// The baseline is the side that still renders every hidden subtree, so a run that took none off
	// it is one where this stopped looking. React's count is free: it falls to zero as it unmounts.
	if (!a.hiddenDropped) problems.push('base rendered no hidden subtrees in the shell, so nothing was counted off it');
	if (b.toastPortals !== TOAST_PORTAL_COUNT) {
		problems.push(`react: collapsed ${b.toastPortals} toast portal wrappers out of the shell, expected ${TOAST_PORTAL_COUNT}`);
	}

	// See `dropEagerMenus`: the baseline builds one menu per icon picker at load and the port builds
	// none, so a run that took nothing off the baseline is one where this stopped looking.
	if (!a.eagerMenus) problems.push('base built no icon picker menus at rest, so nothing was counted off it');

	// See `dropReplayState`: the baseline builds exactly one scene at rest and the port builds none.
	if (a.replayScenes !== 1) problems.push(`base built ${a.replayScenes} combat replay scenes at rest, expected 1`);
	if (b.replayScenes !== 0) problems.push(`react built ${b.replayScenes} combat replay scenes with no run behind them, expected 0`);

	// A tab whose identifier does not resolve would silently drop its pane from the comparison below.
	if (a.ids.join() !== b.ids.join()) problems.push(`tab ids differ: base [${a.ids}] react [${b.ids}]`);
	if (!b.ids.length || b.ids.some(id => !id)) problems.push(`react tab identifiers unresolved: [${b.ids}]`);

	// What makes the lift an assertion rather than a fold: React must have nothing left to lift, and
	// the two sides must hold the same number of level containers whether they were lifted or not.
	for (const id of b.ids.filter(Boolean)) {
		const react = b.levels[id];
		const base = a.levels[id];
		if (react.lifted) problems.push(`${id}: react still nests ${react.lifted} level container(s) inside the picker anchor`);
		if ((base?.total ?? -1) !== react.total) problems.push(`${id}: ${base?.total ?? 'no'} level containers on the baseline, ${react.total} on react`);
	}

	const regions = [['shell', a.shell, b.shell], ...b.ids.filter(Boolean).map(id => [id, a.panes[id] ?? `NO #${id}`, b.panes[id]])];
	const sizes = [];
	for (const [name, base, react] of regions) {
		const la = base.split('\n');
		const lb = react.split('\n');
		sizes.push(`${name}=${lb.length}`);
		// Tallied per region, so `max` reads as "at most this many lines here" rather than run-wide.
		const tally = new Map();
		// Compared through `compareKey` — classes are ignored once a class hook has its `data-testid`
		// twin — but the printed lines below stay token-keyed, which is the more useful diff to read.
		const unexpected = unexpectedLines(la, lb, INTENDED, tally, compareKey);
		for (const entry of tally.keys()) seen.add(entry);
		problems.push(...overusedIntended(INTENDED, tally).map(problem => `${name}: ${problem}`));
		if (!unexpected.length && la.length === lb.length) continue;
		problems.push(`${name}: base ${la.length} lines, react ${lb.length}, ${unexpected.length} differ`);
		for (const i of unexpected.slice(0, 6)) problems.push(`  line ${i}\n     base : ${la[i]}\n     react: ${lb[i]}`);
	}

	const pruned = b.shell.split('\n').filter(l => l.trimStart() === PRUNED_LINE).length;
	if (pruned !== 2 + b.modals.length) {
		problems.push(`${pruned} pruned subtrees in the shell, expected ${2 + b.modals.length} (the strip, .sim-main, and ${b.modals.length} modals)`);
	}
	// The ported dialogs' contents are different markup by design and cannot be compared against each
	// other, so each side's are taken off by exact count — reverting a port fails here rather than
	// passing quietly.
	for (const ported of PORTED_DIALOGS) takeModals(a, ported, 'base', problems);
	takeModals(a, [REFORGE_PROGRESS, b.reforgeGroups], 'base', problems);
	takeModals(a, [COMBUSTION_DIALOGS, b.combustionButtons * COMBUSTION_DIALOG_COUNT], 'base', problems);
	takeModals(b, PORTED_DIALOG_REACT, 'react', problems);
	if (a.modals.length !== b.modals.length) problems.push(`base has ${a.modals.length} modals, react has ${b.modals.length}`);
	else {
		// Keyed by tag tree, not class list, for the same reason the region comparison above is.
		const keyed = modal => modal.split('\n').map(compareKey).join('\n');
		const ak = a.modals.map(keyed);
		const bk = b.modals.map(keyed);
		const differing = bk.filter((modal, index) => modal !== ak[index]);
		if (differing.length)
			problems.push(`${differing.length} of ${b.modals.length} modals differ in content:\n${differing[0].split('\n').slice(0, 4).join('\n')}`);
	}

	if (problems.length === 0) {
		pass++;
		console.log(`PASS  ${spec.padEnd(24)} ${sizes.join(' ')}   errors base=${a.errors.length} react=${b.errors.length}`);
	} else {
		fail++;
		console.log(`FAIL  ${spec.padEnd(24)} ${sizes.join(' ')}`);
		problems.forEach(x => console.log('    ! ' + x));
	}
	for (const e of b.errors.slice(0, 3)) console.log(`   react error: ${e.slice(0, 160)}`);
}
await browser.close();

// An intended divergence that stopped happening is a finding too: either the change was reverted or
// the markup moved, and in both cases this entry is now lying about the tree.
// This gate owns the check for the whole list, because it is the one that sees both the shell and
// every pane. `panes-parity.mjs` shares the list but only enforces each entry's `max`.
for (const problem of unobservedIntended(INTENDED, seen)) {
	fail++;
	console.log(`FAIL  ${problem}`);
}

console.log(`\n${pass} pass, ${fail} fail`);
process.exit(fail ? 1 : 0);

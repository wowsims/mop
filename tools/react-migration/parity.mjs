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
	dropSubtrees,
	normaliseBaseUiMenus,
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
	SERIALIZE,
	specsFromArgv,
	unexpectedLines,
	unobservedIntended,
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
// `exporter` is six baseline modals of which five have ported. The sixth is the results tab's log
// exporter, whose only opener lives inside the un-ported log runner, so React still builds it as a
// Bootstrap modal. It is byte-identical to three of the five — no class tells them apart — so all
// six leave the baseline, the one React still builds leaves the React side, and that pair is
// asserted against each other below instead of by the set comparison.
//
// `importer` is the same arrangement one step earlier: three baseline importers are built into the
// header at load, and they port one at a time. All three leave the baseline; whichever React still
// builds as Bootstrap modals leave the React side and are asserted against their twins.
const PORTED_DIALOGS = [
	['advanced-encounter-picker-modal', 1],
	['exporter', 6],
	['importer', 3],
	['ep-weights-menu', 1],
	['glyph-modal', 1],
	// Two on the baseline: the gear one, which has ported, and the bulk tab's railless copy, which has
	// not. They serialise the same apart from the rail, and `takeModals` matches on the first two
	// lines — where both read `.modal` then `.modal-dialog.modal-xl.selector-modal` — so neither can be
	// singled out. Both leave the baseline, the one React still builds leaves the React side below,
	// and that pair is asserted against each other instead of by the set comparison. The item-swap
	// surplus is already off by then; `dropSwapModals` runs first.
	['selector-modal', 2],
];

// One Base UI portal per ported dialog: the encounter modal, five exporters, three importers, the
// EP weights dialog, the glyph selector and the gear item selector. Neither *progress* dialog is
// among them — both are rendered only while a run is in flight, the way the vanilla stat-weights
// overlay was inserted on Calculate and removed after, so at load there is nothing here for the
// baseline to be missing a twin for. The reforge one is the exception the baseline has and React does not: `ReforgeOptimizer`
// built its `ProgressTrackerModal` in its constructor, so master carries an empty one from load.
const PORTED_DIALOG_REACT = ['sim-dialog-portal', 12];

// The reforge progress tracker, whose count is per spec rather than fixed: only a spec that
// configures `reforge` builds one, and the sidebar group React renders is the same condition. Taken
// off the baseline by that count, so reverting the port — which would build the modal on both sides
// — leaves the two multisets a modal apart and fails here.
const REFORGE_PROGRESS = 'reforge-optimizer-progress-tracker';
const REFORGE_GROUP = '.suggest-reforges-settings-group';

// Bootstrap on both sides still, and taken out of the React set only so the counts line up. Each one
// is asserted byte-identical to one of the baseline dialogs its marker pulled out.
const VANILLA_ON_BOTH = [
	['exporter', 1],
	['selector-modal', 1],
];

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
const SWAP_ICONS = '.item-swap-picker-root .icon-group > *';
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
const dropReforgeProgressLine = (grabbed, count, problems) => {
	if (!count) return;
	const lines = grabbed.shell.split('\n');
	if (lines.slice(-count).some(line => line.trim() !== PRUNED_LINE)) {
		problems.push(`base: the last ${count} shell line(s) are not pruned modals, so the reforge progress tracker cannot be counted off`);
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
const SOCIAL_WRAPPER = /^button$/;
const SOCIAL_COUNT = 3;

// Base UI portals the import/export popups to `<body>` and renders them only while open, so at load
// the React tree has no menu where the Bootstrap one has a populated `<ul>`. Dropped from the
// baseline outright rather than replaced with a placeholder — a placeholder would be the difference.
// The contents are covered by `header-toolbar.mjs`, which reads the item labels with the menu open.
const IMPORT_EXPORT = /\.import-export(\.|$)/;
const DROPDOWN_MENU = /^ul\.dropdown-menu$/;
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
// and the two subtrees are compared against each other, so what stops being gated is the toast's
// place among its siblings and nothing else — the same trade the modal set comparison makes.
const SIDEBAR_ACTIONS = /\.sim-sidebar-actions(\.|$)/;
const NATIVE_SIM_NOTICE = /\.toast-notice-native-download(\.|$)/;
const NATIVE_SIM_NOTICE_COUNT = 1;

const grab = async (browser, port, spec) => {
	// The baseline has the same picker roots; only the React one has Base UI's wrappers around their
	// menus, so normalising both sides would report the baseline as missing what it never had.
	const isReact = port === PORTS.react;
	const { page, errors } = await openSpec(browser, port, spec, { selector: '.sim-sidebar, .sim-ui' });
	const ids = await page.evaluate(() => window.simTabsProbe.ids());
	const tree = await page.evaluate(SERIALIZE, '.sim-ui');
	const notice = dropSubtrees(pruneSubtrees(pruneSubtrees(tree, MODAL), PRUNED), SIDEBAR_ACTIONS, NATIVE_SIM_NOTICE);
	const shell = notice.dom;
	// Each modal's own subtree, keyed by nothing: sorted and compared as a multiset below.
	const modals = collectSubtrees(tree, MODAL).sort();
	const swapIcons = await page.evaluate(selector => document.querySelectorAll(selector).length, SWAP_ICONS);
	const reforgeGroups = await page.evaluate(selector => document.querySelectorAll(selector).length, REFORGE_GROUP);
	const panes = {};
	const levels = {};
	const swap = { active: 0, sockets: 0 };
	const paneProblems = [];
	for (const id of ids) {
		if (!id) continue;
		// Both sides: see `normaliseLiftedSubtrees`. Its counts are compared across the two below.
		const lifted = normaliseLiftedSubtrees(dropRootClasses(await page.evaluate(SERIALIZE, '#' + id)));
		paneProblems.push(...lifted.problems.map(problem => `${id}: ${problem}`));
		levels[id] = { lifted: lifted.lifted, total: lifted.total };
		// Both sides: see `normaliseSwapIcons`. The baseline's counts are asserted to be zero below.
		const swapped = normaliseSwapIcons(lifted.dom);
		swap.active += swapped.active;
		swap.sockets += swapped.sockets;
		// The React side only: see `normaliseBaseUiMenus` and `normaliseSortButtons`. On the baseline
		// the first is a no-op and the second would report every header cell as missing a button.
		if (!isReact) {
			panes[id] = swapped.dom;
			continue;
		}
		const normalised = normaliseBaseUiMenus(swapped.dom);
		paneProblems.push(...normalised.problems.map(problem => `${id}: ${problem}`));
		const buttons = normaliseSortButtons(normalised.dom);
		paneProblems.push(...buttons.problems.map(problem => `${id}: ${problem}`));
		panes[id] = buttons.dom;
	}
	await page.close();
	return {
		ids,
		shell,
		panes,
		levels,
		modals,
		swapIcons,
		reforgeGroups,
		swap,
		notices: collectSubtrees(tree, NATIVE_SIM_NOTICE),
		noticesDropped: notice.dropped,
		paneProblems,
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

	// See `SWAP_ICONS`. Both sides must render the same icons; only the baseline's modals come off.
	if (a.swapIcons !== b.swapIcons) problems.push(`base renders ${a.swapIcons} item-swap icons, react ${b.swapIcons}`);
	// See `normaliseSwapIcons`. The fold is only sound while the baseline paints nothing at rest.
	if (a.swap.active || a.swap.sockets) {
		problems.push(`base paints ${a.swap.active} active swap icon(s) and ${a.swap.sockets} socket line(s) at rest, so the fold hides a real difference`);
	}
	dropSwapModals(a, a.swapIcons, problems);
	// See `REFORGE_PROGRESS`. Both sides must render the same reforge sidebar group; only the
	// baseline's progress modal comes off, because React builds one only while a solve is running.
	if (a.reforgeGroups !== b.reforgeGroups) problems.push(`base renders ${a.reforgeGroups} reforge action group(s), react ${b.reforgeGroups}`);
	dropReforgeProgressLine(a, b.reforgeGroups, problems);

	// What keeps the drop above an assertion: the notice has to have been in the sidebar actions on
	// both sides, and the two copies have to be the same markup.
	for (const [side, grabbed] of [
		['base', a],
		['react', b],
	]) {
		if (grabbed.noticesDropped !== NATIVE_SIM_NOTICE_COUNT) {
			problems.push(`${side}: dropped ${grabbed.noticesDropped} native-sim notices from the sidebar actions, expected ${NATIVE_SIM_NOTICE_COUNT}`);
		}
	}
	if (a.notices.join('\n') !== b.notices.join('\n')) problems.push('the native-sim notice differs in content between the two builds');

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
		const unexpected = unexpectedLines(la, lb, INTENDED, tally);
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
	// Each side keeps a placeholder for every ported dialog, so the shell still lines up, but their
	// contents are different markup by design and cannot be compared against each other. The counts
	// are exact, so reverting a port fails here rather than passing quietly.
	const basePorted = [];
	for (const ported of PORTED_DIALOGS) basePorted.push(...takeModals(a, ported, 'base', problems));
	basePorted.push(...takeModals(a, [REFORGE_PROGRESS, b.reforgeGroups], 'base', problems));
	takeModals(b, PORTED_DIALOG_REACT, 'react', problems);
	// The dialogs React still builds as Bootstrap modals. The set comparison cannot see them — the
	// baseline's copies left with the ones that ported — so they are compared here.
	for (const vanilla of VANILLA_ON_BOTH) {
		for (const modal of takeModals(b, vanilla, 'react', problems)) {
			if (!basePorted.includes(modal)) problems.push(`react: a still-vanilla "${vanilla[0]}" modal matches none of the baseline dialogs`);
		}
	}
	if (a.modals.length !== b.modals.length) problems.push(`base has ${a.modals.length} modals, react has ${b.modals.length}`);
	else {
		const differing = b.modals.filter((modal, index) => modal !== a.modals[index]);
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

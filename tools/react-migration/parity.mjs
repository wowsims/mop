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
];

// One Base UI portal per ported dialog: the encounter modal, five exporters, three importers and the
// EP weights dialog. The stat-weights *progress* dialog is not among them — it is rendered only
// while a run is in flight, the way the vanilla overlay was inserted on Calculate and removed after,
// so at load there is nothing here for the baseline to be missing a twin for.
const PORTED_DIALOG_REACT = ['sim-dialog-portal', 10];

// Bootstrap on both sides still, and taken out of the React set only so the counts line up. Each one
// is asserted byte-identical to one of the baseline dialogs its marker pulled out.
const VANILLA_ON_BOTH = [['exporter', 1]];

// Matched on the subtree's first two lines — the `.modal` wrapper and the box inside it, or the
// portal and its backdrop. A class deeper in the contents must not pick a modal out by accident:
// the React exporters carry `.exporter` on their popup, three levels below their portal.
const takeModals = (grabbed, [marker, expected], side, problems) => {
	const taken = grabbed.modals.filter(modal => modal.split('\n').slice(0, 2).join('\n').includes(marker));
	if (taken.length !== expected) problems.push(`${side}: ${taken.length} modals matching "${marker}", expected ${expected}`);
	grabbed.modals = grabbed.modals.filter(modal => !taken.includes(modal));
	return taken;
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

const grab = async (browser, port, spec) => {
	// The baseline has the same picker roots; only the React one has Base UI's wrappers around their
	// menus, so normalising both sides would report the baseline as missing what it never had.
	const isReact = port === PORTS.react;
	const { page, errors } = await openSpec(browser, port, spec, { selector: '.sim-sidebar, .sim-ui' });
	const ids = await page.evaluate(() => window.simTabsProbe.ids());
	const tree = await page.evaluate(SERIALIZE, '.sim-ui');
	const shell = pruneSubtrees(pruneSubtrees(tree, MODAL), PRUNED);
	// Each modal's own subtree, keyed by nothing: sorted and compared as a multiset below.
	const modals = collectSubtrees(tree, MODAL).sort();
	const panes = {};
	const paneProblems = [];
	for (const id of ids) {
		if (!id) continue;
		const pane = dropRootClasses(await page.evaluate(SERIALIZE, '#' + id));
		// The React side only: see `normaliseBaseUiMenus`. On the baseline it is a no-op, because
		// nothing there carries the classes it looks for.
		if (!isReact) {
			panes[id] = pane;
			continue;
		}
		const normalised = normaliseBaseUiMenus(pane);
		paneProblems.push(...normalised.problems.map(problem => `${id}: ${problem}`));
		panes[id] = normalised.dom;
	}
	await page.close();
	return { ids, shell, panes, modals, paneProblems, errors };
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

	// A tab whose identifier does not resolve would silently drop its pane from the comparison below.
	if (a.ids.join() !== b.ids.join()) problems.push(`tab ids differ: base [${a.ids}] react [${b.ids}]`);
	if (!b.ids.length || b.ids.some(id => !id)) problems.push(`react tab identifiers unresolved: [${b.ids}]`);

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

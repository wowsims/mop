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
import { collectSubtrees, dropRootClasses, launch, openSpec, PORTS, PRUNED_LINE, pruneSubtrees, SERIALIZE, specsFromArgv } from './browser.mjs';

// Attributes are not covered here — tabs-a11y.mjs does that. The serialiser lives in browser.mjs.

// The strip (`.sim-tabs` today, `.sim-tabs-mount` wrapping it after the swap) and the pane
// container, whose own class list loses `tab-content`. No `g` flag: `RegExp.test` is stateful.
const PRUNED = /\.(sim-tabs(-mount)?|sim-main)(\.|$)/;
// Modals are appended to `.sim-ui` as their owner is constructed, so their *order* tracks
// construction order — and porting a tab moves its construction from the shell's constructor into a
// React effect. That reorders them without changing one of them, which a positional diff reports as
// dozens of differing lines. So they are compared as a set: same count, same contents, order free.
// Only the order is given up; each modal is still byte-compared against its twin.
const MODAL = /\.modal(\.|$)/;

/**
 * Divergences the port means to have. This is **not** an allowlist: an entry is required to still be
 * observed, so reverting the change fails the gate just as loudly as making it did. That is the
 * difference between recording a decision and quietly subtracting from the comparison — the
 * allowlist this file used to carry could only ever hide things.
 */
const INTENDED = [
	{
		base: 'label.character-stats-label',
		react: 'h3.character-stats-label',
		why: 'a <label> with no control is not a label; the sidebar heading is a heading',
	},
	{
		// The root's class list carries the spec's own class, so this cannot be a fixed pair.
		match: (base, react) => base.includes('.hide-healing-metrics') && base.replace('.hide-healing-metrics', '') === react,
		describe: 'react drops hide-healing-metrics on a tank spec',
		why: 'Sim.getShowHealingMetrics() derives from showThreatMetrics, and the vanilla shell only recomputed that class on showHealingMetrics — so a tank whose saved settings turned threat on kept hiding columns its own rule says to show',
	},
];

const matches = (entry, base, react) => (entry.match ? entry.match(base, react) : base === entry.base && react === entry.react);

const grab = async (browser, port, spec) => {
	const { page, errors } = await openSpec(browser, port, spec, { selector: '.sim-sidebar, .sim-ui' });
	const ids = await page.evaluate(() => window.simTabsProbe.ids());
	const tree = await page.evaluate(SERIALIZE, '.sim-ui');
	const shell = pruneSubtrees(pruneSubtrees(tree, MODAL), PRUNED);
	// Each modal's own subtree, keyed by nothing: sorted and compared as a multiset below.
	const modals = collectSubtrees(tree, MODAL).sort();
	const panes = {};
	for (const id of ids) if (id) panes[id] = dropRootClasses(await page.evaluate(SERIALIZE, '#' + id));
	await page.close();
	return { ids, shell, panes, modals, errors };
};

const lineDiffs = (a, b) => {
	const la = a.split('\n');
	const lb = b.split('\n');
	const at = [];
	for (let i = 0; i < Math.max(la.length, lb.length); i++) if (la[i] !== lb[i]) at.push(i);
	return { la, lb, at };
};

const browser = await launch();
const seen = new Set();
let pass = 0;
let fail = 0;
for (const spec of specsFromArgv()) {
	const a = await grab(browser, PORTS.base, spec);
	const b = await grab(browser, PORTS.react, spec);
	const problems = [];

	// A tab whose identifier does not resolve would silently drop its pane from the comparison below.
	if (a.ids.join() !== b.ids.join()) problems.push(`tab ids differ: base [${a.ids}] react [${b.ids}]`);
	if (!b.ids.length || b.ids.some(id => !id)) problems.push(`react tab identifiers unresolved: [${b.ids}]`);

	const regions = [['shell', a.shell, b.shell], ...b.ids.filter(Boolean).map(id => [id, a.panes[id] ?? `NO #${id}`, b.panes[id]])];
	const sizes = [];
	for (const [name, base, react] of regions) {
		const { la, lb, at } = lineDiffs(base, react);
		sizes.push(`${name}=${lb.length}`);
		const unexpected = at.filter(i => {
			const entry = INTENDED.find(e => matches(e, la[i]?.trim() ?? '', lb[i]?.trim() ?? ''));
			if (entry) seen.add(entry);
			return !entry;
		});
		if (!unexpected.length && la.length === lb.length) continue;
		problems.push(`${name}: base ${la.length} lines, react ${lb.length}, ${unexpected.length} differ`);
		for (const i of unexpected.slice(0, 6)) problems.push(`  line ${i}\n     base : ${la[i]}\n     react: ${lb[i]}`);
	}

	const pruned = b.shell.split('\n').filter(l => l.trimStart() === PRUNED_LINE).length;
	if (pruned !== 2 + b.modals.length) {
		problems.push(`${pruned} pruned subtrees in the shell, expected ${2 + b.modals.length} (the strip, .sim-main, and ${b.modals.length} modals)`);
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
const stale = INTENDED.filter(entry => !seen.has(entry));
for (const entry of stale) {
	fail++;
	console.log(`FAIL  intended divergence never observed: ${entry.describe ?? `${entry.base} -> ${entry.react}`} (${entry.why})`);
}

console.log(`\n${pass} pass, ${fail} fail`);
process.exit(fail ? 1 : 0);

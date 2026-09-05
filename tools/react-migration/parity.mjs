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
import { dropRootClasses, launch, openSpec, PORTS, PRUNED_LINE, pruneSubtrees, SERIALIZE, specsFromArgv } from './browser.mjs';

// Attributes are not covered here — tabs-a11y.mjs does that. The serialiser lives in browser.mjs.

// The strip (`.sim-tabs` today, `.sim-tabs-mount` wrapping it after the swap) and the pane
// container, whose own class list loses `tab-content`. No `g` flag: `RegExp.test` is stateful.
const PRUNED = /\.(sim-tabs(-mount)?|sim-main)(\.|$)/;

const grab = async (browser, port, spec) => {
	const { page, errors } = await openSpec(browser, port, spec, { selector: '.sim-sidebar, .sim-ui' });
	const ids = await page.evaluate(() => window.simTabsProbe.ids());
	const shell = pruneSubtrees(await page.evaluate(SERIALIZE, '.sim-ui'), PRUNED);
	const panes = {};
	for (const id of ids) if (id) panes[id] = dropRootClasses(await page.evaluate(SERIALIZE, '#' + id));
	await page.close();
	return { ids, shell, panes, errors };
};

const lineDiffs = (a, b) => {
	const la = a.split('\n');
	const lb = b.split('\n');
	const at = [];
	for (let i = 0; i < Math.max(la.length, lb.length); i++) if (la[i] !== lb[i]) at.push(i);
	return { la, lb, at };
};

const browser = await launch();
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
		if (!at.length && la.length === lb.length) continue;
		problems.push(`${name}: base ${la.length} lines, react ${lb.length}, ${at.length} differ`);
		for (const i of at.slice(0, 6)) problems.push(`  line ${i}\n     base : ${la[i]}\n     react: ${lb[i]}`);
	}

	const pruned = b.shell.split('\n').filter(l => l.trimStart() === PRUNED_LINE).length;
	if (pruned !== 2) problems.push(`${pruned} pruned subtrees in the shell, expected 2 (the strip and .sim-main)`);

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
console.log(`\n${pass} pass, ${fail} fail`);
process.exit(fail ? 1 : 0);

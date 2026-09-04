// Structural DOM parity: render the same spec from two builds and compare the rendered tree.
// This is the gate the shell port is held to — every SCSS selector depends on that structure.
import { launch, openSpec, PORTS, specsFromArgv } from './browser.mjs';

// Structure only: tag + sorted class list + depth. Text and most attributes are excluded because
// ids, hrefs and tooltip contents carry generated values that differ run-to-run, not build-to-build.
// Tab attributes are not covered here at all — tabs-a11y.mjs does that.
const SERIALIZE = () => {
	const walk = (el, depth, out) => {
		if (el.nodeType !== 1) return;
		const cls = (el.getAttribute('class') || '').trim().split(/\s+/).filter(Boolean).sort().join('.');
		out.push(`${'  '.repeat(Math.min(depth, 40))}${el.tagName.toLowerCase()}${cls ? '.' + cls : ''}`);
		for (const c of el.children) walk(c, depth + 1, out);
	};
	const out = [];
	const app = document.querySelector('.sim-ui');
	if (!app) return 'NO .sim-ui';
	walk(app, 0, out);
	return out.join('\n');
};

// Deliberate class changes from the Phase 1 tab inversion, both verified as unstyled:
//  - `show` on a nav-link: Bootstrap puts `show` on the pane; the old addSimTabLink also put it on
//    the link, where nothing reads it.
//  - `false` as a class name: `${isFirstTab && 'active'}` stringified when false.
const EXPECTED = [
	[/^(\s*)button\.active\.nav-link\.show$/, 'button.active.nav-link'],
	[/^(\s*)button\.false\.nav-link$/, 'button.nav-link'],
];
const isExpected = (a, b) =>
	EXPECTED.some(([re, want]) => {
		const m = a?.match(re);
		return m && b === m[1] + want;
	});

const grab = async (browser, port, spec) => {
	const { page, errors } = await openSpec(browser, port, spec, { selector: '.sim-sidebar, .sim-ui' });
	const dom = await page.evaluate(SERIALIZE);
	await page.close();
	return { dom, errors };
};

const browser = await launch();
let pass = 0;
let fail = 0;
for (const spec of specsFromArgv()) {
	const a = await grab(browser, PORTS.base, spec);
	const b = await grab(browser, PORTS.react, spec);
	const la = a.dom.split('\n');
	const lb = b.dom.split('\n');
	const diffs = [];
	for (let i = 0; i < Math.max(la.length, lb.length); i++) {
		if (la[i] !== lb[i] && !isExpected(la[i], lb[i])) diffs.push(i);
	}
	const allowed = la.filter((_, i) => la[i] !== lb[i] && isExpected(la[i], lb[i])).length;
	if (diffs.length === 0 && la.length === lb.length) {
		pass++;
		console.log(`PASS  ${spec.padEnd(24)} ${la.length} elements, ${allowed} expected class diffs   errors base=${a.errors.length} react=${b.errors.length}`);
	} else {
		fail++;
		console.log(`FAIL  ${spec.padEnd(24)} base=${la.length} react=${lb.length} elements, ${diffs.length} unexpected`);
		for (const i of diffs.slice(0, 8)) console.log(`   line ${i}\n     base : ${la[i]}\n     react: ${lb[i]}`);
	}
	for (const e of b.errors.slice(0, 3)) console.log(`   react error: ${e.slice(0, 160)}`);
}
await browser.close();
console.log(`\n${pass} pass, ${fail} fail`);
process.exit(fail ? 1 : 0);

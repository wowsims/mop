// Attribute and keyboard parity for the top-level tab strip.
//
// parity.mjs compares classes, which is blind to what Bootstrap's tab plugin did on `window load`:
// a roving tabindex, role="tabpanel" on every pane, and arrow/Home/End navigation with wrap-around.
// Removing data-bs-toggle removes all of it silently, so it gets its own check.
import { launch, openSpec, PORTS, specsFromArgv } from './browser.mjs';

const READ = () => ({
	strip: [...document.querySelectorAll('.sim-tabs')].map(el => [el.tagName, el.getAttribute('role')]),
	links: [...document.querySelectorAll('.sim-tabs .nav-link')].map(b => ({
		id: b.parentElement.className.split(' ')[0],
		tabindex: b.getAttribute('tabindex'),
		ariaSelected: b.getAttribute('aria-selected'),
		role: b.getAttribute('role'),
		ariaControls: b.getAttribute('aria-controls'),
		active: b.classList.contains('active'),
	})),
	panes: [...document.querySelectorAll('.sim-main > .tab-pane')].map(p => ({
		id: p.id,
		role: p.getAttribute('role'),
		labelledby: p.getAttribute('aria-labelledby'),
	})),
});

const activeId = page => page.evaluate(() => document.querySelector('.sim-tabs .nav-link.active')?.parentElement.className.split(' ')[0] ?? null);
const focusedId = page => page.evaluate(() => document.activeElement?.parentElement?.className?.split(' ')[0] ?? null);

// Both directions past the ends, so wrap-around is covered.
const KEYS = ['ArrowRight', 'ArrowRight', 'ArrowLeft', 'Home', 'End', 'ArrowRight'];

const keyboard = async page => {
	await page.click('.sim-tabs li.gear-tab .nav-link');
	const seq = [];
	for (const key of KEYS) {
		await page.keyboard.press(key);
		await page.waitForTimeout(250);
		seq.push(`${key}->${await activeId(page)}|focus=${await focusedId(page)}`);
	}
	return seq;
};

const browser = await launch();
let failures = 0;
for (const spec of specsFromArgv()) {
	const out = {};
	for (const [side, port] of Object.entries(PORTS)) {
		const { page } = await openSpec(browser, port, spec, { selector: '.sim-tabs .nav-link' });
		out[side] = { attrs: await page.evaluate(READ), keys: await keyboard(page) };
		await page.close();
	}
	const attrsSame = JSON.stringify(out.base.attrs) === JSON.stringify(out.react.attrs);
	const keysSame = JSON.stringify(out.base.keys) === JSON.stringify(out.react.keys);
	if (attrsSame && keysSame) {
		console.log(`PASS  ${spec}`);
		continue;
	}
	failures++;
	console.log(`FAIL  ${spec}  attrs=${attrsSame ? 'same' : 'DIFF'} keys=${keysSame ? 'same' : 'DIFF'}`);
	if (!attrsSame) {
		for (const part of ['strip', 'links', 'panes']) {
			if (JSON.stringify(out.base.attrs[part]) === JSON.stringify(out.react.attrs[part])) continue;
			console.log(`  base  ${part}: ${JSON.stringify(out.base.attrs[part])}`);
			console.log(`  react ${part}: ${JSON.stringify(out.react.attrs[part])}`);
		}
	}
	if (!keysSame) {
		console.log('  base keys :', out.base.keys.join('  '));
		console.log('  react keys:', out.react.keys.join('  '));
	}
}
await browser.close();
console.log(failures ? `\n${failures} spec(s) differ` : '\ntab a11y matches baseline');
process.exit(failures ? 1 : 0);

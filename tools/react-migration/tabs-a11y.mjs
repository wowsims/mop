// Accessibility invariants and keyboard parity for the top-level tab strip.
//
// parity.mjs compares classes, which is blind to what Bootstrap's tab plugin did on `window load`:
// a roving tabindex, role="tabpanel" on every pane, and arrow/Home/End navigation with wrap-around.
// Removing data-bs-toggle removes all of it silently, so it gets its own check.
//
// The attribute half used to be a base-vs-react byte comparison. It cannot stay one across the Base
// UI port: `useCompositeItem` writes `tabindex="0"` on the focusable tab where the hand-written
// strip writes no attribute at all, and Base UI's panel wrapper carries the role the pane carries
// today. Both spellings mean the same thing, so the check asserts the *meaning* on the react side
// and keeps the keyboard sequence as the two-sided comparison.
import { launch, openSpec, PORTS, specsFromArgv } from './browser.mjs';

const INVARIANTS = () => {
	const probe = window.simTabsProbe;
	const problems = [];

	// Exactly one top-level strip, and it is the tablist. Not `[role=tablist]` document-wide: the
	// bulk, rotation and detailed-results panes each host a Bootstrap strip of their own.
	const strips = [...document.querySelectorAll('.sim-tabs')];
	if (strips.length !== 1) problems.push(`${strips.length} .sim-tabs elements, expected 1`);
	else {
		const role = strips[0].getAttribute('role');
		if (role !== 'tablist') problems.push(`.sim-tabs has role="${role}", expected tablist`);
		const nested = strips[0].querySelectorAll('[role=tablist]').length;
		if (nested) problems.push(`${nested} nested tablists inside .sim-tabs`);
	}

	const tabs = probe.tabs();
	const ids = probe.ids();
	if (!tabs.length) problems.push('no [role=tab] inside .sim-tabs');
	ids.forEach((id, index) => {
		if (!id) problems.push(`tab ${index} carries no class naming a pane under .sim-main`);
	});

	// Keep-mounted: every tab's pane is in the document whether or not it is open. Nothing asserted
	// this before, and it is the contract `DetailedResults`' live `document.querySelector` calls rely
	// on — under Base UI it is `keepMounted` on the panel that keeps it true.
	const panes = probe.panes();
	if (panes.length !== tabs.length) problems.push(`${panes.length} top-level [role=tabpanel] for ${tabs.length} tabs`);
	for (const id of ids.filter(Boolean)) if (!probe.paneChain(id).length) problems.push(`${id}: no pane under .sim-main`);

	// Exactly one selected tab, and exactly one Tab stop, and they are the same tab. Read as
	// `tabIndex !== -1` rather than off the attribute: today's selected tab has no `tabindex` at all
	// and Base UI's has `tabindex="0"`, and both mean "this is the one Tab stop".
	const selected = probe.selectedIds();
	if (selected.length !== 1) problems.push(`${selected.length} tabs with aria-selected="true", expected 1`);
	const focusable = tabs.filter(tab => tab.tabIndex !== -1).map(tab => probe.idOf(tab));
	if (focusable.length !== 1) problems.push(`${focusable.length} tabs are a Tab stop: [${focusable}]`);
	else if (selected.length === 1 && focusable[0] !== selected[0]) problems.push(`Tab stop is ${focusable[0]} but ${selected[0]} is selected`);

	for (const tab of tabs) {
		const id = probe.idOf(tab);
		const controls = probe.controls(tab);
		if (!controls) {
			problems.push(`${id}: no aria-controls`);
			continue;
		}
		const target = document.getElementById(controls);
		if (!target) {
			// Base UI's `Tabs.Panel` ignores an `id` prop and registers a generated id instead, so a
			// panel given an explicit id would leave every tab's aria-controls dangling. This is the
			// assertion that catches it.
			problems.push(`${id}: aria-controls="${controls}" resolves to nothing`);
			continue;
		}
		if (target.getAttribute('role') !== 'tabpanel') problems.push(`${id}: aria-controls target has role="${target.getAttribute('role')}"`);
		if (!panes.includes(target)) problems.push(`${id}: aria-controls target is not one of the top-level panes`);

		// DORMANT UNTIL THE BASE UI SWAP. Nothing sets aria-labelledby on a pane today, so this is
		// feature-detected on the attribute's presence: Base UI's `TabsPanel` adds it, pointing at the
		// tab that controls the panel, and it is the other half of the id round-trip above.
		const back = target.getAttribute('aria-labelledby');
		if (back !== null && back !== tab.id) problems.push(`${id}: pane aria-labelledby="${back}" but the tab's id is "${tab.id || '(none)'}"`);
	}
	return problems;
};

const selectedId = page => page.evaluate(() => window.simTabsProbe.selectedIds()[0] ?? null);
const focusedId = page => page.evaluate(() => window.simTabsProbe.focusedId());

// Both directions past the ends, so wrap-around is covered.
const KEYS = ['ArrowRight', 'ArrowRight', 'ArrowLeft', 'Home', 'End', 'ArrowRight'];

// Starts from the first tab by position rather than by class, so one script drives both shapes.
const keyboard = async page => {
	await page.locator('.sim-tabs [role=tab]').first().click();
	const seq = [];
	for (const key of KEYS) {
		await page.keyboard.press(key);
		await page.waitForTimeout(250);
		seq.push(`${key}->${await selectedId(page)}|focus=${await focusedId(page)}`);
	}
	return seq;
};

const browser = await launch();
let failures = 0;
for (const spec of specsFromArgv()) {
	const out = {};
	for (const [side, port] of Object.entries(PORTS)) {
		const { page } = await openSpec(browser, port, spec, { selector: '.sim-tabs [role=tab]' });
		out[side] = { problems: await page.evaluate(INVARIANTS), keys: await keyboard(page) };
		await page.close();
	}
	// The invariants are absolute on the react side; the parent branch is only the keyboard baseline.
	const held = out.react.problems.length === 0;
	const keysSame = JSON.stringify(out.base.keys) === JSON.stringify(out.react.keys);
	if (held && keysSame) {
		console.log(`PASS  ${spec}`);
		continue;
	}
	failures++;
	console.log(`FAIL  ${spec}  invariants=${held ? 'held' : 'BROKEN'} keys=${keysSame ? 'same' : 'DIFF'}`);
	out.react.problems.forEach(x => console.log('    ! ' + x));
	if (!keysSame) {
		console.log('  base keys :', out.base.keys.join('  '));
		console.log('  react keys:', out.react.keys.join('  '));
	}
}
await browser.close();
console.log(failures ? `\n${failures} spec(s) differ` : '\ntab a11y invariants hold and keyboard matches baseline');
process.exit(failures ? 1 : 0);

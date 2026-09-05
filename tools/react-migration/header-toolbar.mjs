// The header, the toolbar and the two dropdowns — the region the shell migration rewrites next.
//
// `parity.mjs` sees this markup at load, but it sees nothing that only exists after an interaction,
// and the header's most fragile behaviour is exactly that: Bootstrap's dropdown plugin opens the
// import/export menus, `bootstrap_overrides.ts` adds hover-to-open and hover-to-close on top of it,
// and the sticky `.stuck` class is an IntersectionObserver whose rootMargin is measured from the
// header's own height at construction time. None of that survives a port by accident.
//
// Runs against `BASE_PORT` by default; set `PORT` to point at the React build. The whole output
// should be identical on both.
import { launch, openSpec, PORTS } from './browser.mjs';

const SPEC = process.argv[2] ?? 'warrior/arms';
const PORT = Number(process.env.PORT ?? PORTS.base);
const IS_BASE = PORT === PORTS.base;

// A behaviour the two shapes are known to disagree on, asserted rather than diffed. Printing the raw
// value would make this probe's output differ between the ports forever, and the whole point of it
// is that they match; printing whether each build did what it is recorded as doing keeps that true
// and still fails the moment either side changes.
//
// Bootstrap's click data-API toggled a hover-opened menu shut, and it stayed shut because re-opening
// needed a fresh `mouseover` that a stationary pointer never sent. Base UI re-evaluates hover at
// once, so the menu reappears.
const KNOWN = {
	clickWhileOpen: { base: false, react: true },
};

const assertKnown = (name, value) => {
	const known = KNOWN[name];
	if (!known) return `${name}=${value}`;
	const expected = IS_BASE ? known.base : known.react;
	return `${name}=${value === expected ? 'as-recorded' : `UNEXPECTED(${value}, recorded ${expected})`}`;
};

const structure = () => {
	const header = document.querySelector('.sim-header');
	const container = header?.querySelector('.sim-header-container');
	if (!header || !container) return { error: `header=${!!header} container=${!!container}` };
	const describe = el => `${el.tagName.toLowerCase()}.${[...el.classList].sort().join('.')}`;
	return {
		// Direct children and their order: the shell port must not reflow this row. The tab strip's
		// own shape already differs by design (Base UI replaced it) and has its own gates, so it is
		// normalised to a token rather than compared here.
		containerChildren: [...container.children].map(el => (el.querySelector('[role=tab]') || el.matches('.sim-tabs') ? '<tabs>' : describe(el))),
		// Read through `simDropdownProbe` so this survives the Base UI `Menu` swap. The toggle's own
		// class is the identity — `import-link` / `export-link` — and `expanded` is the one state
		// signal both shapes share. The *contents* are read in the behaviour section below, while the
		// menu is open: Base UI portals its popup and renders it only then, so at rest there is
		// nothing to count on either shape's terms.
		dropdowns: window.simDropdownProbe.toggles(header).map(toggle => ({
			name: window.simDropdownProbe.nameOf(toggle),
			expanded: toggle.getAttribute('aria-expanded'),
		})),
		// Each item, not just the count: the link's own classes, whether it is an anchor and where it
		// points, and the icon glyph — `Icon` cannot emit the bare `fa` prefix these use, so a port
		// that reached for it would silently change every one of them.
		toolbarItems: [...(header.querySelector('.sim-toolbar')?.children ?? [])].map(item => {
			// The socials are a container of their own, described below rather than here: their
			// element *shape* is one of the things the port changes, so reading `querySelector('a,
			// span, button')` off the container would compare the wrapper instead of the link.
			if (item.matches('.sim-toolbar-socials')) return { item: describe(item), socials: item.children.length };
			const link = item.querySelector('a, span, button');
			return {
				item: describe(item),
				link: link ? `${link.tagName.toLowerCase()}.${[...link.classList].sort().join('.')}` : null,
				href: link?.getAttribute('href') ?? null,
				target: link?.getAttribute('target') ?? null,
				icon: [...(item.querySelector('i')?.classList ?? [])].sort().join('.') || null,
			};
		}),
		// Where each social points, what it shows and what it is called — everything about them that
		// the port is *not* allowed to change. The element around the anchor is deliberately absent.
		socials: [...header.querySelectorAll('.sim-toolbar-socials .sim-toolbar-item')].map(item => {
			const link = item.querySelector('a');
			return {
				className: [...(link?.classList ?? [])].sort().join('.') || null,
				href: link?.getAttribute('href') ?? null,
				target: link?.getAttribute('target') ?? null,
				icon: [...(item.querySelector('i')?.classList ?? [])].sort().join('.') || null,
				text: link?.textContent.trim() || null,
			};
		}),
		knownIssuesHidden: header.querySelector('.known-issues')?.classList.contains('hide') ?? null,
	};
};

const openState = selector => {
	const toggle = document.querySelector(selector);
	return toggle ? window.simDropdownProbe.isOpen(toggle) : null;
};

const browser = await launch();
// The download-binary link is otherwise invisible to every gate. `isNative()` is
// `hostname.includes('localhost')`, so under these servers it takes the `fetch('/version')` branch —
// which 404s here, leaving the link unrendered on both builds and the port unverified. Answering it
// makes the outdated case real, and it is the only branch that renders anything.
const { page, errors } = await openSpec(browser, PORT, SPEC, {
	selector: '.sim-header',
	// Answered before the page loads, so the outdated branch is real on both builds.
	route: ['**/version', { status: 200, contentType: 'application/json', body: JSON.stringify({ outdated: 2 }) }],
});

console.log(`${SPEC} on :${PORT}\n`);
console.log('structure');
for (const [key, value] of Object.entries(await page.evaluate(structure))) {
	console.log(`  ${key}`);
	for (const line of JSON.stringify(value, null, 1).split('\n')) console.log(`    ${line}`);
}

// These menus open on **hover**, not on click: `bootstrap_overrides.ts` adds a capturing `mouseover`
// on `body` that calls `Dropdown.show()`, and Bootstrap's own click data-API then *toggles* — so a
// single `page.click()` opens the menu on the way in and closes it on the click, reading as "never
// opened". Each gesture below therefore starts from the pointer parked away from the header.
console.log('\ndropdown behaviour');
const away = async () => {
	await page.mouse.move(5, 500);
	await page.waitForTimeout(400);
};
for (const [label, selector] of [
	['import', '.import-link'],
	['export', '.export-link'],
]) {
	await away();
	await page.hover(selector);
	await page.waitForTimeout(400);
	const onHover = await page.evaluate(openState, selector);
	// The contents, read while it is open — the only moment both shapes have them in the document.
	const items = await page.evaluate(sel => window.simDropdownProbe.items(document.querySelector(sel)).map(item => item.textContent.trim()), selector);

	await away();
	const onLeave = await page.evaluate(openState, selector);

	await page.hover(selector);
	await page.waitForTimeout(300);
	await page.click(selector);
	await page.waitForTimeout(400);
	const onClickWhileOpen = await page.evaluate(openState, selector);

	await away();
	await page.hover(selector);
	await page.waitForTimeout(300);
	await page.keyboard.press('Escape');
	await page.waitForTimeout(300);
	const onEscape = await page.evaluate(openState, selector);
	await away();

	console.log(`  ${label.padEnd(7)} hover=${onHover} leave=${onLeave} ${assertKnown('clickWhileOpen', onClickWhileOpen)} escape=${onEscape}`);
	console.log(`  ${' '.repeat(7)} items=${JSON.stringify(items)}`);
}

// The toolbar's tooltips are the only thing that says what these icon-only links are, and they
// exist nowhere in the DOM until hovered.
console.log('\ntoolbar tooltips');
const items = await page.locator('.sim-toolbar .sim-toolbar-item').all();
for (const [index, item] of items.entries()) {
	await away();
	// The known-issues link ships hidden on a spec that has none, so it is not hoverable.
	if (!(await item.isVisible())) {
		console.log(`  item ${index}  (hidden)`);
		continue;
	}
	await item.hover();
	await page.waitForTimeout(500);
	const text = await page.evaluate(() => {
		const box = document.querySelector('.tippy-box, .sim-tooltip');
		return box && getComputedStyle(box).visibility !== 'hidden' ? box.textContent.trim().slice(0, 60) : null;
	});
	console.log(`  item ${index}  ${JSON.stringify(text)}`);
}
await away();

// `.stuck` comes from an IntersectionObserver whose rootMargin is the header's height, read while
// the tabs are being constructed — so it is the assertion that catches a header measured too early.
const stuck = async () => await page.evaluate(() => document.querySelector('.sim-header')?.classList.contains('stuck') ?? null);
console.log('\nsticky');
console.log(`  at top      ${await stuck()}`);
await page.evaluate(() => document.querySelector('.sim-ui')?.scrollTo({ top: 400 }));
await page.waitForTimeout(600);
console.log(`  scrolled    ${await stuck()}`);

if (errors.length) for (const e of errors) console.log(`  ERROR ${e}`);
await page.close();
await browser.close();
process.exit(errors.length ? 1 : 0);

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
import { ENVIRONMENTAL, launch, PORTS } from './browser.mjs';

const SPEC = process.argv[2] ?? 'warrior/arms';
const PORT = Number(process.env.PORT ?? PORTS.base);
// Anything that is not the parent-branch build is a build of this branch — the dev server on :3403
// included, which a `=== PORTS.react` test would have let off.
const IS_REACT = PORT !== PORTS.base;

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
		dropdowns: [...header.querySelectorAll('.dropdown')].map(d => ({
			className: [...d.classList].sort().join('.'),
			toggle: d.querySelector('button')?.className ?? null,
			// The plugin needs these; dropping one silently disables the menu.
			bsToggle: d.querySelector('button')?.dataset.bsToggle ?? null,
			expanded: d.querySelector('button')?.getAttribute('aria-expanded') ?? null,
			items: d.querySelectorAll('.dropdown-menu > *').length,
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

// Four things the port adds that the baseline does not have, and that nothing else can see: the
// tree comparison in `parity.mjs` is structural and explicitly does not read attributes.
//
// They are reported as checks rather than as recorded values because they are the one part of this
// probe whose output is *meant* to differ between the two builds — everything above this must stay
// byte-identical, and confining the divergence to a block of PASS/FAIL lines is what keeps that
// true. Against the React build a failure is a gate failure; against the baseline these are the
// findings themselves, and failing is the expected reading.
//
// The tab strip is deliberately out of scope: it is Base UI's markup, and `useButton` does not
// default `type` either, which is its own question for whoever ports the last of it.
const a11y = () => {
	const scope = [...document.querySelectorAll('.sim-header .sim-toolbar, .sim-header .import-export')];
	const within = selector => scope.flatMap(el => [...el.querySelectorAll(selector)]);
	const name = el => (el.getAttribute('aria-label') || el.textContent || '').trim();

	const controls = within('a, button');
	const unnamed = controls.filter(el => !name(el));
	const icons = within('i');
	const shown = icons.filter(el => el.getAttribute('aria-hidden') !== 'true');
	const blank = within('a[target="_blank"]');
	const unsafe = blank.filter(el => {
		const rel = (el.getAttribute('rel') || '').split(/\s+/);
		return !rel.includes('noopener') || !rel.includes('noreferrer');
	});
	const buttons = within('button');
	const untyped = buttons.filter(el => !el.getAttribute('type'));

	return [
		[unnamed.length === 0, `${controls.length - unnamed.length}/${controls.length} controls have an accessible name`],
		[shown.length === 0, `${icons.length - shown.length}/${icons.length} icons are aria-hidden`],
		[unsafe.length === 0, `${blank.length - unsafe.length}/${blank.length} _blank links carry rel=noopener noreferrer`],
		[untyped.length === 0, `${buttons.length - untyped.length}/${buttons.length} buttons declare a type`],
	];
};

const openState = selector => document.querySelector(selector)?.parentElement?.querySelector('.dropdown-menu')?.classList.contains('show') ?? null;

const browser = await launch();
const context = await browser.newContext();
const page = await context.newPage();
const errors = [];
page.on('pageerror', e => errors.push(String(e)));
page.on('console', m => {
	if (m.type() === 'error' && !ENVIRONMENTAL.test(m.text())) errors.push('console: ' + m.text());
});
await page.addInitScript(() => {
	window.alert = () => {};
});
// The download-binary link is otherwise invisible to every gate. `isNative()` is
// `hostname.includes('localhost')`, so under these servers it takes the `fetch('/version')` branch —
// which 404s here, leaving the link unrendered on both builds and the port unverified. Answering it
// makes the outdated case real, and it is the only branch that renders anything.
await page.route('**/version', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ outdated: 2 }) }));
await page.goto(`http://localhost:${PORT}/mop/${SPEC}/`, { waitUntil: 'load', timeout: 60000 });
await page.waitForSelector('.sim-header', { timeout: 60000 });
await page.waitForTimeout(2500);

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

	console.log(`  ${label.padEnd(7)} hover=${onHover} leave=${onLeave} clickWhileOpen=${onClickWhileOpen} escape=${onEscape}`);
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

console.log(`\naccessibility (expected to fail on the baseline — these are the port's additions)`);
const checks = await page.evaluate(a11y);
for (const [ok, text] of checks) console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${text}`);
const a11yFailed = IS_REACT && checks.some(([ok]) => !ok);

if (errors.length) for (const e of errors) console.log(`  ERROR ${e}`);
await context.close();
await browser.close();
process.exit(errors.length || a11yFailed ? 1 : 0);

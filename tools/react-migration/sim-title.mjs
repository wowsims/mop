// The sidebar's title, which is also the picker for every other sim: a click-to-open menu of the
// eleven classes, each hovering open a submenu of its specs, each spec a real link to its own page.
//
// `parity.mjs` used to see the whole thing at load — Bootstrap built every class and every spec into
// the DOM up front. Base UI renders a popup only while it is open and portals it to `<body>`, so the
// tree comparison drops the menus and this is what covers them instead. The links are the part that
// matters: they are how every other sim is reached.
import { launch, openSpec, PORTS } from './browser.mjs';

const SPEC = process.argv[2] ?? 'warrior/arms';
const PORT = Number(process.env.PORT ?? PORTS.base);

// Bootstrap keeps its menus in place and marks the open one `.show`; Base UI portals one popup per
// open level. Reading "every open menu, outermost first" is the shape both can answer.
const MENUS = () => [...document.querySelectorAll('.sim-title .dropdown-menu.show, .sim-title-popup')];

const ROWS = level => {
	const menus = [...document.querySelectorAll('.sim-title .dropdown-menu.show, .sim-title-popup')];
	const menu = menus[level];
	if (!menu) return null;
	// Only this menu's own rows. Bootstrap nests each class's submenu inside the root `<ul>`, so a
	// deep query returns all 45 links at level 0; Base UI portals each level separately and would
	// return 11. Scoping to direct rows is what makes the two comparable.
	const rows = menu.querySelectorAll(':scope > li > .sim-link-dropdown > .sim-link, :scope > li > .sim-link, :scope > .sim-link');
	return [...rows].map(link => ({
		tag: link.tagName.toLowerCase(),
		// The class-colour token, which is what makes each row readable at a glance.
		colour: [...link.classList].find(name => name.startsWith('text-')) ?? null,
		label: link.querySelector('.sim-link-label')?.textContent.trim() ?? null,
		title: link.querySelector('.sim-link-title')?.textContent.trim() ?? null,
		status: link.querySelector('.launch-status-label')?.textContent.trim() ?? null,
		href: link.getAttribute('href'),
		icon: link.querySelector('.sim-link-icon')?.getAttribute('src') ?? null,
	}));
};

const browser = await launch();
const { page, errors } = await openSpec(browser, PORT, SPEC, { selector: '.sim-title' });
console.log(`${SPEC} on :${PORT}\n`);

console.log('trigger');
const trigger = await page.evaluate(() => {
	const link = document.querySelector('.sim-title .sim-link');
	return {
		tag: link?.tagName.toLowerCase(),
		colour: [...(link?.classList ?? [])].find(name => name.startsWith('text-')) ?? null,
		label: link?.querySelector('.sim-link-label')?.textContent.trim() ?? null,
		title: link?.querySelector('.sim-link-title')?.textContent.trim() ?? null,
		status: link?.querySelector('.launch-status-label')?.textContent.trim() ?? null,
	};
});
console.log(`  ${JSON.stringify(trigger)}`);

// Click, not hover: the root carried `data-bs-trigger="click"`, which kept the global hover override
// off it. Nothing else in this menu opens on click.
console.log('\nclasses (click to open)');
await page.click('.sim-title .sim-link');
await page.waitForTimeout(700);
console.log(`  menus open   ${(await page.evaluate(MENUS)).length}`);
const classes = await page.evaluate(ROWS, 0);
console.log(`  rows         ${classes?.length}`);
for (const row of classes ?? []) console.log(`    ${row.tag.padEnd(6)} ${String(row.colour).padEnd(18)} ${row.title}`);

// The class rows open on hover, which is what `bootstrap_overrides.ts` gave them and what Base UI
// does for a submenu by default.
//
// Every class, not just one: dropping the menus out of `parity.mjs` took 361 lines of shell
// comparison with them, and all 34 spec links were in there. This is where they are covered now.
const normalise = href => String(href).replace(`localhost:${PORT}`, 'localhost:<port>');
console.log('\nspecs (hover each class)');
const rowSelector = '.sim-title .dropdown-menu.show > li > .sim-link-dropdown > .sim-link, .sim-title-popup > .sim-link';
let total = 0;
for (const [index, klass] of (classes ?? []).entries()) {
	await page.locator(rowSelector).nth(index).hover();
	await page.waitForTimeout(500);
	const open = (await page.evaluate(MENUS)).length;
	const specs = await page.evaluate(ROWS, 1);
	total += specs?.length ?? 0;
	console.log(`  ${klass.title.padEnd(13)} menus=${open} rows=${specs?.length}`);
	for (const row of specs ?? []) console.log(`    ${row.tag} ${row.label} / ${row.title} / ${row.status}\n      ${normalise(row.href)}\n      ${row.icon}`);
}
console.log(`\n  ${total} spec links across ${classes?.length} classes`);

if (errors.length) for (const e of errors) console.log(`  ERROR ${e}`);
await page.close();
await browser.close();
process.exit(errors.length ? 1 : 0);

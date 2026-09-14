// The item-swap block's two behaviours, neither of which a structural gate can see: the toggle that
// shows and hides the picker row, and the button that exchanges equipped gear with the swap set.
//
// `panes-parity.mjs` compares this block at rest — with the toggle off, which is the default on
// every spec — so on its own it proves only that the disabled state matches. Everything below
// happens after a click. The whole output should be identical on both builds.
import { launch, openSpec, PORTS, q } from './browser.mjs';

const SPEC = process.argv[2] ?? 'warrior/arms';
const PORT = Number(process.env.PORT ?? PORTS.base);

const STATE = () => {
	const q = name => `:is([data-testid="${name}"], .${name})`;
	const root = document.querySelector(q('item-swap-picker-root'));
	if (!root) return { error: 'no item-swap-picker-root' };
	const container = root.querySelector(q('input-item-swap-container'));
	return {
		children: [...root.children].map(el => `${el.tagName.toLowerCase()}.${[...el.classList].sort().join('.')}`),
		hidden: container?.classList.contains('hide') ?? null,
		checked: root.querySelector('#enable-item-swap')?.checked ?? null,
		icons: root.querySelectorAll(':is(.icon-group, .ui-picker-group-icons) > *').length,
		// What the swap set actually holds. An empty slot is a placeholder image and `href="#"`; a
		// filled one is `.active` with a wowhead link, so the item id is the readable part.
		swap: [...root.querySelectorAll(':is(.icon-group, .ui-picker-group-icons) :is([data-testid="icon-picker-button"], .icon-picker-button)')].map(icon =>
			icon.hasAttribute('data-active') ? (icon.getAttribute('href')?.match(/item=(\d+)/)?.[1] ?? 'active') : 'empty',
		),

		// Paint state, which is where the two builds legitimately differ at rest: vanilla's `update()`
		// only ran from an `itemSwap` change, so a spec that loads a swap preset renders four blank,
		// unpainted slots until the set is next touched. Run this on `warrior/protection` to see it.
		sockets: [...root.querySelectorAll(q('item-picker-sockets-container'))].map(container => container.children.length),
		painted: [...root.querySelectorAll(':is(.icon-group, .ui-picker-group-icons) :is([data-testid="icon-picker-button"], .icon-picker-button)')].map(icon => !!icon.style.backgroundImage),
	};
};

const browser = await launch();
const { page, errors } = await openSpec(browser, PORT, SPEC, { selector: q('sim-tabs') });
await page.evaluate(() =>
	window.simTabsProbe
		.tabs()
		.find(tab => window.simTabsProbe.idOf(tab) === 'settings-tab')
		?.click(),
);
await page.waitForSelector(q('item-swap-picker-root'), { timeout: 60000, state: 'visible' });
await page.waitForTimeout(1200);

console.log(`${SPEC} on :${PORT}\n`);
console.log(`at rest      ${JSON.stringify(await page.evaluate(STATE))}`);

// `reverse: true` on the picker means the checkbox reads inverted; click it rather than reason about it.
// The clickable surface is the label, not the visually hidden native input BooleanPicker's
// Checkbox.Root puts the id on.
await page.click('label[for="enable-item-swap"]');
await page.waitForTimeout(600);
console.log(`toggled      ${JSON.stringify(await page.evaluate(STATE))}`);

// A spec whose swap set starts enabled (warrior/protection) is hidden by the toggle above rather
// than shown, and the swap button goes with it.
if ((await page.evaluate(STATE)).hidden) {
	await page.click('label[for="enable-item-swap"]');
	await page.waitForTimeout(600);
	console.log(`re-toggled   ${JSON.stringify(await page.evaluate(STATE))}`);
}

// The swap button exchanges equipped gear with the swap set. Starting from an empty swap set, that
// means the equipped items move into it — visible as placeholders becoming wowhead links.
await page.click(`${q('item-swap-picker-root')} ${q('gear-swap-icon')}`);
await page.waitForTimeout(900);
console.log(`swapped      ${JSON.stringify(await page.evaluate(STATE))}`);

// Swapping again must put them back: the operation is its own inverse.
await page.click(`${q('item-swap-picker-root')} ${q('gear-swap-icon')}`);
await page.waitForTimeout(900);
console.log(`swapped back ${JSON.stringify(await page.evaluate(STATE))}`);

// And back off again: the class has to come back, not just go away once.
await page.click('label[for="enable-item-swap"]');
await page.waitForTimeout(600);
console.log(`toggled off  ${JSON.stringify(await page.evaluate(STATE))}`);

if (errors.length) for (const e of errors) console.log(`  ERROR ${e}`);
await page.close();
await browser.close();
process.exit(errors.length ? 1 : 0);

// The encounter block in the settings tab, and the one interaction the port touches that no
// structural gate can see: the advanced modal behind its button.
//
// `panes-parity.mjs` compares the block at rest, element for element, on every spec. What it cannot
// compare is a modal that does not exist until clicked — and the button is React's now while the
// modal behind it is still a vanilla `BaseModal`, so the wiring between them is exactly the new
// seam. The whole output should be identical on both builds.
import { launch, openSpec, PORTS } from './browser.mjs';

const SPEC = process.argv[2] ?? 'warrior/protection';
const PORT = Number(process.env.PORT ?? PORTS.base);

// The block's own children, and the ids of the pickers in it: order is what the vanilla constructor
// decided by call order and what React now decides by JSX order, and the two must agree.
const BLOCK = () => {
	const root = document.querySelector('.encounter-picker-root');
	if (!root) return { error: 'no .encounter-picker-root' };
	const describeEl = el => `${el.tagName.toLowerCase()}.${[...el.classList].sort().join('.')}`;
	return {
		children: [...root.children].map(describeEl),
		pickerIds: [...root.querySelectorAll('[id]')].map(el => el.id).filter(id => id.startsWith('encounter-')),
		groups: [...root.querySelectorAll('.picker-group')].map(group => [...group.children].map(el => el.id || describeEl(el))),
	};
};

// `BaseModal`'s `rootCssClass` lands on the `.modal-dialog`; Bootstrap puts `show` on the `.modal`
// that wraps it, and `modal-open` on the body. Reading the dialog's own classList says "closed"
// forever — on both builds, which is how this was caught.
const MODAL = () => {
	const dialog = document.querySelector('.advanced-encounter-picker-modal');
	if (!dialog) return { present: false };
	return {
		present: true,
		open: !!dialog.closest('.modal')?.classList.contains('show'),
		backdrop: !!document.querySelector('.modal-backdrop'),
		bodyLocked: document.body.classList.contains('modal-open'),
		targets: dialog.querySelectorAll('.targets-picker .list-picker-item').length,
		headerGroups: dialog.querySelectorAll('.encounter-header .picker-group').length,
	};
};

const browser = await launch();
// `openSpec` installs the strip probe, which is the only shape-agnostic way to open a tab: the two
// builds' strips are different markup.
const { page, errors } = await openSpec(browser, PORT, SPEC, { selector: '.sim-tabs' });
await page.evaluate(() =>
	window.simTabsProbe
		.tabs()
		.find(tab => window.simTabsProbe.idOf(tab) === 'settings-tab')
		?.click(),
);
await page.waitForSelector('.encounter-picker-root', { timeout: 60000, state: 'visible' });
await page.waitForTimeout(1500);

console.log(`${SPEC} on :${PORT}\n`);
console.log('block');
for (const [key, value] of Object.entries(await page.evaluate(BLOCK))) {
	console.log(`  ${key}`);
	for (const line of JSON.stringify(value, null, 1).split('\n')) console.log(`    ${line}`);
}

// One duplicate modal would be invisible everywhere else: `parity.mjs` compares modals as a set.
const modalCount = await page.locator('.advanced-encounter-picker-modal').count();
console.log(`\nmodal\n  instances    ${modalCount}`);
console.log(`  before click ${JSON.stringify(await page.evaluate(MODAL))}`);
await page.click('.encounter-picker-root .advanced-button');
await page.waitForTimeout(800);
console.log(`  after click  ${JSON.stringify(await page.evaluate(MODAL))}`);
await page.keyboard.press('Escape');
await page.waitForTimeout(800);
console.log(`  after escape ${JSON.stringify(await page.evaluate(MODAL))}`);

if (errors.length) for (const e of errors) console.log(`  ERROR ${e}`);
await page.close();
await browser.close();
process.exit(errors.length ? 1 : 0);

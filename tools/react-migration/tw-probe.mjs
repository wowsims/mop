// Computed-style + geometry probe, this branch (3404) against the React baseline (3402).
//
//   node tools/react-migration/tw-probe.mjs
//
// Class lists are deliberately NOT compared — that is the whole point of the Tailwind migration.
// What must not move is what the browser actually resolves: 54 computed properties and the
// bounding box of every element, keyed by its structural position rather than by its classes.
// A-S4 makes derived theme colours color-mix(), which Chrome serialises as color(srgb ...)
// instead of rgb()/rgba(); normalise both ports so that is not reported as a divergence.
import { mkdirSync, writeFileSync } from 'node:fs';

import { launch, q } from './browser.mjs';

const OUT = process.env.OUT ?? '/tmp/claude-1000/-home-lutz-personal-wowsims-mop/a456ffb7-c358-4299-a16d-31ee7d7a10b3/scratchpad/tw/probe';
const PORTS = { react: Number(process.env.REACT_PORT ?? 3402), tw: Number(process.env.TW_PORT ?? 3404) };
// 2200 is the untested regime: below 1921px the root font-size is 14px, at or above it 16px — every
// other width in this file sits under that switch.
const WIDTHS = [2200, 1600, 700];
const SPECS = (process.env.SPECS ?? 'warrior/arms,mage/fire,warrior/protection').split(',');
// The pane ids `SimTabDef` registers them under (`ui/app/SimTabsSection.tsx`), not link text or hrefs
// — React's tab strip is a Base UI `<button role="tab">` with no href, and the batch tab's visible
// text is "Batch" plus a badge, so text/href matching (vanilla's scheme) cannot find it.
const TABS = ['gear-tab', 'settings-tab', 'talents-tab', 'rotation-tab', 'detailed-results-tab-tab', 'bulk-tab'];

const PROPS = [
	'display','position','top','right','bottom','left','float','clear',
	'width','height','min-width','min-height','max-width','max-height',
	'margin-top','margin-right','margin-bottom','margin-left',
	'padding-top','padding-right','padding-bottom','padding-left',
	'border-top-width','border-right-width','border-bottom-width','border-left-width',
	'border-top-style','border-top-color','border-left-color','border-radius',
	'overflow-x','overflow-y','visibility','opacity','pointer-events','cursor','z-index','order',
	'flex-grow','flex-shrink','flex-basis','flex-direction','flex-wrap','align-items','align-self','justify-content','gap',
	'grid-template-columns','grid-template-rows',
	'font-size','font-weight','font-variant-numeric','line-height','color','background-color',
	'text-align','text-overflow','white-space','text-transform','letter-spacing','vertical-align','user-select','filter','transform',
];

const SNAP = props => {
	const normalizeColor = value => {
		const m = value.match(/^color\(srgb\s+([\d.]+|none)\s+([\d.]+|none)\s+([\d.]+|none)(?:\s*\/\s*([\d.]+|none))?\)$/);
		if (!m) return value;
		const chan = v => Math.round((v === 'none' ? 0 : Number(v)) * 255 + 1e-4);
		const [r, g, b] = [chan(m[1]), chan(m[2]), chan(m[3])];
		if (m[4] === undefined) return `rgb(${r}, ${g}, ${b})`;
		const a = m[4] === 'none' ? 0 : Number(m[4]);
		if (a === 1) return `rgb(${r}, ${g}, ${b})`;
		return `rgba(${r}, ${g}, ${b}, ${String(Math.round(a * 1000) / 1000)})`;
	};
	const out = [];
	const walk = (el, path) => {
		const cs = getComputedStyle(el);
		const r = el.getBoundingClientRect();
		const vals = props.map(p => normalizeColor(cs.getPropertyValue(p))).join('|');
		out.push(`${path} ${el.tagName.toLowerCase()} [${Math.round(r.x)},${Math.round(r.y)},${Math.round(r.width)},${Math.round(r.height)}] ${vals}`);
		let i = 0;
		for (const c of el.children) walk(c, `${path}/${i++}`);
	};
	walk(document.body, '');
	return out;
};

const settle = (page, ms) => page.waitForTimeout(ms);

const openTab = async (page, id) => {
	const ok = await page.evaluate(name => {
		const tab = [...document.querySelectorAll('[role="tab"]')].find(
			el => el.offsetParent !== null && (el.classList.contains(name) || el.getAttribute('aria-controls') === name),
		);
		if (!tab) return false;
		tab.click();
		return true;
	}, id);
	if (ok) await page.waitForTimeout(700);
	return ok;
};

const capture = async (browser, port, url, width, { tabs = false } = {}) => {
	const page = await browser.newPage();
	await page.addInitScript(() => {
		window.alert = () => {};
	});
	await page.setViewportSize({ width, height: 1000 });
	await page.goto(url.replace('PORT', String(port)), { waitUntil: 'load', timeout: 60000 });
	await page.waitForSelector(tabs ? q('sim-ui') : 'body', { timeout: 60000 });
	await settle(page, 2500);
	const shots = {};
	if (!tabs) {
		shots.default = await page.evaluate(SNAP, PROPS);
		const png = await page.screenshot({ fullPage: false });
		await page.close();
		return { shots, png: { default: png } };
	}
	const pngs = {};
	for (const t of TABS) {
		const found = await openTab(page, t);
		shots[t] = found ? await page.evaluate(SNAP, PROPS) : [`TAB-NOT-FOUND ${t}`];
		pngs[t] = await page.screenshot({ fullPage: false });
	}
	// Results-stuck: the results pane scrolled 400px down, with the sticky toolbar caught mid-stick —
	// precedent `header-toolbar.mjs`'s own scroll of the sim root. Re-open the results tab first since
	// the loop above leaves the last tab (`bulk-tab`) open.
	await openTab(page, 'detailed-results-tab-tab');
	await page.evaluate(sel => document.querySelector(sel)?.scrollTo({ top: 400 }), q('sim-ui'));
	await settle(page, 700);
	shots['results-stuck'] = await page.evaluate(SNAP, PROPS);
	pngs['results-stuck'] = await page.screenshot({ fullPage: false });
	await page.close();
	return { shots, png: pngs };
};

// Three differences are known, recorded in TAILWIND-DIVERGENCE.md, and verified to render
// identically. Normalising them here is what lets a real regression be seen at all.
//   1. `rounded-pill` (700px) vs `rounded-full` (calc(infinity * 1px)) — both far exceed half the
//      element height, so both are a full pill.
//   2. `CritCapRow`'s `--bs-border-opacity: 0` (the brand colour at zero alpha) vs
//      `border-transparent`. Both fully transparent.
//   3. `border-*-style: none` vs `solid` on an element whose four border widths are all 0.
const normalise = line =>
	line
		.replace(/\b(700px|3\.35544e\+07px|9999px)\b/g, 'PILL')
		.replace(/rgba\(224, 163, 53, 0\)/g, 'rgba(0, 0, 0, 0)')
		.replace(/\|0px\|0px\|0px\|0px\|(none|solid)\|/g, '|0px|0px|0px|0px|NOBORDER|');

const diff = (a, b) => {
	const out = [];
	const n = Math.max(a.length, b.length);
	for (let i = 0; i < n; i++) {
		const x = a[i] === undefined ? '<missing>' : normalise(a[i]);
		const y = b[i] === undefined ? '<missing>' : normalise(b[i]);
		if (x !== y) out.push(`  react: ${x}\n  tw   : ${y}`);
		if (out.length > 60) {
			out.push(`  ... truncated, ${n - i} lines left`);
			break;
		}
	}
	return out;
};

const main = async () => {
	mkdirSync(OUT, { recursive: true });
	const browser = await launch();
	const pages = [['landing', 'http://localhost:PORT/mop/', false], ...SPECS.map(s => [s, `http://localhost:PORT/mop/${s}/`, true])];
	let elements = 0;
	let problems = 0;
	const report = [];
	for (const [name, url, tabs] of pages) {
		for (const width of WIDTHS) {
			const r = await capture(browser, PORTS.react, url, width, { tabs });
			const t = await capture(browser, PORTS.tw, url, width, { tabs });
			for (const key of Object.keys(r.shots)) {
				const a = r.shots[key];
				const b = t.shots[key] ?? [];
				elements += a.length;
				const d = diff(a, b);
				const tag = `${name} @${width} ${key}`;
				if (d.length) {
					problems++;
					report.push(`\n### DIFF ${tag}  (${a.length} vs ${b.length} elements)\n${d.join('\n')}`);
				} else {
					report.push(`OK   ${tag}  ${a.length} elements identical`);
				}
				const slug = `${name.replace('/', '-')}-${width}-${key}`;
				writeFileSync(`${OUT}/${slug}.react.png`, r.png[key]);
				writeFileSync(`${OUT}/${slug}.tw.png`, t.png[key]);
			}
		}
	}
	await browser.close();
	const text = `elements compared: ${elements}\nsections with a diff: ${problems}\n${report.join('\n')}\n`;
	writeFileSync(`${OUT}/report.txt`, text);
	console.log(text.slice(0, 20000));
};

main();

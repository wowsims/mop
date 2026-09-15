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
// A tree-changing commit (an element inserted or removed) shifts every later line of the
// position-keyed snapshot, so the plain diff cannot say where the change is. With
// `CONFINE='<selector>'` a second, path-keyed comparison is written to confine.txt: every
// differing path must lie under an element matching the selector on either port ("confined"), or
// be a pure geometry shift with identical computed styles (reported with its delta so the reader
// can check it is exactly the subtree's height change). Default behaviour is unchanged.
const CONFINE = process.env.CONFINE ?? '';

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

// `display: contents` never paints — it has no box, so it isn't layout — and a portalled overlay
// root is verified by the state probe and the live matrix, not by the rest-state walk. SNAP and
// ROOTS each keep their own copy of this normalisation (they run inside `page.evaluate`, which
// serialises the function on its own and cannot see this module's scope), so a structural-only move
// (a `display: contents` slot wrapper dropped, an overlay portalled to a different parent) doesn't
// shift every later element's index into a wall of spurious diffs.
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
	const isContents = el => getComputedStyle(el).display === 'contents';
	const isPortalRoot = el => el.hasAttribute('data-base-ui-portal') || el.classList.contains('react-tooltip');
	const flatten = children => {
		const out = [];
		for (const c of children) {
			if (c.nodeType !== 1 || isPortalRoot(c)) continue;
			if (isContents(c)) out.push(...flatten(c.children));
			else out.push(c);
		}
		return out;
	};
	const out = [];
	const limit = 20000;
	let visited = 0;
	let gaveUp = false;
	const walk = (el, path) => {
		if (gaveUp) return;
		if (++visited > limit) {
			out.push(`${path} ALIGNMENT-GAVE-UP`);
			gaveUp = true;
			return;
		}
		const cs = getComputedStyle(el);
		const r = el.getBoundingClientRect();
		const vals = props.map(p => normalizeColor(cs.getPropertyValue(p))).join('|');
		out.push(`${path} ${el.tagName.toLowerCase()} [${Math.round(r.x)},${Math.round(r.y)},${Math.round(r.width)},${Math.round(r.height)}] ${vals}`);
		const kids = flatten(el.children);
		kids.forEach((c, i) => walk(c, `${path}/${i}`));
	};
	walk(document.body, '');
	return out;
};

// Paths (in SNAP's scheme: body is '', its children '/0', '/1', …) of every element matching the
// CONFINE selector — the subtrees a tree-changing commit is allowed to touch. Uses the same
// display:contents/portal normalisation as SNAP so indices line up between the two.
const ROOTS = selector => {
	const isContents = el => getComputedStyle(el).display === 'contents';
	const isPortalRoot = el => el.hasAttribute('data-base-ui-portal') || el.classList.contains('react-tooltip');
	const flatten = children => {
		const out = [];
		for (const c of children) {
			if (c.nodeType !== 1 || isPortalRoot(c)) continue;
			if (isContents(c)) out.push(...flatten(c.children));
			else out.push(c);
		}
		return out;
	};
	const pathOf = el => {
		const parts = [];
		for (let node = el; node && node !== document.body; node = node.parentElement) {
			parts.unshift(flatten(node.parentElement.children).indexOf(node));
		}
		return `/${parts.join('/')}`;
	};
	return [...document.querySelectorAll(selector)].map(pathOf);
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
	const roots = {};
	const rootsOf = async () => (CONFINE ? page.evaluate(ROOTS, CONFINE) : []);
	if (!tabs) {
		shots.default = await page.evaluate(SNAP, PROPS);
		roots.default = await rootsOf();
		const png = await page.screenshot({ fullPage: false });
		await page.close();
		return { shots, roots, png: { default: png } };
	}
	const pngs = {};
	for (const t of TABS) {
		const found = await openTab(page, t);
		shots[t] = found ? await page.evaluate(SNAP, PROPS) : [`TAB-NOT-FOUND ${t}`];
		roots[t] = found ? await rootsOf() : [];
		pngs[t] = await page.screenshot({ fullPage: false });
	}
	// Results-stuck: the results pane scrolled 400px down, with the sticky toolbar caught mid-stick —
	// precedent `header-toolbar.mjs`'s own scroll of the sim root. Re-open the results tab first since
	// the loop above leaves the last tab (`bulk-tab`) open.
	await openTab(page, 'detailed-results-tab-tab');
	await page.evaluate(sel => document.querySelector(sel)?.scrollTo({ top: 400 }), q('sim-ui'));
	await settle(page, 700);
	shots['results-stuck'] = await page.evaluate(SNAP, PROPS);
	roots['results-stuck'] = await rootsOf();
	pngs['results-stuck'] = await page.screenshot({ fullPage: false });
	await page.close();
	return { shots, roots, png: pngs };
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

// Path-keyed comparison for CONFINE mode. Lines are `path tag [x,y,w,h] vals`; a path present on
// both ports with equal tag and computed values but a different rect is a "shift"; everything
// else is a change, confined when its path is at or below a CONFINE root on either port.
const parse = lines => {
	const map = new Map();
	for (const line of lines) {
		const m = line.match(/^(\S*) (\S+) \[([^\]]*)\] (.*)$/);
		if (m) map.set(m[1], { tag: m[2], rect: m[3], vals: normalise(m[4]) });
	}
	return map;
};
const under = (path, roots) => roots.some(root => path === root || path.startsWith(`${root}/`));
const confine = (a, b, rootsA, rootsB) => {
	const A = parse(a);
	const B = parse(b);
	const roots = [...new Set([...rootsA, ...rootsB])];
	const out = { confined: 0, shifts: new Map(), unconfined: [] };
	const shift = (x, y) => {
		const [ax, ay, aw, ah] = x.rect.split(',').map(Number);
		const [bx, by, bw, bh] = y.rect.split(',').map(Number);
		const key = `dx=${bx - ax} dy=${by - ay} dw=${bw - aw} dh=${bh - ah}`;
		out.shifts.set(key, (out.shifts.get(key) ?? 0) + 1);
	};
	for (const [path, x] of A) {
		const y = B.get(path);
		if (!y) {
			if (under(path, roots)) out.confined++;
			else out.unconfined.push(`  react-only: ${path} ${x.tag} [${x.rect}]`);
			continue;
		}
		if (x.tag === y.tag && x.vals === y.vals) {
			if (x.rect === y.rect) continue;
			if (under(path, roots)) out.confined++;
			else shift(x, y);
			continue;
		}
		if (under(path, roots)) out.confined++;
		else out.unconfined.push(`  react: ${path} ${x.tag} [${x.rect}] ${x.vals}\n  tw   : ${path} ${y.tag} [${y.rect}] ${y.vals}`);
	}
	for (const [path, y] of B) {
		if (A.has(path)) continue;
		if (under(path, roots)) out.confined++;
		else out.unconfined.push(`  tw-only: ${path} ${y.tag} [${y.rect}]`);
	}
	return out;
};

// Wall-clock backstop for a section that will not settle for reasons SNAP's own bound can't see
// (a stuck page, a runaway resize/re-render loop): past this, the section is abandoned rather than
// hanging the whole run, with a message giving the section so it can be triaged.
const ALIGN_TIMEOUT_MS = Number(process.env.ALIGN_TIMEOUT_MS ?? 45000);
const withAlignTimeout = (promise, label) =>
	new Promise((resolve, reject) => {
		const timer = setTimeout(() => reject(new Error(`ALIGNMENT GAVE UP at ${label}`)), ALIGN_TIMEOUT_MS);
		promise.then(
			v => {
				clearTimeout(timer);
				resolve(v);
			},
			e => {
				clearTimeout(timer);
				reject(e);
			},
		);
	});

const main = async () => {
	mkdirSync(OUT, { recursive: true });
	const browser = await launch();
	const pages = [['landing', 'http://localhost:PORT/mop/', false], ...SPECS.map(s => [s, `http://localhost:PORT/mop/${s}/`, true])];
	let elements = 0;
	let problems = 0;
	let unconfined = 0;
	const report = [];
	const confined = [];
	for (const [name, url, tabs] of pages) {
		for (const width of WIDTHS) {
			const sectionLabel = `${name} @${width}`;
			let r, t;
			try {
				r = await withAlignTimeout(capture(browser, PORTS.react, url, width, { tabs }), `${sectionLabel} (react)`);
				t = await withAlignTimeout(capture(browser, PORTS.tw, url, width, { tabs }), `${sectionLabel} (tw)`);
			} catch (e) {
				problems++;
				report.push(`\n### ${e.message}`);
				continue;
			}
			for (const key of Object.keys(r.shots)) {
				const a = r.shots[key];
				const b = t.shots[key] ?? [];
				elements += a.length;
				const tag = `${sectionLabel} ${key}`;
				const gaveUp = a.some(l => l.endsWith(' ALIGNMENT-GAVE-UP')) || b.some(l => l.endsWith(' ALIGNMENT-GAVE-UP'));
				if (gaveUp) {
					problems++;
					report.push(`\nALIGNMENT GAVE UP at ${tag}`);
				} else {
					const d = diff(a, b);
					if (d.length) {
						problems++;
						report.push(`\n### DIFF ${tag}  (${a.length} vs ${b.length} elements)\n${d.join('\n')}`);
					} else {
						report.push(`OK   ${tag}  ${a.length} elements identical`);
					}
				}
				if (CONFINE) {
					const c = confine(a, b, r.roots[key] ?? [], t.roots[key] ?? []);
					const shifts = [...c.shifts].map(([delta, n]) => `${delta} ×${n}`).join('; ') || 'none';
					const bad = c.unconfined.length;
					if (bad) unconfined++;
					confined.push(
						`${bad ? 'BAD ' : 'OK  '} ${tag}  roots=${(r.roots[key] ?? []).length}/${(t.roots[key] ?? []).length} confined=${c.confined} unconfined=${bad} shifts: ${shifts}${bad ? `\n${c.unconfined.slice(0, 15).join('\n')}` : ''}`,
					);
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
	if (CONFINE) {
		const confineText = `confine selector: ${CONFINE}\nsections with unconfined diffs: ${unconfined}\n${confined.join('\n')}\n`;
		writeFileSync(`${OUT}/confine.txt`, confineText);
		console.log(confineText.slice(0, 20000));
		return;
	}
	console.log(text.slice(0, 20000));
};

main();

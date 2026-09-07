// Custom properties a port left behind, which no other gate can see.
//
// Bootstrap declares `--bs-modal-*` inside its own `.modal` rule, so a component that references one
// from outside a Bootstrap modal gets an empty value and the whole declaration is dropped. There is
// no error, no console warning, and `parity.mjs` records tag and sorted classes only — so the
// progress tracker shipped with `border: 1px solid var(--bs-modal-border-color)` and simply had no
// border until someone looked.
//
// "Empty" is NOT the defect on its own, and a first version of this gate that said so was wrong:
// Bootstrap emits `var(--bs-modal-footer-bg)` for a value this project's config leaves unset, so it
// resolves to nothing on master too, by design. What matters is a property that is empty on THIS
// build where the baseline resolves it — that is a component which left the scope declaring it.
// So both ports are measured and only the difference fails.
//
// The stylesheets are fetched and parsed here rather than read through `document.styleSheets`: vite
// emits its `<link>` with `crossorigin`, so touching `cssRules` throws and a gate that caught that
// would quietly inspect nothing. It asserts a non-zero declaration count for the same reason.
//
// Scope, stated rather than implied: it can only judge elements that exist, so anything inside a
// dialog that has not been opened is invisible to it. `OPENERS` opens the ported ones first.
import { launch, openSpec, PORTS, specsFromArgv } from './browser.mjs';

// Prefixes whose declaring scope is narrower than the components that reference them.
const WATCHED = ['--bs-modal-', '--bs-offcanvas-', '--bs-accordion-'];

// Clicked in order before the sweep so dialog content is in the DOM — these are the React popups,
// which are the ones at risk: they have no `.modal` ancestor to inherit Bootstrap's variables from.
// A selector that matches nothing is reported rather than skipped, because a renamed control would
// otherwise shrink coverage silently.
const OPENERS = [
	['stat weights', ['.ep-weights-action']],
	['advanced encounter', ['.advanced-button']],
	// React-only: master's tab strip is Bootstrap `.nav-link` anchors with no stable per-tab hook, so
	// this one reports NOT FOUND on the baseline by design. That costs nothing — the baseline reading
	// a property needs comes from any element that resolves it, not from this dialog.
	['glyph selector (react tabs only)', ['.sim-tab-link.talents-tab', '.major-glyphs .glyph-picker-root .glyph-link']],
];

// Below this, the run learned nothing and the pass would be vacuous.
const MIN_DECLARATIONS = 5;

/** Every `selector { property: … var(--watched-x) … }` in one stylesheet's text. */
const parseDeclarations = (css, watched) => {
	const found = [];
	const pattern = new RegExp(`var\\(\\s*(${watched.map(prefix => `${prefix}[a-z0-9-]+`).join('|')})`, 'g');
	let match;
	while ((match = pattern.exec(css)) !== null) {
		const custom = match[1];
		// Walk back to the declaration's property name, then to the rule's opening brace.
		const declStart = Math.max(css.lastIndexOf(';', match.index), css.lastIndexOf('{', match.index)) + 1;
		const property = css.slice(declStart, css.indexOf(':', declStart)).trim();
		const braceAt = css.lastIndexOf('{', match.index);
		if (braceAt < 0) continue;
		const selectorStart = Math.max(css.lastIndexOf('}', braceAt), css.lastIndexOf('{', braceAt - 1)) + 1;
		const selector = css.slice(selectorStart, braceAt).trim();
		// At-rule preludes (`@media …`) are not selectors; the rule inside carries its own.
		if (!selector || selector.startsWith('@') || !property || property.startsWith('@')) continue;
		found.push({ selector, property, custom });
	}
	return found;
};

const RESOLVE = declarations =>
	declarations.map(declaration => {
		let elements = [];
		try {
			elements = Array.from(document.querySelectorAll(declaration.selector));
		} catch {
			return { ...declaration, matched: -1, dead: 0, example: '' };
		}
		const dead = elements.filter(element => !getComputedStyle(element).getPropertyValue(declaration.custom).trim());
		return {
			...declaration,
			matched: elements.length,
			dead: dead.length,
			example: dead.length ? dead[0].className || dead[0].tagName.toLowerCase() : '',
		};
	});

const measure = async (browser, port, spec) => {
	const { page } = await openSpec(browser, port, spec, { selector: '.sim-sidebar, .sim-ui' });
	const opened = [];
	for (const [label, selectors] of OPENERS) {
		let missing = null;
		for (const selector of selectors) {
			const found = await page.$(selector);
			if (!found) {
				missing = selector;
				break;
			}
			await page.evaluate(element => element.click(), found);
			await page.waitForTimeout(400);
		}
		opened.push(missing ? `${label}: NOT FOUND (${missing})` : `${label}: opened`);
	}

	const hrefs = await page.evaluate(() =>
		Array.from(document.querySelectorAll('link[rel=stylesheet]'))
			.map(link => link.href)
			.filter(href => href.startsWith(location.origin)),
	);
	const declarations = [];
	for (const href of hrefs) {
		const response = await fetch(href);
		declarations.push(...parseDeclarations(await response.text(), WATCHED));
	}

	const results = await page.evaluate(RESOLVE, declarations);
	await page.close();
	return { opened, declarations, results };
};

const browser = await launch();
let failed = 0;

for (const spec of specsFromArgv()) {
	const base = await measure(browser, PORTS.base, spec);
	const react = await measure(browser, PORTS.react, spec);

	console.log(`\n${spec}`);
	console.log(`  openers   base [${base.opened.join(' | ')}]  react [${react.opened.join(' | ')}]`);
	console.log(`  declarations   base ${base.declarations.length}   react ${react.declarations.length}`);

	if (react.declarations.length < MIN_DECLARATIONS || base.declarations.length < MIN_DECLARATIONS) {
		failed++;
		console.log(`  FAIL  fewer than ${MIN_DECLARATIONS} declarations found — the sweep is not reading the stylesheets`);
		continue;
	}

	// A property the baseline resolves nowhere is one the project's Bootstrap config leaves unset,
	// which is Bootstrap's own way of saying "no value". Only the ones it does resolve can regress.
	const liveOnBase = new Set(base.results.filter(result => result.matched > 0 && result.dead < result.matched).map(result => result.custom));
	const problems = react.results.filter(result => result.matched > 0 && result.dead > 0 && liveOnBase.has(result.custom));

	console.log(`  live on the baseline   ${[...liveOnBase].join(', ') || '(none)'}`);

	if (!problems.length) {
		console.log('  PASS  every property the baseline resolves still resolves wherever react uses it');
		continue;
	}
	failed++;
	for (const problem of problems) {
		console.log(`  FAIL  ${problem.custom} is empty on ${problem.dead}/${problem.matched} react element(s), but resolves on the baseline`);
		console.log(`          ${problem.property} in "${problem.selector}"`);
		console.log(`          e.g. .${problem.example}`);
	}
}

await browser.close();
console.log(failed ? `\n${failed} spec(s) FAILED` : '\nno property regressed out of its declaring scope');
process.exit(failed ? 1 : 0);

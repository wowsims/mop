// The sidebar's reference bar — save a run as the reference, swap it with the current one, delete
// it — and the seven deltas it fills in. Nothing else has ever driven it.
//
// `topline-metrics.mjs` compares the finished sidebar list digit for digit across the two ports, but
// only in the state a page reaches on its own: no reference, every `.results-reference` still
// `hide`. `sim-progress.mjs` stops at "the result carries its metric tiles". The three buttons and
// the delta text under them were observed by **zero** checks, and they are exactly what porting the
// vanilla builder out of `.results-content` had to keep.
//
// Two runs are needed, not one: a reference only becomes visible once a *second* result is compared
// against it, and only a second run can make a delta non-zero. Both are short and seeded, so the
// gate is a couple of minutes rather than the ten a real run takes.
//
// Cross-port, like `topline-metrics.mjs`: the baseline's own autosaved settings blob is planted on
// both builds with a fixed seed, so the same two runs happen twice and the delta text is comparable
// character for character. What is *not* comparable is `type` on the three buttons — vanilla emits
// none — so that is asserted only on the port, the way `sim-progress.mjs` handles its defects.
//
// One divergence is deliberate, and it is the `deleted` stage's delta text. Vanilla's
// `updateReference` re-adds `hide` and returns early when the reference is gone, leaving the last
// delta it wrote in the hidden span; the port renders that span from state, so it goes empty. Both
// slots are `hide`, so nothing is on screen either way. The stage is therefore compared with the
// text stripped, and the divergence itself is asserted below — including that the baseline still
// leaves text behind, so a stale entry fails rather than passing quietly.
import { launch, openSpec, PORTS } from './browser.mjs';

const SPECS = ['warrior/arms'];
const SEED = '1337';
const ITERATIONS = 200;
// A fixed seed makes a rerun of the same settings reproduce the first result exactly, so the second
// run is a different length. That keeps it deterministic — and identical on both ports — while
// still moving every number, which is what a delta needs to be non-zero.
const RERUN_ITERATIONS = 500;
const SETTINGS_SUFFIX = '__currentSettings__';

const specs = () => (process.argv[2] ? process.argv[2].split(',') : SPECS);

// Classes are sorted so a clsx-vs-classList ordering difference is not read as a divergence; the
// question here is which classes are on, not in what order they were written.
const READ = () => {
	const cls = el => (el.getAttribute('class') || '').trim().split(/\s+/).filter(Boolean).sort().join('.');
	const text = el => (el ? el.textContent.replace(/\s+/g, ' ').trim() : null);
	const bar = document.querySelector('.results-content .results-sim-reference');
	if (!bar) return ['NO .results-content .results-sim-reference'];

	const visible = el => !!el && !!el.offsetParent;
	const button = selector => {
		const el = bar.querySelector(selector);
		return el ? `${text(el)} visible=${visible(el)}` : 'MISSING';
	};

	return [
		`bar ${cls(bar)}`,
		`set ${button('.results-sim-set-reference')}`,
		`swap ${button('.results-sim-reference-swap')}`,
		`delete ${button('.results-sim-reference-delete')}`,
		...[...document.querySelectorAll('.results-content .results-metric')].map(metric => {
			const slot = metric.querySelector('.results-reference');
			const diff = metric.querySelector('.results-reference-diff');
			return `${cls(metric)} slot=${slot ? cls(slot) : 'MISSING'} diff=${cls(diff)} text=${text(diff)}`;
		}),
	];
};

// The port's own fix, invisible to a cross-port diff because the baseline has nothing to compare.
const TYPES = () => [...document.querySelectorAll('.results-content .results-sim-reference button')].map(button => button.getAttribute('type'));

const settingsBlob = async (browser, spec) => {
	const { page } = await openSpec(browser, PORTS.base, spec);
	const stored = await page.evaluate(suffix => {
		const key = Object.keys(localStorage).find(candidate => candidate.endsWith(suffix));
		return key ? { key, value: localStorage.getItem(key) } : null;
	}, SETTINGS_SUFFIX);
	await page.close();
	if (!stored) throw new Error(`no ${SETTINGS_SUFFIX} entry after loading ${spec}`);

	const settings = JSON.parse(stored.value);
	settings.settings = { ...settings.settings, fixedRngSeed: SEED, iterations: ITERATIONS };
	return { key: stored.key, value: JSON.stringify(settings) };
};

const collect = async (browser, port, spec, seeded) => {
	const { page, errors } = await openSpec(browser, port, spec);
	await page.addInitScript(({ key, value }) => localStorage.setItem(key, value), seeded);
	await page.reload({ waitUntil: 'load', timeout: 60000 });
	await page.waitForSelector('.sim-ui', { timeout: 60000 });
	await page.waitForTimeout(2500);

	const runOnce = async iterations => {
		await page.fill('#simui-iterations', String(iterations));
		await page.dispatchEvent('#simui-iterations', 'change');
		await page.waitForSelector('.dps-action:not([disabled])', { timeout: 120000 });
		const before = await page.evaluate(() => document.querySelector('.results-content .results-metric .topline-result-avg')?.textContent ?? '');
		await page.click('.dps-action');
		// Waits for the *text* to change rather than for a tile to exist: the second run replaces a
		// list that is already there, so a count would be satisfied before it ever re-rendered.
		await page.waitForFunction(
			previous => {
				const avg = document.querySelector('.results-content .results-metric .topline-result-avg');
				return !!avg && avg.textContent !== previous;
			},
			before,
			{ timeout: 180000 },
		);
		await page.waitForTimeout(300);
	};

	const stages = {};
	await runOnce(ITERATIONS);
	stages.firstRun = await page.evaluate(READ);

	await page.click('.results-sim-set-reference');
	await page.waitForTimeout(200);
	stages.referenceSet = await page.evaluate(READ);

	await runOnce(RERUN_ITERATIONS);
	stages.secondRun = await page.evaluate(READ);

	await page.click('.results-sim-reference-swap');
	await page.waitForTimeout(300);
	stages.swapped = await page.evaluate(READ);

	await page.click('.results-sim-reference-delete');
	await page.waitForTimeout(200);
	stages.deleted = await page.evaluate(READ);

	const types = await page.evaluate(TYPES);
	await page.close();
	return { stages, types, errors };
};

const diff = (label, base, react, problems) => {
	for (let index = 0; index < Math.max(base.length, react.length); index++) {
		if (base[index] !== react[index]) problems.push(`${label} line ${index}\n      base : ${base[index]}\n      react: ${react[index]}`);
	}
};

const browser = await launch();
let failures = 0;
try {
	for (const spec of specs()) {
		const seeded = await settingsBlob(browser, spec);
		const sides = {};
		for (const [side, port] of Object.entries(PORTS)) sides[side] = await collect(browser, port, spec, seeded);

		const problems = [];
		const withoutText = lines => lines.map(line => line.replace(/ text=.*$/, ''));
		for (const stage of Object.keys(sides.base.stages)) {
			const [base, react] = [sides.base.stages[stage], sides.react.stages[stage]];
			if (stage === 'deleted') diff(stage, withoutText(base), withoutText(react), problems);
			else diff(stage, base, react, problems);
		}

		const deletedText = side => sides[side].stages.deleted.filter(line => line.includes(' text=')).map(line => line.replace(/^.* text=/, ''));
		if (deletedText('react').some(text => text !== '')) problems.push(`deleted: the port left delta text in the hidden slot — ${JSON.stringify(deletedText('react'))}`);
		if (!deletedText('base').some(text => text !== '')) problems.push('deleted: the baseline no longer leaves stale delta text, so the recorded divergence is gone');

		// Invariants, so a build where every stage is identically broken still fails. `has-reference`
		// is the class the stylesheet swaps the button for the bar on; the deltas are what the bar is
		// for. Mutation check: drop the `has-reference` toggle and the first two fail; drop
		// `referenceDiffs` and the third does.
		const on = (stage, needle) => sides.react.stages[stage].some(line => line.includes(needle));
		const bar = stage => sides.react.stages[stage][0];
		if (bar('firstRun') !== 'bar results-sim-reference') problems.push(`firstRun: the bar starts flagged — ${bar('firstRun')}`);
		if (bar('referenceSet') !== 'bar has-reference.results-sim-reference') problems.push(`referenceSet: the bar is not flagged — ${bar('referenceSet')}`);
		if (bar('deleted') !== 'bar results-sim-reference') problems.push(`deleted: the bar stayed flagged — ${bar('deleted')}`);
		if (on('firstRun', 'text=+') || on('firstRun', 'text=-')) problems.push('firstRun: a delta was filled in before any reference was saved');
		if (!on('secondRun', 'text=+') && !on('secondRun', 'text=-')) problems.push('secondRun: no delta was filled in against the saved reference');
		if (on('deleted', 'text=+') || on('deleted', 'text=-')) problems.push('deleted: a delta survived the reference being removed');
		if (sides.react.types.length !== 3 || sides.react.types.some(type => type !== 'button')) {
			problems.push(`the three reference buttons declare a type: ${JSON.stringify(sides.react.types)}`);
		}

		const ok = problems.length === 0;
		if (!ok) failures++;
		console.log(`${ok ? 'PASS' : 'FAIL'}  ${spec.padEnd(22)} stages=${Object.keys(sides.react.stages).length} metrics=${sides.react.stages.secondRun.length - 4}`);
		problems.forEach(problem => console.log('    ! ' + problem));
		sides.react.errors.slice(0, 3).forEach(error => console.log('    error: ' + error.slice(0, 140)));
	}
} finally {
	await browser.close();
}

console.log(failures ? `\n${failures} spec(s) differ` : '\nthe reference bar matches the baseline through set, rerun, swap and delete');
process.exit(failures ? 1 : 0);

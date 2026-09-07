// The detailed-results metrics tables: the region both tree gates see only as an empty shell.
//
// `parity.mjs` and `panes-parity.mjs` serialise the results pane without ever running a sim, and
// `SERIALIZE` records tag and sorted classes only. So everything below the `<thead>` — rows, values,
// sort order, grouping, expansion, tooltips — is compared against nothing today. This gate asserts
// it directly, so the rebuild has something to be measured against that was proved on the vanilla
// build first.
//
// `PORT` picks a build, `stat-weights.mjs` style, and there is no cross-build comparison: no page
// handle exposes `sim`, so the gate cannot fix an RNG seed, so two builds sim different fights and
// no number survives the crossing. Every assertion below is therefore an invariant, and the gate is
// expected to exit 0 on **both** ports — on the baseline because that is what proves the invariants
// describe today's behaviour, and on the port because that is what proves the rebuild kept them.
//
// Deliberately shape-agnostic where the port will differ: collapsed children are asserted invisible
// (`offsetParent === null`), never `.hide`, because vanilla hides them with a class and a React
// table will unmount them instead. `.expand` on the *parent* is still asserted — the stylesheet
// picks which caret shows off it, so it is a contract either way.
import { launch, openSpec, PORTS, SERIALIZE } from './browser.mjs';

// Beast mastery, not arms, and not by accident: `shouldCollapse` keeps a parent row only for a pet,
// so a spec with a permanent pet is what guarantees the grouped-row assertions have something to run
// on. The gate asserts those parents exist rather than skipping when it finds none.
const SPEC = process.argv[2] ?? 'hunter/beast_mastery';
const PORT = Number(process.env.PORT ?? PORTS.react);

// Logged by `ActionId.toStringIgnoringTag()` for the merged pet-group parent rows, whose
// `actionIdOverride` is an absent `petActionId`. Present on both builds; the count drops as tables
// port, because a React name cell keys its icon on `equalityKey()`, which does not log.
const BENIGN_CONSOLE = /Empty action id!/;

const HEAD = 'metrics-table-header-cell';
const PRIMARY = 'metrics-table-cell--primary-metric.metrics-table-header-cell.text-center';
const RATE = 'metrics-table-header-cell.text-body.text-success';
const plain = count => Array(count).fill(HEAD);

// The at-load shell, read off the column configs. `sortCol` is the one column carrying
// `ColumnSortType.Descending`. `mustHaveRows` is set only where a sim on this spec is guaranteed to
// produce rows: dtps is empty for a DPS spec and healing is one incidental row, so neither claims it.
const TABLES = [
	{ root: '.damage-metrics-root', headers: [HEAD, PRIMARY, ...plain(7), RATE], sortCol: 9, mustHaveRows: true },
	{ root: '.healing-metrics-root', headers: [HEAD, PRIMARY, ...plain(9), RATE], sortCol: 11 },
	{ root: '.dtps-metrics-root', headers: [HEAD, PRIMARY, ...plain(6), RATE], sortCol: 8 },
	{ root: '.cast-metrics-root', headers: plain(3), sortCol: 1, mustHaveRows: true },
	{ root: '.buff-metrics-root', headers: plain(4), sortCol: 3, mustHaveRows: true },
	{ root: '.debuff-metrics-root', headers: plain(4), sortCol: 3, mustHaveRows: true },
];

// `orderedResourceTypes` — always all 15 in the DOM, each container hidden until its table has rows.
const RESOURCE_CONTAINERS = 15;
const RESOURCE_COLUMNS = 6;

const problems = [];
const check = (name, ok, detail) => {
	if (!ok) problems.push(name);
	console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}${detail === undefined ? '' : `  ${detail}`}`);
};

// `TableSorter.sortFunc`, reproduced so the order is judged by the rule the code applies rather than
// by "these look sorted".
const compare = (a, b, asc) => {
	if (typeof a === 'number' && typeof b === 'number') return asc ? a - b : b - a;
	return asc ? String(a).localeCompare(String(b)) : String(b).localeCompare(String(a));
};

// Mixed number/string neighbours are skipped: `getValue` yields `NaN` for a row with no hits (0/0),
// which `parseFloat` leaves as the string 'NaN', and the comparator is not a total order across the
// two types — so a sorted array carries no adjacent-pair guarantee there. Every same-type neighbour
// is still checked, and the skipped count is printed so a column that went all-mixed is visible.
const ordering = (values, asc) => {
	let compared = 0;
	let skipped = 0;
	const inversions = [];
	for (let i = 1; i < values.length; i++) {
		const [a, b] = [values[i - 1], values[i]];
		if (typeof a !== typeof b) {
			skipped++;
			continue;
		}
		compared++;
		if (compare(a, b, asc) > 0) inversions.push(`${JSON.stringify(a)} before ${JSON.stringify(b)}`);
	}
	return { compared, skipped, inversions };
};

// Everything below runs in the page.

const SHELL = roots =>
	roots.map(root => {
		const rootElem = document.querySelector(root);
		if (!rootElem) return { root, missing: true };
		const table = rootElem.querySelector('table');
		const thead = table?.querySelector('thead');
		const tbody = table?.querySelector('tbody');
		const classesOf = el => [...el.classList].sort().join('.');
		const headers = [...(thead?.querySelectorAll('th') ?? [])];
		return {
			root,
			table: table ? classesOf(table) : null,
			thead: thead ? classesOf(thead) : null,
			headerRow: thead?.querySelector('tr') ? classesOf(thead.querySelector('tr')) : null,
			tbody: tbody ? classesOf(tbody) : null,
			rows: tbody ? tbody.querySelectorAll('tr').length : null,
			headers: headers.map(classesOf),
			// Every `<th>` wraps its label in a span. The stylesheet reads it and the port must keep it.
			labelled: headers.filter(th => th.firstElementChild?.tagName === 'SPAN' && th.textContent.trim()).length,
		};
	});

const RESOURCES = () =>
	[...document.querySelectorAll('.resource-metrics-table-container')].map(container => ({
		hidden: container.classList.contains('hide'),
		title: container.querySelector('.resource-metrics-table-title')?.textContent ?? null,
		tables: container.querySelectorAll('.resource-metrics-table-root').length,
		columns: container.querySelectorAll('thead th').length,
		rows: container.querySelectorAll('tbody tr').length,
	}));

const ROWS = root => {
	const rootElem = document.querySelector(root);
	if (!rootElem) return { missing: true };
	const rows = [...rootElem.querySelectorAll('tbody tr')];
	return {
		total: rows.length,
		parents: rows.filter(row => row.classList.contains('parent-metric')).length,
		children: rows.filter(row => row.classList.contains('child-metric')).length,
		hidden: rootElem.classList.contains('hide'),
		// The name cell `nameCellConfig` builds: an icon anchor and a name span, on every row.
		withName: rows.filter(row => row.querySelector('.metrics-action-name')?.textContent.trim()).length,
		withIcon: rows.filter(row => row.querySelector('a.metrics-action-icon')).length,
		resolved: rows.filter(row => row.querySelector('a.metrics-action-icon')?.getAttribute('href')).length,
	};
};

// The order the table arrives in, before anything is clicked. `TableSorter.update()` sorts on
// `defaultSortCol` with `sortDesc` still true, so the one column carrying `ColumnSortType.Descending`
// opens descending — the behaviour a model-driven table has to be configured into rather than
// inheriting.
const DEFAULT_SORT_PROBE = ({ root, column }) => {
	const parse = cell => {
		const raw = cell.dataset.text ?? cell.innerText;
		const num = parseFloat(raw);
		return isNaN(num) ? raw : num;
	};
	return [...document.querySelectorAll(`${root} tbody tr`)].filter(row => !row.classList.contains('child-metric')).map(row => parse(row.cells[column]));
};

// Every probe below yields after a click before reading the result back. `TableSorter` mutates the
// DOM inside its own listener, but a React table schedules the update and commits it in a
// microtask — a difference in *when*, not in what, and a gate that could not tell the two apart
// would fail the port for the right implementation.

// Click every header twice and read the column back each time. One evaluate rather than one per
// click: a dispatched click also reaches the eight inner Bootstrap panes that are never displayed,
// where a real mouse cannot.
const SORT_PROBE = async root => {
	const settle = () => new Promise(resolve => setTimeout(resolve, 0));
	// `TableSorter.parseRowValues` verbatim.
	const parse = cell => {
		const raw = cell.dataset.text ?? cell.innerText;
		const num = parseFloat(raw);
		return isNaN(num) ? raw : num;
	};
	const table = document.querySelector(`${root} table.metrics-table`);
	if (!table) return { missing: true };
	const column = index => [...table.querySelectorAll('tbody tr')].filter(row => !row.classList.contains('child-metric')).map(row => parse(row.cells[index]));
	// `sortDesc` starts all-true and `setSort` flips before applying, so the first click on any
	// column — the default one included — is ascending and the second is descending.
	const out = [];
	for (const [index, th] of [...table.querySelectorAll('thead th')].entries()) {
		th.click();
		await settle();
		const asc = column(index);
		th.click();
		await settle();
		out.push({ asc, desc: column(index) });
	}
	return out;
};

// Groups keyed by their whole row text: a pet's child rows can repeat a name ("Melee" twice).
const GROUP_PROBE = async ({ root, column }) => {
	const settle = () => new Promise(resolve => setTimeout(resolve, 0));
	const parse = cell => {
		const raw = cell.dataset.text ?? cell.innerText;
		const num = parseFloat(raw);
		return isNaN(num) ? raw : num;
	};
	const table = document.querySelector(`${root} table.metrics-table`);
	if (!table) return { missing: true };
	const key = row => [...row.cells].map(cell => cell.textContent.trim()).join('|');
	const groups = () => {
		const rows = [...table.querySelectorAll('tbody tr')];
		const out = [];
		for (let i = 0; i < rows.length; i++) {
			if (!rows[i].classList.contains('parent-metric')) continue;
			const children = [];
			for (let j = i + 1; j < rows.length && rows[j].classList.contains('child-metric'); j++) children.push(rows[j]);
			out.push({ parent: key(rows[i]), children: children.map(key), values: children.map(child => parse(child.cells[column])) });
		}
		return out;
	};
	const before = groups();
	table.querySelectorAll('thead th')[column].click();
	await settle();
	return { before, after: groups() };
};

const EXPAND_PROBE = async root => {
	const settle = () => new Promise(resolve => setTimeout(resolve, 0));
	const bodyRows = () => [...document.querySelectorAll(`${root} tbody tr`)];
	const childrenOf = (rows, at) => {
		const out = [];
		for (let i = at + 1; i < rows.length && rows[i].classList.contains('child-metric'); i++) out.push(rows[i]);
		return out;
	};
	// The biggest group, so the assertion is about a block of children rather than about one row.
	const initial = bodyRows();
	let at = -1;
	initial.forEach((row, index) => {
		if (row.classList.contains('parent-metric') && (at === -1 || childrenOf(initial, index).length > childrenOf(initial, at).length)) at = index;
	});
	if (at === -1) return { missing: 'no parent-metric row' };
	const parent = initial[at];
	// Visibility, never `.hide`, and the children re-found each time rather than held: vanilla hides
	// a collapsed child with a class and gives the same element back, a React table unmounts it and
	// mounts a new one. Both read as zero visible children below the parent.
	const state = () => {
		const rows = bodyRows();
		const index = rows.indexOf(parent);
		const children = index === -1 ? [] : childrenOf(rows, index);
		return {
			expand: parent.classList.contains('expand'),
			children: children.length,
			visible: children.filter(child => child.offsetParent !== null).length,
		};
	};
	const open = state();
	parent.click();
	await settle();
	const collapsed = state();
	parent.click();
	await settle();
	return { count: open.children, open, collapsed, reopened: state() };
};

const TIPS = () => {
	const boxes = [...document.querySelectorAll('.tippy-box')].filter(box => box.getAttribute('data-state') === 'visible');
	return { open: boxes.length, withTable: boxes.filter(box => box.querySelector('table.metrics-table')).length };
};

const browser = await launch();
try {
	const { page, errors } = await openSpec(browser, PORT, SPEC);
	const fatal = () => errors.filter(error => !BENIGN_CONSOLE.test(error));

	console.log(`${SPEC} on :${PORT}\n`);

	// Opened through the probe rather than by selector: the pane id is `detailed-results-tab-tab`
	// (`SimUI.addTab` appends `-tab` to the css class) and the strip's shape is what a later swap
	// changes.
	const tabId = await page.evaluate(() => window.simTabsProbe.ids().find(id => id && /detailed-results/.test(id)));
	check('the results tab is in the strip', !!tabId, String(tabId));
	if (!tabId) throw new Error('no detailed-results tab');
	await page.evaluate(
		id =>
			window.simTabsProbe
				.tabs()
				.find(tab => window.simTabsProbe.idOf(tab) === id)
				.click(),
		tabId,
	);
	await page.waitForTimeout(1200);

	// The plan's Risk 1, converted from an inference into a number. Its "assert the two ports are
	// equal" cannot happen inside one run — the mould is one build per run — so this is printed on
	// each and compared across the pair.
	const shellLines = (await page.evaluate(SERIALIZE, `#${tabId}`)).split('\n').length;
	console.log(`serialised pane at load: ${shellLines} lines (compare across the two ports)\n`);

	console.log('shell at load');
	const shell = await page.evaluate(
		SHELL,
		TABLES.map(table => table.root),
	);
	for (const [index, table] of TABLES.entries()) {
		const seen = shell[index];
		const expected = table.headers;
		const ok =
			!seen.missing &&
			seen.table === 'metrics-table.tablesorter' &&
			seen.thead === 'metrics-table-header' &&
			seen.headerRow === 'metrics-table-header-row' &&
			seen.tbody === 'metrics-table-body' &&
			seen.rows === 0 &&
			seen.labelled === expected.length &&
			JSON.stringify(seen.headers) === JSON.stringify(expected);
		check(`${table.root} builds its whole shell before any sim`, ok, `${seen.headers?.length ?? 0}/${expected.length} columns, ${seen.rows} rows`);
		if (!ok) console.log(`        got ${JSON.stringify(seen)}`);
	}

	const containers = await page.evaluate(RESOURCES);
	check(
		`all ${RESOURCE_CONTAINERS} resource containers exist at load, hidden, each holding one ${RESOURCE_COLUMNS}-column table`,
		containers.length === RESOURCE_CONTAINERS &&
			containers.every(container => container.hidden && container.tables === 1 && container.columns === RESOURCE_COLUMNS && container.title),
		`${containers.length} containers, ${containers.filter(container => container.hidden).length} hidden`,
	);

	console.log('\nrunning one iteration');
	await page.waitForSelector('.detailed-results-1-iteration-button:not([disabled])', { timeout: 60000 });
	const started = Date.now();
	await page.click('.detailed-results-1-iteration-button');
	await page.waitForFunction(() => !document.querySelector('.dr-no-results'), null, { timeout: 120000 });
	await page.waitForFunction(() => document.querySelectorAll('.damage-metrics-root tbody tr').length > 0, null, { timeout: 60000 });
	await page.waitForTimeout(500);
	console.log(`  ----  ${Date.now() - started} ms`);

	console.log('\nrows');
	const rowCounts = {};
	for (const table of TABLES) {
		const rows = await page.evaluate(ROWS, table.root);
		rowCounts[table.root] = rows;
		// The one universal invariant: `MetricsTable.onSimResult` toggles `hide` on exactly this.
		check(`${table.root} is hidden exactly when it has no rows`, rows.total > 0 !== rows.hidden, `${rows.total} rows, hide=${rows.hidden}`);
		if (table.mustHaveRows) check(`${table.root} has rows after a sim`, rows.total > 0, String(rows.total));
		if (!rows.total) continue;
		check(
			`${table.root} renders a name cell on every row`,
			rows.withName === rows.total && rows.withIcon === rows.total,
			`${rows.withName} names, ${rows.withIcon} icons of ${rows.total}`,
		);
		// Icon resolution, not the node cache. Not per row: the merged pet-group parents carry an
		// empty ActionId and legitimately never resolve one.
		check(`${table.root} resolves at least one action icon`, rows.resolved > 0, `${rows.resolved}/${rows.total}`);
	}

	const populated = TABLES.filter(table => rowCounts[table.root].total > 0);

	console.log('\nthe default column opens descending, before any header is clicked');
	for (const table of populated) {
		const values = await page.evaluate(DEFAULT_SORT_PROBE, { root: table.root, column: table.sortCol });
		const down = ordering(values, false);
		check(
			`${table.root} opens sorted descending on column ${table.sortCol}`,
			down.inversions.length === 0 && (down.compared > 0 || values.length < 2),
			`${values.length} parent rows, ${down.compared} compared, ${down.skipped} mixed-type skipped${down.inversions.length ? `; ${down.inversions[0]}` : ''}`,
		);
	}

	console.log('\nsorting — first click ascending, second descending, every column');
	for (const table of populated) {
		const columns = await page.evaluate(SORT_PROBE, table.root);
		const failures = [];
		let compared = 0;
		let skipped = 0;
		for (const [index, { asc, desc }] of columns.entries()) {
			const up = ordering(asc, true);
			const down = ordering(desc, false);
			compared += up.compared + down.compared;
			skipped += up.skipped + down.skipped;
			if (up.inversions.length) failures.push(`col ${index} asc: ${up.inversions[0]}`);
			if (down.inversions.length) failures.push(`col ${index} desc: ${down.inversions[0]}`);
		}
		// A single-row table orders trivially and cannot say anything; anything wider has to actually
		// compare something, or a column that read as all-mixed would pass silently.
		const parentRows = columns[0]?.asc.length ?? 0;
		check(
			`${table.root} sorts every column both ways`,
			failures.length === 0 && (compared > 0 || parentRows < 2),
			failures.length
				? failures.join('; ')
				: `${columns.length} columns, ${parentRows} parent rows, ${compared} neighbours compared, ${skipped} mixed-type skipped`,
		);
	}

	console.log('\nsub-rows stay with their parent and re-sort with it');
	for (const table of populated) {
		if (!rowCounts[table.root].parents) continue;
		// Any column but the one it is already sorted on. Column 0 is the string sort, which is the
		// one a model-driven table is likeliest to get wrong.
		const column = table.sortCol === 0 ? 1 : 0;
		const { before, after } = await page.evaluate(GROUP_PROBE, { root: table.root, column });
		const parentsKept = JSON.stringify(before.map(group => group.parent).sort()) === JSON.stringify(after.map(group => group.parent).sort());
		const byParent = new Map(before.map(group => [group.parent, group]));
		const childrenKept = after.every(group => {
			const was = byParent.get(group.parent);
			return was && JSON.stringify([...group.children].sort()) === JSON.stringify([...was.children].sort());
		});
		const inversions = after.flatMap(group => ordering(group.values, true).inversions);
		// A group of one child orders trivially, so at least one real block has to be present or the
		// within-group ordering half of this check says nothing.
		const blocks = after.filter(group => group.children.length > 1).length;
		check(
			`${table.root} keeps every child block with its parent and re-sorts it by column ${column}`,
			before.length > 0 && blocks > 0 && parentsKept && childrenKept && inversions.length === 0,
			`${before.length} groups (${blocks} with >1 child), parents kept=${parentsKept}, children kept=${childrenKept}, ${inversions.length} inversions`,
		);
	}

	console.log('\nexpansion');
	const expansion = await page.evaluate(EXPAND_PROBE, '.damage-metrics-root');
	check(
		'a parent row starts expanded, hides its children on click, and shows them again on a second click',
		!expansion.missing &&
			expansion.count > 0 &&
			expansion.open.expand &&
			expansion.open.visible === expansion.count &&
			!expansion.collapsed.expand &&
			expansion.collapsed.visible === 0 &&
			expansion.reopened.expand &&
			expansion.reopened.visible === expansion.count,
		JSON.stringify(expansion),
	);

	console.log('\ntooltips');
	const hover = async locator => {
		await page.mouse.move(0, 0);
		await page.waitForTimeout(450);
		await locator.hover({ timeout: 5000 });
		await page.waitForTimeout(650);
		return page.evaluate(TIPS);
	};
	const primary = await hover(page.locator('.damage-metrics-root tbody tr td.metrics-table-cell--primary-metric').first());
	check('the primary-metric cell opens a tooltip holding a nested metrics table', primary.withTable > 0, JSON.stringify(primary));

	// The threat veto: `onShow` returns false while `.hide-threat-metrics` is on the sim root, so the
	// same cell must open in one state and stay shut in the other. Both directions, because a gate
	// that only saw the default state would pass on a veto that never fires.
	const dpsRow = await page.evaluate(() =>
		[...document.querySelectorAll('.damage-metrics-root tbody tr')].findIndex(
			row => row.offsetParent !== null && parseFloat(row.cells[9]?.dataset.text ?? '0') > 0,
		),
	);
	check('a damage row carrying a threat tooltip is reachable', dpsRow >= 0, String(dpsRow));
	if (dpsRow >= 0) {
		const setThreat = async show => {
			await page.click('.sim-toolbar button.sim-options');
			await page.waitForTimeout(700);
			await page.locator('#simui-show-threat-metrics').setChecked(show);
			await page.waitForTimeout(400);
			await page.keyboard.press('Escape');
			await page.waitForTimeout(700);
		};
		const dpsCell = page.locator('.damage-metrics-root tbody tr').nth(dpsRow).locator('td.text-success');
		const showedThreat = await page.evaluate(() => !document.querySelector('.hide-threat-metrics'));

		await setThreat(false);
		const vetoed = await hover(dpsCell);
		check('the threat tooltip stays shut while threat metrics are hidden', vetoed.open === 0, JSON.stringify(vetoed));

		await setThreat(true);
		const allowed = await hover(dpsCell);
		check('the same cell opens its threat tooltip once threat metrics are shown', allowed.withTable > 0, JSON.stringify(allowed));

		await page.mouse.move(0, 0);
		await setThreat(showedThreat);
	}

	console.log('\nresources');
	const afterRun = await page.evaluate(RESOURCES);
	check(
		`all ${RESOURCE_CONTAINERS} containers survive the sim, in order`,
		afterRun.length === RESOURCE_CONTAINERS && JSON.stringify(afterRun.map(c => c.title)) === JSON.stringify(containers.map(c => c.title)),
		afterRun.map(container => container.title).join(', '),
	);
	check(
		'a resource container is shown exactly when its table has rows',
		afterRun.every(container => container.rows > 0 !== container.hidden),
		afterRun
			.filter(container => !container.hidden)
			.map(container => `${container.title}:${container.rows}`)
			.join(' '),
	);
	check(
		'at least one resource container is shown',
		afterRun.some(container => !container.hidden),
	);

	const benign = errors.filter(error => BENIGN_CONSOLE.test(error));
	if (benign.length) console.log(`\n  ----  ${benign.length} benign console errors (/${BENIGN_CONSOLE.source}/); a ported table logs none`);
	console.log(`\n${problems.length ? `${problems.length} checks fail` : 'all checks pass'}`);
	for (const error of fatal()) console.log(`  ERROR ${error}`);
	await page.close();
	process.exitCode = problems.length || fatal().length ? 1 : 0;
} catch (error) {
	console.log(`\nFAILED  ${error}`);
	process.exitCode = 1;
} finally {
	await browser.close();
}

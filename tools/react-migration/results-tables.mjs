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
// expected to exit 0 on **both** ports — the baseline (`BASE_PORT`, a build of this same migration a
// few commits back) and the port, because both are React shells by now and are held to the one shape.
//
// `.tablesorter` is dead on both builds — the React shell never emits it, on the baseline named by
// `BASE_PORT` or on the port — so it is asserted absent on both rather than branched per port.
//
// Deliberately shape-agnostic where the port will differ: collapsed children are asserted invisible
// (`offsetParent === null`), never `.hide`, because vanilla hides them with a class and a React
// table will unmount them instead. `data-expanded` on the *parent* is still asserted — the caret
// reads off it either way.
import { launch, openSpec, PORTS, q, SERIALIZE } from './browser.mjs';

// Beast mastery, not arms, and not by accident: `shouldCollapse` keeps a parent row only for a pet,
// so a spec with a permanent pet is what guarantees the grouped-row assertions have something to run
// on. The gate asserts those parents exist rather than skipping when it finds none.
const SPEC = process.argv[2] ?? 'hunter/beast_mastery';
const PORT = Number(process.env.PORT ?? PORTS.react);

// Logged by `ActionId.toStringIgnoringTag()` for the merged pet-group parent rows, whose
// `actionIdOverride` is an absent `petActionId`. Present on both builds; the count drops as tables
// port, because a React name cell keys its icon on `equalityKey()`, which does not log.
const BENIGN_CONSOLE = /Empty action id!/;

// The at-load shell, read off the column configs. `sortCol` is the one column carrying
// `ColumnSortType.Descending`. `mustHaveRows` is set only where a sim on this spec is guaranteed to
// produce rows: dtps is empty for a DPS spec and healing is one incidental row, so neither claims it.
// `columnCount`/`primaryIndex` replace the old per-header exact-class-list comparison (name, primary
// bar, +N plain, rate), which broke once the `ui-metrics-*` companion classes landed — structure is
// asserted by count and by the primary column's position instead.
// `togglable` marks a table behind a metrics toggle (`useDisplayMetrics`): SPEC's defaults leave
// healing and threat off, so those two panes are never rendered at all — not hidden, absent — and
// their shell-at-load check is skipped rather than failed.
const TABLES = [
	{ root: q('damage-metrics-root'), columnCount: 10, primaryIndex: 1, sortCol: 9, mustHaveRows: true },
	{ root: q('healing-metrics-root'), columnCount: 12, primaryIndex: 1, sortCol: 11, togglable: true },
	{ root: q('dtps-metrics-root'), columnCount: 9, primaryIndex: 1, sortCol: 8, togglable: true },
	{ root: q('cast-metrics-root'), columnCount: 3, primaryIndex: -1, sortCol: 1, mustHaveRows: true },
	{ root: q('buff-metrics-root'), columnCount: 4, primaryIndex: -1, sortCol: 3, mustHaveRows: true },
	{ root: q('debuff-metrics-root'), columnCount: 4, primaryIndex: -1, sortCol: 3, mustHaveRows: true },
];

// `orderedResourceTypes` — a container is built only once its own table has rows.
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

// Structure only, by testid/role on both builds — `metrics-table`/`-header`/`-header-row`/`-body`/
// `-header-cell` are hooks this unit converts to `data-testid`, so a `:is([data-testid=…], .…)`
// selector is what still finds them on the baseline (class) and the port (testid) alike. The
// primary-metric column is a `data-primary-metric` attribute rather than a testid, because it marks
// a repeated column across every row, not one located element; the baseline still carries the literal
// `.metrics-table-cell--primary-metric` class it always had.
const SHELL = roots =>
	roots.map(root => {
		const rootElem = document.querySelector(root);
		if (!rootElem) return { root, missing: true };
		const table = rootElem.querySelector('table');
		const thead = table?.querySelector(':is([data-testid="metrics-table-header"], .metrics-table-header)');
		const tbody = table?.querySelector(':is([data-testid="metrics-table-body"], .metrics-table-body)');
		const headerRow = thead?.querySelector(':is([data-testid="metrics-table-header-row"], .metrics-table-header-row)');
		const headers = [...(headerRow?.querySelectorAll(':is([data-testid="metrics-table-header-cell"], .metrics-table-header-cell)') ?? [])];
		return {
			root,
			hasTable: !!table,
			tablesorter: table ? table.classList.contains('tablesorter') : null,
			hasThead: !!thead,
			hasHeaderRow: !!headerRow,
			hasTbody: !!tbody,
			rows: tbody ? tbody.querySelectorAll('tr').length : null,
			headerCount: headers.length,
			primaryIndex: headers.findIndex(th => th.matches(':is([data-primary-metric], .metrics-table-cell--primary-metric)')),
			// Every `<th>` wraps its whole label in a span, and nothing else in the cell carries text.
			// Not "the span is the cell's first element child": the React shell puts the label's span
			// inside the focusable `<button>` a sortable header needs, which vanilla has no room for.
			// So this stops catching an element inserted around the span — which is the change — and
			// starts catching a label that leaked out of it.
			labelled: headers.filter(th => {
				const label = th.querySelector('span')?.textContent.trim();
				return !!label && label === th.textContent.trim();
			}).length,
		};
	});

// Inlined rather than calling `q` — this function is serialised into the page, where the
// module-scope helper does not exist.
const RESOURCES = () =>
	[...document.querySelectorAll(':is([data-testid="resource-metrics-table-container"], .resource-metrics-table-container)')].map(container => ({
		hidden: container.classList.contains('hide'),
		title: container.querySelector(':is([data-testid="resource-metrics-table-title"], .resource-metrics-table-title)')?.textContent ?? null,
		tables: container.querySelectorAll(':is([data-testid="resource-metrics-table-root"], .resource-metrics-table-root)').length,
		columns: container.querySelectorAll('thead th').length,
		rows: container.querySelectorAll('tbody tr').length,
	}));

const ROWS = root => {
	const rootElem = document.querySelector(root);
	if (!rootElem) return { missing: true };
	const rows = [...rootElem.querySelectorAll('tbody tr')];
	return {
		total: rows.length,
		parents: rows.filter(row => row.hasAttribute('data-parent')).length,
		children: rows.filter(row => row.hasAttribute('data-child')).length,
		hidden: rootElem.classList.contains('hide'),
		// The name cell `nameCellConfig` builds: an icon anchor and a name span, on every row. Inlined
		// rather than calling `q` — this function is serialised into the page, where the module-scope
		// helper does not exist.
		withName: rows.filter(row => row.querySelector(':is([data-testid="metrics-action-name"], .metrics-action-name)')?.textContent.trim()).length,
		withIcon: rows.filter(row => row.querySelector('a:is([data-testid="metrics-action-icon"], .metrics-action-icon)')).length,
		resolved: rows.filter(row => row.querySelector('a:is([data-testid="metrics-action-icon"], .metrics-action-icon)')?.getAttribute('href')).length,
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
	return [...document.querySelectorAll(`${root} tbody tr`)].filter(row => !row.hasAttribute('data-child')).map(row => parse(row.cells[column]));
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
	const table = document.querySelector(`${root} table:is([data-testid="metrics-table"], .metrics-table)`);
	if (!table) return { missing: true };
	const column = index => [...table.querySelectorAll('tbody tr')].filter(row => !row.hasAttribute('data-child')).map(row => parse(row.cells[index]));
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
	const table = document.querySelector(`${root} table:is([data-testid="metrics-table"], .metrics-table)`);
	if (!table) return { missing: true };
	const key = row => [...row.cells].map(cell => cell.textContent.trim()).join('|');
	const groups = () => {
		const rows = [...table.querySelectorAll('tbody tr')];
		const out = [];
		for (let i = 0; i < rows.length; i++) {
			if (!rows[i].hasAttribute('data-parent')) continue;
			const children = [];
			for (let j = i + 1; j < rows.length && rows[j].hasAttribute('data-child'); j++) children.push(rows[j]);
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
		for (let i = at + 1; i < rows.length && rows[i].hasAttribute('data-child'); i++) out.push(rows[i]);
		return out;
	};
	// The biggest group, so the assertion is about a block of children rather than about one row.
	const initial = bodyRows();
	let at = -1;
	initial.forEach((row, index) => {
		if (row.hasAttribute('data-parent') && (at === -1 || childrenOf(initial, index).length > childrenOf(initial, at).length)) at = index;
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
			expand: parent.hasAttribute('data-expanded'),
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

// Shape-agnostic, for the same reason the expansion probe is. Vanilla's tooltip is a tippy instance
// portaled to <body>; a ported table's is a react-tooltip node rendered in place, next to the table.
// Both are counted, and `withTable` is the assertion either way — a tooltip that opened without its
// nested table is a failure on both builds, and a veto that stopped working shows as `open > 0`
// whichever library drew it.
const TIPS = () => {
	const boxes = [
		...[...document.querySelectorAll('.tippy-box')].filter(box => box.getAttribute('data-state') === 'visible'),
		...document.querySelectorAll('.react-tooltip__show'),
	];
	return { open: boxes.length, withTable: boxes.filter(box => box.querySelector('table:is([data-testid="metrics-table"], .metrics-table)')).length };
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
		// A togglable table renders only when its metric is on, and SPEC's defaults leave healing/threat
		// off — so a togglable table missing on either build is the toggle working, not a shell gap.
		if (table.togglable && seen.missing) {
			console.log(`  SKIP  ${table.root} builds its whole shell before any sim  metric toggled off, pane not rendered`);
			continue;
		}
		const tablesorterOk = seen.tablesorter === false;
		const ok =
			!seen.missing &&
			seen.hasTable &&
			tablesorterOk &&
			seen.hasThead &&
			seen.hasHeaderRow &&
			seen.hasTbody &&
			seen.rows === 0 &&
			seen.headerCount === table.columnCount &&
			seen.labelled === table.columnCount &&
			seen.primaryIndex === table.primaryIndex;
		check(`${table.root} builds its whole shell before any sim`, ok, `${seen.headerCount ?? 0}/${table.columnCount} columns, ${seen.rows} rows`);
		if (!ok) console.log(`        got ${JSON.stringify(seen)}`);
	}

	// Asserted the same on both builds: a container is built only once its table has rows, so at load
	// there are none.
	const containers = await page.evaluate(RESOURCES);
	check(
		'no resource container exists at load, because none has rows yet',
		containers.length === 0,
		`${containers.length} containers, ${containers.filter(container => container.hidden).length} hidden`,
	);

	console.log('\nrunning one iteration');
	await page.waitForSelector(`${q('detailed-results-1-iteration-button')}:not([disabled])`, { timeout: 60000 });
	const started = Date.now();
	await page.click(q('detailed-results-1-iteration-button'));
	await page.waitForFunction(() => !document.querySelector('[data-no-results]'), null, { timeout: 120000 });
	await page.waitForFunction(
		() => document.querySelectorAll(':is([data-testid="damage-metrics-root"], .damage-metrics-root) tbody tr').length > 0,
		null,
		{ timeout: 60000 },
	);
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
	const expansion = await page.evaluate(EXPAND_PROBE, q('damage-metrics-root'));
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
	const primary = await hover(page.locator(`${q('damage-metrics-root')} tbody tr td:is([data-primary-metric], .metrics-table-cell--primary-metric)`).first());
	check('the primary-metric cell opens a tooltip holding a nested metrics table', primary.withTable > 0, JSON.stringify(primary));

	// The threat veto: `onShow` returns false while threat metrics are off, so the
	// same cell must open in one state and stay shut in the other. Both directions, because a gate
	// that only saw the default state would pass on a veto that never fires.
	const dpsRow = await page.evaluate(() =>
		[...document.querySelectorAll(':is([data-testid="damage-metrics-root"], .damage-metrics-root) tbody tr')].findIndex(
			row => row.offsetParent !== null && parseFloat(row.cells[9]?.dataset.text ?? '0') > 0,
		),
	);
	check('a damage row carrying a threat tooltip is reachable', dpsRow >= 0, String(dpsRow));
	if (dpsRow >= 0) {
		const setThreat = async show => {
			await page.click(`:is(${q('sim-toolbar')}) button:is(${q('sim-options')})`);
			await page.waitForTimeout(700);
			const checkbox = page.locator('#simui-show-threat-metrics');
			const label = page.locator('label[for="simui-show-threat-metrics"]');
			const previous = await checkbox.isChecked();
			if (previous !== show) await label.click();
			await page.waitForTimeout(400);
			await page.keyboard.press('Escape');
			await page.waitForTimeout(700);
			return previous;
		};
		const dpsCell = page.locator(`${q('damage-metrics-root')} tbody tr`).nth(dpsRow).locator('td.text-success');

		const showedThreat = await setThreat(false);
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
		'every container the sim produced holds a well-formed table',
		afterRun.length > 0 && afterRun.every(container => container.tables === 1 && container.columns === RESOURCE_COLUMNS && container.title),
		afterRun.map(container => container.title).join(', '),
	);
	check(
		'a resource container is on screen exactly when its table has rows',
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

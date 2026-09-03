// Node microbench for the UI log pipeline. Run with:
//   node --expose-gc tools/bench/parse_bench.mjs
// See tools/bench/README.md for the full recipe.

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

const SKIP_FIELDS = new Set(['raw', 'cachedHTML', 'activeAuras', 'source', 'target', 'actionId', 'logIndex']);

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

const { values } = parseArgs({
	options: {
		fixture: { type: 'string', multiple: true, default: ['unholy', 'demonology'] },
		runs: { type: 'string', default: '5' },
		full: { type: 'boolean', default: false },
		json: { type: 'string' },
		sanity: { type: 'boolean', default: false },
		dump: { type: 'string' },
	},
});
const RUNS = Number(values.runs);

installBrowserGlobals();
const { SimLog, SimResult, RaidSimRequest, RaidSimResult } = await import('./.build/entry.js');

if (values.sanity) {
	await sanity(values.fixture[0]);
	process.exit(0);
}

if (values.dump) {
	await dumpParity(values.fixture, values.dump);
	process.exit(0);
}

const rows = [];
for (const name of values.fixture) {
	rows.push(await benchFixture(name));
}
report(rows);
if (values.json) {
	const { writeFile } = await import('node:fs/promises');
	await writeFile(values.json, JSON.stringify(rows, null, '\t') + '\n');
}

// Phase 0c gate. Every scalar field of every log, plus the derived arrays, in a stable
// text form. A parser rewrite must leave this byte-identical.
//
// Fields are discovered rather than listed: the failure mode of replacing a 13-branch
// alternation with indexOf classification is a misclassification that still produces a
// plausible timestamp and class name, so `CriticalBlock` collapsing to `Block` or a lost
// `tick` flag has to show up here. Enumerating by hand would miss whichever field the
// rewrite happens to break.
function scalars(obj) {
	const out = [];
	for (const key of Object.keys(obj).sort()) {
		if (SKIP_FIELDS.has(key)) continue;
		const v = obj[key];
		if (v === null || v === undefined) {
			out.push(`${key}=`);
		} else if (Array.isArray(v)) {
			out.push(`${key}#${v.length}`);
		} else if (typeof v === 'object') {
			continue;
		} else {
			out.push(`${key}=${typeof v === 'number' ? v.toFixed(6) : v}`);
		}
	}
	return out.join(',');
}

function dumpLog(log) {
	const entity = e => (e ? `${e.name}/${e.index}/${e.isTarget ? 'T' : 'P'}${e.isPet ? 'p' : ''}` : '-');
	return [
		log.constructor.name,
		log.timestamp.toFixed(6),
		log.actionIdAsString ?? '-',
		entity(log.source),
		entity(log.target),
		scalars(log),
		// Order, not just count: populateActiveAuras sorts this by name.
		log.activeAuras.map(a => a.actionId?.name ?? '?').join(';'),
		log.raw,
	].join('|');
}

async function dumpParity(fixtures, outPath) {
	const { createWriteStream } = await import('node:fs');
	const out = createWriteStream(outPath);
	const write = line => new Promise(res => (out.write(line + '\n') ? res() : out.once('drain', res)));

	for (const name of fixtures) {
		const { request, result } = await loadBundle(name);
		request.requestId = `parity-${name}`;
		const simResult = await SimResult.makeNew(request, result);

		await write(`## fixture ${name} logs=${simResult.logs.length}`);
		for (const log of simResult.logs) await write(dumpLog(log));

		for (const unit of [...simResult.getPlayers(), ...simResult.getTargets()]) {
			await write(`## unit ${unit.name}/${unit.index} logs=${unit.logs.length} pets=${unit.pets.length}`);
			for (const [label, arr] of [
				['cast', unit.castLogs],
				['auraUptime', unit.auraUptimeLogs],
				['dps', unit.dpsLogs],
				['threat', unit.threatLogs],
				['mcd', unit.majorCooldownLogs],
			]) {
				await write(`## ${label} n=${arr.length}`);
				for (const log of arr) await write(dumpLog(log));
			}
			const grouped = unit.groupedResourceLogs;
			for (const key of Object.keys(grouped).sort()) {
				await write(`## resource ${key} n=${grouped[key].length}`);
				for (const log of grouped[key]) await write(dumpLog(log));
			}
		}
	}
	await new Promise(res => out.end(res));
	console.log(`wrote ${outPath}`);
}

// Guards against the bench silently timing an empty result: protojson round-trips are
// easy to get wrong, and an empty raidMetrics makes makeNew look free.
async function sanity(name) {
	const { request, result } = await loadBundle(name);
	request.requestId = 'sanity';
	const simResult = await SimResult.makeNew(request, result);
	const player = simResult.getPlayers()[0];
	console.log({
		fixture: name,
		parties: result.raidMetrics?.parties?.length,
		playersInParty0: result.raidMetrics?.parties?.[0]?.players?.length,
		targets: result.encounterMetrics?.targets?.length,
		totalLogs: simResult.logs.length,
		player: player?.name,
		playerLogs: player?.logs.length,
		pets: player?.pets.length,
		castLogs: player?.castLogs.length,
		auraUptimeLogs: player?.auraUptimeLogs.length,
		dpsLogs: player?.dpsLogs.length,
	});
}

async function loadBundle(name) {
	const bundle = JSON.parse(await readFile(path.join(REPO, 'tools/bench/logs', `${name}.json`), 'utf8'));
	return {
		request: RaidSimRequest.fromJson(bundle.request, { ignoreUnknownFields: true }),
		result: RaidSimResult.fromJson(bundle.result, { ignoreUnknownFields: true }),
	};
}

async function benchFixture(name) {
	const logs = await readFile(path.join(REPO, 'tools/bench/logs', `${name}.log`), 'utf8');
	const lines = logs.split('\n').length;
	const row = { fixture: name, lines, bytes: logs.length };

	// parseAll is the whole cost for a result whose tabs are never opened.
	row.parseMs = await median(RUNS, () => SimLog.parseAll({ logs }));
	row.linesPerSec = Math.round(lines / (row.parseMs / 1000));
	row.promises = await countPromises(() => SimLog.parseAll({ logs }));
	row.parseHeapMb = await retainedHeapMb(() => SimLog.parseAll({ logs }));

	if (values.full) {
		const { request, result } = await loadBundle(name);
		// makeNew memoizes on requestId, so give each run a fresh one.
		let n = 0;
		const fresh = () => {
			request.requestId = `bench-${name}-${n++}`;
			return SimResult.makeNew(request, result);
		};
		row.makeNewMs = Math.max(0, (await median(RUNS, fresh)) - row.parseMs);
		row.makeNewHeapMb = await retainedHeapMb(fresh);
		// The derived views are built on first read, so makeNew alone no longer tells the
		// whole story. Time reading every one of them for every unit as well: that is the
		// work the old constructor did eagerly, and what a tab that displays everything pays.
		row.derivesMs = await median(RUNS, async () => {
			const simResult = await fresh();
			touchDerives(simResult);
		});
		row.derivesMs = Math.max(0, row.derivesMs - row.parseMs - row.makeNewMs);
	}
	return row;
}

// Reads every derived view on every unit, so the lazy getters actually run.
function touchDerives(simResult) {
	const visit = unit => {
		void unit.damageDealtLogs.length;
		void unit.dpsLogs.length;
		void unit.castLogs.length;
		void unit.threatLogs.length;
		void unit.auraUptimeLogs.length;
		void unit.majorCooldownLogs.length;
		void unit.majorCooldownAuraUptimeLogs.length;
		void Object.keys(unit.groupedResourceLogs).length;
		unit.pets.forEach(visit);
	};
	simResult.getPlayers().forEach(visit);
	simResult.getTargets().forEach(visit);
}

async function median(runs, fn) {
	const samples = [];
	for (let i = 0; i < runs; i++) {
		const t0 = performance.now();
		await fn();
		samples.push(performance.now() - t0);
	}
	samples.sort((a, b) => a - b);
	return samples[Math.floor(samples.length / 2)];
}

// One instrumented run: every Promise the pipeline allocates, however it was created.
async function countPromises(fn) {
	const Real = globalThis.Promise;
	let count = 0;
	class Counting extends Real {
		constructor(executor) {
			super(executor);
			count++;
		}
	}
	globalThis.Promise = Counting;
	try {
		await fn();
	} finally {
		globalThis.Promise = Real;
	}
	return count;
}

async function retainedHeapMb(fn) {
	if (!globalThis.gc) return null;
	globalThis.gc();
	const before = process.memoryUsage().heapUsed;
	const held = await fn();
	globalThis.gc();
	const after = process.memoryUsage().heapUsed;
	// Touch the result so it cannot be collected before the measurement.
	void (Array.isArray(held) ? held.length : held);
	return round((after - before) / 1024 / 1024, 1);
}

function round(v, digits) {
	const f = 10 ** digits;
	return Math.round(v * f) / f;
}

function report(rows) {
	const cols = [
		['fixture', r => r.fixture],
		['lines', r => r.lines.toLocaleString('en-US')],
		['parse ms', r => round(r.parseMs, 1).toString()],
		['lines/s', r => r.linesPerSec.toLocaleString('en-US')],
		['promises', r => r.promises.toLocaleString('en-US')],
		['parse heap MB', r => (r.parseHeapMb ?? '—').toString()],
	];
	if (values.full) {
		cols.push(['makeNew ms', r => round(r.makeNewMs, 1).toString()]);
		cols.push(['derives ms', r => round(r.derivesMs ?? 0, 1).toString()]);
		cols.push(['makeNew heap MB', r => (r.makeNewHeapMb ?? '—').toString()]);
	}

	const widths = cols.map(([head, get]) => Math.max(head.length, ...rows.map(r => get(r).length)));
	const line = cells => '| ' + cells.map((c, i) => c.padStart(widths[i])).join(' | ') + ' |';
	console.log(line(cols.map(([head]) => head)));
	console.log('|' + widths.map(w => '-'.repeat(w + 2)).join('|') + '|');
	for (const r of rows) console.log(line(cols.map(([, get]) => get(r))));
	if (!globalThis.gc) console.log('\nheap columns need --expose-gc');
}

// The bundle pulls in modules that read browser globals at import time.
function installBrowserGlobals() {
	const noop = () => {};
	const elem = () => ({
		style: {},
		dataset: {},
		classList: { add: noop, remove: noop, toggle: noop, contains: () => false },
		children: [],
		appendChild: noop,
		append: noop,
		setAttribute: noop,
		removeAttribute: noop,
		addEventListener: noop,
		removeEventListener: noop,
		querySelector: () => null,
		querySelectorAll: () => [],
		cloneNode() {
			return elem();
		},
	});

	globalThis.document = {
		createElement: elem,
		createElementNS: elem,
		createDocumentFragment: elem,
		createTextNode: text => ({ text }),
		documentElement: elem(),
		body: elem(),
		head: elem(),
		addEventListener: noop,
		querySelector: () => null,
		querySelectorAll: () => [],
	};
	globalThis.window = {
		location: { protocol: 'http:', host: 'localhost', hostname: 'localhost', pathname: '/mop/', href: 'http://localhost/mop/', search: '' },
		addEventListener: noop,
		removeEventListener: noop,
		matchMedia: () => ({ matches: false, addEventListener: noop, removeEventListener: noop }),
	};
	globalThis.location = globalThis.window.location;
	globalThis.navigator ??= { userAgent: 'node', language: 'en' };
	globalThis.localStorage = {
		_d: new Map(),
		getItem(k) {
			return this._d.has(k) ? this._d.get(k) : null;
		},
		setItem(k, v) {
			this._d.set(k, String(v));
		},
		removeItem(k) {
			this._d.delete(k);
		},
	};
	globalThis.sessionStorage = globalThis.localStorage;

	// The UI fetches its database over HTTP; serve it off disk instead.
	const realFetch = globalThis.fetch;
	globalThis.fetch = async (url, init) => {
		const pathname = String(url).replace(/^https?:\/\/[^/]+/, '');
		if (pathname.startsWith('/mop/')) {
			return new Response(await readFile(path.join(REPO, pathname.slice('/mop/'.length))));
		}
		return realFetch(url, init);
	};
}

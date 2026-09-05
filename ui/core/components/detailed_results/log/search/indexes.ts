import type { CombatLog, DamageEffect, LogKind, Outcome } from '../../../../proto_utils/combat_log/types';
import { formattedTimestamp } from '../../../../proto_utils/combat_log/types';
import { spellSchoolNames } from '../../../../proto_utils/names';
import type { Clause, ClauseField, QueryNode } from './query';

// `spellIcons` is a name -> icon URL side table rather than a richer option type, so this module
// stays a plain data layer: the URL is a string the picker happens to put in an <img>.
export type SuggestionSource = { spells: Array<string>; units: Array<string>; schools: Array<string>; spellIcons: Map<string, string> };

// Union of typed-array and plain-array so binary-search results (contiguous slices) and
// build-time index arrays (Int32Array) can share the same merge/intersect helpers.
type SortedInts = Int32Array | ReadonlyArray<number>;

const EMPTY: SortedInts = [];

// 'cast' unions every cast-related kind because a user typing it means "show me the casts",
// not the specific began/cancelled/completed split. 'buff' is a plainer synonym for 'aura'.
const TYPE_KIND_ALIASES: Partial<Record<string, Array<LogKind>>> = {
	cast: ['cast-began', 'cast-cancelled', 'cast-completed', 'cast'],
	aura: ['aura'],
	buff: ['aura'],
	resource: ['resource'],
	cooldown: ['major-cooldown'],
	stacks: ['aura-stacks'],
};

// 'damage' is an effect, not a kind: the 'damage' kind tags every damage-dealt line, heals and
// shields included, so routing it through the kind index would make type:damage and type:heal
// overlap instead of partition. A miss has no effect at all and matches neither, which is what
// master's isDamage() reported for it too.
const TYPE_EFFECT_ALIASES: Partial<Record<string, DamageEffect>> = {
	damage: 'damage',
	heal: 'healing',
	healing: 'healing',
	shield: 'shielding',
	shielding: 'shielding',
};

type NumericFilter = { min: number; minInclusive: boolean; max: number; maxInclusive: boolean };

// Accepts 'a-b' ranges and '>', '>=', '<', '<=', '=' comparisons; a bare number is exact.
// The range separator and a negative sign are both '-', but the number pattern only stops
// consuming at a non-digit, so '-5-10' still splits into -5 and 10.
export function isNumericFilter(value: string): boolean {
	return parseNumericFilter(value) !== null;
}

function parseNumericFilter(value: string): NumericFilter | null {
	const trimmed = value.trim();
	const range = /^(-?\d+(?:\.\d+)?)\s*-\s*(-?\d+(?:\.\d+)?)$/.exec(trimmed);
	if (range) {
		const a = Number(range[1]);
		const b = Number(range[2]);
		return { min: Math.min(a, b), minInclusive: true, max: Math.max(a, b), maxInclusive: true };
	}
	const cmp = /^(>=|<=|>|<|=)?(-?\d+(?:\.\d+)?)$/.exec(trimmed);
	if (cmp) {
		const n = Number(cmp[2]);
		switch (cmp[1]) {
			case '>':
				return { min: n, minInclusive: false, max: Infinity, maxInclusive: true };
			case '>=':
				return { min: n, minInclusive: true, max: Infinity, maxInclusive: true };
			case '<':
				return { min: -Infinity, minInclusive: true, max: n, maxInclusive: false };
			case '<=':
				return { min: -Infinity, minInclusive: true, max: n, maxInclusive: true };
			default:
				return { min: n, minInclusive: true, max: n, maxInclusive: true };
		}
	}
	return null;
}

function lowerBound(arr: Float64Array, value: number): number {
	let lo = 0;
	let hi = arr.length;
	while (lo < hi) {
		const mid = (lo + hi) >>> 1;
		if (arr[mid] < value) lo = mid + 1;
		else hi = mid;
	}
	return lo;
}

function upperBound(arr: Float64Array, value: number): number {
	let lo = 0;
	let hi = arr.length;
	while (lo < hi) {
		const mid = (lo + hi) >>> 1;
		if (arr[mid] <= value) lo = mid + 1;
		else hi = mid;
	}
	return lo;
}

function lowerBoundPairs(arr: Array<[number, number]>, value: number): number {
	let lo = 0;
	let hi = arr.length;
	while (lo < hi) {
		const mid = (lo + hi) >>> 1;
		if (arr[mid][0] < value) lo = mid + 1;
		else hi = mid;
	}
	return lo;
}

function upperBoundPairs(arr: Array<[number, number]>, value: number): number {
	let lo = 0;
	let hi = arr.length;
	while (lo < hi) {
		const mid = (lo + hi) >>> 1;
		if (arr[mid][0] <= value) lo = mid + 1;
		else hi = mid;
	}
	return lo;
}

function intersectSorted(a: SortedInts, b: SortedInts): Array<number> {
	const out: Array<number> = [];
	let i = 0;
	let j = 0;
	while (i < a.length && j < b.length) {
		const av = a[i];
		const bv = b[j];
		if (av === bv) {
			out.push(av);
			i++;
			j++;
		} else if (av < bv) {
			i++;
		} else {
			j++;
		}
	}
	return out;
}

function unionSorted(a: SortedInts, b: SortedInts): Array<number> {
	const out: Array<number> = [];
	let i = 0;
	let j = 0;
	while (i < a.length && j < b.length) {
		const av = a[i];
		const bv = b[j];
		if (av === bv) {
			out.push(av);
			i++;
			j++;
		} else if (av < bv) {
			out.push(av);
			i++;
		} else {
			out.push(bv);
			j++;
		}
	}
	while (i < a.length) out.push(a[i++]);
	while (j < b.length) out.push(b[j++]);
	return out;
}

function push<K>(map: Map<K, Array<number>>, key: K, i: number) {
	let arr = map.get(key);
	if (!arr) {
		arr = [];
		map.set(key, arr);
	}
	arr.push(i);
}

function toInt32Map<K>(map: Map<K, Array<number>>): Map<K, Int32Array> {
	const out = new Map<K, Int32Array>();
	for (const [key, values] of map) out.set(key, Int32Array.from(values));
	return out;
}

// Small, bounded by distinct spell/unit names rather than log lines, so a substring scan
// here never touches the corpus.
function matchByNameMap(map: Map<string, Int32Array>, needle: string): Array<number> {
	let out: SortedInts = EMPTY;
	for (const [key, arr] of map) {
		if (key.includes(needle)) out = unionSorted(out, arr);
	}
	return out as Array<number>;
}

export class LogIndex {
	private built = false;

	private kindIndex!: Map<LogKind, Int32Array>;
	private effectIndex!: Map<DamageEffect, Int32Array>;
	private outcomeIndex!: Map<Outcome, Int32Array>;
	private schoolIndex!: Map<string, Int32Array>;
	private spellIndex!: Map<string, Int32Array>;
	private sourceNameIndex!: Map<string, Int32Array>;
	private targetNameIndex!: Map<string, Int32Array>;
	private sourceNumberIndex!: Map<number, Int32Array>;
	private targetNumberIndex!: Map<number, Int32Array>;
	private amountSorted!: Array<[number, number]>;
	// The log is not globally ordered by timestamp: pre-pull lines interleave with the first
	// [0.00] lines, and a line the parser cannot timestamp gets 0. So time gets its own sorted
	// permutation rather than binary-searching the corpus in log order.
	private timeSortedValues!: Float64Array;
	private timeSortedIndexes!: Int32Array;
	private allIndexes!: Int32Array;
	private nonDebugIndexes!: Int32Array;
	private debugIndexes!: Int32Array;
	private searchTextCache!: Array<string | undefined>;

	private readonly suggestionSpells = new Set<string>();
	private readonly spellIcons = new Map<string, string>();
	private readonly suggestionUnits = new Set<string>();
	private readonly suggestionSchools = new Set<string>();
	private suggestionSource: SuggestionSource = { spells: [], units: [], schools: [], spellIcons: new Map() };

	constructor(
		private readonly logs: ReadonlyArray<CombatLog>,
		private readonly isDebug: (i: number) => boolean,
	) {}

	// `targetNumber` is the results filter's selected target, as the 1-based number the log itself
	// prints. It restricts to lines naming that target at either endpoint, which is the log-shaped
	// equivalent of the unit list Timeline and CombatReplay narrow. It is applied here rather than
	// by rebuilding the index, so changing the dropdown costs an intersection, not a reindex.
	filter(nodes: ReadonlyArray<QueryNode>, showDebug: boolean, targetNumber: number | null = null): Array<number> {
		this.ensureBuilt();
		// Stays a typed array until something actually narrows it, so the common no-filter case
		// does not copy half a million ints just to hand them straight back.
		let candidates: SortedInts = showDebug ? this.allIndexes : this.nonDebugIndexes;

		if (targetNumber !== null) {
			const asSource = this.sourceNumberIndex.get(targetNumber);
			const asTarget = this.targetNumberIndex.get(targetNumber);
			candidates = intersectSorted(candidates, unionSorted(asSource ?? EMPTY, asTarget ?? EMPTY));
		}

		// The chip row ANDs its chips, so this is one AND node's worth of work.
		candidates = this.evalAnd(nodes, candidates);
		return Array.isArray(candidates) ? candidates : Array.from(candidates);
	}

	// Structured children first, so a free-text scan inside the same AND only ever walks what
	// they left standing. Nested groups sit between the two: they can narrow, but they can also
	// contain a scan of their own.
	private evalAnd(nodes: ReadonlyArray<QueryNode>, candidates: SortedInts): SortedInts {
		const rank = (node: QueryNode) => (node.kind === 'clause' ? (node.clause.field === null ? 2 : 0) : 1);
		for (const node of [...nodes].sort((a, b) => rank(a) - rank(b))) {
			candidates = this.evalNode(node, candidates);
			if (!candidates.length) break;
		}
		return candidates;
	}

	private evalNode(node: QueryNode, candidates: SortedInts): SortedInts {
		switch (node.kind) {
			case 'clause':
				return this.evalClause(node.clause, candidates);
			case 'and':
				return this.evalAnd(node.children, candidates);
			case 'or': {
				// Each branch sees the same candidates; the union is what survives the group.
				let out: SortedInts = EMPTY;
				for (const child of node.children) out = unionSorted(out, this.evalNode(child, candidates));
				return out;
			}
		}
	}

	private evalClause(clause: Clause, candidates: SortedInts): SortedInts {
		if (clause.field !== null) {
			return intersectSorted(candidates, this.matchStructured(clause.field, clause.values));
		}
		const needle = (clause.values[0] ?? '').toLowerCase();
		if (!needle) return candidates;
		const kept: Array<number> = [];
		for (let n = 0; n < candidates.length; n++) {
			const i = candidates[n];
			if (this.searchTextFor(i).includes(needle)) kept.push(i);
		}
		return kept;
	}

	// Sorted once at build: the sets never change afterwards, and this runs on every keystroke.
	suggestions(): SuggestionSource {
		this.ensureBuilt();
		return this.suggestionSource;
	}

	private ensureBuilt() {
		if (this.built) return;
		this.build();
		this.suggestionSource = {
			spells: [...this.suggestionSpells].sort(),
			units: [...this.suggestionUnits].sort(),
			schools: [...this.suggestionSchools].sort(),
			spellIcons: this.spellIcons,
		};
		this.built = true;
	}

	private build() {
		const n = this.logs.length;
		const times = new Float64Array(n);
		this.searchTextCache = new Array(n);
		const allIdx = new Int32Array(n);
		const nonDebug: Array<number> = [];
		const debug: Array<number> = [];

		const kind = new Map<LogKind, Array<number>>();
		const effect = new Map<DamageEffect, Array<number>>();
		const outcome = new Map<Outcome, Array<number>>();
		const school = new Map<string, Array<number>>();
		const spell = new Map<string, Array<number>>();
		const sourceName = new Map<string, Array<number>>();
		const targetName = new Map<string, Array<number>>();
		const sourceNumber = new Map<number, Array<number>>();
		const targetNumber = new Map<number, Array<number>>();
		const amountPairs: Array<[number, number]> = [];

		for (let i = 0; i < n; i++) {
			const log = this.logs[i];
			allIdx[i] = i;
			times[i] = log.timestamp;
			if (this.isDebug(i)) debug.push(i);
			else nonDebug.push(i);

			push(kind, log.kind, i);

			if (log.kind === 'damage') {
				if (log.effect) push(effect, log.effect, i);
				push(outcome, log.outcome, i);
				amountPairs.push([log.amount, i]);
			}

			if (log.spellSchool != null) {
				const name = spellSchoolNames.get(log.spellSchool);
				if (name) {
					push(school, name.toLowerCase(), i);
					this.suggestionSchools.add(name);
				}
			}

			if (log.actionId?.name) {
				push(spell, log.actionId.name.toLowerCase(), i);
				this.suggestionSpells.add(log.actionId.name);
				if (log.actionId.iconUrl) this.spellIcons.set(log.actionId.name, log.actionId.iconUrl);
			}

			if (log.source) {
				push(sourceName, log.source.name.toLowerCase(), i);
				if (log.source.isTarget) push(sourceNumber, log.source.index + 1, i);
				this.suggestionUnits.add(log.source.name);
			}
			if (log.target) {
				push(targetName, log.target.name.toLowerCase(), i);
				if (log.target.isTarget) push(targetNumber, log.target.index + 1, i);
				this.suggestionUnits.add(log.target.name);
			}
		}

		this.kindIndex = toInt32Map(kind);
		this.effectIndex = toInt32Map(effect);
		this.outcomeIndex = toInt32Map(outcome);
		this.schoolIndex = toInt32Map(school);
		this.spellIndex = toInt32Map(spell);
		this.sourceNameIndex = toInt32Map(sourceName);
		this.targetNameIndex = toInt32Map(targetName);
		this.sourceNumberIndex = toInt32Map(sourceNumber);
		this.targetNumberIndex = toInt32Map(targetNumber);
		amountPairs.sort((a, b) => a[0] - b[0]);
		this.amountSorted = amountPairs;
		const order = Int32Array.from(allIdx).sort((a, b) => times[a] - times[b]);
		const sortedTimes = new Float64Array(n);
		for (let i = 0; i < n; i++) sortedTimes[i] = times[order[i]];
		this.timeSortedIndexes = order;
		this.timeSortedValues = sortedTimes;
		this.allIndexes = allIdx;
		this.nonDebugIndexes = Int32Array.from(nonDebug);
		this.debugIndexes = Int32Array.from(debug);
	}

	private searchTextFor(i: number): string {
		let text = this.searchTextCache[i];
		if (text === undefined) {
			const log = this.logs[i];
			text = `${formattedTimestamp(log)} ${log.raw} ${log.actionId?.name ?? ''}`.toLowerCase();
			this.searchTextCache[i] = text;
		}
		return text;
	}

	private matchStructured(field: ClauseField, values: ReadonlyArray<string>): SortedInts {
		let out: SortedInts = EMPTY;
		for (const value of values) out = unionSorted(out, this.matchOne(field, value));
		return out;
	}

	private matchOne(field: ClauseField, rawValue: string): SortedInts {
		switch (field) {
			case 'type':
				return this.matchType(rawValue);
			case 'school':
				return this.schoolIndex.get(rawValue.toLowerCase()) ?? EMPTY;
			case 'outcome':
				return this.outcomeIndex.get(rawValue.toLowerCase() as Outcome) ?? EMPTY;
			case 'spell':
				return matchByNameMap(this.spellIndex, rawValue.toLowerCase());
			case 'source':
				return this.matchEntity(this.sourceNameIndex, this.sourceNumberIndex, rawValue);
			case 'target':
				return this.matchEntity(this.targetNameIndex, this.targetNumberIndex, rawValue);
			case 'time':
				return this.matchTime(rawValue);
			case 'amount':
				return this.matchAmount(rawValue);
		}
	}

	private matchType(rawValue: string): SortedInts {
		const value = rawValue.toLowerCase();
		if (value === 'debug') return this.debugIndexes;
		const effectAlias = TYPE_EFFECT_ALIASES[value];
		if (effectAlias) return this.effectIndex.get(effectAlias) ?? EMPTY;
		const kinds = TYPE_KIND_ALIASES[value] ?? [value as LogKind];
		return kinds.map(k => this.kindIndex.get(k) ?? EMPTY).reduce<SortedInts>((acc, cur) => unionSorted(acc, cur), EMPTY);
	}

	private matchEntity(nameIndex: Map<string, Int32Array>, numberIndex: Map<number, Int32Array>, rawValue: string): SortedInts {
		const trimmed = rawValue.trim();
		if (/^\d+$/.test(trimmed)) return numberIndex.get(Number(trimmed)) ?? EMPTY;
		return matchByNameMap(nameIndex, trimmed.toLowerCase());
	}

	private matchTime(rawValue: string): SortedInts {
		const filter = parseNumericFilter(rawValue);
		if (!filter) return EMPTY;
		const lo = filter.minInclusive ? lowerBound(this.timeSortedValues, filter.min) : upperBound(this.timeSortedValues, filter.min);
		const hi = filter.maxInclusive ? upperBound(this.timeSortedValues, filter.max) : lowerBound(this.timeSortedValues, filter.max);
		const positions: Array<number> = [];
		for (let i = lo; i < hi; i++) positions.push(this.timeSortedIndexes[i]);
		positions.sort((a, b) => a - b);
		return positions;
	}

	private matchAmount(rawValue: string): SortedInts {
		const filter = parseNumericFilter(rawValue);
		if (!filter) return EMPTY;
		const lo = filter.minInclusive ? lowerBoundPairs(this.amountSorted, filter.min) : upperBoundPairs(this.amountSorted, filter.min);
		const hi = filter.maxInclusive ? upperBoundPairs(this.amountSorted, filter.max) : lowerBoundPairs(this.amountSorted, filter.max);
		const positions: Array<number> = [];
		for (let i = lo; i < hi; i++) positions.push(this.amountSorted[i][1]);
		positions.sort((a, b) => a - b);
		return positions;
	}
}

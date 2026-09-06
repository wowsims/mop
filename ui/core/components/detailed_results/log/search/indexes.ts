import type { CombatLog, DamageEffect, LogKind, Outcome, ParsedKind } from '../../../../proto_utils/combat_log/types';
import { formattedTimestamp } from '../../../../proto_utils/combat_log/types';
import { spellSchoolNames } from '../../../../proto_utils/names';
import type { ClauseField, SearchGroup } from './query';

// `spellIcons` is a name -> icon URL side table rather than a richer option type, so this module
// stays a plain data layer: the URL is a string the picker happens to put in an <img>.
export type SuggestionSource = { spells: Array<string>; units: Array<string>; schools: Array<string>; spellIcons: Map<string, string> };

export const EMPTY_SUGGESTIONS: SuggestionSource = { spells: [], units: [], schools: [], spellIcons: new Map() };

// Union of typed-array and plain-array so binary-search results (contiguous slices) and
// build-time index arrays (Int32Array) can share the same merge/intersect helpers.
export type SortedInts = Int32Array | ReadonlyArray<number>;

const EMPTY: SortedInts = [];

type TypeFilter = { kinds: ReadonlyArray<LogKind> } | { effect: DamageEffect } | { debug: true };

// One row per token the Type filter offers. The dropdown lists these keys and matchType reads the
// same rows, so a token cannot be offered without a matcher, or matched without being offered.
//
// 'cast' unions every cast-related kind because a user picking it means "show me the casts", not
// the specific began/cancelled/completed split. 'buff' is a plainer synonym for 'aura'.
//
// damage/heal/shield select an effect, not a kind: the 'damage' kind tags every damage-dealt line,
// heals and shields included, so routing them through the kind index would make type:damage and
// type:heal overlap instead of partition. A miss has no effect at all and matches neither, which
// is what master's isDamage() reported for it too.
const TYPE_FILTERS = {
	damage: { effect: 'damage' },
	heal: { effect: 'healing' },
	shield: { effect: 'shielding' },
	resource: { kinds: ['resource'] },
	aura: { kinds: ['aura'] },
	buff: { kinds: ['aura'] },
	cast: { kinds: ['cast-began', 'cast-cancelled', 'cast-completed', 'cast'] },
	'major-cooldown': { kinds: ['major-cooldown'] },
	'stat-change': { kinds: ['stat-change'] },
	debug: { debug: true },
} as const satisfies Record<string, TypeFilter>;

type TypeToken = keyof typeof TYPE_FILTERS;

export const TYPE_SUGGESTIONS: ReadonlyArray<TypeToken> = Object.keys(TYPE_FILTERS) as Array<TypeToken>;

// Parsed kinds no token reaches, each deliberately:
//   'plain'       - the parser's fallback for a line it did not recognise; nothing to select on.
//   'damage'      - reached through the effect rows above, never through the kind index.
//   'aura-stacks' - no token offers it, and filter values are picked rather than typed.
// A new ParsedKind that is neither covered by a row above nor listed here stops compiling below,
// which is the only direction `satisfies` cannot catch on its own.
type UnfilterableKind = 'plain' | 'damage' | 'aura-stacks';
type FilteredKind = Extract<(typeof TYPE_FILTERS)[TypeToken], { kinds: ReadonlyArray<unknown> }>['kinds'][number];
type AssertNever<T extends never> = T;
type _UncoveredKinds = AssertNever<Exclude<ParsedKind, UnfilterableKind | FilteredKind>>;

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

// Values in ascending order, plus the log-order row each came from.
type SortedNumeric = { values: Float64Array; indexes: Int32Array };

function sortedPermutation(indexes: Int32Array, byRow: Float64Array): SortedNumeric {
	indexes.sort((a, b) => byRow[a] - byRow[b]);
	const values = new Float64Array(indexes.length);
	for (let k = 0; k < indexes.length; k++) values[k] = byRow[indexes[k]];
	return { values, indexes };
}

function matchRange(sorted: SortedNumeric, rawValue: string): SortedInts {
	const filter = parseNumericFilter(rawValue);
	if (!filter) return EMPTY;
	const lo = filter.minInclusive ? lowerBound(sorted.values, filter.min) : upperBound(sorted.values, filter.min);
	const hi = filter.maxInclusive ? upperBound(sorted.values, filter.max) : lowerBound(sorted.values, filter.max);
	return sorted.indexes.slice(lo, hi).sort();
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

export class LogIndex {
	private rowSetsBuilt = false;
	private indexesBuilt = false;

	private kindIndex!: Map<LogKind, Int32Array>;
	private effectIndex!: Map<DamageEffect, Int32Array>;
	private outcomeIndex!: Map<Outcome, Int32Array>;
	private schoolIndex!: Map<string, Int32Array>;
	private spellIndex!: Map<string, Int32Array>;
	private sourceNameIndex!: Map<string, Int32Array>;
	private targetNameIndex!: Map<string, Int32Array>;
	private sourceNumberIndex!: Map<number, Int32Array>;
	private targetNumberIndex!: Map<number, Int32Array>;
	private allIndexes!: Int32Array;
	private nonDebugIndexes!: Int32Array;
	private debugIndexes!: Int32Array;
	// Both built on first use. The log is not globally ordered by timestamp: pre-pull lines
	// interleave with the first [0.00] lines, and a line the parser cannot timestamp gets 0. So
	// time gets its own sorted permutation rather than binary-searching the corpus in log order.
	private timeSorted: SortedNumeric | null = null;
	private amountSorted: SortedNumeric | null = null;
	private searchTextCache: Array<string | undefined> | null = null;

	private readonly suggestionSpells = new Set<string>();
	private readonly spellIcons = new Map<string, string>();
	private readonly suggestionUnits = new Set<string>();
	private readonly suggestionSchools = new Set<string>();
	private suggestionSource: SuggestionSource | null = null;

	constructor(
		private readonly logs: ReadonlyArray<CombatLog>,
		private readonly isDebug: (i: number) => boolean,
	) {}

	// `targetNumber` is the results filter's selected target, as the 1-based number the log itself
	// prints. It restricts to lines naming that target at either endpoint, which is the log-shaped
	// equivalent of the unit list Timeline and CombatReplay narrow. It is applied here rather than
	// by rebuilding the index, so changing the dropdown costs an intersection, not a reindex.
	filter(groups: ReadonlyArray<SearchGroup>, keywords: ReadonlyArray<string>, showDebug: boolean, targetNumber: number | null = null): SortedInts {
		this.ensureRowSets();
		// An explicit type:debug filter asks for the lines the toggle hides, so it wins over the toggle.
		const includeDebug = showDebug || groups.some(group => group.field === 'type' && group.values.some(value => value.toLowerCase() === 'debug'));
		// Stays a typed array until something actually narrows it, so the common no-filter case
		// does not copy half a million ints just to hand them straight back.
		let candidates: SortedInts = includeDebug ? this.allIndexes : this.nonDebugIndexes;

		if (targetNumber !== null) {
			this.ensureIndexes();
			const asSource = this.sourceNumberIndex.get(targetNumber);
			const asTarget = this.targetNumberIndex.get(targetNumber);
			candidates = intersectSorted(candidates, unionSorted(asSource ?? EMPTY, asTarget ?? EMPTY));
		}

		// Groups first, so the keyword scan only ever walks what they left standing. A group with
		// no values is a field picked but not yet filled: invisible, rather than matching nothing.
		for (const group of groups) {
			if (!candidates.length) break;
			if (!group.values.length) continue;
			const merge = group.join === 'and' ? intersectSorted : unionSorted;
			const matched = group.values.map(value => this.matchOne(group.field, value)).reduce(merge);
			candidates = intersectSorted(candidates, matched);
		}

		const needles = keywords.map(keyword => keyword.toLowerCase());
		if (needles.length && candidates.length) {
			const kept: Array<number> = [];
			for (let n = 0; n < candidates.length; n++) {
				const i = candidates[n];
				const text = this.searchTextFor(i);
				let matchesAll = true;
				for (const needle of needles) {
					if (!text.includes(needle)) {
						matchesAll = false;
						break;
					}
				}
				if (matchesAll) kept.push(i);
			}
			candidates = kept;
		}

		return candidates;
	}

	// Sorted once: the sets never change after the index is built, and every value picker rebuilds
	// from this.
	suggestions(): SuggestionSource {
		this.ensureIndexes();
		return (this.suggestionSource ??= {
			spells: [...this.suggestionSpells].sort(),
			units: [...this.suggestionUnits].sort(),
			schools: [...this.suggestionSchools].sort(),
			spellIcons: this.spellIcons,
		});
	}

	private ensureRowSets() {
		if (this.rowSetsBuilt) return;
		this.rowSetsBuilt = true;
		const n = this.logs.length;
		const allIdx = new Int32Array(n);
		const nonDebug: Array<number> = [];
		const debug: Array<number> = [];
		for (let i = 0; i < n; i++) {
			allIdx[i] = i;
			if (this.isDebug(i)) debug.push(i);
			else nonDebug.push(i);
		}
		this.allIndexes = allIdx;
		this.nonDebugIndexes = Int32Array.from(nonDebug);
		this.debugIndexes = Int32Array.from(debug);
	}

	private ensureIndexes() {
		if (this.indexesBuilt) return;
		this.indexesBuilt = true;
		const kind = new Map<LogKind, Array<number>>();
		const effect = new Map<DamageEffect, Array<number>>();
		const outcome = new Map<Outcome, Array<number>>();
		const school = new Map<string, Array<number>>();
		const spell = new Map<string, Array<number>>();
		const sourceName = new Map<string, Array<number>>();
		const targetName = new Map<string, Array<number>>();
		const sourceNumber = new Map<number, Array<number>>();
		const targetNumber = new Map<number, Array<number>>();

		for (let i = 0; i < this.logs.length; i++) {
			const log = this.logs[i];
			push(kind, log.kind, i);

			if (log.kind === 'damage') {
				if (log.effect) push(effect, log.effect, i);
				push(outcome, log.outcome, i);
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
	}

	private timeIndex(): SortedNumeric {
		if (this.timeSorted) return this.timeSorted;
		const n = this.logs.length;
		const indexes = new Int32Array(n);
		const byRow = new Float64Array(n);
		for (let i = 0; i < n; i++) {
			indexes[i] = i;
			byRow[i] = this.logs[i].timestamp;
		}
		return (this.timeSorted = sortedPermutation(indexes, byRow));
	}

	// Damage lines only: a miss still has an amount (0) and is included, nothing else is.
	private amountIndex(): SortedNumeric {
		if (this.amountSorted) return this.amountSorted;
		const rows: Array<number> = [];
		const byRow = new Float64Array(this.logs.length);
		for (let i = 0; i < this.logs.length; i++) {
			const log = this.logs[i];
			if (log.kind !== 'damage') continue;
			rows.push(i);
			byRow[i] = log.amount;
		}
		return (this.amountSorted = sortedPermutation(Int32Array.from(rows), byRow));
	}

	private searchTextFor(i: number): string {
		const cache = (this.searchTextCache ??= new Array(this.logs.length));
		let text = cache[i];
		if (text === undefined) {
			const log = this.logs[i];
			text = `${formattedTimestamp(log)} ${log.raw} ${log.actionId?.name ?? ''}`.toLowerCase();
			cache[i] = text;
		}
		return text;
	}

	private matchOne(field: ClauseField, rawValue: string): SortedInts {
		this.ensureIndexes();
		const value = rawValue.toLowerCase();
		switch (field) {
			case 'type':
				return this.matchType(value);
			case 'school':
				return this.schoolIndex.get(value) ?? EMPTY;
			case 'outcome':
				return this.outcomeIndex.get(value as Outcome) ?? EMPTY;
			// Picked from the index's own key set, so the lookup is the whole match: a substring
			// scan also matched every longer name containing this one ("Target 1" hit "Target 10").
			case 'spell':
				return this.spellIndex.get(value) ?? EMPTY;
			case 'source':
				return this.sourceNameIndex.get(value) ?? EMPTY;
			case 'target':
				return this.targetNameIndex.get(value) ?? EMPTY;
			case 'time':
				return matchRange(this.timeIndex(), value);
			case 'amount':
				return matchRange(this.amountIndex(), value);
		}
	}

	private matchType(value: string): SortedInts {
		const filter: TypeFilter | undefined = TYPE_FILTERS[value as TypeToken];
		if (!filter) return EMPTY;
		if ('debug' in filter) return this.debugIndexes;
		if ('effect' in filter) return this.effectIndex.get(filter.effect) ?? EMPTY;
		return filter.kinds.map(k => this.kindIndex.get(k) ?? EMPTY).reduce<SortedInts>((acc, cur) => unionSorted(acc, cur), EMPTY);
	}
}

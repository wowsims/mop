import { RaidSimResult } from '../../proto/api';
import type { SpellSchool } from '../../proto/common';
import { ActionId } from '../action_id';
import { stringToResourceType } from '../names';
import {
	AuraLog,
	AuraStacksLog,
	CastBeganLog,
	CastCancelledLog,
	CastCompletedLog,
	DamageEffect,
	DamageLog,
	Entity,
	BaseLog,
	LogKind,
	MajorCooldownLog,
	Outcome,
	ParsedLog,
	PlainLog,
	ResourceLog,
	StatChangeLog,
} from './types';

// Preamble patterns, hoisted so parseAll does not allocate a fresh RegExp per line.
const TIMESTAMP_PREFIX_REGEX = /(\[[0-9.-]+\]) (\[[0-9a-zA-Z\s\-()#]+\])?(.*)/;
const SPELL_SCHOOL_REGEX = / \(SpellSchool: (-?[0-9]+)\)/;
const THREAT_REGEX = / \(Threat: (-?[0-9]+\.[0-9]+)\)/;
const TIMESTAMP_REGEX = /\[(-?[0-9]+\.[0-9]+)\]\w*(.*)/;

// Not read by parseAll - it consumed TIMESTAMP_PREFIX_REGEX through the old SimLog.toHTML and
// rawWithoutTimestamp methods, which the log/ display components now own. Exported alongside it
// so a raw line is stripped identically everywhere, instead of a second regex drifting from this one.
export function rawWithoutTimestamp(raw: string): string {
	const captureArr = TIMESTAMP_PREFIX_REGEX.exec(raw);
	if (!captureArr || captureArr.length != 4) return raw;
	return `${captureArr[2] ?? ''}${captureArr[3]}`.trim();
}

export function computeActionIdAsString(actionId: ActionId | null): string | null {
	try {
		return actionId?.toString() || null;
	} catch {
		return null;
	}
}

const OUTCOME_BY_TOKEN: Record<string, Outcome> = {
	Miss: 'miss',
	Dodge: 'dodge',
	Parry: 'parry',
	CriticalBlock: 'critical-block',
	GlanceBlock: 'blocked-glance',
	Block: 'block',
	Glance: 'glance',
	Crit: 'crit',
	Hit: 'hit',
};

// One object is allocated per line and each builder finishes it in place. The obvious shape -
// build a params literal, then spread it into a second literal per kind - allocates twice and
// copies nine fields per line, and measured ~30% slower than master's single constructor call.
type Mutable<T> = { -readonly [K in keyof T]: T[K] };

function newLog(
	raw: string,
	logIndex: number,
	timestamp: number,
	source: Entity | null,
	target: Entity | null,
	spellSchool: SpellSchool | null,
	threat: number,
): PendingLog {
	return { kind: 'plain', raw, logIndex, timestamp, source, target, actionId: null, actionIdAsString: null, spellSchool, threat, activeAuras: [] };
}

function buildDamageLog(log: PendingLog, match: RegExpExecArray): DamageLog {
	const out = log as Mutable<DamageLog>;
	out.kind = 'damage';
	// Crush has no OUTCOME_BY_TOKEN entry: sim/core/flags.go:123 never emits OutcomeCrush, so
	// this falls back to 'hit' the same as an actual Hit token.
	out.outcome = OUTCOME_BY_TOKEN[match[3]] ?? 'hit';
	out.effect = match[18] ? (match[18] === 'healing' ? 'healing' : match[18] === 'shielding' ? 'shielding' : 'damage') : null;
	out.amount = match[17] ? parseFloat(match[17]) : 0;
	out.tick = Boolean(match[2]) && match[2].includes('tick');
	return out;
}

function buildResourceLog(log: PendingLog, match: RegExpExecArray): ResourceLog {
	const [resourceType, secondaryResourceType] = stringToResourceType(match[3]);
	const out = log as Mutable<ResourceLog>;
	out.kind = 'resource';
	out.resourceType = resourceType;
	out.valueBefore = parseFloat(match[5]);
	out.valueAfter = parseFloat(match[6]);
	out.isSpend = match[1] == 'Spent';
	out.total = match[8] !== undefined ? parseFloat(match[8]) : 0;
	// Always assigned, including when undefined: the parity dump discovers fields with
	// Object.keys, and the old constructor's assignment created the key either way.
	out.secondaryResourceType = secondaryResourceType;
	return out;
}

function buildAuraLog(log: PendingLog, match: RegExpExecArray): AuraLog {
	const event = match[1];
	const out = log as Mutable<AuraLog>;
	out.kind = 'aura';
	out.isGained = event == 'gained';
	out.isFaded = event == 'faded';
	out.isRefreshed = event == 'refreshed';
	return out;
}

function buildAuraStacksLog(log: PendingLog, match: RegExpExecArray): AuraStacksLog {
	const out = log as Mutable<AuraStacksLog>;
	out.kind = 'aura-stacks';
	out.oldStacks = parseInt(match[2]);
	out.newStacks = parseInt(match[3]);
	return out;
}

function buildMajorCooldownLog(log: PendingLog): MajorCooldownLog {
	const out = log as Mutable<MajorCooldownLog>;
	out.kind = 'major-cooldown';
	return out;
}

function buildCastBeganLog(log: PendingLog, match: RegExpExecArray): CastBeganLog {
	let castTime = parseFloat(match[3]);
	if (match[4] == 'ms') castTime /= 1000;
	let effectiveTime = parseFloat(match[5]);
	if (match[6] == 'ms') effectiveTime /= 1000;
	const out = log as Mutable<CastBeganLog>;
	out.kind = 'cast-began';
	out.manaCost = parseFloat(match[2]);
	out.castTime = castTime;
	out.effectiveTime = effectiveTime;
	return out;
}

function buildCastCancelledLog(log: PendingLog, match: RegExpExecArray): CastCancelledLog {
	let cancelTime = parseFloat(match[2]);
	if (match[3] == 'ms') cancelTime /= 1000;
	const out = log as Mutable<CastCancelledLog>;
	out.kind = 'cast-cancelled';
	out.cancelTime = cancelTime;
	return out;
}

function buildCastCompletedLog(log: PendingLog): CastCompletedLog {
	const out = log as Mutable<CastCompletedLog>;
	out.kind = 'cast-completed';
	return out;
}

function buildStatChangeLog(log: PendingLog, match: RegExpExecArray): StatChangeLog {
	const out = log as Mutable<StatChangeLog>;
	out.kind = 'stat-change';
	out.isGain = match[1] != 'Lost';
	out.stats = match[4];
	return out;
}

function buildPlainLog(log: PendingLog): PlainLog {
	const out = log as Mutable<PlainLog>;
	out.kind = 'plain';
	return out;
}

type LogMatcher = {
	// Literals the pattern requires: a line must contain at least one of them to be worth
	// testing. Skipping a matcher whose guard fails can therefore never skip a match the
	// pattern would have made, which is what keeps this dispatch equivalent to running every
	// pattern in order - it just stops paying for the ones that cannot match. The damage
	// pattern is both the first tried and the most expensive, so guarding it is most of the
	// win. assertGuardsAreNecessary() below checks each literal really is in its pattern.
	guard: Array<string>;
	regex: RegExp;
	// Some patterns match lines they cannot actually build from; those fall through to the
	// next matcher, exactly as the old `parse` chain did by returning null.
	valid?: (match: RegExpExecArray) => boolean;
	// The fragment naming this line's action, e.g. '{SpellID: 48707}'.
	idString: (match: RegExpExecArray) => string;
	build: (log: PendingLog, match: RegExpExecArray) => ParsedLog;
};

// Order is load-bearing: first match wins, and it runs most to least common.
const LOG_MATCHERS: Array<LogMatcher> = [
	{
		guard: ['Miss', 'Hit', 'Crit', 'Crush', 'Glance', 'Dodge', 'Parry', 'Block'],
		// The `(Crush)` alternative and `( \((\d+)% Resist\))?` group can never match in MoP - the
		// sim emits neither - but stay in the pattern because removing them renumbers match[15],
		// match[17] and match[18], which the surviving groups are indexed by below.
		regex: /] (.*?) (tick )?((Miss)|(Hit)|(CriticalBlock)|(Crit)|(Crush)|(GlanceBlock)|(Glance)|(Dodge)|(Parry)|(Block))( \((\d+)% Resist\))?( for (\d+\.\d+) ((damage)|(healing)|(shielding)))?/,
		idString: match => match[1],
		build: (log, match) => buildDamageLog(log, match),
	},
	{
		guard: [' from '],
		regex: /(Gained|Spent) (\d+\.?\d*) (\S.+?\S) from (.*?) \((\d+\.?\d*) --> (\d+\.?\d*)\)( of (\d+\.?\d*) total)?/,
		idString: match => match[4],
		build: (log, match) => buildResourceLog(log, match),
	},
	{
		guard: ['Aura '],
		regex: /Aura ((gained)|(faded)|(refreshed)): (.*)/,
		valid: match => Boolean(match[5]),
		idString: match => match[5],
		build: (log, match) => buildAuraLog(log, match),
	},
	{
		guard: [' stacks: '],
		regex: /(.*) stacks: ([0-9]+) --> ([0-9]+)/,
		valid: match => Boolean(match[1]),
		idString: match => match[1],
		build: (log, match) => buildAuraStacksLog(log, match),
	},
	{
		guard: ['Major cooldown used: '],
		regex: /Major cooldown used: (.*)/,
		idString: match => match[1],
		build: log => buildMajorCooldownLog(log),
	},
	{
		guard: ['Casting '],
		regex: /Casting (.*) \(Cost = (\d+\.?\d*), Cast Time = (\d+\.?\d*)(m?s), Effective Time = (\d+\.?\d*)(m?s)\)/,
		idString: match => match[1],
		build: (log, match) => buildCastBeganLog(log, match),
	},
	{
		guard: ['Cancelled '],
		regex: /Cancelled (.*) after (\d+\.?\d*)(m?s)/,
		idString: match => match[1],
		build: (log, match) => buildCastCancelledLog(log, match),
	},
	{
		guard: ['Completed cast '],
		regex: /Completed cast (.*)/,
		idString: match => match[1],
		build: log => buildCastCompletedLog(log),
	},
	{
		guard: [' from '],
		regex: /((Gained)|(Lost)) ({.*}) from (fading )?(.*)/,
		idString: match => match[6],
		build: (log, match) => buildStatChangeLog(log, match),
	},
];

type MatchedLine = { matcher: LogMatcher; match: RegExpExecArray };
// The per-line object the builders finish. Allocated fully shaped in the classify pass, including
// the fields the resolve pass fills in, so no builder ever adds a property to a completed object.
type PendingLog = Mutable<Omit<BaseLog, 'kind'>> & { kind: LogKind };
type PendingEntry = { log: PendingLog; matcher: LogMatcher | null; match: RegExpExecArray | null; key: string };
type ActionIdRequest = { logString: string; playerIndex: number | undefined };

// The dispatch is only equivalent to trying every pattern in order if each guard literal is
// something its own pattern requires. That is a property of the table, so check it here
// rather than trusting the comment. Necessary, not sufficient: a literal inside an optional
// group would pass this and still not be required, so guards stay hand-reviewed too.
function assertGuardsAreNecessary() {
	for (const matcher of LOG_MATCHERS) {
		for (const literal of matcher.guard) {
			if (!matcher.regex.source.includes(literal)) {
				throw new Error(`Log matcher guard '${literal}' is absent from its pattern ${matcher.regex.source}`);
			}
		}
	}
}

function matchLogLine(raw: string): MatchedLine | null {
	for (const matcher of LOG_MATCHERS) {
		let possible = false;
		for (const literal of matcher.guard) {
			if (raw.includes(literal)) {
				possible = true;
				break;
			}
		}
		if (!possible) continue;
		const match = matcher.regex.exec(raw);
		if (match && (!matcher.valid || matcher.valid(match))) {
			return { matcher, match };
		}
	}
	return null;
}

assertGuardsAreNecessary();

export async function parseAll(result: RaidSimResult): Promise<Array<ParsedLog>> {
	const lines = result.logs.split('\n');
	const pending: Array<PendingEntry> = new Array(lines.length);
	// Resolving an ActionId is the only asynchronous part of parsing, and a fight names
	// on the order of a hundred of them across tens of thousands of lines. Collect the
	// distinct ones while classifying, resolve them in one batch, then build every log
	// synchronously.
	const distinctIds = new Map<string, ActionIdRequest>();

	for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
		let line = lines[lineIndex];
		const raw = line;
		let spellSchool: SpellSchool | null = null;
		let threat = 0;

		const spellSchoolMatch = SPELL_SCHOOL_REGEX.exec(line);
		if (spellSchoolMatch) {
			spellSchool = parseInt(spellSchoolMatch[1]);
		}

		const threatMatch = THREAT_REGEX.exec(line);
		if (threatMatch) {
			threat = parseFloat(threatMatch[1]);
			line = line.substring(0, threatMatch.index);
		}

		const match = TIMESTAMP_REGEX.exec(line);
		if (!match || !match[1]) {
			pending[lineIndex] = { log: newLog(raw, lineIndex, 0, null, null, spellSchool, threat), matcher: null, match: null, key: '' };
			continue;
		}

		const timestamp = parseFloat(match[1]);
		const remainder = match[2];

		const entities = Entity.parseAll(remainder);
		const source = entities[0] || null;
		const target = entities[1] || null;

		const log = newLog(raw, lineIndex, timestamp, source, target, spellSchool, threat);

		const matched = matchLogLine(raw);
		if (!matched) {
			pending[lineIndex] = { log, matcher: null, match: null, key: '' };
			continue;
		}
		// Keep the key: the build pass needs it, and recomputing it there means a second
		// idString() call and a second string per matched line.
		const logString = matched.matcher.idString(matched.match);
		const key = `${source?.index ?? -1}|${logString}`;
		pending[lineIndex] = { log, ...matched, key };
		if (!distinctIds.has(key)) {
			distinctIds.set(key, { logString, playerIndex: source?.index });
		}
	}

	const keys = [...distinctIds.keys()];
	const resolved = await Promise.all(
		keys.map(key => {
			const { logString, playerIndex } = distinctIds.get(key)!;
			return ActionId.fromLogString(logString).fill(playerIndex);
		}),
	);
	// ActionId is immutable (readonly fields, private constructor), so one resolved
	// instance can be shared by every line that names it.
	const actionIds = new Map<string, ActionId>();
	keys.forEach((key, i) => actionIds.set(key, resolved[i]));

	return pending.map(entry => {
		const actionId = entry.matcher ? actionIds.get(entry.key)! : null;
		entry.log.actionId = actionId;
		entry.log.actionIdAsString = computeActionIdAsString(actionId);
		return entry.matcher ? entry.matcher.build(entry.log, entry.match!) : buildPlainLog(entry.log);
	});
}

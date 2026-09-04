import type { SpellSchool } from '../../proto/common';
import type { ResourceType, SecondaryResourceType } from '../../proto/spell';
import type { ActionId } from '../action_id';

export class Entity {
	readonly name: string;
	readonly ownerName: string; // Blank if not a pet.

	// Either target index, player index, or owner index depending on what kind
	// of entity this is.
	readonly index: number;

	readonly isTarget: boolean;
	readonly isPet: boolean;

	constructor(name: string, ownerName: string, index: number, isTarget: boolean, isPet: boolean) {
		this.name = name;
		this.ownerName = ownerName;
		this.index = index;
		this.isTarget = isTarget;
		this.isPet = isPet;
	}

	equals(other: Entity) {
		return this.isTarget == other.isTarget && this.isPet == other.isPet && this.index == other.index && this.name == other.name;
	}

	toString(): string {
		if (this.isTarget) {
			return `Target ${this.index + 1}`;
		} else if (this.isPet) {
			return `${this.ownerName} (#${this.index + 1}) - ${this.name}`;
		} else {
			return `${this.name} (#${this.index + 1})`;
		}
	}

	// Parses one or more Entities from a string.
	// Each entity label should be one of:
	//   'Target 1' if a target,
	//   'PlayerName (#1)' if a player, or
	//   'PlayerName (#1) - PetName' if a pet.
	static parseRegex = /\[(Target (\d+))|(([a-zA-Z0-9]+) \(#(\d+)\) - ([a-zA-Z0-9\s:,]+))|(([a-zA-Z0-9\s]+) \(#(\d+)\))\]/g;
	static parseAll(str: string): Array<Entity> {
		return Array.from(str.matchAll(Entity.parseRegex)).map(match => {
			if (match[1]) {
				return new Entity(match[1], '', parseInt(match[2]) - 1, true, false);
			} else if (match[3]) {
				return new Entity(match[6], match[4], parseInt(match[5]) - 1, false, true);
			} else if (match[7]) {
				return new Entity(match[8], '', parseInt(match[9]) - 1, false, false);
			} else {
				throw new Error('Invalid Entity match');
			}
		});
	}
}

// The one token the sim prints per damage line (sim/core/flags.go:123). Exactly one arrives, so
// the UI maps it rather than re-deriving a precedence from booleans.
//
// 'crush' is absent on purpose: OutcomeCrush is declared and read back in String(), but nothing in
// sim/ ever sets it, so the token cannot reach the log. Partial resists are gone for the same
// reason - the sim contains no "% Resist" fragment at all.
export type Outcome = 'miss' | 'dodge' | 'parry' | 'critical-block' | 'blocked-glance' | 'block' | 'glance' | 'crit' | 'hit';

export type DamageEffect = 'damage' | 'healing' | 'shielding';

export type ParsedKind =
	| 'plain'
	| 'damage'
	| 'resource'
	| 'aura'
	| 'aura-stacks'
	| 'major-cooldown'
	| 'cast-began'
	| 'cast-cancelled'
	| 'cast-completed'
	| 'stat-change';

export type DerivedKind = 'dps' | 'threat-group' | 'resource-group' | 'aura-uptime' | 'cast';

export type LogKind = ParsedKind | DerivedKind;

export interface BaseLog {
	readonly kind: LogKind;
	readonly raw: string;

	// Index of this log within the full log output.
	// When comparing timestamps this should be used instead of timestamp, because
	// timestamp is scraped from log text and doesn't have enough precision.
	readonly logIndex: number;

	// Time in seconds from the encounter start. Negative before the pull.
	readonly timestamp: number;

	readonly source: Entity | null;
	readonly target: Entity | null;
	readonly actionId: ActionId | null;
	readonly actionIdAsString: string | null;

	// Not all events have a spell school, so this is null rather than 0.
	readonly spellSchool: SpellSchool | null;
	readonly threat: number;

	// Auras active at this timestamp, filled by populateActiveAuras. Consecutive logs
	// deliberately share one array instance, so never mutate it in place.
	activeAuras: Array<AuraUptimeLog>;
}

export interface PlainLog extends BaseLog {
	readonly kind: 'plain';
}

export interface DamageLog extends BaseLog {
	readonly kind: 'damage';
	readonly outcome: Outcome;
	// null when the line carries no "for N <effect>" clause at all, which is what a miss, dodge or
	// parry looks like. Master modelled that as the empty string and its isDamage() reported false
	// for it, so absence has to stay distinguishable from damage.
	readonly effect: DamageEffect | null;
	readonly amount: number;
	// Periodic damage. Orthogonal to `outcome` — a tick can crit, and the display only says
	// "Tick" when the outcome is a plain hit.
	readonly tick: boolean;
}

export interface ResourceLog extends BaseLog {
	readonly kind: 'resource';
	readonly resourceType: ResourceType;
	readonly valueBefore: number;
	readonly valueAfter: number;
	readonly isSpend: boolean;
	readonly total: number;
	readonly secondaryResourceType: SecondaryResourceType | undefined;
}

export interface AuraLog extends BaseLog {
	readonly kind: 'aura';
	readonly isGained: boolean;
	readonly isFaded: boolean;
	readonly isRefreshed: boolean;
}

export interface AuraStacksLog extends BaseLog {
	readonly kind: 'aura-stacks';
	readonly oldStacks: number;
	readonly newStacks: number;
}

export interface MajorCooldownLog extends BaseLog {
	readonly kind: 'major-cooldown';
}

export interface CastBeganLog extends BaseLog {
	readonly kind: 'cast-began';
	readonly manaCost: number;
	readonly castTime: number;
	readonly effectiveTime: number;
}

export interface CastCancelledLog extends BaseLog {
	readonly kind: 'cast-cancelled';
	readonly cancelTime: number;
}

export interface CastCompletedLog extends BaseLog {
	readonly kind: 'cast-completed';
}

export interface StatChangeLog extends BaseLog {
	readonly kind: 'stat-change';
	readonly isGain: boolean;
	readonly stats: string;
}

export type ParsedLog =
	| PlainLog
	| DamageLog
	| ResourceLog
	| AuraLog
	| AuraStacksLog
	| MajorCooldownLog
	| CastBeganLog
	| CastCancelledLog
	| CastCompletedLog
	| StatChangeLog;

// Derived logs are never produced by the parse. They are built per unit, on demand, from an
// already-parsed array, and most carry raw: ''.

export interface DpsLog extends BaseLog {
	readonly kind: 'dps';
	readonly dps: number;
	readonly damageLogs: Array<DamageLog>;
}

export interface ThreatLogGroup extends BaseLog {
	readonly kind: 'threat-group';
	readonly threatBefore: number;
	readonly threatAfter: number;
	readonly logs: Array<CombatLog>;
}

export interface ResourceGroupLog extends BaseLog {
	readonly kind: 'resource-group';
	readonly resourceType: ResourceType;
	readonly valueBefore: number;
	readonly valueAfter: number;
	readonly maxValue: number;
	readonly logs: Array<ResourceLog>;
}

export interface AuraUptimeLog extends BaseLog {
	readonly kind: 'aura-uptime';
	readonly gainedAt: number;
	readonly fadedAt: number;
	readonly stacksChange: Array<AuraStacksLog>;
}

export interface CastLog extends BaseLog {
	readonly kind: 'cast';
	readonly castTime: number;
	readonly effectiveTime: number;
	readonly travelTime: number;
	readonly cancelTime: number;
	readonly castBeganLog: CastBeganLog;
	readonly castCancelledLog: CastCancelledLog | null;
	readonly castCompletedLog: CastCompletedLog | null;
	// All damage dealt from the completion of this cast until the completion of the next.
	readonly damageDealtLogs: Array<DamageLog>;
}

export type DerivedLog = DpsLog | ThreatLogGroup | ResourceGroupLog | AuraUptimeLog | CastLog;

export type CombatLog = ParsedLog | DerivedLog;

// Written as standalone predicates rather than methods: negating a `this is X` guard narrows the
// base type to never by the third branch.
export const isDamage = (log: CombatLog): log is DamageLog => log.kind === 'damage';
export const isResource = (log: CombatLog): log is ResourceLog => log.kind === 'resource';
export const isAura = (log: CombatLog): log is AuraLog => log.kind === 'aura';
export const isAuraStacks = (log: CombatLog): log is AuraStacksLog => log.kind === 'aura-stacks';
export const isMajorCooldown = (log: CombatLog): log is MajorCooldownLog => log.kind === 'major-cooldown';
export const isCastBegan = (log: CombatLog): log is CastBeganLog => log.kind === 'cast-began';
export const isCastCancelled = (log: CombatLog): log is CastCancelledLog => log.kind === 'cast-cancelled';
export const isCastCompleted = (log: CombatLog): log is CastCompletedLog => log.kind === 'cast-completed';

export function formattedTimestamp(log: BaseLog): string {
	const positiveTimestamp = Math.abs(log.timestamp);
	const minutes = Math.floor(positiveTimestamp / 60);
	const seconds = Math.floor(positiveTimestamp - minutes * 60);
	const milliseconds = ((positiveTimestamp - Math.floor(positiveTimestamp)) * 1000).toFixed();

	const formatted = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}:${String(milliseconds).padStart(3, '0')}`;
	return log.timestamp < 0 ? `-${formatted}` : formatted;
}

import type { ResourceType } from '@generated/proto/spell';
import type { ActionId } from '@sim/proto/action_id';
import type { AuraStacksLog } from '@sim/proto/combat_log';

export interface ReplayAction {
	time: number;
	name: string;
	actionId: ActionId | null;
	dmg: number | null;
	isCrit: boolean;
}

export interface ReplayAura {
	gainedAt: number;
	fadedAt: number;
	name: string;
	actionId: ActionId | null;
	stacksChange: AuraStacksLog[];
}

/** One resource log line, reduced to what a bar reads. The maximum is constant per type, so it lives on the row. */
export interface ReplayResourceSample {
	time: number;
	value: number;
}

export interface ReplayResourceRow {
	type: ResourceType;
	label: string;
	color: string;
	maxValue: number;
	/** Combo points, chi and runes are drawn as discrete pips rather than as a continuous bar. */
	segmented: boolean;
	samples: ReplayResourceSample[];
}

export interface ReplayHit {
	time: number;
	x: number;
	y: number;
	dmg: number | null;
	isCrit: boolean;
}

export interface ReplayEnemy {
	/** Position in the filtered target list — the card index, which is also what a hit carries. */
	index: number;
	name: string;
	auras: ReplayAura[];
	/** Sorted by time, as the log produced them. */
	hits: ReplayHit[];
	/** `cumulativeDamage[i]` is the damage dealt by `hits[0..i]`, so health at a time is one binary search. */
	cumulativeDamage: number[];
	totalDamage: number;
}

export interface ReplayModel {
	duration: number;
	playerName: string;
	/** Every player cast, sorted by time. */
	actions: ReplayAction[];
	/** The first cast of each distinct action — the action grid, one icon per spell. */
	uniqueActions: ReplayAction[];
	playerAuras: ReplayAura[];
	enemies: ReplayEnemy[];
	/** Targets past the eight the formation draws, shown as a `+N` marker. */
	hiddenEnemyCount: number;
	resourceRows: ReplayResourceRow[];
	/** Every icon the replay will show, warmed before playback so a cast does not pop in. */
	iconUrls: string[];
}

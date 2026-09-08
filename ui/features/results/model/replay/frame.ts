import type { AuraStacksLog } from '@sim/proto/combat_log';
import { formatDurationSeconds } from '@sim/utils/format';

import { DMG_WINDOW_SEC, HIT_WINDOW_SEC, MAX_TICKER, RECENT_WINDOW_SEC, REPLAY_TIME_FORMAT } from './constants';
import type { ReplayAction, ReplayAura, ReplayEnemy, ReplayHit, ReplayResourceSample } from './types';

interface Timed {
	time: number;
}

/** Last entry at or before `time`, or -1. Every list the replay looks up is in log order, so this is a search rather than a scan. */
const lastIndexAtOrBefore = (items: ReadonlyArray<Timed>, time: number): number => {
	let low = 0;
	let high = items.length - 1;
	let found = -1;
	while (low <= high) {
		const mid = (low + high) >> 1;
		if (items[mid].time <= time) {
			found = mid;
			low = mid + 1;
		} else {
			high = mid - 1;
		}
	}
	return found;
};

const firstIndexAtOrAfter = (items: ReadonlyArray<Timed>, time: number): number => {
	let low = 0;
	let high = items.length;
	while (low < high) {
		const mid = (low + high) >> 1;
		if (items[mid].time < time) low = mid + 1;
		else high = mid;
	}
	return low;
};

export const actionIndexAt = (actions: ReadonlyArray<ReplayAction>, time: number): number => lastIndexAtOrBefore(actions, time);

/** The tail of the cast list up to `time`, newest last — the strip above the arena. */
export const tickerCasts = (actions: ReadonlyArray<ReplayAction>, time: number): ReplayAction[] => {
	const index = actionIndexAt(actions, time);
	return actions.slice(Math.max(0, index + 1 - MAX_TICKER), index + 1);
};

export const tickerOpacity = (index: number, count: number): number => (index === count - 1 ? 1 : 0.25 + 0.6 * (index / Math.max(1, count - 1)));

export interface CastBarFrame {
	width: string;
	label: string;
	remaining: string;
}

const IDLE_CAST_BAR: CastBarFrame = { width: '0%', label: '', remaining: '' };

/**
 * The bar fills over the gap to the next cast, which is the only cast length the log gives us. A gap
 * under a GCD is filler rather than a cast, and one over ten seconds is a lull, so both read as idle.
 */
export const castBarFrame = (actions: ReadonlyArray<ReplayAction>, duration: number, time: number): CastBarFrame => {
	const index = actionIndexAt(actions, time);
	if (index < 0) return IDLE_CAST_BAR;

	const current = actions[index];
	const castDuration = (actions[index + 1]?.time ?? duration) - current.time;
	if (castDuration <= 1.5 || castDuration > 10) return IDLE_CAST_BAR;

	const elapsed = time - current.time;
	return {
		width: `${Math.min(1, elapsed / castDuration) * 100}%`,
		label: current.name,
		remaining: `${Math.max(0, castDuration - elapsed).toFixed(1)}s`,
	};
};

/** Whether one of the last few casts was this action and is still fresh — the action grid's highlight. */
export const isActionRecent = (actions: ReadonlyArray<ReplayAction>, name: string, time: number): boolean => {
	const index = actionIndexAt(actions, time);
	for (let i = index; i >= 0 && i >= index - 5; i--) {
		if (time - actions[i].time > RECENT_WINDOW_SEC) return false;
		if (actions[i].name === name) return true;
	}
	return false;
};

/** Auras up at `time`, soonest to expire first, which is the order the icon row is drawn in. */
export const activeAuras = (auras: ReadonlyArray<ReplayAura>, time: number): ReplayAura[] =>
	auras.filter(aura => aura.gainedAt <= time && aura.fadedAt >= time).sort((left, right) => left.fadedAt - right.fadedAt);

/** Walked backwards rather than searched: a merged aura's stack log is the concatenation of its spans'. */
export const stacksAt = (stacksChange: ReadonlyArray<AuraStacksLog>, time: number): number => {
	for (let i = stacksChange.length - 1; i >= 0; i--) {
		if (stacksChange[i].timestamp <= time) return stacksChange[i].newStacks;
	}
	return 0;
};

export interface AuraFrame {
	remaining: string;
	stacks: string;
	/** Just gained, so the icon wears its highlight ring. */
	fresh: boolean;
}

export const auraFrame = (aura: ReplayAura, time: number): AuraFrame => {
	const remaining = aura.fadedAt - time;
	const stacks = stacksAt(aura.stacksChange, time);
	return {
		remaining: remaining < 10 ? remaining.toFixed(1) : String(Math.round(remaining)),
		stacks: stacks > 1 ? String(stacks) : '',
		fresh: time - aura.gainedAt <= RECENT_WINDOW_SEC,
	};
};

/** The value the last log line before `time` left, or nothing spent yet. */
export const resourceValueAt = (samples: ReadonlyArray<ReplayResourceSample>, time: number): number => {
	const index = lastIndexAtOrBefore(samples, time);
	return index < 0 ? 0 : samples[index].value;
};

/**
 * The replay has no health log, so an enemy's bar is how much of the damage it will ever take has
 * already landed. A target that takes none stays full rather than dividing by zero.
 */
export const healthFractionAt = (enemy: ReplayEnemy, time: number): number => {
	const index = lastIndexAtOrBefore(enemy.hits, time);
	const dealt = index < 0 ? 0 : enemy.cumulativeDamage[index];
	return Math.max(0, 1 - dealt / Math.max(1, enemy.totalDamage));
};

export const activeHits = (enemy: ReplayEnemy, time: number): ReplayHit[] =>
	enemy.hits.slice(firstIndexAtOrAfter(enemy.hits, time - DMG_WINDOW_SEC), lastIndexAtOrBefore(enemy.hits, time) + 1);

export interface HitFrame {
	flashSize: number;
	flashOpacity: number;
	ringSize: number;
	ringOpacity: number;
	ringGlow: number;
	numberOpacity: number;
	numberScale: number;
	floatY: number;
}

/**
 * One hit's animation at `time`. The flash and ring expand out of the impact over `HIT_WINDOW_SEC`
 * while the damage number rises and fades over the longer `DMG_WINDOW_SEC`.
 */
export const hitFrame = (hit: ReplayHit, time: number): HitFrame => {
	const age = time - hit.time;
	const burst = Math.min(1, age / HIT_WINDOW_SEC);
	const eased = 1 - (1 - burst) * (1 - burst);
	const float = Math.min(1, age / DMG_WINDOW_SEC);

	return {
		flashSize: 14 + eased * 28,
		flashOpacity: Math.max(0, 1 - burst) * (hit.isCrit ? 1 : 0.85),
		ringSize: 24 + eased * 72,
		ringOpacity: Math.max(0, (1 - burst) * 0.85),
		ringGlow: 6 + eased * 10,
		numberOpacity: float < 0.15 ? float / 0.15 : float > 0.6 ? Math.max(0, 1 - (float - 0.6) / 0.4) : 1,
		numberScale: float < 0.1 ? 1.4 - (float / 0.1) * 0.4 : 1,
		floatY: float < 0.3 ? (float / 0.3) * 28 : 28 + ((float - 0.3) / 0.7) * 14,
	};
};

export const tickerDamageLabel = (dmg: number): string => (dmg >= 1000 ? `${(dmg / 1000).toFixed(1)}k` : String(Math.round(dmg)));

export const hitDamageLabel = (dmg: number): string =>
	dmg >= 1000000 ? `${(dmg / 1000000).toFixed(2)}M` : dmg >= 1000 ? `${(dmg / 1000).toFixed(1)}K` : String(Math.round(dmg));

export const replayTimeLabel = (time: number, duration: number): string =>
	`${formatDurationSeconds(time, REPLAY_TIME_FORMAT)} / ${formatDurationSeconds(duration, REPLAY_TIME_FORMAT)}`;

/** The scrubber runs 0–1000 rather than in seconds, so a fight of any length gets the same resolution. */
export const scrubberValue = (time: number, duration: number): number => Math.round((time / Math.max(duration, 0.001)) * 1000);

export const scrubberTime = (value: number, duration: number): number => (value / 1000) * duration;

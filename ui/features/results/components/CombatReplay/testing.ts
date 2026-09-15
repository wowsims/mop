import { ResourceType } from '@generated/proto/spell';
import type { ActionId } from '@sim/proto/action_id';
import type { AuraStacksLog } from '@sim/proto/combat_log';

import type { ReplayAction, ReplayAura, ReplayEnemy, ReplayHit, ReplayModel, ReplayResourceRow } from '../../model/replay';

/** Enough of an `ActionId` for `useActionId` to resolve without filling. */
export const actionId = (name: string): ActionId =>
	({
		equalityKey: () => name,
		reforgeId: 0,
		iconUrl: `${name}.png`,
		name,
		anyId: () => true,
		toStringIgnoringTag: () => name,
		itemId: 0,
		spellId: 1,
		spellIdTooltipOverride: 0,
	}) as unknown as ActionId;

export const replayAction = (time: number, name: string, extra: Partial<ReplayAction> = {}): ReplayAction => ({
	time,
	name,
	actionId: actionId(name),
	dmg: null,
	isCrit: false,
	...extra,
});

export const replayAura = (
	gainedAt: number,
	fadedAt: number,
	name: string,
	stacksChange: Array<{ timestamp: number; newStacks: number }> = [],
): ReplayAura => ({
	gainedAt,
	fadedAt,
	name,
	actionId: actionId(name),
	stacksChange: stacksChange as Array<AuraStacksLog>,
});

export const replayHit = (time: number, dmg: number | null, isCrit = false): ReplayHit => ({ time, x: 30, y: 40, dmg, isCrit });

export const replayEnemy = (index: number, name: string, hits: Array<ReplayHit>, auras: Array<ReplayAura> = []): ReplayEnemy => {
	let running = 0;
	return {
		index,
		name,
		auras,
		hits,
		cumulativeDamage: hits.map(hit => (running += hit.dmg ?? 0)),
		totalDamage: hits.reduce((total, hit) => total + (hit.dmg ?? 0), 0),
	};
};

export const resourceRow = (overrides: Partial<ReplayResourceRow> = {}): ReplayResourceRow => ({
	type: ResourceType.ResourceTypeEnergy,
	label: 'Energy',
	color: '#ffd700',
	maxValue: 100,
	segmented: false,
	samples: [],
	...overrides,
});

export const replayModel = (overrides: Partial<ReplayModel> = {}): ReplayModel => ({
	duration: 30,
	playerName: 'Hero',
	actions: [],
	uniqueActions: [],
	playerAuras: [],
	enemies: [replayEnemy(0, 'Boss', [])],
	hiddenEnemyCount: 0,
	resourceRows: [],
	iconUrls: [],
	...overrides,
});

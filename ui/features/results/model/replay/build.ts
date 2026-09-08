import { OtherAction } from '@generated/proto/common';
import { ResourceType } from '@generated/proto/spell';
import i18n from '@i18n/config';
import type { CastBeganLog, DamageLog, ResourceLog } from '@sim/proto/combat_log';
import { Entity, isCastBegan, isDamage, isResource } from '@sim/proto/combat_log';
import { isAvoidedOutcome, isCriticalOutcome } from '@sim/proto/combat_log/types';
import { resourceColors, resourceNames } from '@sim/proto/names';
import { ActionMetrics, type SimResult, type SimResultFilter } from '@sim/proto/sim_result';

import { MAX_ENEMIES, RESOURCE_MAX_DEFAULTS, RESOURCE_PRIORITY, SEGMENTED_RESOURCE_TYPES } from './constants';
import type { ReplayAction, ReplayAura, ReplayEnemy, ReplayHit, ReplayModel, ReplayResourceRow, ReplayResourceSample } from './types';

/** Which spell an aura is, ignoring its tag — the name is only a fallback for an id that has none. */
export const auraSpellKey = (aura: ReplayAura): string => aura.actionId?.toStringIgnoringTag() ?? aura.name;

/**
 * Merges adjacent uptime spans for the same spell into one. A refreshed aura produces a new
 * `AuraUptimeLog` starting at the refresh, which would otherwise show an artificially short timer.
 */
export const mergeAdjacentAuras = (auras: ReplayAura[]): ReplayAura[] => {
	const merged: ReplayAura[] = [];
	const byKey = new Map<string, ReplayAura>();
	for (const aura of auras) {
		const key = auraSpellKey(aura);
		const previous = byKey.get(key);
		if (previous && Math.abs(previous.fadedAt - aura.gainedAt) < 0.05) {
			previous.fadedAt = aura.fadedAt;
			previous.stacksChange = [...previous.stacksChange, ...aura.stacksChange];
		} else {
			const copy = { ...aura, stacksChange: [...aura.stacksChange] };
			merged.push(copy);
			byKey.set(key, copy);
		}
	}
	return merged;
};

const isReplayableId = (actionId: ReplayAura['actionId']): boolean =>
	!!actionId && actionId.otherId === OtherAction.OtherActionNone && !!(actionId.spellId || actionId.itemId) && !!actionId.name;

const auraOf = (aura: { gainedAt: number; fadedAt: number; actionId: ReplayAura['actionId']; stacksChange: ReplayAura['stacksChange'] }): ReplayAura => ({
	gainedAt: aura.gainedAt,
	fadedAt: aura.fadedAt,
	name: aura.actionId!.name,
	actionId: aura.actionId,
	stacksChange: aura.stacksChange,
});

const cumulativeDamage = (hits: ReplayHit[]): number[] => {
	let running = 0;
	return hits.map(hit => (running += hit.dmg ?? 0));
};

const resourceRows = (logs: ResourceLog[]): ReplayResourceRow[] => {
	const maxima = new Map<ResourceType, number>();
	for (const log of logs) {
		if (log.total > 0) maxima.set(log.resourceType, Math.max(maxima.get(log.resourceType) ?? 0, log.total));
	}

	const samples = new Map<ResourceType, ReplayResourceSample[]>();
	for (const log of logs) {
		if (log.resourceType === ResourceType.ResourceTypeNone || log.resourceType === ResourceType.ResourceTypeHealth) continue;
		let list = samples.get(log.resourceType);
		if (!list) samples.set(log.resourceType, (list = []));
		list.push({ time: log.timestamp, value: log.valueAfter });
	}

	// The prioritised types first so the primary resource leads, then whatever else the log carried.
	const ordered = [...RESOURCE_PRIORITY.filter(type => samples.has(type)), ...[...samples.keys()].filter(type => !RESOURCE_PRIORITY.includes(type))];

	return ordered.map(type => ({
		type,
		label: resourceNames.get(type) ?? String(type),
		color: resourceColors.get(type) ?? '#94a3b8',
		maxValue: maxima.get(type) || RESOURCE_MAX_DEFAULTS[type] || 100,
		segmented: SEGMENTED_RESOURCE_TYPES.has(type),
		samples: samples.get(type)!,
	}));
};

/** The whole replay, derived from one finished run: everything below is either constant or a lookup by time. */
export const buildReplayModel = (result: SimResult, filter: SimResultFilter): ReplayModel => {
	const duration = result.result.firstIterationDuration || result.result.avgIterationDuration || 120;

	const targets = result.getTargets(filter);
	const targetNames = targets.map(target => target.name);
	const enemyCount = Math.max(1, targets.length);

	const players = result.getPlayers(filter);
	const playerEntity = players[0] ? new Entity(players[0].name, '', players[0].index, false, false) : null;

	// Per-tag lookup so passive tagged variants (e.g. tag=1) are not merged with
	// non-passive variants (tag=0) before the isPassiveAction check.
	const actionMetricsPerTag = ActionMetrics.joinById(
		players.map(player => player.getPlayerAndPetActions().map(action => action.forTarget(filter))).flat(),
		true,
	);

	const castBeganLogs: CastBeganLog[] = [];
	const damageLogs: DamageLog[] = [];
	const resourceLogs: ResourceLog[] = [];
	for (const log of result.logs) {
		if (log.timestamp < 0) continue;
		if (isCastBegan(log)) castBeganLogs.push(log);
		else if (isDamage(log)) damageLogs.push(log);
		else if (isResource(log)) resourceLogs.push(log);
	}

	const isReplayedCast = (cast: CastBeganLog): boolean =>
		isReplayableId(cast.actionId) && !actionMetricsPerTag.find(metric => metric.actionId?.equals(cast.actionId!))?.isPassiveAction;

	const playerCasts = (playerEntity ? castBeganLogs.filter(cast => cast.source?.equals(playerEntity)) : castBeganLogs).filter(isReplayedCast);
	const playerDamage = playerEntity ? damageLogs.filter(log => log.source?.equals(playerEntity)) : damageLogs;

	const actions: ReplayAction[] = playerCasts.map(cast => {
		const actionId = cast.actionId!;
		const landed = playerDamage.find(
			log =>
				log.timestamp >= cast.timestamp &&
				log.timestamp <= cast.timestamp + 3 &&
				log.actionId?.name === actionId.name &&
				!isAvoidedOutcome(log.outcome),
		);
		return {
			time: cast.timestamp,
			name: actionId.name,
			actionId,
			dmg: landed?.amount ?? null,
			isCrit: !!landed && isCriticalOutcome(landed.outcome),
		};
	});

	const uniqueActions: ReplayAction[] = [];
	const seenActionNames = new Set<string>();
	for (const action of actions) {
		if (seenActionNames.has(action.name)) continue;
		seenActionNames.add(action.name);
		uniqueActions.push(action);
	}

	const hitsByEnemy: ReplayHit[][] = Array.from({ length: Math.min(enemyCount, MAX_ENEMIES) }, () => []);
	for (const log of playerDamage) {
		if (isAvoidedOutcome(log.outcome)) continue;
		if (log.actionId && log.actionId.otherId !== OtherAction.OtherActionNone) continue;
		const cardIndex = targetNames.findIndex(name => name === log.target?.name);
		if (cardIndex === -1 && targetNames.length > 0) continue;
		const hits = hitsByEnemy[Math.max(0, cardIndex)];
		if (!hits) continue;
		// A stable scatter across the silhouette: the same hit lands in the same place every replay.
		const seed = Math.round(Math.abs(log.timestamp) * 1000);
		hits.push({
			time: log.timestamp,
			x: 20 + ((seed * 23) % 60),
			y: 10 + ((seed * 37) % 60),
			dmg: log.amount > 0 ? log.amount : null,
			isCrit: isCriticalOutcome(log.outcome),
		});
	}

	// An aura up for the whole fight is scenery, not an event, so it is left out of both icon rows.
	const isPermanent = (gainedAt: number, fadedAt: number) => gainedAt <= 0 && fadedAt >= duration - 0.1;
	const uptimeAuras = (logs: Array<{ gainedAt: number; fadedAt: number; actionId: ReplayAura['actionId']; stacksChange: ReplayAura['stacksChange'] }>) =>
		mergeAdjacentAuras(logs.filter(log => isReplayableId(log.actionId) && !isPermanent(log.gainedAt, log.fadedAt)).map(auraOf));

	const enemies: ReplayEnemy[] = hitsByEnemy.map((hits, index) => ({
		index,
		name: targetNames[index] ?? i18n.t('combat_replay.training_dummy'),
		// Merged per target, not across the whole filtered list: the vanilla merged one flat array keyed
		// by spell alone, so a dot fading on one enemy absorbed the same dot landing on the next.
		auras: targets[index] ? uptimeAuras(targets[index].auraUptimeLogs) : [],
		hits,
		cumulativeDamage: cumulativeDamage(hits),
		totalDamage: hits.reduce((total, hit) => total + (hit.dmg ?? 0), 0),
	}));

	const playerAuras = players[0] ? uptimeAuras(players[0].auraUptimeLogs) : [];

	return {
		duration,
		playerName: players[0]?.name ?? i18n.t('combat_replay.default_player'),
		actions,
		uniqueActions,
		playerAuras,
		enemies,
		hiddenEnemyCount: Math.max(0, enemyCount - MAX_ENEMIES),
		resourceRows: resourceRows(playerEntity ? resourceLogs.filter(log => log.source?.equals(playerEntity)) : resourceLogs),
		iconUrls: [...uniqueActions, ...playerAuras, ...enemies.flatMap(enemy => enemy.auras)].map(entry => entry.actionId?.iconUrl ?? '').filter(Boolean),
	};
};

import type { Player } from '../../../player';
import { ReforgeOptimizer } from '../../suggest_reforges_action';
import { ReforgeGearCache } from '../../../reforge_cache';
import {
	BulkGearCandidate,
	BulkSimResult,
	BulkSimStage,
	DistributionMetrics,
	ReforgeOptimizeMode,
	ReforgeOptimizeRequest,
} from '../../../proto/api';
import { Class, Debuffs, ItemSlot, PartyBuffs, RaidBuffs, WeaponType } from '../../../proto/common';
import { Gear } from '../../../proto_utils/gear';
import { isSpecDualWieldCapable } from '../../../player_classes/capabilities';
import { OptimisationStage, STAGE_CONFIG } from './types';
import {
	BULK_SIM_ITEM_SLOT_TO_ITEM_SLOT_PAIRS,
	BULK_SIM_ITEM_SLOT_TO_SINGLE_ITEM_SLOT,
	BulkSimItemSlot,
	ITEM_SLOT_TO_BULK_SIM_ITEM_SLOT,
} from './constants_auto_gen';

export {
	BulkSimItemSlot,
	ITEM_SLOT_TO_BULK_SIM_ITEM_SLOT,
	BULK_SIM_ITEM_SLOT_TO_SINGLE_ITEM_SLOT,
	BULK_SIM_ITEM_SLOT_TO_ITEM_SLOT_PAIRS,
};

export const getBulkItemSlotFromSlot = (slot: ItemSlot, canDualWield: boolean): BulkSimItemSlot => {
	if (canDualWield && [ItemSlot.ItemSlotMainHand, ItemSlot.ItemSlotOffHand].includes(slot)) {
		return BulkSimItemSlot.ItemSlotHandWeapon;
	}
	return ITEM_SLOT_TO_BULK_SIM_ITEM_SLOT.get(slot)!;
};

export const getBulkPlayerCanDualWield = (player: Player<any>): boolean => {
	// Hunters are intentionally excluded from bulk dual-wield grouping to match backend behavior.
	return isSpecDualWieldCapable(player.getSpec()) && player.getClass() !== Class.ClassHunter;
};

export const getBulkFreezeWeaponTypes = (
	player: Player<any>,
	slot: ItemSlot.ItemSlotMainHand | ItemSlot.ItemSlotOffHand,
): WeaponType[] => {
	const playerCanDualWield = getBulkPlayerCanDualWield(player);

	return Array.from(
		new Set(
			player
				.getPlayerClass()
				.weaponTypes.filter(eligibleWeaponType => slot === ItemSlot.ItemSlotMainHand || (playerCanDualWield && !eligibleWeaponType.canUseTwoHand))
				.map(eligibleWeaponType => eligibleWeaponType.weaponType),
		),
	);
};

export const getDpsError = (metrics: DistributionMetrics, iterations: number): number => (iterations > 0 ? metrics.stdev / Math.sqrt(iterations) : 0);

export const getDurationSeconds = (startedAt: number): number => (new Date().getTime() - startedAt) / 1000;

export const cleanBulkDpsMetrics = (dpsMetrics: DistributionMetrics): DistributionMetrics => {
	dpsMetrics.hist = [];
	dpsMetrics.allValues = [];
	return dpsMetrics;
};

export const getGearKey = (gear: Gear): string => {
	const itemKeys = gear.asArray().map(item => {
		if (!item) {
			return '';
		}

		return [
			item._item.id,
			item._randomSuffix?.id ?? 0,
			item._enchant?.effectId ?? 0,
			item._tinker?.effectId ?? 0,
			item._reforge?.id ?? 0,
			item._upgrade,
			Number(item._challengeMode),
			item._gems.map(gem => gem?.id ?? 0).join(','),
		].join(':');
	});

	[BulkSimItemSlot.ItemSlotFinger, BulkSimItemSlot.ItemSlotTrinket].forEach(bulkSlot => {
		const slots = BULK_SIM_ITEM_SLOT_TO_ITEM_SLOT_PAIRS.get(bulkSlot)!;
		const slotKeys = [itemKeys[slots[0]], itemKeys[slots[1]]].sort();
		itemKeys[slots[0]] = slotKeys[0];
		itemKeys[slots[1]] = slotKeys[1];
	});

	return itemKeys.join('|');
};

export const dedupeGearSets = (gearSets: Gear[], existingGearSets: Gear[] = []): Gear[] => {
	const seenGearKeys = new Set<string>(existingGearSets.map(getGearKey));
	return gearSets.filter(gear => {
		const gearKey = getGearKey(gear);
		if (seenGearKeys.has(gearKey)) {
			return false;
		}

		seenGearKeys.add(gearKey);
		return true;
	});
};

export const shouldRunOptimisationStage = (stage: OptimisationStage, candidateCount: number): boolean => {
	const maxSurvivors = STAGE_CONFIG[stage].maxSurvivors;
	return maxSurvivors === undefined || candidateCount > maxSurvivors;
};

export const getOptimisationStageMinIterations = (stage: OptimisationStage, highStageIterations: number): number =>
	STAGE_CONFIG[stage].minIterations ?? highStageIterations;

export const getOptimisationTotalSimRounds = (reforgedGearSetCount: number): number => {
	let candidates = reforgedGearSetCount;
	let rounds = 0;

	for (const stage of ['low', 'medium'] as const) {
		if (shouldRunOptimisationStage(stage, candidates)) {
			rounds += candidates + 1;
			candidates = Math.min(candidates, STAGE_CONFIG[stage].maxSurvivors!);
		}
	}

	return rounds + candidates + 1;
};

export const bulkSimStageToOptimisationStage = (stage: BulkSimStage): OptimisationStage | 'reforging' | null => {
	switch (stage) {
		case BulkSimStage.BulkSimStageReforge:
			return 'reforging';
		case BulkSimStage.BulkSimStageLow:
			return 'low';
		case BulkSimStage.BulkSimStageMedium:
			return 'medium';
		case BulkSimStage.BulkSimStageHigh:
			return 'high';
		default:
			return null;
	}
};

export const getCoreBulkSimTrackingMetrics = (result: BulkSimResult): Record<string, string | number> => {
	const metrics: Record<string, string | number> = {
		total_sim_rounds: result.stageMetrics.reduce((total, stage) => total + stage.inputGearSets + 1, 0),
	};

	for (const stage of result.stageMetrics) {
		const stageName = bulkSimStageToOptimisationStage(stage.stage);
		if (!stageName) continue;
		metrics[`${stageName}_skipped`] = 0;
		metrics[`${stageName}_input_gear_sets`] = stage.inputGearSets;
		metrics[`${stageName}_results`] = stage.survivors;
		metrics[`${stageName}_survivors`] = stage.survivors;
		metrics[`${stageName}_iterations`] = stage.iterations;
		metrics[`${stageName}_target_error_pct`] = stage.targetErrorPct;
		metrics[`${stageName}_concurrency`] = stage.concurrency;
		metrics[`${stageName}_duration_seconds`] = Math.round(stage.durationSeconds);
	}

	if (result.timings) {
		metrics.core_simming_duration_seconds = Math.round(result.timings.simmingSeconds);
		metrics.core_total_duration_seconds = Math.round(result.timings.totalSeconds);
	}

	return metrics;
};


export type BulkSimReforgeCacheData = {
	cache: ReforgeGearCache;
	candidates: BulkGearCandidate[];
	optimizedCandidates: BulkGearCandidate[];
	cacheKeysByCandidateIndex: Map<number, string>;
};

export type BulkSimReforgeCacheContext = {
	player: Player<any>;
	gearSets: Gear[];
	reforgeRequest: ReforgeOptimizeRequest;
	raidBuffs: RaidBuffs;
	partyBuffs: PartyBuffs | undefined;
	debuffs: Debuffs;
};

export async function getBulkSimReforgeCacheData({
	player,
	gearSets,
	reforgeRequest,
	raidBuffs,
	partyBuffs,
	debuffs,
}: BulkSimReforgeCacheContext): Promise<BulkSimReforgeCacheData> {
	const cache = ReforgeGearCache.get(player.getPlayerSpec());
	const configHash = await ReforgeOptimizer.getBulkSimReforgeCacheConfigHash({ player, reforgeRequest, raidBuffs, partyBuffs, debuffs });
	const cacheEntries = await Promise.all(
		gearSets.map(async (gear, index) => ({
			index,
			gear,
			cacheKey: await ReforgeGearCache.getKey(gear.asSpec(), configHash),
		})),
	);
	const cachedGearByKey = await cache.getMany(cacheEntries.map(entry => entry.cacheKey));

	const candidates: BulkGearCandidate[] = [];
	const optimizedCandidates: BulkGearCandidate[] = [];
	const cacheKeysByCandidateIndex = new Map<number, string>();
	for (const entry of cacheEntries) {
		const cachedGear = cachedGearByKey.get(entry.cacheKey);
		if (cachedGear) {
			optimizedCandidates.push(BulkGearCandidate.create({ index: entry.index, gear: cachedGear }));
		} else {
			candidates.push(BulkGearCandidate.create({ index: entry.index, gear: entry.gear.asSpec() }));
			cacheKeysByCandidateIndex.set(entry.index, entry.cacheKey);
		}
	}

	return { cache, candidates, optimizedCandidates, cacheKeysByCandidateIndex };
}

export async function writeBulkSimReforgeCacheResults(optimizedCandidates: BulkGearCandidate[], cacheData: BulkSimReforgeCacheData): Promise<void> {
	const cacheEntries = optimizedCandidates.flatMap(candidate => {
		const cacheKey = cacheData.cacheKeysByCandidateIndex.get(candidate.index);
		if (!cacheKey || !candidate.gear) return [];
		return [{ key: cacheKey, optimizedGear: candidate.gear }];
	});
	await cacheData.cache.setGearMany(cacheEntries);
}


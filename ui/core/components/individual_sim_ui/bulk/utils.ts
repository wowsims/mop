import type { Player } from '../../../player';
import { ReforgeOptimizer } from '../../suggest_reforges_action';
import { ReforgeGearCache } from '../../../reforge_cache';
import { BulkGearCandidate, BulkSimResult, BulkSimStage, DistributionMetrics, ReforgeOptimizeMode, ReforgeOptimizeRequest } from '../../../proto/api';
import { Debuffs, ItemSlot, PartyBuffs, RaidBuffs } from '../../../proto/common';
import { Database } from '../../../proto_utils/database';
import { Gear } from '../../../proto_utils/gear';
import { sleep } from '../../../utils';
import { OptimisationStage, STAGE_CONFIG } from './types';

const BULK_CACHE_LOOKUP_BATCH_SIZE = 2000;
const BULK_CACHE_PROGRESS_CHECK_MODULO = 64;
const BULK_CACHE_YIELD_BUDGET_MS = 16;

// Combines Fingers 1 and 2 and Trinket 1 and 2 into single groups
export enum BulkSimItemSlot {
	ItemSlotHead,
	ItemSlotNeck,
	ItemSlotShoulder,
	ItemSlotBack,
	ItemSlotChest,
	ItemSlotWrist,
	ItemSlotHands,
	ItemSlotWaist,
	ItemSlotLegs,
	ItemSlotFeet,
	ItemSlotFinger,
	ItemSlotTrinket,
	ItemSlotMainHand,
	ItemSlotOffHand,
	ItemSlotHandWeapon, // Weapon grouping slot for specs that can dual-wield
}

export const itemSlotToBulkSimItemSlot: Map<ItemSlot, BulkSimItemSlot> = new Map([
	[ItemSlot.ItemSlotHead, BulkSimItemSlot.ItemSlotHead],
	[ItemSlot.ItemSlotNeck, BulkSimItemSlot.ItemSlotNeck],
	[ItemSlot.ItemSlotShoulder, BulkSimItemSlot.ItemSlotShoulder],
	[ItemSlot.ItemSlotBack, BulkSimItemSlot.ItemSlotBack],
	[ItemSlot.ItemSlotChest, BulkSimItemSlot.ItemSlotChest],
	[ItemSlot.ItemSlotWrist, BulkSimItemSlot.ItemSlotWrist],
	[ItemSlot.ItemSlotHands, BulkSimItemSlot.ItemSlotHands],
	[ItemSlot.ItemSlotWaist, BulkSimItemSlot.ItemSlotWaist],
	[ItemSlot.ItemSlotLegs, BulkSimItemSlot.ItemSlotLegs],
	[ItemSlot.ItemSlotFeet, BulkSimItemSlot.ItemSlotFeet],
	[ItemSlot.ItemSlotFinger1, BulkSimItemSlot.ItemSlotFinger],
	[ItemSlot.ItemSlotFinger2, BulkSimItemSlot.ItemSlotFinger],
	[ItemSlot.ItemSlotTrinket1, BulkSimItemSlot.ItemSlotTrinket],
	[ItemSlot.ItemSlotTrinket2, BulkSimItemSlot.ItemSlotTrinket],
	[ItemSlot.ItemSlotMainHand, BulkSimItemSlot.ItemSlotMainHand],
	[ItemSlot.ItemSlotOffHand, BulkSimItemSlot.ItemSlotOffHand],
]);

export const bulkSimItemSlotToSingleItemSlot: Map<BulkSimItemSlot, ItemSlot> = new Map([
	[BulkSimItemSlot.ItemSlotHead, ItemSlot.ItemSlotHead],
	[BulkSimItemSlot.ItemSlotNeck, ItemSlot.ItemSlotNeck],
	[BulkSimItemSlot.ItemSlotShoulder, ItemSlot.ItemSlotShoulder],
	[BulkSimItemSlot.ItemSlotBack, ItemSlot.ItemSlotBack],
	[BulkSimItemSlot.ItemSlotChest, ItemSlot.ItemSlotChest],
	[BulkSimItemSlot.ItemSlotWrist, ItemSlot.ItemSlotWrist],
	[BulkSimItemSlot.ItemSlotHands, ItemSlot.ItemSlotHands],
	[BulkSimItemSlot.ItemSlotWaist, ItemSlot.ItemSlotWaist],
	[BulkSimItemSlot.ItemSlotLegs, ItemSlot.ItemSlotLegs],
	[BulkSimItemSlot.ItemSlotFeet, ItemSlot.ItemSlotFeet],
	[BulkSimItemSlot.ItemSlotMainHand, ItemSlot.ItemSlotMainHand],
	[BulkSimItemSlot.ItemSlotOffHand, ItemSlot.ItemSlotOffHand],
]);

export const bulkSimItemSlotToItemSlotPairs: Map<BulkSimItemSlot, [ItemSlot, ItemSlot]> = new Map([
	[BulkSimItemSlot.ItemSlotFinger, [ItemSlot.ItemSlotFinger1, ItemSlot.ItemSlotFinger2]],
	[BulkSimItemSlot.ItemSlotTrinket, [ItemSlot.ItemSlotTrinket1, ItemSlot.ItemSlotTrinket2]],
	[BulkSimItemSlot.ItemSlotHandWeapon, [ItemSlot.ItemSlotMainHand, ItemSlot.ItemSlotOffHand]],
]);

export const getBulkItemSlotFromSlot = (slot: ItemSlot, canDualWield: boolean): BulkSimItemSlot => {
	if (canDualWield && [ItemSlot.ItemSlotMainHand, ItemSlot.ItemSlotOffHand].includes(slot)) {
		return BulkSimItemSlot.ItemSlotHandWeapon;
	}
	return itemSlotToBulkSimItemSlot.get(slot)!;
};

export const binomialCoefficient = (n: number, k: number): number => {
	if (Number.isNaN(n) || Number.isNaN(k)) return NaN;
	if (k < 0 || k > n) return 0;
	if (k === 0 || k === n) return 1;
	if (k === 1 || k === n - 1) return n;
	if (n - k < k) k = n - k;
	let res = n;
	for (let j = 2; j <= k; j++) res *= (n - j + 1) / j;
	return Math.round(res);
};

export function getAllPairs<T>(arr: T[]): [T, T][] {
	const pairs: [T, T][] = [];
	for (let i = 0; i < arr.length; i++) {
		for (let j = i + 1; j < arr.length; j++) {
			pairs.push([arr[i], arr[j]]);
		}
	}
	return pairs;
}

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
		const slots = bulkSimItemSlotToItemSlotPairs.get(bulkSlot)!;
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
	cachedOptimizedGearSets: Gear[];
	cacheKeysByCandidateIndex: Map<number, string>;
};

export type BulkSimReforgeCacheProgress = {
	processedCandidates: number;
	totalCandidates: number;
	restoredCandidates: number;
};

export type BulkSimReforgeCacheContext = {
	player: Player<any>;
	gearSets: Gear[];
	db: Database;
	reforgeRequest: ReforgeOptimizeRequest;
	raidBuffs: RaidBuffs;
	partyBuffs: PartyBuffs | undefined;
	debuffs: Debuffs;
	onProgress?: (progress: BulkSimReforgeCacheProgress) => void;
	signal?: AbortSignal;
};

export async function getBulkSimReforgeCacheData({
	player,
	gearSets,
	db,
	reforgeRequest,
	raidBuffs,
	partyBuffs,
	debuffs,
	onProgress,
	signal,
}: BulkSimReforgeCacheContext): Promise<BulkSimReforgeCacheData> {
	throwIfAborted(signal);

	const cache = ReforgeGearCache.get(player.getPlayerSpec());
	const configHash = await ReforgeOptimizer.getBulkSimReforgeCacheConfigHash({ player, reforgeRequest, raidBuffs, partyBuffs, debuffs });
	const totalCandidates = gearSets.length;
	onProgress?.({
		processedCandidates: 0,
		totalCandidates,
		restoredCandidates: 0,
	});

	let lastYieldAt = performance.now();

	const candidates: BulkGearCandidate[] = [];
	const optimizedCandidates: BulkGearCandidate[] = [];
	const cachedOptimizedGearSets: Gear[] = [];
	const cacheKeysByCandidateIndex = new Map<number, string>();
	const pendingEntries: Array<{ index: number; gear: Gear; cacheKey: string }> = [];

	let processedCandidates = 0;
	let restoredCandidates = 0;

	const flushPendingEntries = async () => {
		if (!pendingEntries.length) {
			return;
		}

		const cachedGearByKey = await cache.getMany(
			pendingEntries.map(entry => entry.cacheKey),
			signal,
		);
		for (const entry of pendingEntries) {
			throwIfAborted(signal);
			const cachedGear = cachedGearByKey.get(entry.cacheKey);
			if (cachedGear) {
				optimizedCandidates.push(BulkGearCandidate.create({ index: entry.index, gear: cachedGear }));
				cachedOptimizedGearSets.push(db.lookupEquipmentSpec(cachedGear));
				restoredCandidates++;
			} else {
				candidates.push(BulkGearCandidate.create({ index: entry.index, gear: entry.gear.asSpec() }));
				cacheKeysByCandidateIndex.set(entry.index, entry.cacheKey);
			}

			processedCandidates++;
			if (processedCandidates % BULK_CACHE_PROGRESS_CHECK_MODULO === 0 || processedCandidates === totalCandidates) {
				const now = performance.now();
				if (processedCandidates === totalCandidates || now - lastYieldAt >= BULK_CACHE_YIELD_BUDGET_MS) {
					onProgress?.({
						processedCandidates,
						totalCandidates,
						restoredCandidates,
					});
					await sleep(0);
					lastYieldAt = performance.now();
				}
			}
		}

		pendingEntries.length = 0;
	};

	for (let i = 0; i < totalCandidates; i++) {
		throwIfAborted(signal);
		const gear = gearSets[i];
		const cacheKey = await ReforgeGearCache.getKey(gear.asSpec(), configHash);
		pendingEntries.push({ index: i, gear, cacheKey });

		if (pendingEntries.length >= BULK_CACHE_LOOKUP_BATCH_SIZE || i + 1 === totalCandidates) {
			await flushPendingEntries();
		}
	}

	return { cache, candidates, optimizedCandidates, cachedOptimizedGearSets, cacheKeysByCandidateIndex };
}

export async function writeBulkSimReforgeCacheResults(optimizedCandidates: BulkGearCandidate[], cacheData: BulkSimReforgeCacheData): Promise<void> {
	const cacheEntries = optimizedCandidates.flatMap(candidate => {
		const cacheKey = cacheData.cacheKeysByCandidateIndex.get(candidate.index);
		if (!cacheKey || !candidate.gear) return [];
		return [{ key: cacheKey, optimizedGear: candidate.gear }];
	});
	await cacheData.cache.setGearMany(cacheEntries);
}

export const throwIfAborted = (signal?: AbortSignal, errorMessage = 'Bulk Sim Aborted'): void => {
	if (signal?.aborted) {
		throw new Error(errorMessage);
	}
};

import type { Player } from '../../../player';
import { ReforgeOptimizer } from '../../suggest_reforges_action';
import { ReforgeGearCache } from '../../../reforge_cache';
import { BulkGearCandidate, BulkSimResult, BulkSimStage, DistributionMetrics, ReforgeOptimizeMode, ReforgeOptimizeRequest } from '../../../proto/api';
import { Class, Debuffs, EquipmentSpec, ItemRandomSuffix, ItemSlot, ItemSpec, PartyBuffs, RaidBuffs, ReforgeStat, WeaponType } from '../../../proto/common';
import { ItemEffectRandPropPoints, SimDatabase, SimEnchant, SimGem, SimItem } from '../../../proto/db';
import { UIEnchant as Enchant, UIGem as Gem, UIItem as Item } from '../../../proto/ui';
import { Database } from '../../../proto_utils/database';
import { EquippedItem } from '../../../proto_utils/equipped_item';
import { Gear } from '../../../proto_utils/gear';
import { getGearKeyFromSpec } from '../../../proto_utils/utils';
import { isSpecDualWieldCapable } from '../../../player_classes/capabilities';
import { sleep } from '../../../utils';
import { OptimisationStage, STAGE_CONFIG } from './types';
import {
	BULK_SIM_ITEM_SLOT_TO_ITEM_SLOT_PAIRS,
	BULK_SIM_ITEM_SLOT_TO_SINGLE_ITEM_SLOT,
	BulkSimItemSlot,
	ITEM_SLOT_TO_BULK_SIM_ITEM_SLOT,
} from './constants_auto_gen';

export { BulkSimItemSlot, ITEM_SLOT_TO_BULK_SIM_ITEM_SLOT, BULK_SIM_ITEM_SLOT_TO_SINGLE_ITEM_SLOT, BULK_SIM_ITEM_SLOT_TO_ITEM_SLOT_PAIRS };

const BULK_CACHE_LOOKUP_BATCH_SIZE = 2000;
const BULK_CACHE_PROGRESS_CHECK_MODULO = 64;
const BULK_CACHE_YIELD_BUDGET_MS = 16;

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

export const getBulkFreezeWeaponTypes = (player: Player<any>, slot: ItemSlot.ItemSlotMainHand | ItemSlot.ItemSlotOffHand): WeaponType[] => {
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

export const cleanBulkDpsMetrics = (dpsMetrics: DistributionMetrics): DistributionMetrics => {
	dpsMetrics.hist = [];
	dpsMetrics.allValues = [];
	return dpsMetrics;
};

export const dedupeGearSets = (gearSets: Gear[], existingGearSets: Gear[] = []): Gear[] => {
	const seenGearKeys = new Set<string>();
	for (let i = 0; i < existingGearSets.length; i++) {
		seenGearKeys.add(getGearKeyFromSpec(existingGearSets[i].asSpec()));
	}

	const deduped: Gear[] = [];
	for (let i = 0; i < gearSets.length; i++) {
		const gear = gearSets[i];
		const gearKey = getGearKeyFromSpec(gear.asSpec());
		if (seenGearKeys.has(gearKey)) {
			continue;
		}
		seenGearKeys.add(gearKey);
		deduped.push(gear);
	}

	return deduped;
};

export const shouldRunOptimisationStage = (stage: OptimisationStage, candidateCount: number): boolean => {
	const maxSurvivors = STAGE_CONFIG[stage].maxSurvivors;
	return maxSurvivors === undefined || candidateCount > maxSurvivors;
};

export const getOptimisationStageMinIterations = (stage: OptimisationStage, highStageIterations: number): number =>
	STAGE_CONFIG[stage].minIterations ?? highStageIterations;

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

export const makeBulkGearDatabase = (db: Database, gearSets: Gear[], extraItems: EquippedItem[] = []): SimDatabase => {
	const items = new Map<number, Item>();
	const randomSuffixes = new Map<number, ItemRandomSuffix>();
	const reforgeStats = new Map<number, ReforgeStat>();
	const itemEffectRandPropPoints = new Map<number, ItemEffectRandPropPoints>();
	const enchants = new Map<number, Enchant>();
	const gems = new Map<number, Gem>();

	const addEquippedItem = (equippedItem: EquippedItem) => {
		const item = equippedItem.item;
		items.set(item.id, item);

		const randomSuffix = equippedItem.randomSuffix;
		if (randomSuffix) randomSuffixes.set(randomSuffix.id, randomSuffix);

		const itemReforge = equippedItem.reforge;
		if (itemReforge) {
			const reforge = db.getReforgeById(itemReforge.id);
			if (reforge) reforgeStats.set(reforge.id, reforge);
		}

		const scalingIlvls = new Set([equippedItem.ilvl]);
		Object.values(item.scalingOptions ?? {}).forEach(opt => {
			if (opt?.ilvl) scalingIlvls.add(opt.ilvl);
		});
		scalingIlvls.forEach(ilvl => {
			const rpp = db.getItemEffectRandPropPoints(ilvl);
			if (rpp) itemEffectRandPropPoints.set(rpp.ilvl, rpp);
		});

		const enchant = equippedItem.enchant;
		if (enchant) enchants.set(enchant.effectId, enchant);

		const tinker = equippedItem.tinker;
		if (tinker) enchants.set(tinker.effectId, tinker);

		for (const gem of equippedItem.gems) {
			if (gem) gems.set(gem.id, gem);
		}
	};

	for (const gearSet of gearSets) {
		for (const equippedItem of gearSet.asArray()) {
			if (equippedItem) addEquippedItem(equippedItem);
		}
	}
	for (const equippedItem of extraItems) {
		addEquippedItem(equippedItem);
	}

	return SimDatabase.create({
		items: Array.from(items.values()).map(item => SimItem.fromJson(Item.toJson(item), { ignoreUnknownFields: true })),
		randomSuffixes: Array.from(randomSuffixes.values()),
		reforgeStats: Array.from(reforgeStats.values()),
		itemEffectRandPropPoints: Array.from(itemEffectRandPropPoints.values()),
		enchants: Array.from(enchants.values()).map(enchant => SimEnchant.fromJson(Enchant.toJson(enchant), { ignoreUnknownFields: true })),
		gems: Array.from(gems.values()).map(gem => SimGem.fromJson(Gem.toJson(gem), { ignoreUnknownFields: true })),
	});
};

export const makeBulkItemDatabaseFromSpecs = (db: Database, baselineGear: Gear, itemSpecs: readonly ItemSpec[]): SimDatabase => {
	const extraItems = itemSpecs
		.map(itemSpec => (itemSpec ? db.lookupItemSpec(itemSpec) : null))
		.filter((item): item is EquippedItem => item != null);
	return makeBulkGearDatabase(db, [baselineGear], extraItems);
};

type BulkSimReforgeCacheData = {
	cache: ReforgeGearCache;
	candidates: BulkGearCandidate[];
	optimizedCandidates: BulkGearCandidate[];
	cachedOptimizedGearSets: Gear[];
	cacheKeysByCandidateIndex: Map<number, string>;
};

export type BulkSimReforgeCacheProgress = {
	stage?: 'candidate-build' | 'cache-restore';
	processedCandidates: number;
	totalCandidates: number;
	restoredCandidates: number;
};

type BulkSimReforgeCacheContext = {
	player: Player<any>;
	gearSets?: Gear[];
	candidateSpecs?: EquipmentSpec[];
	candidateGearKeys?: string[];
	candidateIndices?: number[];
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
	candidateSpecs,
	candidateGearKeys,
	candidateIndices,
	db,
	reforgeRequest,
	raidBuffs,
	partyBuffs,
	debuffs,
	onProgress,
	signal,
}: BulkSimReforgeCacheContext): Promise<BulkSimReforgeCacheData> {
	throwIfAborted(signal);
	if (!gearSets && !candidateSpecs) {
		throw new Error('Either gearSets or candidateSpecs must be provided for cache restore.');
	}

	const cache = ReforgeGearCache.get(player.getPlayerSpec());
	const configHash = await ReforgeOptimizer.getConfigHash({ player, reforgeRequest, raidBuffs, partyBuffs, debuffs });
	const frozenItemSlots =
		reforgeRequest.settings?.freezeItemSlots && reforgeRequest.settings.frozenItemSlots.length ? reforgeRequest.settings.frozenItemSlots : undefined;
	const totalCandidates = candidateSpecs?.length ?? gearSets!.length;
	onProgress?.({
		stage: 'cache-restore',
		processedCandidates: 0,
		totalCandidates,
		restoredCandidates: 0,
	});

	let lastYieldAt = performance.now();

	const candidates: BulkGearCandidate[] = [];
	const optimizedCandidates: BulkGearCandidate[] = [];
	const cachedOptimizedGearSets: Gear[] = [];
	const cacheKeysByCandidateIndex = new Map<number, string>();
	const pendingEntries: Array<{ index: number; spec: EquipmentSpec; cacheKey: string }> = [];

	let processedCandidates = 0;
	let restoredCandidates = 0;
	const shouldLookupCache = await cache.hasEntries();

	const flushPendingEntries = async () => {
		if (!pendingEntries.length) {
			return;
		}

		const cachedGearByKey = shouldLookupCache
			? await cache.getMany(
					pendingEntries.map(entry => entry.cacheKey),
					signal,
				)
			: new Map<string, EquipmentSpec>();
		for (const entry of pendingEntries) {
			throwIfAborted(signal);
			const cachedGear = cachedGearByKey.get(entry.cacheKey);
			if (cachedGear) {
				optimizedCandidates.push(BulkGearCandidate.create({ index: entry.index, gear: cachedGear }));
				cachedOptimizedGearSets.push(db.lookupEquipmentSpec(cachedGear));
				restoredCandidates++;
			} else {
				candidates.push(BulkGearCandidate.create({ index: entry.index, gear: entry.spec }));
				cacheKeysByCandidateIndex.set(entry.index, entry.cacheKey);
			}

			processedCandidates++;
			if (processedCandidates % BULK_CACHE_PROGRESS_CHECK_MODULO === 0 || processedCandidates === totalCandidates) {
				const now = performance.now();
				if (processedCandidates === totalCandidates || now - lastYieldAt >= BULK_CACHE_YIELD_BUDGET_MS) {
					onProgress?.({
						stage: 'cache-restore',
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
		const spec = candidateSpecs?.[i] ?? gearSets![i].asSpec();
		const gearKey = candidateGearKeys?.[i] ?? getGearKeyFromSpec(gearSets![i].asSpec(), frozenItemSlots);
		const candidateIndex = candidateIndices?.[i] ?? i;
		const cacheKey = await ReforgeGearCache.getKey(gearKey, configHash);
		pendingEntries.push({ index: candidateIndex, spec, cacheKey });

		if (pendingEntries.length >= BULK_CACHE_LOOKUP_BATCH_SIZE || i + 1 === totalCandidates) {
			await flushPendingEntries();
		}
	}

	return { cache, candidates, optimizedCandidates, cachedOptimizedGearSets, cacheKeysByCandidateIndex };
}

export async function writeBulkSimReforgeCacheResults(optimizedCandidates: BulkGearCandidate[], cacheData: BulkSimReforgeCacheData): Promise<void> {
	const cacheEntries: Array<{ key: string; optimizedGear: EquipmentSpec }> = [];
	for (let i = 0; i < optimizedCandidates.length; i++) {
		const candidate = optimizedCandidates[i];
		const cacheKey = cacheData.cacheKeysByCandidateIndex.get(candidate.index);
		if (!cacheKey || !candidate.gear) {
			continue;
		}
		cacheEntries.push({ key: cacheKey, optimizedGear: candidate.gear });
	}
	await cacheData.cache.setGearMany(cacheEntries);
}

export const throwIfAborted = (signal?: AbortSignal, errorMessage = 'Bulk Sim Aborted'): void => {
	if (signal?.aborted) {
		throw new Error(errorMessage);
	}
};

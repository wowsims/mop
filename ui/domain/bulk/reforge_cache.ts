// The reforge cache the bulk sim fills and reads back: which candidates already
// have optimized gear, and the yield budget that keeps the pass responsive.
import { BulkGearCandidate, ReforgeOptimizeRequest } from '@generated/proto/api';
import { Debuffs, EquipmentSpec, PartyBuffs, RaidBuffs } from '@generated/proto/common';

import type { Player } from '../player';
import { Database } from '../proto_utils/database';
import { Gear } from '../proto_utils/gear';
import { getReforgeCacheGearKey } from '../proto_utils/items';
import { ReforgeGearCache } from '../reforge_cache';
import { getReforgeConfigHash } from '../state/reforge_request';
import { sleep } from '../utils';
import { throwIfAborted } from './utils';

const BULK_CACHE_LOOKUP_BATCH_SIZE = 2000;

type BulkSimReforgeCacheData = {
	cache: ReforgeGearCache;
	candidates: BulkGearCandidate[];
	optimizedCandidates: BulkGearCandidate[];
	cachedOptimizedGearSets: Gear[];
	cacheKeysByCandidateIndex: Map<number, string>;
};
export const BULK_CACHE_PROGRESS_CHECK_MODULO = 64;
export const BULK_CACHE_YIELD_BUDGET_MS = 16;

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

	const cache = ReforgeGearCache.get(player.getPlayerSpec(), player.sim.env);
	const configHash = await getReforgeConfigHash({ player, reforgeRequest, raidBuffs, partyBuffs, debuffs });
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
		const gearKey = candidateGearKeys?.[i] ?? getReforgeCacheGearKey(spec, frozenItemSlots);
		const candidateIndex = candidateIndices?.[i] ?? i;
		const cacheKey = ReforgeGearCache.getKey(gearKey, configHash);
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

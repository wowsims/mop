import { BulkGearCandidate, BulkSimRequest, BulkSimStage, ReforgeOptimizeMode, ReforgeOptimizeRequest } from '../../proto/api';
import { EquipmentSpec } from '../../proto/common';
import { SimSignals } from '../../sim_signal_manager';
import { WorkerPool, WorkerProgressCallback } from '../../worker_pool';
import { optimizeReforgeGear, reforgeGearKey } from '../reforge_optimizer';
import { queue } from 'async';
import { makeBulkSimStageProgressEmitter } from './progress';
import { BulkSimReforgeCandidateTask } from './types';

export const optimizeReforgeCandidates = async (
	request: BulkSimRequest,
	workerPool: WorkerPool,
	onProgress: WorkerProgressCallback,
	signals: SimSignals,
	onReforgeCandidateOptimized?: (candidate: BulkGearCandidate, optimizedGear: EquipmentSpec) => void | Promise<void>,
): Promise<{ request: BulkSimRequest; aborted: boolean }> => {
	const reforgeRequest = request.reforgeRequest;
	if (!reforgeRequest || !request.baseRequest?.raid) {
		return { request, aborted: false };
	}

	const candidates = request.candidates.filter(candidate => candidate.gear);
	const optimizedCandidates: BulkGearCandidate[] = request.optimizedCandidates.map(candidate => BulkGearCandidate.clone(candidate));
	if (!candidates.length) {
		return {
			request: BulkSimRequest.create({
				...request,
				candidates: dedupeBulkSimReforgeCandidates(request, optimizedCandidates),
				optimizedCandidates: [],
				reforgeRequest: undefined,
			}),
			aborted: false,
		};
	}

	const startedAt = new Date().getTime();
	const concurrency = Math.max(1, Math.min(workerPool.getNumWorkers(), candidates.length));
	console.log(`[Bulk Sim] Reforge optimization started candidates=${candidates.length} concurrency=${concurrency} wasm=true`);
	const emitter = makeBulkSimStageProgressEmitter(onProgress, BulkSimStage.BulkSimStageReforge, candidates.length, candidates.length);
	emitter.report(0, 0, 0);

	const gearCache = makeBulkSimReforgeGearCache(request, reforgeRequest, workerPool, signals);
	const collector = makeBulkSimReforgeCollector(request.baseRequest.raid.parties[0]?.players[0]?.equipment);
	const includeGems = reforgeRequest.settings?.includeGems ?? false;

	const reforgeQueue = queue<BulkSimReforgeCandidateTask, Error>(async ({ candidate, position }) => {
		if (signals.abort.isTriggered()) return;
		if (!candidate.gear) return;

		// Retry without gems: a gem-inclusive model can be infeasible where the
		// reforge-only one is not.
		let optimizedGear = await gearCache.optimize(candidate.gear, includeGems);
		if (!optimizedGear && !signals.abort.isTriggered() && includeGems) {
			optimizedGear = await gearCache.optimize(candidate.gear, false);
		}
		const optimizedSuccessfully = !!optimizedGear;
		if (!optimizedGear) {
			if (signals.abort.isTriggered()) return;
			console.warn(`[Bulk Sim] Reforge optimization failed for candidate ${candidate.index}; using original gear`);
			optimizedGear = candidate.gear;
		}

		const completedCandidates = collector.record(candidate, optimizedGear, position);
		if (optimizedSuccessfully) {
			await onReforgeCandidateOptimized?.(candidate, optimizedGear);
		}
		emitter.report(completedCandidates, completedCandidates, 0);
	}, concurrency);

	const queueErrorPromise = reforgeQueue.error();
	candidates.forEach((candidate, position) => reforgeQueue.push({ candidate, position }));
	await Promise.race([reforgeQueue.drain(), queueErrorPromise]);
	if (signals.abort.isTriggered()) {
		return { request: buildBulkSimReforgeRequest(request, optimizedCandidates, collector.completed(), true), aborted: true };
	}

	const outputCandidates = optimizedCandidates.length + collector.completed().length;
	console.log(
		`[Bulk Sim] Reforge optimization completed candidates=${collector.completedCount()} outputCandidates=${outputCandidates} total=${formatBulkSimReforgeDuration(startedAt)}`,
	);

	return {
		request: buildBulkSimReforgeRequest(request, optimizedCandidates, collector.completed(), false),
		aborted: false,
	};
};

const dedupeBulkSimReforgeCandidates = (request: BulkSimRequest, candidates: BulkGearCandidate[]): BulkGearCandidate[] => {
	const seenGearKeys = new Set<string>();
	const baselineGear = request.baseRequest?.raid?.parties[0]?.players[0]?.equipment;
	if (baselineGear) {
		seenGearKeys.add(reforgeGearKey(baselineGear));
	}

	const deduped: BulkGearCandidate[] = [];
	for (const candidate of candidates) {
		if (!candidate.gear) continue;

		const gearKey = reforgeGearKey(candidate.gear);
		if (seenGearKeys.has(gearKey)) continue;

		seenGearKeys.add(gearKey);
		deduped.push(BulkGearCandidate.clone(candidate));
	}
	return deduped;
};

// Caches optimizer results by gear key and de-duplicates concurrent work: candidates
// with identical input gear share one solve instead of each running their own.
type BulkSimReforgeGearCache = {
	optimize: (gear: EquipmentSpec, includeGems: boolean) => Promise<EquipmentSpec | null>;
};

const makeBulkSimReforgeGearCache = (
	request: BulkSimRequest,
	templateRequest: ReforgeOptimizeRequest,
	workerPool: WorkerPool,
	signals: SimSignals,
): BulkSimReforgeGearCache => {
	const optimizedGearByKey = new Map<string, EquipmentSpec | null>();
	const inFlightOptimizedGearByKey = new Map<string, Promise<EquipmentSpec | null>>();

	return {
		optimize: async (gear: EquipmentSpec, includeGems: boolean): Promise<EquipmentSpec | null> => {
			const cacheKey = `${reforgeGearKey(gear)}:${includeGems ? 1 : 0}`;
			if (optimizedGearByKey.has(cacheKey)) {
				const cachedGear = optimizedGearByKey.get(cacheKey);
				return cachedGear ? EquipmentSpec.clone(cachedGear) : null;
			}
			const inFlightGear = inFlightOptimizedGearByKey.get(cacheKey);
			if (inFlightGear) {
				const optimizedGear = await inFlightGear;
				return optimizedGear ? EquipmentSpec.clone(optimizedGear) : null;
			}

			const baseRaid = request.baseRequest?.raid;
			if (!baseRaid) {
				optimizedGearByKey.set(cacheKey, null);
				return null;
			}

			const optimizePromise = optimizeReforgeGear(
				baseRaid,
				templateRequest,
				gear,
				includeGems,
				workerPool,
				signals,
				ReforgeOptimizeMode.ReforgeOptimizeModeBulk,
			);
			inFlightOptimizedGearByKey.set(cacheKey, optimizePromise);
			try {
				const optimizedGear = await optimizePromise;
				optimizedGearByKey.set(cacheKey, optimizedGear ? EquipmentSpec.clone(optimizedGear) : null);
				return optimizedGear ? EquipmentSpec.clone(optimizedGear) : null;
			} finally {
				inFlightOptimizedGearByKey.delete(cacheKey);
			}
		},
	};
};

// Collects optimized candidates, keeping the first occurrence of each distinct gear set
// (the baseline counts as already seen) and preserving input order.
const makeBulkSimReforgeCollector = (baselineGear: EquipmentSpec | undefined) => {
	const seenGearKeys = new Set<string>();
	if (baselineGear) {
		seenGearKeys.add(reforgeGearKey(baselineGear));
	}
	const completedByPosition: Array<BulkGearCandidate | undefined> = [];
	let completedCandidates = 0;

	return {
		record: (candidate: BulkGearCandidate, optimizedGear: EquipmentSpec, position: number): number => {
			const gearKey = reforgeGearKey(optimizedGear);
			if (!seenGearKeys.has(gearKey)) {
				seenGearKeys.add(gearKey);
				completedByPosition[position] = BulkGearCandidate.create({ index: candidate.index, gear: optimizedGear });
			}
			completedCandidates++;
			return completedCandidates;
		},
		completed: (): BulkGearCandidate[] => completedByPosition.filter((candidate): candidate is BulkGearCandidate => !!candidate),
		completedCount: (): number => completedCandidates,
	};
};

// The request the bulk sim proceeds with: reforged candidates, deduplicated, with the
// reforge pre-pass removed. An aborted run also reports them so the frontend can still
// write its cache entries.
const buildBulkSimReforgeRequest = (
	request: BulkSimRequest,
	optimizedCandidates: BulkGearCandidate[],
	completedCandidates: BulkGearCandidate[],
	aborted: boolean,
): BulkSimRequest => {
	const partialOptimizedCandidates = dedupeBulkSimReforgeCandidates(request, [...optimizedCandidates, ...completedCandidates]);
	return BulkSimRequest.create({
		...request,
		candidates: partialOptimizedCandidates,
		optimizedCandidates: aborted ? partialOptimizedCandidates.map(candidate => BulkGearCandidate.clone(candidate)) : [],
		reforgeRequest: undefined,
	});
};

const formatBulkSimReforgeDuration = (startedAt: number): string => {
	return `${((new Date().getTime() - startedAt) / 1000).toFixed(2)}s`;
};

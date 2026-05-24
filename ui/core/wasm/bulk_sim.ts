import {
	BulkGearCandidate,
	BulkGearResult,
	BulkSimRequest,
	BulkSimResult,
	BulkSimStage,
	BulkSimStageMetrics,
	BulkSimTimings,
	DistributionMetrics,
	ErrorOutcome,
	ErrorOutcomeType,
	ProgressMetrics,
	RaidSimRequest,
	ReforgeOptimizeMode,
	ReforgeOptimizeRequest,
} from '../proto/api';
import { EquipmentSpec, ItemRandomSuffix, ReforgeStat } from '../proto/common';
import { ItemEffectRandPropPoints, SimDatabase, SimEnchant, SimGem, SimItem } from '../proto/db';
import { UIEnchant as Enchant, UIGem as Gem, UIItem as Item } from '../proto/ui';
import { Database } from '../proto_utils/database';
import { Gear } from '../proto_utils/gear';
import { SimSignals } from '../sim_signal_manager';
import { isDevMode, noop } from '../utils';
import { WorkerPool, WorkerProgressCallback } from '../worker_pool';
import { optimizeReforgeGear, reforgeGearKey } from './reforge_optimizer';
import { runConcurrentSim } from './sim';

const BULK_SIM_DEFAULT_TOP_RESULTS = 5;
const BULK_SIM_MIN_COMBINATIONS = 20;
const BULK_SIM_CULLING_COEFFICIENT = 1.35;
const BULK_SIM_COMBINATION_LOG_MIN = 10;
const BULK_SIM_MAX_ADAPTIVE_PASSES = 2;
const BULK_SIM_ADAPTIVE_MAX_ITERATION_MULTIPLIER = 4;
const BULK_SIM_SURVIVOR_SOFT_CAP_MULTIPLIER = 2;

export const makeBulkGearDatabase = (db: Database, gearSets: Gear[]): SimDatabase => {
	const items = new Map<number, Item>();
	const randomSuffixes = new Map<number, ItemRandomSuffix>();
	const reforgeStats = new Map<number, ReforgeStat>();
	const itemEffectRandPropPoints = new Map<number, ItemEffectRandPropPoints>();
	const enchants = new Map<number, Enchant>();
	const gems = new Map<number, Gem>();

	for (const gearSet of gearSets) {
		for (const equippedItem of gearSet.asArray()) {
			if (!equippedItem) continue;

			const item = equippedItem.item;
			items.set(item.id, item);

			const randomSuffix = equippedItem.randomSuffix;
			if (randomSuffix) {
				randomSuffixes.set(randomSuffix.id, randomSuffix);
			}

			const itemReforge = equippedItem.reforge;
			if (itemReforge) {
				const reforge = db.getReforgeById(itemReforge.id);
				if (reforge) reforgeStats.set(reforge.id, reforge);
			}

			const randPropPoints = db.getItemEffectRandPropPoints(equippedItem.ilvl);
			if (randPropPoints) {
				itemEffectRandPropPoints.set(randPropPoints.ilvl, randPropPoints);
			}

			const enchant = equippedItem.enchant;
			if (enchant) {
				enchants.set(enchant.effectId, enchant);
			}

			const tinker = equippedItem.tinker;
			if (tinker) {
				enchants.set(tinker.effectId, tinker);
			}

			for (const gem of equippedItem.gems) {
				if (gem) gems.set(gem.id, gem);
			}
		}
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

type ConcurrentBulkSimCandidate = {
	index: number;
	gear: EquipmentSpec;
};

type ConcurrentBulkSimCandidateResult = {
	candidate: ConcurrentBulkSimCandidate;
	dpsMetrics?: DistributionMetrics;
	error?: ErrorOutcome;
};

type ConcurrentBulkSimStageConfig = {
	stage: BulkSimStage;
	minIterations?: number;
	targetErrorPct: number;
	minSurvivors?: number;
	maxSurvivors?: number;
	cullingCoefficient?: number;
};

type ConcurrentBulkSimStageResult = {
	baseline?: ConcurrentBulkSimCandidateResult;
	results: ConcurrentBulkSimCandidateResult[];
	iterations: number;
	metrics: BulkSimStageMetrics;
};

const bulkSimStageConfigs: ConcurrentBulkSimStageConfig[] = [
	{
		stage: BulkSimStage.BulkSimStageLow,
		minIterations: 100,
		targetErrorPct: 1,
		minSurvivors: 20,
		maxSurvivors: 100,
		cullingCoefficient: BULK_SIM_CULLING_COEFFICIENT,
	},
	{
		stage: BulkSimStage.BulkSimStageMedium,
		minIterations: 1000,
		targetErrorPct: 0.2,
		minSurvivors: 5,
		maxSurvivors: 25,
		cullingCoefficient: BULK_SIM_CULLING_COEFFICIENT,
	},
	{
		stage: BulkSimStage.BulkSimStageHigh,
		minIterations: 1000,
		targetErrorPct: 0.05,
	},
];

const makeAndSendBulkSimError = (err: string | ErrorOutcome, onProgress: WorkerProgressCallback, optimizedCandidates: BulkGearCandidate[] = []): BulkSimResult => {
	const errRes = BulkSimResult.create();
	errRes.optimizedCandidates = optimizedCandidates.map(candidate => BulkGearCandidate.clone(candidate));
	if (typeof err === 'string') {
		console.error(err);
		errRes.error = ErrorOutcome.create({ message: err });
	} else {
		if (err.message) console.error(err.message);
		errRes.error = err;
	}
	onProgress(ProgressMetrics.create({ bulkStage: BulkSimStage.BulkSimStageError, finalBulkSimResult: errRes }));
	return errRes;
};

const validateBulkSimRequest = (request: BulkSimRequest): string => {
	if (!request) return '[Bulk sim] Request is empty';
	if (!request.baseRequest) return '[Bulk sim] Base request is empty';
	if (!request.baseRequest.raid) return '[Bulk sim] Raid is empty';
	if (!request.baseRequest.simOptions) return '[Bulk sim] Sim options are empty';
	const player = request.baseRequest.raid.parties[0]?.players[0];
	if (!player || !player.class) return '[Bulk Sim] First player is empty';
	if (!player.equipment) return '[Bulk sim] Baseline gear is empty';
	return '';
};

const getBulkSimBaselineGear = (request: BulkSimRequest) => request.baseRequest!.raid!.parties[0].players[0].equipment!;

const shouldRunBulkSimStage = (config: ConcurrentBulkSimStageConfig, candidateCount: number): boolean =>
	config.maxSurvivors === undefined ||
	candidateCount > config.maxSurvivors ||
	(candidateCount < BULK_SIM_MIN_COMBINATIONS && config.stage == BulkSimStage.BulkSimStageHigh);

const getBulkSimStageMinIterations = (request: BulkSimRequest, config: ConcurrentBulkSimStageConfig): number => {
	if (config.stage == BulkSimStage.BulkSimStageHigh && request.highStageIterations > 0) {
		return request.highStageIterations;
	}
	return config.minIterations ?? request.highStageIterations;
};

const getBulkSimStageIterations = (
	request: BulkSimRequest,
	config: ConcurrentBulkSimStageConfig,
	baselineMetrics: DistributionMetrics | undefined,
	candidateCount: number,
): number => {
	const minIterations = getBulkSimStageMinIterations(request, config);
	const targetIterations = getBulkSimTargetIterations(config.targetErrorPct, baselineMetrics, candidateCount);
	return Math.max(minIterations, targetIterations);
};

const getBulkSimTargetIterations = (targetErrorPct: number, metrics: DistributionMetrics | undefined, candidateCount: number): number => {
	if (!metrics || metrics.avg <= 0) return 0;

	const targetError = metrics.avg * (targetErrorPct / 100);
	if (targetError <= 0) return 0;

	const combinationMultiplier = bulkSimCombinationErrorMultiplier(candidateCount);
	return Math.ceil(Math.pow((metrics.stdev * combinationMultiplier) / targetError, 2));
};

const bulkSimStageLogName = (stage: BulkSimStage): string => {
	switch (stage) {
		case BulkSimStage.BulkSimStageLow:
			return 'low';
		case BulkSimStage.BulkSimStageMedium:
			return 'medium';
		case BulkSimStage.BulkSimStageHigh:
			return 'high';
		default:
			return BulkSimStage[stage] ?? String(stage);
	}
};

const formatBulkSimStageStart = (config: ConcurrentBulkSimStageConfig, candidateCount: number, minIterations: number): string => {
	return `- Stage: ${bulkSimStageLogName(config.stage)} - Starting
Sims:
  Candidates: ${candidateCount}
  Total runs: ${candidateCount + 1}-${candidateCount + 2} (baseline probe, optional baseline, candidates)
Stage config:
  Per-candidate concurrent sim: true
  Min iterations: ${minIterations}
  Target error: ${config.targetErrorPct.toFixed(2)}%`;
};

const formatBulkSimStageSummary = (status: string, metrics: BulkSimStageMetrics, completedSims: number): string => {
	return `- Stage: ${bulkSimStageLogName(metrics.stage)} - ${status}
Sims:
  Input gear sets: ${metrics.inputGearSets}
  Completed candidates: ${completedSims}
  Survivors: ${metrics.survivors}
Results:
  Iterations: ${metrics.iterations}
  Target error: ${metrics.targetErrorPct.toFixed(2)}%
  Observed error: ${metrics.observedErrorPct.toFixed(2)}%
  Best candidate DPS: ${metrics.bestCandidateAvgDps.toFixed(2)}
  Baseline DPS: ${metrics.baselineAvgDps.toFixed(2)}
Timing:
  Duration: ${metrics.durationSeconds.toFixed(2)}s`;
};

const emitBulkSimStageProgress = (
	onProgress: WorkerProgressCallback,
	bulkStage: BulkSimStage,
	completedSims: number,
	totalSims: number,
	completedIterations: number,
	totalIterations: number,
	dps: number,
) => {
	onProgress(
		ProgressMetrics.create({
			bulkStage,
			completedSims,
			totalSims,
			completedIterations,
			totalIterations,
			dps,
		}),
	);
};

const optimizeReforgeCandidates = async (
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
			request: BulkSimRequest.create({ ...request, candidates: dedupeBulkSimReforgeCandidates(request, optimizedCandidates), optimizedCandidates: [], reforgeRequest: undefined }),
			aborted: false,
		};
	}

	const startedAt = new Date().getTime();
	const concurrency = Math.max(1, Math.min(workerPool.getNumWorkers(), candidates.length));
	console.log(`[Bulk Sim] Reforge optimization started candidates=${candidates.length} concurrency=${concurrency} wasm=true`);
	emitBulkSimStageProgress(onProgress, BulkSimStage.BulkSimStageReforge, 0, candidates.length, 0, candidates.length, 0);

	const optimizedGearByKey = new Map<string, EquipmentSpec | null>();
	const inFlightOptimizedGearByKey = new Map<string, Promise<EquipmentSpec | null>>();
	const seenGearKeys = new Set<string>();
	const completedOptimizedCandidatesByPosition: Array<BulkGearCandidate | undefined> = [];
	const baselineGear = request.baseRequest.raid.parties[0]?.players[0]?.equipment;
	if (baselineGear) {
		seenGearKeys.add(reforgeGearKey(baselineGear));
	}

	let completedCandidates = 0;
	let nextCandidatePosition = 0;
	const completedOptimizedCandidates = () => completedOptimizedCandidatesByPosition.filter((candidate): candidate is BulkGearCandidate => !!candidate);
	const buildReforgeRequest = (aborted: boolean) => {
		const partialOptimizedCandidates = dedupeBulkSimReforgeCandidates(request, [...optimizedCandidates, ...completedOptimizedCandidates()]);
		return BulkSimRequest.create({
			...request,
			candidates: partialOptimizedCandidates,
			optimizedCandidates: aborted ? partialOptimizedCandidates.map(candidate => BulkGearCandidate.clone(candidate)) : [],
			reforgeRequest: undefined,
		});
	};
	const optimizeWorker = async () => {
		while (!signals.abort.isTriggered()) {
			const position = nextCandidatePosition++;
			if (position >= candidates.length) return;

			const candidate = candidates[position];
			if (!candidate?.gear) continue;

			const includeGems = reforgeRequest.settings?.includeGems ?? false;
			let optimizedGear = await optimizeReforgeCandidate(request, reforgeRequest, candidate.gear, includeGems, optimizedGearByKey, inFlightOptimizedGearByKey, workerPool, signals);
			if (!optimizedGear && !signals.abort.isTriggered() && includeGems) {
				optimizedGear = await optimizeReforgeCandidate(request, reforgeRequest, candidate.gear, false, optimizedGearByKey, inFlightOptimizedGearByKey, workerPool, signals);
			}
			const optimizedSuccessfully = !!optimizedGear;
			if (!optimizedGear) {
				if (signals.abort.isTriggered()) return;
				console.warn(`[Bulk Sim] Reforge optimization failed for candidate ${candidate.index}; using original gear`);
				optimizedGear = candidate.gear;
			}

			const gearKey = reforgeGearKey(optimizedGear);
			if (!seenGearKeys.has(gearKey)) {
				seenGearKeys.add(gearKey);
				completedOptimizedCandidatesByPosition[position] = BulkGearCandidate.create({ index: candidate.index, gear: optimizedGear });
			}
			if (optimizedSuccessfully) {
				await onReforgeCandidateOptimized?.(candidate, optimizedGear);
			}

			completedCandidates++;
			emitBulkSimStageProgress(onProgress, BulkSimStage.BulkSimStageReforge, completedCandidates, candidates.length, completedCandidates, candidates.length, 0);
		}
	};

	await Promise.all(Array.from({ length: concurrency }, () => optimizeWorker()));
	if (signals.abort.isTriggered()) {
		return { request: buildReforgeRequest(true), aborted: true };
	}

	console.log(
		`[Bulk Sim] Reforge optimization completed candidates=${completedCandidates} outputCandidates=${optimizedCandidates.length + completedOptimizedCandidates().length} total=${formatBulkSimReforgeDuration(startedAt)}`,
	);

	return {
		request: buildReforgeRequest(false),
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

const optimizeReforgeCandidate = async (
	request: BulkSimRequest,
	templateRequest: ReforgeOptimizeRequest,
	gear: EquipmentSpec,
	includeGems: boolean,
	optimizedGearByKey: Map<string, EquipmentSpec | null>,
	inFlightOptimizedGearByKey: Map<string, Promise<EquipmentSpec | null>>,
	workerPool: WorkerPool,
	signals: SimSignals,
): Promise<EquipmentSpec | null> => {
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

	const optimizePromise = optimizeReforgeGear(baseRaid, templateRequest, gear, includeGems, workerPool, signals, ReforgeOptimizeMode.ReforgeOptimizeModeBulk);
	inFlightOptimizedGearByKey.set(cacheKey, optimizePromise);
	try {
		const optimizedGear = await optimizePromise;
		optimizedGearByKey.set(cacheKey, optimizedGear ? EquipmentSpec.clone(optimizedGear) : null);
		return optimizedGear ? EquipmentSpec.clone(optimizedGear) : null;
	} finally {
		inFlightOptimizedGearByKey.delete(cacheKey);
	}
};

const formatBulkSimReforgeDuration = (startedAt: number): string => {
	return `${((new Date().getTime() - startedAt) / 1000).toFixed(2)}s`;
};

const cleanBulkSimDpsMetrics = (metrics: DistributionMetrics | undefined): DistributionMetrics | undefined => {
	if (!metrics) return undefined;
	const cleaned = DistributionMetrics.clone(metrics);
	cleaned.hist = [];
	cleaned.allValues = [];
	return cleaned;
};

const makeBulkSimRequestForCandidate = (request: BulkSimRequest, candidate: ConcurrentBulkSimCandidate, iterations: number, seedOffset = 0): RaidSimRequest => {
	const simRequest = RaidSimRequest.clone(request.baseRequest!);
	simRequest.requestId = request.requestId;
	simRequest.simOptions!.iterations = iterations;
	simRequest.simOptions!.randomSeed += BigInt(seedOffset);
	simRequest.simOptions!.debugFirstIteration = false;
	simRequest.simOptions!.debug = false;
	simRequest.raid!.parties[0].players[0].equipment = candidate.gear;
	return simRequest;
};

const runSingleBulkSimConcurrent = async (
	request: BulkSimRequest,
	candidate: ConcurrentBulkSimCandidate,
	iterations: number,
	workerPool: WorkerPool,
	signals: SimSignals,
	progressCallback?: (progressMetrics: ProgressMetrics) => void,
	seedOffset = 0,
): Promise<ConcurrentBulkSimCandidateResult> => {
	if (signals.abort.isTriggered()) {
		return { candidate, error: ErrorOutcome.create({ type: ErrorOutcomeType.ErrorOutcomeAborted }) };
	}

	const simRequest = makeBulkSimRequestForCandidate(request, candidate, iterations, seedOffset);
	const simResult = await runConcurrentSim(simRequest, workerPool, progressCallback ?? noop, signals);
	if (simResult.error) {
		return { candidate, error: simResult.error };
	}

	return {
		candidate,
		dpsMetrics: cleanBulkSimDpsMetrics(simResult.raidMetrics?.dps),
	};
};

const bulkSimDpsError = (metrics: DistributionMetrics | undefined, iterations: number): number => {
	if (!metrics || iterations <= 0) return 0;
	return metrics.stdev / Math.sqrt(iterations);
};

const bulkSimCombinationErrorMultiplier = (candidateCount: number): number =>
	Math.sqrt(Math.max(1, Math.log10(Math.max(candidateCount, BULK_SIM_COMBINATION_LOG_MIN))));

const bulkSimSurvivorIntervalMultiplier = (candidateCount: number, cullingCoefficient: number): number =>
	cullingCoefficient * bulkSimCombinationErrorMultiplier(candidateCount);

const bulkSimObservedErrorPct = (metrics: DistributionMetrics | undefined, iterations: number, candidateCount: number): number => {
	if (!metrics || metrics.avg <= 0 || iterations <= 0) return 0;
	return (bulkSimDpsError(metrics, iterations) * bulkSimCombinationErrorMultiplier(candidateCount) * 100) / metrics.avg;
};

const bulkSimObservedStageErrorPct = (
	baseline: ConcurrentBulkSimCandidateResult | undefined,
	results: ConcurrentBulkSimCandidateResult[],
	iterations: number,
	candidateCount: number,
): number => {
	let observedErrorPct = bulkSimObservedErrorPct(baseline?.dpsMetrics, iterations, candidateCount);
	for (const result of results) {
		observedErrorPct = Math.max(observedErrorPct, bulkSimObservedErrorPct(result.dpsMetrics, iterations, candidateCount));
	}
	return observedErrorPct;
};

const getBulkSimStageTargetIterations = (
	targetErrorPct: number,
	baseline: ConcurrentBulkSimCandidateResult | undefined,
	results: ConcurrentBulkSimCandidateResult[],
	candidateCount: number,
): number => {
	let targetIterations = getBulkSimTargetIterations(targetErrorPct, baseline?.dpsMetrics, candidateCount);
	for (const result of results) {
		targetIterations = Math.max(targetIterations, getBulkSimTargetIterations(targetErrorPct, result.dpsMetrics, candidateCount));
	}
	return targetIterations;
};

const hasBulkSimStageError = (baseline: ConcurrentBulkSimCandidateResult | undefined, results: ConcurrentBulkSimCandidateResult[]): boolean => {
	return !!baseline?.error || results.some(result => !!result.error);
};

const adaptConcurrentBulkSimStageIterations = async (
	request: BulkSimRequest,
	candidates: ConcurrentBulkSimCandidate[],
	config: ConcurrentBulkSimStageConfig,
	workerPool: WorkerPool,
	onProgress: WorkerProgressCallback,
	signals: SimSignals,
	baseline: ConcurrentBulkSimCandidateResult,
	results: ConcurrentBulkSimCandidateResult[],
	iterations: number,
): Promise<{ baseline: ConcurrentBulkSimCandidateResult; results: ConcurrentBulkSimCandidateResult[]; iterations: number }> => {
	const maxAdaptiveIterations = Math.ceil(iterations * BULK_SIM_ADAPTIVE_MAX_ITERATION_MULTIPLIER);
	for (let adaptivePass = 1; adaptivePass <= BULK_SIM_MAX_ADAPTIVE_PASSES; adaptivePass++) {
		if (signals.abort.isTriggered() || hasBulkSimStageError(baseline, results)) return { baseline, results, iterations };

		const observedErrorPct = bulkSimObservedStageErrorPct(baseline, results, iterations, candidates.length);
		if (observedErrorPct <= config.targetErrorPct) return { baseline, results, iterations };

		let targetIterations = getBulkSimStageTargetIterations(config.targetErrorPct, baseline, results, candidates.length);
		targetIterations = Math.min(maxAdaptiveIterations, Math.max(iterations + 1, targetIterations));
		if (targetIterations <= iterations) return { baseline, results, iterations };

		if (isDevMode()) {
			console.log(`[Bulk Sim] - Stage: ${bulkSimStageLogName(config.stage)} - Adaptive pass ${adaptivePass}
Results:
  Current iterations: ${iterations}
  Additional iterations: ${targetIterations - iterations}
  Target iterations: ${targetIterations}
  Target error: ${config.targetErrorPct.toFixed(2)}%
  Observed error: ${observedErrorPct.toFixed(2)}%`);
		}

		const additionalIterations = targetIterations - iterations;
		const rerunResult = await rerunConcurrentBulkSimStageAdditionalIterations(
			request,
			candidates,
			config,
			workerPool,
			onProgress,
			signals,
			baseline,
			results,
			iterations,
			additionalIterations,
		);
		baseline = rerunResult.baseline;
		results = rerunResult.results;
		iterations = targetIterations;
	}
	return { baseline, results, iterations };
};

const rerunConcurrentBulkSimStageAdditionalIterations = async (
	request: BulkSimRequest,
	candidates: ConcurrentBulkSimCandidate[],
	config: ConcurrentBulkSimStageConfig,
	workerPool: WorkerPool,
	onProgress: WorkerProgressCallback,
	signals: SimSignals,
	baseline: ConcurrentBulkSimCandidateResult,
	results: ConcurrentBulkSimCandidateResult[],
	currentIterations: number,
	additionalIterations: number,
): Promise<{ baseline: ConcurrentBulkSimCandidateResult; results: ConcurrentBulkSimCandidateResult[] }> => {
	const totalSims = candidates.length + 1;
	const totalIterations = totalSims * additionalIterations;
	emitBulkSimStageProgress(onProgress, config.stage, 0, totalSims, 0, totalIterations, 0);

	const baselineCandidate = { index: -1, gear: getBulkSimBaselineGear(request) };
	const baselineExtra = await runSingleBulkSimConcurrent(
		request,
		baselineCandidate,
		additionalIterations,
		workerPool,
		signals,
		progressMetrics => {
			if (progressMetrics.totalIterations == 0) return;
			emitBulkSimStageProgress(
				onProgress,
				config.stage,
				0,
				totalSims,
				Math.min(progressMetrics.completedIterations, additionalIterations),
				totalIterations,
				progressMetrics.dps,
			);
		},
		currentIterations,
	);
	if (baselineExtra.error) return { baseline: baselineExtra, results };
	baseline = mergeBulkSimCandidateResults(baseline, baselineExtra);
	emitBulkSimStageProgress(onProgress, config.stage, 1, totalSims, additionalIterations, totalIterations, baseline.dpsMetrics?.avg ?? 0);

	const additionalResults: ConcurrentBulkSimCandidateResult[] = [];
	let completedCandidateIterations = 0;
	for (const [idx, candidate] of candidates.entries()) {
		if (signals.abort.isTriggered()) break;

		const candidateResult = await runSingleBulkSimConcurrent(
			request,
			candidate,
			additionalIterations,
			workerPool,
			signals,
			progressMetrics => {
				if (progressMetrics.totalIterations == 0) return;
				emitBulkSimStageProgress(
					onProgress,
					config.stage,
					1 + idx,
					totalSims,
					additionalIterations + completedCandidateIterations + Math.min(progressMetrics.completedIterations, additionalIterations),
					totalIterations,
					progressMetrics.dps,
				);
			},
			currentIterations,
		);

		additionalResults.push(candidateResult);
		completedCandidateIterations += additionalIterations;
		emitBulkSimStageProgress(
			onProgress,
			config.stage,
			1 + idx + 1,
			totalSims,
			additionalIterations + completedCandidateIterations,
			totalIterations,
			candidateResult.dpsMetrics?.avg ?? 0,
		);

		if (candidateResult.error) {
			signals.abort.trigger();
			break;
		}
	}

	return { baseline, results: mergeBulkSimCandidateResultSlices(results, additionalResults) };
};

const mergeBulkSimCandidateResultSlices = (
	results: ConcurrentBulkSimCandidateResult[],
	additionalResults: ConcurrentBulkSimCandidateResult[],
): ConcurrentBulkSimCandidateResult[] => {
	const additionalByCandidate = new Map(additionalResults.map(result => [result.candidate.index, result]));
	return results.map(result => {
		const additionalResult = additionalByCandidate.get(result.candidate.index);
		return additionalResult ? mergeBulkSimCandidateResults(result, additionalResult) : result;
	});
};

const mergeBulkSimCandidateResults = (
	result: ConcurrentBulkSimCandidateResult,
	additionalResult: ConcurrentBulkSimCandidateResult,
): ConcurrentBulkSimCandidateResult => {
	if (result.error) return result;
	if (additionalResult.error) return additionalResult;

	return {
		candidate: result.candidate,
		dpsMetrics: mergeBulkSimDistributionMetrics(result.dpsMetrics, additionalResult.dpsMetrics),
	};
};

const mergeBulkSimDistributionMetrics = (
	metrics: DistributionMetrics | undefined,
	additionalMetrics: DistributionMetrics | undefined,
): DistributionMetrics | undefined => {
	if (!metrics) return additionalMetrics;
	if (!additionalMetrics) return metrics;

	const metricsAggregator = getBulkSimDistributionMetricsAggregatorData(metrics);
	const additionalAggregator = getBulkSimDistributionMetricsAggregatorData(additionalMetrics);
	const totalN = metricsAggregator.n + additionalAggregator.n;
	if (totalN <= 0) return DistributionMetrics.clone(metrics);

	const merged = DistributionMetrics.create({
		avg: (metrics.avg * metricsAggregator.n + additionalMetrics.avg * additionalAggregator.n) / totalN,
		max: metrics.max,
		maxSeed: metrics.maxSeed,
		min: metrics.min,
		minSeed: metrics.minSeed,
		hist: { ...metrics.hist },
		allValues: metrics.allValues.slice(),
		aggregatorData: {
			n: totalN,
			sumSq: metricsAggregator.sumSq + additionalAggregator.sumSq,
		},
	});

	if (additionalMetrics.max > merged.max) {
		merged.max = additionalMetrics.max;
		merged.maxSeed = additionalMetrics.maxSeed;
	}
	if (additionalMetrics.min == 0 || additionalMetrics.min < merged.min) {
		merged.min = additionalMetrics.min;
		merged.minSeed = additionalMetrics.minSeed;
	} else if (additionalMetrics.min == merged.min) {
		merged.minSeed = additionalMetrics.minSeed;
	}
	for (const [roundedDps, count] of Object.entries(additionalMetrics.hist)) {
		merged.hist[Number(roundedDps)] = (merged.hist[Number(roundedDps)] ?? 0) + count;
	}
	merged.allValues.push(...additionalMetrics.allValues);
	merged.stdev = Math.sqrt(Math.max(0, merged.aggregatorData!.sumSq / totalN - merged.avg * merged.avg));
	return merged;
};

const getBulkSimDistributionMetricsAggregatorData = (metrics: DistributionMetrics): { n: number; sumSq: number } => {
	if (metrics.aggregatorData && metrics.aggregatorData.n > 0) return metrics.aggregatorData;
	const n = 1;
	return {
		n,
		sumSq: (metrics.stdev * metrics.stdev + metrics.avg * metrics.avg) * n,
	};
};

const topBulkSimResults = (results: ConcurrentBulkSimCandidateResult[], limit: number): ConcurrentBulkSimCandidateResult[] => {
	if (limit <= 0 || results.length == 0) return [];
	return results
		.filter(result => result.dpsMetrics)
		.slice()
		.sort((a, b) => b.dpsMetrics!.avg - a.dpsMetrics!.avg)
		.slice(0, limit);
};

const selectBulkSimSurvivors = (
	results: ConcurrentBulkSimCandidateResult[],
	baseline: ConcurrentBulkSimCandidateResult,
	iterations: number,
	config: ConcurrentBulkSimStageConfig,
): ConcurrentBulkSimCandidate[] => {
	if (config.maxSurvivors === undefined || results.length <= config.maxSurvivors) {
		return results.map(result => result.candidate);
	}

	let bestMetrics = baseline.dpsMetrics;
	for (const result of results) {
		if (result.dpsMetrics && (!bestMetrics || result.dpsMetrics.avg > bestMetrics.avg)) {
			bestMetrics = result.dpsMetrics;
		}
	}

	const intervalMultiplier = bulkSimSurvivorIntervalMultiplier(results.length, config.cullingCoefficient ?? BULK_SIM_CULLING_COEFFICIENT);
	const bestLowerBound = (bestMetrics?.avg ?? 0) - bulkSimDpsError(bestMetrics, iterations) * intervalMultiplier;
	const meanSurvivors = topBulkSimResults(results, config.minSurvivors ?? 0);
	let survivors = meanSurvivors.slice();
	const seen = new Set(survivors.map(result => result.candidate.index));

	for (const result of results) {
		if (!result.dpsMetrics || seen.has(result.candidate.index)) continue;

		const candidateUpperBound = result.dpsMetrics.avg + bulkSimDpsError(result.dpsMetrics, iterations) * intervalMultiplier;
		if (candidateUpperBound < bestLowerBound) continue;

		survivors.push(result);
		seen.add(result.candidate.index);
	}

	const softMaxSurvivors = config.maxSurvivors * BULK_SIM_SURVIVOR_SOFT_CAP_MULTIPLIER;
	if (survivors.length > softMaxSurvivors) {
		survivors = topBulkSimResults(survivors, softMaxSurvivors);
	}

	return survivors.map(result => result.candidate);
};

const bulkSimCandidateResultToProto = (result: ConcurrentBulkSimCandidateResult | undefined): BulkGearResult | undefined => {
	if (!result) return undefined;
	return BulkGearResult.create({
		candidateIndex: result.candidate.index,
		gear: result.candidate.gear,
		dpsMetrics: result.dpsMetrics,
	});
};

const runConcurrentBulkSimStage = async (
	request: BulkSimRequest,
	candidates: ConcurrentBulkSimCandidate[],
	config: ConcurrentBulkSimStageConfig,
	workerPool: WorkerPool,
	onProgress: WorkerProgressCallback,
	signals: SimSignals,
): Promise<ConcurrentBulkSimStageResult> => {
	const startedAt = new Date().getTime();
	const minIterations = getBulkSimStageMinIterations(request, config);
	if (isDevMode()) {
		console.log(`[Bulk Sim] ${formatBulkSimStageStart(config, candidates.length, minIterations)}`);
	}
	const maxBaselineSims = 2;
	const maxTotalSims = candidates.length + maxBaselineSims;
	const probeTotalIterations = maxTotalSims * minIterations;
	emitBulkSimStageProgress(onProgress, config.stage, 0, maxTotalSims, 0, probeTotalIterations, 0);

	const baselineCandidate = { index: -1, gear: getBulkSimBaselineGear(request) };
	const baselineProbe = await runSingleBulkSimConcurrent(request, baselineCandidate, minIterations, workerPool, signals, progressMetrics => {
		if (progressMetrics.totalIterations == 0) return;
		emitBulkSimStageProgress(
			onProgress,
			config.stage,
			0,
			maxTotalSims,
			Math.min(progressMetrics.completedIterations, minIterations),
			probeTotalIterations,
			progressMetrics.dps,
		);
	});
	if (baselineProbe.error) {
		return {
			baseline: baselineProbe,
			results: [],
			iterations: minIterations,
			metrics: BulkSimStageMetrics.create({ stage: config.stage }),
		};
	}
	emitBulkSimStageProgress(onProgress, config.stage, 1, maxTotalSims, minIterations, probeTotalIterations, baselineProbe.dpsMetrics?.avg ?? 0);

	const iterations = getBulkSimStageIterations(request, config, baselineProbe.dpsMetrics, candidates.length);
	const reuseBaselineProbe = iterations == minIterations;
	const baselineSims = reuseBaselineProbe ? 1 : 2;
	const totalSims = candidates.length + baselineSims;
	let completedBaselineIterations = minIterations;
	let baseline = baselineProbe;
	const totalStageIterations = (candidates.length + 1) * iterations;
	emitBulkSimStageProgress(onProgress, config.stage, 1, totalSims, completedBaselineIterations, totalStageIterations, baselineProbe.dpsMetrics?.avg ?? 0);

	if (!reuseBaselineProbe) {
		const extraBaselineIterations = iterations - minIterations;
		const baselineExtra = await runSingleBulkSimConcurrent(
			request,
			baselineCandidate,
			extraBaselineIterations,
			workerPool,
			signals,
			progressMetrics => {
				if (progressMetrics.totalIterations == 0) return;
				emitBulkSimStageProgress(
					onProgress,
					config.stage,
					1,
					totalSims,
					minIterations + Math.min(progressMetrics.completedIterations, extraBaselineIterations),
					totalStageIterations,
					progressMetrics.dps,
				);
			},
			minIterations,
		);
		if (baselineExtra.error) {
			return {
				baseline: baselineExtra,
				results: [],
				iterations,
				metrics: BulkSimStageMetrics.create({ stage: config.stage }),
			};
		}
		baseline = mergeBulkSimCandidateResults(baselineProbe, baselineExtra);
		completedBaselineIterations = iterations;
		emitBulkSimStageProgress(
			onProgress,
			config.stage,
			baselineSims,
			totalSims,
			completedBaselineIterations,
			totalStageIterations,
			baseline.dpsMetrics?.avg ?? 0,
		);
	}

	const results: ConcurrentBulkSimCandidateResult[] = [];
	let completedCandidateIterations = 0;
	for (const [idx, candidate] of candidates.entries()) {
		if (signals.abort.isTriggered()) break;

		const candidateResult = await runSingleBulkSimConcurrent(request, candidate, iterations, workerPool, signals, progressMetrics => {
			if (progressMetrics.totalIterations == 0) return;
			emitBulkSimStageProgress(
				onProgress,
				config.stage,
				baselineSims + idx,
				totalSims,
				completedBaselineIterations + completedCandidateIterations + Math.min(progressMetrics.completedIterations, iterations),
				totalStageIterations,
				progressMetrics.dps,
			);
		});

		results.push(candidateResult);
		completedCandidateIterations += iterations;
		emitBulkSimStageProgress(
			onProgress,
			config.stage,
			baselineSims + idx + 1,
			totalSims,
			completedBaselineIterations + completedCandidateIterations,
			totalStageIterations,
			candidateResult.dpsMetrics?.avg ?? 0,
		);

		if (candidateResult.error) {
			signals.abort.trigger();
			break;
		}
	}
	const adaptedStage = await adaptConcurrentBulkSimStageIterations(
		request,
		candidates,
		config,
		workerPool,
		onProgress,
		signals,
		baseline,
		results,
		iterations,
	);
	baseline = adaptedStage.baseline;
	results.splice(0, results.length, ...adaptedStage.results);
	if (baseline.error) {
		return {
			baseline,
			results,
			iterations: adaptedStage.iterations,
			metrics: BulkSimStageMetrics.create({ stage: config.stage }),
		};
	}

	const bestCandidate = topBulkSimResults(results, 1)[0];
	const metrics = BulkSimStageMetrics.create({
		stage: config.stage,
		inputGearSets: candidates.length,
		survivors: results.length,
		iterations: adaptedStage.iterations,
		concurrency: 1,
		durationSeconds: (new Date().getTime() - startedAt) / 1000,
		targetErrorPct: config.targetErrorPct,
		observedErrorPct: bulkSimObservedStageErrorPct(baseline, results, adaptedStage.iterations, candidates.length),
		baselineAvgDps: baseline.dpsMetrics?.avg ?? 0,
		bestCandidateAvgDps: bestCandidate?.dpsMetrics?.avg ?? 0,
	});

	return {
		baseline,
		results,
		iterations: adaptedStage.iterations,
		metrics,
	};
};

export const runConcurrentBulkSim = async (
	request: BulkSimRequest,
	workerPool: WorkerPool,
	onProgress: WorkerProgressCallback,
	signals: SimSignals,
	onReforgeCandidateOptimized?: (candidate: BulkGearCandidate, optimizedGear: EquipmentSpec) => void | Promise<void>,
): Promise<BulkSimResult> => {
	if (isDevMode()) {
		console.log(`Running bulk sim using ${workerPool.getNumWorkers()} wasm workers per gear sim.`);
	}

	const validationError = validateBulkSimRequest(request);
	if (validationError) return makeAndSendBulkSimError(validationError, onProgress);

	const startedAt = new Date().getTime();
	if (request.reforgeRequest) {
		const reforgeResult = await optimizeReforgeCandidates(request, workerPool, onProgress, signals, onReforgeCandidateOptimized);
		request = reforgeResult.request;
		if (reforgeResult.aborted) {
			return makeAndSendBulkSimError(ErrorOutcome.create({ type: ErrorOutcomeType.ErrorOutcomeAborted }), onProgress, request.optimizedCandidates);
		}
	}
	const simmingStartedAt = new Date().getTime();
	let candidates = request.candidates
		.filter(candidate => candidate.gear)
		.map((candidate: BulkGearCandidate) => ({ index: candidate.index, gear: candidate.gear! }));
	const topResults = request.topResults > 0 ? request.topResults : BULK_SIM_DEFAULT_TOP_RESULTS;
	const result = BulkSimResult.create({ timings: BulkSimTimings.create() });

	if (candidates.length == 0) {
		const baseline = await runSingleBulkSimConcurrent(
			request,
			{ index: -1, gear: getBulkSimBaselineGear(request) },
			request.baseRequest!.simOptions!.iterations,
			workerPool,
			signals,
		);
		if (baseline.error) return makeAndSendBulkSimError(baseline.error, onProgress);

		result.baseline = bulkSimCandidateResultToProto(baseline);
		result.timings!.totalSeconds = (new Date().getTime() - startedAt) / 1000;
		result.timings!.simmingSeconds = (new Date().getTime() - simmingStartedAt) / 1000;
		onProgress(ProgressMetrics.create({ bulkStage: BulkSimStage.BulkSimStageComplete, finalBulkSimResult: result }));
		return result;
	}

	let latestBaseline: ConcurrentBulkSimCandidateResult | undefined;
	let latestResults: ConcurrentBulkSimCandidateResult[] = [];
	for (const stageConfig of bulkSimStageConfigs) {
		if (signals.abort.isTriggered()) return makeAndSendBulkSimError(ErrorOutcome.create({ type: ErrorOutcomeType.ErrorOutcomeAborted }), onProgress);
		if (!shouldRunBulkSimStage(stageConfig, candidates.length)) continue;

		const stageResult = await runConcurrentBulkSimStage(request, candidates, stageConfig, workerPool, onProgress, signals);
		if (stageResult.baseline?.error) return makeAndSendBulkSimError(stageResult.baseline.error, onProgress);
		const candidateError = stageResult.results.find(candidateResult => candidateResult.error)?.error;
		if (candidateError) return makeAndSendBulkSimError(candidateError, onProgress);

		latestBaseline = stageResult.baseline;
		latestResults = stageResult.results;
		result.stageMetrics.push(stageResult.metrics);
		switch (stageConfig.stage) {
			case BulkSimStage.BulkSimStageLow:
				result.timings!.lowStageSeconds = stageResult.metrics.durationSeconds;
				break;
			case BulkSimStage.BulkSimStageMedium:
				result.timings!.mediumStageSeconds = stageResult.metrics.durationSeconds;
				break;
			case BulkSimStage.BulkSimStageHigh:
				result.timings!.highStageSeconds = stageResult.metrics.durationSeconds;
				break;
		}

		if (stageConfig.maxSurvivors !== undefined && latestBaseline) {
			candidates = selectBulkSimSurvivors(stageResult.results, latestBaseline, stageResult.iterations, stageConfig);
			stageResult.metrics.survivors = candidates.length;
		}
		if (isDevMode()) {
			console.log(`[Bulk Sim] ${formatBulkSimStageSummary('Finished', stageResult.metrics, stageResult.results.length)}`);
		}
	}

	if (!latestBaseline) {
		latestBaseline = await runSingleBulkSimConcurrent(
			request,
			{ index: -1, gear: getBulkSimBaselineGear(request) },
			request.baseRequest!.simOptions!.iterations,
			workerPool,
			signals,
		);
		if (latestBaseline.error) return makeAndSendBulkSimError(latestBaseline.error, onProgress);
	}

	result.baseline = bulkSimCandidateResultToProto(latestBaseline);
	result.topResults = topBulkSimResults(latestResults, topResults)
		.map(bulkSimCandidateResultToProto)
		.filter((result): result is BulkGearResult => result != undefined);
	result.timings!.simmingSeconds = (new Date().getTime() - simmingStartedAt) / 1000;
	result.timings!.totalSeconds = (new Date().getTime() - startedAt) / 1000;

	onProgress(ProgressMetrics.create({ bulkStage: BulkSimStage.BulkSimStageComplete, finalBulkSimResult: result }));
	return result;
};

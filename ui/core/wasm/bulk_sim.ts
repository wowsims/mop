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
} from '../proto/api';
import { EquipmentSpec, ItemRandomSuffix, ReforgeStat } from '../proto/common';
import { ItemEffectRandPropPoints, SimDatabase, SimEnchant, SimGem, SimItem } from '../proto/db';
import { UIEnchant as Enchant, UIGem as Gem, UIItem as Item } from '../proto/ui';
import { Database } from '../proto_utils/database';
import { Gear } from '../proto_utils/gear';
import { SimSignals } from '../sim_signal_manager';
import { isDevMode, noop } from '../utils';
import { WorkerPool, WorkerProgressCallback } from '../worker_pool';
import { runConcurrentSim } from './sim';

const BULK_SIM_DEFAULT_TOP_RESULTS = 5;
const BULK_SIM_MIN_COMBINATIONS = 20;
const BULK_SIM_CULLING_COEFFICIENT = 1.35;
const BULK_SIM_COMBINATION_LOG_MIN = 10;

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

const makeAndSendBulkSimError = (err: string | ErrorOutcome, onProgress: WorkerProgressCallback): BulkSimResult => {
	const errRes = BulkSimResult.create();
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
	if (!request.baselineGear) return '[Bulk sim] Baseline gear is empty';
	const player = request.baseRequest.raid.parties[0]?.players[0];
	if (!player || !player.class) return '[Bulk Sim] First player is empty';
	return '';
};

const shouldRunBulkSimStage = (config: ConcurrentBulkSimStageConfig, candidateCount: number): boolean =>
	config.maxSurvivors === undefined || candidateCount > config.maxSurvivors || (candidateCount < BULK_SIM_MIN_COMBINATIONS && config.stage == BulkSimStage.BulkSimStageHigh);

const getBulkSimStageMinIterations = (request: BulkSimRequest, config: ConcurrentBulkSimStageConfig): number => {
	if (config.stage == BulkSimStage.BulkSimStageHigh && request.highStageIterations > 0) {
		return request.highStageIterations;
	}
	return config.minIterations ?? request.highStageIterations;
};

const getBulkSimStageIterations = (request: BulkSimRequest, config: ConcurrentBulkSimStageConfig, baselineMetrics: DistributionMetrics | undefined, candidateCount: number): number => {
	const minIterations = getBulkSimStageMinIterations(request, config);
	if (!baselineMetrics || baselineMetrics.avg <= 0) return minIterations;

	const targetError = baselineMetrics.avg * (config.targetErrorPct / 100);
	const combinationMultiplier = Math.sqrt(Math.max(1, Math.log10(Math.max(candidateCount, BULK_SIM_COMBINATION_LOG_MIN))));
	if (targetError <= 0) return minIterations;

	const targetIterations = Math.ceil(Math.pow((baselineMetrics.stdev * combinationMultiplier) / targetError, 2));
	return Math.max(minIterations, targetIterations);
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

const cleanBulkSimDpsMetrics = (metrics: DistributionMetrics | undefined): DistributionMetrics | undefined => {
	if (!metrics) return undefined;
	const cleaned = DistributionMetrics.clone(metrics);
	cleaned.hist = [];
	cleaned.allValues = [];
	return cleaned;
};

const makeBulkSimRequestForCandidate = (request: BulkSimRequest, candidate: ConcurrentBulkSimCandidate, iterations: number): RaidSimRequest => {
	const simRequest = RaidSimRequest.clone(request.baseRequest!);
	simRequest.requestId = request.requestId;
	simRequest.simOptions!.iterations = iterations;
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
): Promise<ConcurrentBulkSimCandidateResult> => {
	if (signals.abort.isTriggered()) {
		return { candidate, error: ErrorOutcome.create({ type: ErrorOutcomeType.ErrorOutcomeAborted }) };
	}

	const simRequest = makeBulkSimRequestForCandidate(request, candidate, iterations);
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
	let maxActorError = bulkSimDpsError(baseline.dpsMetrics, iterations);
	for (const result of results) {
		if (result.dpsMetrics && (!bestMetrics || result.dpsMetrics.avg > bestMetrics.avg)) {
			bestMetrics = result.dpsMetrics;
		}
		maxActorError = Math.max(maxActorError, bulkSimDpsError(result.dpsMetrics, iterations));
	}

	const lowerBound = (bestMetrics?.avg ?? 0) - maxActorError * (config.cullingCoefficient ?? BULK_SIM_CULLING_COEFFICIENT);
	const meanSurvivors = topBulkSimResults(results, config.minSurvivors ?? 0);
	let survivors = meanSurvivors.slice();
	const seen = new Set(survivors.map(result => result.candidate.index));

	for (const result of results) {
		if (!result.dpsMetrics || result.dpsMetrics.avg < lowerBound || seen.has(result.candidate.index)) continue;
		survivors.push(result);
		seen.add(result.candidate.index);
	}

	if (survivors.length > config.maxSurvivors) {
		survivors = topBulkSimResults(survivors, config.maxSurvivors);
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
	const maxBaselineSims = 2;
	const maxTotalSims = candidates.length + maxBaselineSims;
	const probeTotalIterations = maxTotalSims * minIterations;
	emitBulkSimStageProgress(onProgress, config.stage, 0, maxTotalSims, 0, probeTotalIterations, 0);

	const baselineCandidate = { index: -1, gear: request.baselineGear! };
	const baselineProbe = await runSingleBulkSimConcurrent(request, baselineCandidate, minIterations, workerPool, signals, progressMetrics => {
		if (progressMetrics.totalIterations == 0) return;
		emitBulkSimStageProgress(onProgress, config.stage, 0, maxTotalSims, Math.min(progressMetrics.completedIterations, minIterations), probeTotalIterations, progressMetrics.dps);
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
	const totalStageIterations = completedBaselineIterations + candidates.length * iterations + (reuseBaselineProbe ? 0 : iterations);
	emitBulkSimStageProgress(onProgress, config.stage, 1, totalSims, completedBaselineIterations, totalStageIterations, baselineProbe.dpsMetrics?.avg ?? 0);

	if (!reuseBaselineProbe) {
		baseline = await runSingleBulkSimConcurrent(request, baselineCandidate, iterations, workerPool, signals, progressMetrics => {
			if (progressMetrics.totalIterations == 0) return;
			emitBulkSimStageProgress(
				onProgress,
				config.stage,
				1,
				totalSims,
				minIterations + Math.min(progressMetrics.completedIterations, iterations),
				totalStageIterations,
				progressMetrics.dps,
			);
		});
		if (baseline.error) {
			return {
				baseline,
				results: [],
				iterations,
				metrics: BulkSimStageMetrics.create({ stage: config.stage }),
			};
		}
		completedBaselineIterations += iterations;
		emitBulkSimStageProgress(onProgress, config.stage, baselineSims, totalSims, completedBaselineIterations, totalStageIterations, baseline.dpsMetrics?.avg ?? 0);
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

	const bestCandidate = topBulkSimResults(results, 1)[0];
	const metrics = BulkSimStageMetrics.create({
		stage: config.stage,
		inputGearSets: candidates.length,
		survivors: results.length,
		iterations,
		concurrency: 1,
		durationSeconds: (new Date().getTime() - startedAt) / 1000,
		targetErrorPct: config.targetErrorPct,
		baselineAvgDps: baseline.dpsMetrics?.avg ?? 0,
		bestCandidateAvgDps: bestCandidate?.dpsMetrics?.avg ?? 0,
	});

	return {
		baseline,
		results,
		iterations,
		metrics,
	};
};

export const runConcurrentBulkSim = async (
	request: BulkSimRequest,
	workerPool: WorkerPool,
	onProgress: WorkerProgressCallback,
	signals: SimSignals,
): Promise<BulkSimResult> => {
	if (isDevMode()) {
		console.log(`Running bulk sim using ${workerPool.getNumWorkers()} wasm workers per gear sim.`);
	}

	const validationError = validateBulkSimRequest(request);
	if (validationError) return makeAndSendBulkSimError(validationError, onProgress);

	const startedAt = new Date().getTime();
	const simmingStartedAt = new Date().getTime();
	let candidates = request.candidates
		.filter(candidate => candidate.gear)
		.map((candidate: BulkGearCandidate) => ({ index: candidate.index, gear: candidate.gear! }));
	const topResults = request.topResults > 0 ? request.topResults : BULK_SIM_DEFAULT_TOP_RESULTS;
	const result = BulkSimResult.create({ timings: BulkSimTimings.create() });

	if (candidates.length == 0) {
		const baseline = await runSingleBulkSimConcurrent(request, { index: -1, gear: request.baselineGear! }, request.baseRequest!.simOptions!.iterations, workerPool, signals);
		if (baseline.error) return makeAndSendBulkSimError(baseline.error, onProgress);

		result.baseline = bulkSimCandidateResultToProto(baseline);
		result.timings!.totalSeconds = (new Date().getTime() - startedAt) / 1000;
		result.timings!.simmingSeconds = result.timings!.totalSeconds;
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
	}

	if (!latestBaseline) {
		latestBaseline = await runSingleBulkSimConcurrent(request, { index: -1, gear: request.baselineGear! }, request.baseRequest!.simOptions!.iterations, workerPool, signals);
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

import { DistributionMetrics } from '../../../proto/api';
import { Gear } from '../../../proto_utils/gear';

export const WEB_DEFAULT_ITERATIONS = 5_000;
export const WEB_ITERATIONS_LIMIT = 100_000;
export const LOCAL_ITERATIONS_LIMIT = 5_000_000;

export const WEB_COMBINATIONS_LIMIT = 50_000;
export const LOCAL_COMBINATIONS_LIMIT = 100_000;

export type OptimisationStage = 'low' | 'medium' | 'high';
export type OptimisationStageConfig = {
	concurrency?: number;
	minIterations?: number;
	targetErrorPct: number;
	cullingCoefficient?: number;
	minSurvivors?: number;
	maxSurvivors?: number;
};

export const BULK_OPTIMISATION_MIN_COMBINATIONS = 20;
export const BULK_OPTIMISATION_AGGRESSIVE_CULLING_COEFFICIENT = 1.35;
export const BULK_OPTIMISATION_CONSERVATIVE_ERROR_THRESHOLD = 2.5;
export const BULK_CANDIDATE_GEAR_BUILD_CHUNK_SIZE = 250;

export const STAGE_CONFIG: Record<OptimisationStage, OptimisationStageConfig> = {
	low: {
		minIterations: 100,
		targetErrorPct: 1,
		minSurvivors: 20,
		maxSurvivors: 100,
	},
	medium: {
		minIterations: 1000,
		targetErrorPct: 0.2,
		minSurvivors: 5,
		maxSurvivors: 25,
		concurrency: 3,
	},
	high: {
		targetErrorPct: 0.05,
		concurrency: 1,
	},
};

export interface TopGearResult {
	gear: Gear;
	dpsMetrics: DistributionMetrics;
}

export interface BulkOptimisationStageResult {
	baseline: TopGearResult;
	results: TopGearResult[];
	nextRound: number;
	metrics: BulkOptimisationStageMetrics;
}

export interface BulkOptimisationStageMetrics {
	inputGearSets: number;
	results: number;
	iterations: number;
	targetErrorPct: number;
	combinationErrorMultiplier: number;
	concurrency: number;
	stageRounds: number;
	durationSeconds: number;
	baselineAvgDps: number;
	baselineStdev: number;
	bestCandidateAvgDps: number;
	bestCandidateStdev: number;
}

export interface BulkOptimisationStageTask {
	gear: Gear;
	round: number;
	stageRound: number;
}

export interface BulkOptimisationStageProgress {
	completedIterationsByRound: Map<number, number>;
	completedIterations: number;
	totalIterations: number;
	startedAt: number;
}

export interface BulkSimRoundConfig {
	currentRound: number;
	totalRounds: number;
	title?: string;
	stageCurrentRound?: number;
	stageRounds?: number;
}

export interface BulkSimProgressConfig extends BulkSimRoundConfig {
	aggregateCompletedIterations?: number;
	aggregateTotalIterations?: number;
	aggregateStartedAt?: number;
	useSimCountProgress?: boolean;
}

export interface BulkSingleGearSimConfig extends BulkSimRoundConfig {
	iterations?: number;
	aggregateProgress?: BulkOptimisationStageProgress;
}

import { DistributionMetrics } from '../../../proto/api';
import { Gear } from '../../../proto_utils/gear';

export const WEB_DEFAULT_ITERATIONS = 5_000;
export const WEB_ITERATIONS_LIMIT = 100_000;
export const LOCAL_ITERATIONS_LIMIT = 5_000_000;

export const WEB_COMBINATIONS_LIMIT = 5_000;
export const LOCAL_COMBINATIONS_LIMIT = 35_000;

export type OptimisationStage = 'low' | 'medium' | 'high';
export type OptimisationStageConfig = {
	concurrency?: number;
	minIterations?: number;
	targetErrorPct: number;
	minSurvivors?: number;
	maxSurvivors?: number;
};

export const BULK_OPTIMISATION_MIN_COMBINATIONS = 20;
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

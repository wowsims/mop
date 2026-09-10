import { DistributionMetrics } from '@generated/proto/api';

import type { EquippedItem } from '../proto/equipped_item';
import { Gear } from '../proto/gear';

export const WEB_ITERATIONS_LIMIT = 1_000_000;
export const NATIVE_ITERATIONS_LIMIT = 10_000_000;

export const WEB_COMBINATIONS_LIMIT = 5_000;
export const NATIVE_COMBINATIONS_LIMIT = 100_000;

export type OptimisationStage = 'low' | 'medium' | 'high';

export interface TopGearResult {
	gear: Gear;
	dpsMetrics: DistributionMetrics;
	backendRank?: number;
	pairedErrorToNextResult?: number;
	pairedErrorToBaseline?: number;
}

export interface BulkPickerEntry {
	/** Index into the batch's item array, or -1/-2 for the two equipped slots this group covers. */
	index: number;
	item: EquippedItem;
}

export interface BulkResults {
	chains: TopGearResult[][];
	originalGearResults: TopGearResult;
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

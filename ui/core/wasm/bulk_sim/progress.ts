import { BulkSimStage, BulkSimStageMetrics, ProgressMetrics } from '../../proto/api';
import { WorkerProgressCallback } from '../../worker_pool';
import { ConcurrentBulkSimStageConfig } from './types';

export const bulkSimStageLogName = (stage: BulkSimStage): string => {
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

export const formatBulkSimStageStart = (
	config: ConcurrentBulkSimStageConfig,
	candidateCount: number,
	minIterations: number,
	carriedIterations: number,
): string => {
	return `- Stage: ${bulkSimStageLogName(config.stage)} - Starting
Sims:
  Candidates: ${candidateCount}
  Total runs: ${candidateCount + 1}-${candidateCount + 2} (baseline probe, optional baseline, candidates)
Stage config:
  Per-candidate concurrent sim: true
  Min iterations: ${minIterations}
  Carried iterations: ${carriedIterations}
  Target error: ${config.targetErrorPct.toFixed(2)}%`;
};

export const formatBulkSimStageSummary = (status: string, metrics: BulkSimStageMetrics, completedSims: number): string => {
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

// Binds the parts of a stage's progress reporting that never change between emits, so
// call sites pass only what actually moves. Stage totals are only known after the
// baseline probe, so a stage uses one emitter for the probe and another for the rest.
export type BulkSimStageProgressEmitter = {
	report: (completedSims: number, completedIterations: number, dps: number) => void;
};

export const makeBulkSimStageProgressEmitter = (
	onProgress: WorkerProgressCallback,
	stage: BulkSimStage,
	totalSims: number,
	totalIterations: number,
): BulkSimStageProgressEmitter => ({
	report: (completedSims, completedIterations, dps) =>
		emitBulkSimStageProgress(onProgress, stage, completedSims, totalSims, completedIterations, totalIterations, dps),
});

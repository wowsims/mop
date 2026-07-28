import { ConcurrentBulkSimCandidate, ConcurrentBulkSimCandidateResult, ConcurrentBulkSimStageResult } from './types';

// Holds the previous stage's accumulated results so the next stage only has to sim
// the iteration delta. Mirrors bulkSimStageCarryOver in sim/core/bulk/bulk_sim.go.
export type ConcurrentBulkSimStageCarryOver = {
	iterations: number;
	baseline: ConcurrentBulkSimCandidateResult;
	byCandidate: Map<number, ConcurrentBulkSimCandidateResult>;
};

export const newBulkSimStageCarryOver = (stageResult: ConcurrentBulkSimStageResult): ConcurrentBulkSimStageCarryOver | undefined => {
	if (stageResult.iterations <= 0 || !stageResult.baseline || stageResult.baseline.error || !stageResult.baseline.dpsMetrics) return undefined;

	const byCandidate = new Map<number, ConcurrentBulkSimCandidateResult>();
	for (const result of stageResult.results) {
		if (!result.error && result.dpsMetrics) {
			byCandidate.set(result.candidate.index, result);
		}
	}
	return { iterations: stageResult.iterations, baseline: stageResult.baseline, byCandidate };
};

// Reports whether every candidate has carried metrics. A partial carry-over would
// need per-candidate iteration counts, so the stage falls back to running the full
// count for everyone instead.
export const bulkSimCarryOverCovers = (carry: ConcurrentBulkSimStageCarryOver | undefined, candidates: ConcurrentBulkSimCandidate[]): boolean =>
	!!carry && candidates.every(candidate => carry.byCandidate.has(candidate.index));

const bulkSimCarriedCandidateResult = (
	carry: ConcurrentBulkSimStageCarryOver | undefined,
	candidateIndex: number,
): ConcurrentBulkSimCandidateResult | undefined => carry?.byCandidate.get(candidateIndex);

export const bulkSimCarriedResults = (
	carry: ConcurrentBulkSimStageCarryOver | undefined,
	candidates: ConcurrentBulkSimCandidate[],
): ConcurrentBulkSimCandidateResult[] =>
	candidates.map(candidate => bulkSimCarriedCandidateResult(carry, candidate.index)).filter((result): result is ConcurrentBulkSimCandidateResult => !!result);

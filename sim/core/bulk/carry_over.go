package bulk

// bulkSimStageCarryOver holds the previous stage's accumulated results so the next
// stage only has to sim the iteration delta.
type bulkSimStageCarryOver struct {
	iterations  int32
	baseline    *BulkSimCandidateResult
	byCandidate map[int32]*BulkSimCandidateResult
}

func newBulkSimStageCarryOver(stageResult BulkSimStageResult) *bulkSimStageCarryOver {
	if stageResult.Iterations <= 0 || stageResult.Baseline == nil || stageResult.Baseline.Error != nil || stageResult.Baseline.DpsMetrics == nil {
		return nil
	}

	byCandidate := make(map[int32]*BulkSimCandidateResult, len(stageResult.Results))
	for _, result := range stageResult.Results {
		if result != nil && result.Error == nil && result.DpsMetrics != nil {
			byCandidate[result.Candidate.Index] = result
		}
	}
	return &bulkSimStageCarryOver{
		iterations:  stageResult.Iterations,
		baseline:    stageResult.Baseline,
		byCandidate: byCandidate,
	}
}

// covers reports whether every candidate has carried metrics. A partial carry-over
// would need per-candidate iteration counts, so the stage falls back to running the
// full count for everyone instead.
func (carry *bulkSimStageCarryOver) covers(candidates []BulkSimCandidate) bool {
	if carry == nil {
		return false
	}
	for _, candidate := range candidates {
		if carry.byCandidate[candidate.Index] == nil {
			return false
		}
	}
	return true
}

func (carry *bulkSimStageCarryOver) carriedIterations() int32 {
	if carry == nil {
		return 0
	}
	return carry.iterations
}

func (carry *bulkSimStageCarryOver) baselineResult() *BulkSimCandidateResult {
	if carry == nil {
		return nil
	}
	return carry.baseline
}

func (carry *bulkSimStageCarryOver) candidateResult(index int32) *BulkSimCandidateResult {
	if carry == nil {
		return nil
	}
	return carry.byCandidate[index]
}

func (carry *bulkSimStageCarryOver) results(candidates []BulkSimCandidate) []*BulkSimCandidateResult {
	results := make([]*BulkSimCandidateResult, 0, len(candidates))
	for _, candidate := range candidates {
		if result := carry.candidateResult(candidate.Index); result != nil {
			results = append(results, result)
		}
	}
	return results
}

// Wraps an in-progress stage's results as a carry-over so an adaptive pass can merge
// its delta through the same path a later stage uses.
func bulkSimCarryOverFromResults(iterations int32, baseline *BulkSimCandidateResult, results []*BulkSimCandidateResult) *bulkSimStageCarryOver {
	byCandidate := make(map[int32]*BulkSimCandidateResult, len(results))
	for _, result := range results {
		if result != nil {
			byCandidate[result.Candidate.Index] = result
		}
	}
	return &bulkSimStageCarryOver{iterations: iterations, baseline: baseline, byCandidate: byCandidate}
}

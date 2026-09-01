package bulk

import (
	"cmp"
	"container/heap"
	"math"
	"slices"

	"github.com/wowsims/mop/sim/core/proto"
)

type bulkSimResultMinHeap []*BulkSimCandidateResult

func (h bulkSimResultMinHeap) Len() int { return len(h) }

func (h bulkSimResultMinHeap) Less(i, j int) bool {
	return h[i].DpsMetrics.Avg < h[j].DpsMetrics.Avg
}

func (h bulkSimResultMinHeap) Swap(i, j int) { h[i], h[j] = h[j], h[i] }

func (h *bulkSimResultMinHeap) Push(x any) {
	*h = append(*h, x.(*BulkSimCandidateResult))
}

func (h *bulkSimResultMinHeap) Pop() any {
	old := *h
	n := len(old)
	result := old[n-1]
	*h = old[:n-1]
	return result
}

// Converts a target relative error into an iteration count using standard
// error: stdev / sqrt(iterations). The combination multiplier is a practical
// multiple-candidate adjustment so large candidate sets use more iterations
// without paying the full Bonferroni cost.
func getBulkSimTargetIterations(targetErrorPct float64, metrics *proto.DistributionMetrics, candidateCount int) int32 {
	if metrics == nil || metrics.Avg <= 0 {
		return 0
	}

	targetError := metrics.Avg * (targetErrorPct / 100)
	if targetError <= 0 {
		return 0
	}

	combinationMultiplier := bulkSimCombinationErrorMultiplier(candidateCount)
	return int32(math.Ceil(math.Pow((metrics.Stdev*combinationMultiplier)/targetError, 2)))
}

// Keeps candidates that could still plausibly be the best result after
// accounting for sim variance. The top MinSurvivors by mean are always
// retained, then any candidate whose upper interval overlaps the best
// candidate's lower interval is kept. A soft cap prevents pathological stages
// from forwarding the entire candidate set when many results are tied.
func selectBulkSimSurvivors(results []*BulkSimCandidateResult, baseline *BulkSimCandidateResult, iterations int32, config BulkSimStageConfig, originalCandidateCount int) []BulkSimCandidate {
	maxSurvivors := getBulkSimStageMaxSurvivors(config, len(results))
	if maxSurvivors == 0 || len(results) <= maxSurvivors {
		return bulkSimResultsToCandidates(results)
	}

	bestMetrics := baseline.DpsMetrics
	for _, result := range results {
		if result == nil || result.DpsMetrics == nil {
			continue
		}
		if result.DpsMetrics.Avg > bestMetrics.Avg {
			bestMetrics = result.DpsMetrics
		}
	}
	intervalMultiplier := bulkSimSurvivorIntervalMultiplier(originalCandidateCount, config.CullingCoefficient)
	bestLowerBound := bestMetrics.Avg - bulkSimDpsError(bestMetrics, iterations)*intervalMultiplier

	meanSurvivors := topBulkSimResults(results, config.MinSurvivors)
	survivors := make([]*BulkSimCandidateResult, 0, maxSurvivors)
	seen := make(map[int32]bool)
	for _, result := range meanSurvivors {
		survivors = append(survivors, result)
		seen[result.Candidate.Index] = true
	}
	for _, result := range results {
		if result == nil || result.DpsMetrics == nil || seen[result.Candidate.Index] {
			continue
		}

		if bulkSimCandidateIsCulled(result.DpsMetrics, bestMetrics, bestLowerBound, iterations, intervalMultiplier) {
			continue
		}
		survivors = append(survivors, result)
		seen[result.Candidate.Index] = true
	}

	softMaxSurvivors := maxSurvivors * BulkSimSurvivorSoftCapMultiplier
	if len(survivors) > softMaxSurvivors {
		survivors = topBulkSimResults(survivors, softMaxSurvivors)
	}

	return bulkSimResultsToCandidates(survivors)
}

// The marginal cull test compares the sum of both candidates' half-widths, which is
// sqrt(2) wider than the standard error of the difference it is really testing. Keeping
// that factor when switching to the paired estimate means pairing only removes the
// variance the shared seeds already cancel - it does not additionally tighten the
// interval.
const BulkSimPairedIntervalConservatism = math.Sqrt2

// Decides whether a candidate is far enough behind the leader to drop out.
//
// Every candidate is simmed on the same seed sequence, so most of the per-iteration
// noise is shared between any two of them. Comparing marginal standard errors throws
// that away; differencing the paired per-iteration values keeps it, which resolves the
// same gap with fewer iterations. Falls back to the marginal comparison when the values
// are unavailable or not aligned (different iteration counts).
func bulkSimCandidateIsCulled(metrics *proto.DistributionMetrics, bestMetrics *proto.DistributionMetrics, bestLowerBound float64, iterations int32, intervalMultiplier float64) bool {
	if pairedError, ok := bulkSimPairedDpsError(metrics, bestMetrics); ok {
		return bestMetrics.Avg-metrics.Avg > pairedError*intervalMultiplier*BulkSimPairedIntervalConservatism
	}

	candidateUpperBound := metrics.Avg + bulkSimDpsError(metrics, iterations)*intervalMultiplier
	return candidateUpperBound < bestLowerBound
}

// bulkSimZ95 is the two-sided 95% z threshold; the same value the UI's significance test
// (zTest in ui/core/utils.ts) uses, so backend separation decisions and frontend display
// agree on what counts as "different".
const bulkSimZ95 = 1.96

func bulkSimUnresolvedFinalistPair(sortedFinalists []*BulkSimCandidateResult) bool {
	for idx := 0; idx+1 < len(sortedFinalists); idx++ {
		upper, lower := sortedFinalists[idx], sortedFinalists[idx+1]
		pairedError, ok := bulkSimPairedDpsError(lower.DpsMetrics, upper.DpsMetrics)
		if !ok || pairedError == 0 {
			continue
		}
		if math.Abs(upper.DpsMetrics.Avg-lower.DpsMetrics.Avg) <= bulkSimZ95*pairedError {
			return true
		}
	}
	return false
}

func bulkSimPairedDpsError(metrics *proto.DistributionMetrics, bestMetrics *proto.DistributionMetrics) (float64, bool) {
	if metrics == nil || bestMetrics == nil {
		return 0, false
	}
	values, bestValues := metrics.AllValues, bestMetrics.AllValues
	if len(values) == 0 || len(values) != len(bestValues) {
		return 0, false
	}

	var sum, sumSq float64
	for idx, value := range values {
		difference := value - bestValues[idx]
		sum += difference
		sumSq += difference * difference
	}
	count := float64(len(values))
	mean := sum / count
	variance := math.Max(0, sumSq/count-mean*mean)
	return math.Sqrt(variance / count), true
}

func bulkSimDpsError(metrics *proto.DistributionMetrics, iterations int32) float64 {
	if metrics == nil || iterations <= 0 {
		return 0
	}
	return metrics.Stdev / math.Sqrt(float64(iterations))
}

func bulkSimCombinationErrorMultiplier(candidateCount int) float64 {
	return math.Sqrt(math.Max(1, math.Log10(math.Max(float64(candidateCount), BulkSimCombinationLogMin))))
}

func bulkSimSurvivorIntervalMultiplier(candidateCount int, cullingCoefficient float64) float64 {
	return cullingCoefficient * bulkSimCombinationErrorMultiplier(candidateCount)
}

func bulkSimObservedErrorPct(metrics *proto.DistributionMetrics, iterations int32, candidateCount int) float64 {
	if metrics == nil || metrics.Avg <= 0 || iterations <= 0 {
		return 0
	}
	return bulkSimDpsError(metrics, iterations) * bulkSimCombinationErrorMultiplier(candidateCount) / metrics.Avg * 100
}

// Reports the worst relative error across the baseline and every candidate.
// Using the max is intentionally conservative: one noisy candidate can still
// affect culling or final top-result confidence.
func bulkSimObservedStageErrorPct(baseline *BulkSimCandidateResult, results []*BulkSimCandidateResult, iterations int32, candidateCount int) float64 {
	observedErrorPct := 0.0
	if baseline != nil {
		observedErrorPct = bulkSimObservedErrorPct(baseline.DpsMetrics, iterations, candidateCount)
	}
	for _, result := range results {
		if result == nil {
			continue
		}
		observedErrorPct = math.Max(observedErrorPct, bulkSimObservedErrorPct(result.DpsMetrics, iterations, candidateCount))
	}
	return observedErrorPct
}

func getBulkSimStageTargetIterations(targetErrorPct float64, baseline *BulkSimCandidateResult, results []*BulkSimCandidateResult, candidateCount int) int32 {
	targetIterations := int32(0)
	if baseline != nil {
		targetIterations = max(targetIterations, getBulkSimTargetIterations(targetErrorPct, baseline.DpsMetrics, candidateCount))
	}
	for _, result := range results {
		if result == nil {
			continue
		}
		targetIterations = max(targetIterations, getBulkSimTargetIterations(targetErrorPct, result.DpsMetrics, candidateCount))
	}
	return targetIterations
}

func topBulkSimResults(results []*BulkSimCandidateResult, limit int) []*BulkSimCandidateResult {
	if limit <= 0 || len(results) == 0 {
		return nil
	}
	// Both branches sort on DpsMetrics.Avg, so both drop entries that cannot supply one.
	// The filter is inline rather than a shared pre-pass so the heap branch below keeps
	// streaming over results within its bounded `limit` allocation.
	if len(results) <= limit {
		topResults := make([]*BulkSimCandidateResult, 0, len(results))
		for _, result := range results {
			if result == nil || result.DpsMetrics == nil {
				continue
			}
			topResults = append(topResults, result)
		}
		sortBulkSimResultsByDps(topResults)
		return topResults
	}

	topResults := make(bulkSimResultMinHeap, 0, limit)
	for _, result := range results {
		if result == nil || result.DpsMetrics == nil {
			continue
		}
		if topResults.Len() < limit {
			heap.Push(&topResults, result)
			continue
		}
		if result.DpsMetrics.Avg > topResults[0].DpsMetrics.Avg {
			topResults[0] = result
			heap.Fix(&topResults, 0)
		}
	}

	result := []*BulkSimCandidateResult(topResults)
	sortBulkSimResultsByDps(result)
	return result
}

func sortBulkSimResultsByDps(results []*BulkSimCandidateResult) {
	slices.SortFunc(results, func(a, b *BulkSimCandidateResult) int {
		return cmp.Compare(b.DpsMetrics.Avg, a.DpsMetrics.Avg)
	})
}

func bestBulkSimDps(results []*BulkSimCandidateResult) float64 {
	best := 0.0
	for _, result := range results {
		if result != nil && result.DpsMetrics != nil {
			best = math.Max(best, result.DpsMetrics.Avg)
		}
	}
	return best
}

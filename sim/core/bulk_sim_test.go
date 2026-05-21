package core

import (
	"math"
	"testing"

	"github.com/wowsims/mop/sim/core/proto"
)

func TestMergeBulkSimDistributionMetrics(t *testing.T) {
	metrics := newBulkSimTestDistributionMetrics([]float64{8, 12})
	metrics.MaxSeed = 12
	metrics.MinSeed = 8

	additionalMetrics := newBulkSimTestDistributionMetrics([]float64{16, 20, 24})
	additionalMetrics.MaxSeed = 24
	additionalMetrics.MinSeed = 16

	merged := mergeBulkSimDistributionMetrics(metrics, additionalMetrics)

	assertFloatEqual(t, "avg", merged.Avg, 16)
	assertFloatEqual(t, "stdev", merged.Stdev, math.Sqrt(32))
	if merged.AggregatorData.N != 5 {
		t.Fatalf("expected 5 merged samples, got %d", merged.AggregatorData.N)
	}
	assertFloatEqual(t, "sumSq", merged.AggregatorData.SumSq, 1440)
	assertFloatEqual(t, "max", merged.Max, 24)
	assertFloatEqual(t, "min", merged.Min, 8)
	if merged.MaxSeed != 24 {
		t.Fatalf("expected max seed 24, got %d", merged.MaxSeed)
	}
	if merged.MinSeed != 8 {
		t.Fatalf("expected min seed 8, got %d", merged.MinSeed)
	}
}

func TestMergeBulkSimCandidateResultSlicesPreservesResultOrder(t *testing.T) {
	results := []*BulkSimCandidateResult{
		newBulkSimTestCandidateResult(2, []float64{8, 12}),
		newBulkSimTestCandidateResult(1, []float64{18, 22}),
	}
	additionalResults := []*BulkSimCandidateResult{
		newBulkSimTestCandidateResult(1, []float64{20, 24}),
		newBulkSimTestCandidateResult(2, []float64{10, 14}),
	}

	merged := mergeBulkSimCandidateResultSlices(results, additionalResults)

	if len(merged) != len(results) {
		t.Fatalf("expected %d merged results, got %d", len(results), len(merged))
	}
	if merged[0].Candidate.Index != 2 || merged[1].Candidate.Index != 1 {
		t.Fatalf("expected result order [2, 1], got [%d, %d]", merged[0].Candidate.Index, merged[1].Candidate.Index)
	}
	assertFloatEqual(t, "candidate 2 avg", merged[0].DpsMetrics.Avg, 11)
	assertFloatEqual(t, "candidate 1 avg", merged[1].DpsMetrics.Avg, 21)
}

func newBulkSimTestCandidateResult(index int32, values []float64) *BulkSimCandidateResult {
	return &BulkSimCandidateResult{
		Candidate:  BulkSimCandidate{Index: index},
		DpsMetrics: newBulkSimTestDistributionMetrics(values),
	}
}

func newBulkSimTestDistributionMetrics(values []float64) *proto.DistributionMetrics {
	metrics := &proto.DistributionMetrics{
		Min:            math.MaxFloat64,
		AggregatorData: &proto.AggregatorData{N: int32(len(values))},
	}
	for idx, value := range values {
		metrics.Avg += value
		metrics.AggregatorData.SumSq += value * value
		if value > metrics.Max {
			metrics.Max = value
			metrics.MaxSeed = int64(value)
		}
		if value < metrics.Min {
			metrics.Min = value
			metrics.MinSeed = int64(value)
		}
		if idx == len(values)-1 {
			metrics.Avg /= float64(len(values))
		}
	}
	metrics.Stdev = math.Sqrt(metrics.AggregatorData.SumSq/float64(len(values)) - metrics.Avg*metrics.Avg)
	return metrics
}

func assertFloatEqual(t *testing.T, name string, actual float64, expected float64) {
	t.Helper()
	if math.Abs(actual-expected) > 1e-9 {
		t.Fatalf("expected %s %.12f, got %.12f", name, expected, actual)
	}
}

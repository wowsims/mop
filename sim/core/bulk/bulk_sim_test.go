package bulk

import (
	"math"
	"testing"

	"github.com/wowsims/mop/sim/core"
	"github.com/wowsims/mop/sim/core/proto"
)

func TestGetBulkSimStageMaxSurvivorsScalesLowStage(t *testing.T) {
	lowStageConfig := BulkSimStageConfig{
		Stage:        proto.BulkSimStage_BulkSimStageLow,
		MaxSurvivors: 100,
	}

	testCases := []struct {
		name           string
		candidateCount int
		want           int
	}{
		{name: "below reference", candidateCount: 863, want: 100},
		{name: "at reference", candidateCount: 1000, want: 100},
		{name: "large candidate set", candidateCount: 13000, want: 361},
	}

	for _, testCase := range testCases {
		t.Run(testCase.name, func(t *testing.T) {
			if got := getBulkSimStageMaxSurvivors(lowStageConfig, testCase.candidateCount); got != testCase.want {
				t.Fatalf("max survivors for %d candidates = %d, want %d", testCase.candidateCount, got, testCase.want)
			}
		})
	}
}

func TestGetBulkSimStageMaxSurvivorsScalesMediumStage(t *testing.T) {
	mediumStageConfig := BulkSimStageConfig{
		Stage:        proto.BulkSimStage_BulkSimStageMedium,
		MaxSurvivors: 25,
	}

	testCases := []struct {
		name           string
		candidateCount int
		want           int
	}{
		{name: "below reference", candidateCount: 50, want: 25},
		{name: "at reference", candidateCount: 100, want: 25},
		{name: "large low-stage output", candidateCount: 722, want: 68},
	}

	for _, testCase := range testCases {
		t.Run(testCase.name, func(t *testing.T) {
			if got := getBulkSimStageMaxSurvivors(mediumStageConfig, testCase.candidateCount); got != testCase.want {
				t.Fatalf("max survivors for %d candidates = %d, want %d", testCase.candidateCount, got, testCase.want)
			}
		})
	}
}

func TestGetBulkSimStageMaxSurvivorsKeepsHighStageUncapped(t *testing.T) {
	highStageConfig := BulkSimStageConfig{
		Stage:        proto.BulkSimStage_BulkSimStageHigh,
		MaxSurvivors: 0,
	}

	if got := getBulkSimStageMaxSurvivors(highStageConfig, 13000); got != 0 {
		t.Fatalf("high max survivors = %d, want uncapped", got)
	}
}

func TestShouldUseLegacyBulkSim(t *testing.T) {
	legacySettings := &proto.BulkSettings{UseLegacyBulkSim: true}

	testCases := []struct {
		name           string
		settings       *proto.BulkSettings
		highIterations int32
		candidateCount int
		want           bool
	}{
		{name: "forced legacy", settings: legacySettings, highIterations: 5000, candidateCount: 1000, want: true},
		{name: "below minimum candidates", settings: &proto.BulkSettings{}, highIterations: 5000, candidateCount: 19, want: true},
		{name: "multistage cheaper", settings: &proto.BulkSettings{}, highIterations: 5000, candidateCount: 1000, want: false},
		{name: "multistage not cheaper", settings: &proto.BulkSettings{}, highIterations: 1000, candidateCount: 20, want: true},
	}

	for _, testCase := range testCases {
		t.Run(testCase.name, func(t *testing.T) {
			if got := shouldUseLegacyBulkSim(testCase.settings, testCase.highIterations, testCase.candidateCount); got != testCase.want {
				t.Fatalf("shouldUseLegacyBulkSim(%d, %d) = %t, want %t", testCase.highIterations, testCase.candidateCount, got, testCase.want)
			}
		})
	}
}

func TestEstimateBulkSimIterations(t *testing.T) {
	settings := &proto.BulkSettings{}

	iterations, useLegacyBulkSim := estimateBulkSimIterations(settings, 5000, 1000)
	if useLegacyBulkSim {
		t.Fatalf("expected multistage bulk sim to be used")
	}
	if iterations != 331100 {
		t.Fatalf("optimisation iterations = %d, want 331100", iterations)
	}

	iterations, useLegacyBulkSim = estimateBulkSimIterations(settings, 1000, 20)
	if !useLegacyBulkSim {
		t.Fatalf("expected high-stage only run")
	}
	if iterations != 20000 {
		t.Fatalf("high-stage-only iterations = %d, want 20000", iterations)
	}
}

func TestEstimateBulkSimIterationsAvoidsOverflow(t *testing.T) {
	iterations, useLegacyBulkSim := estimateBulkSimIterations(&proto.BulkSettings{UseLegacyBulkSim: true}, 50000, 84240)
	if !useLegacyBulkSim {
		t.Fatalf("expected high-stage-only run")
	}
	if iterations != 4212000000 {
		t.Fatalf("high-stage-only iterations = %d, want 4212000000", iterations)
	}
}

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

// Extra iterations are folded into the pass so far via a carry-over keyed by candidate
// index, so a batch that completes out of order still merges each candidate with its
// own previous metrics.
func TestBulkSimCarryOverMergesByCandidateIndex(t *testing.T) {
	results := []*BulkSimCandidateResult{
		newBulkSimTestCandidateResult(2, []float64{8, 12}),
		newBulkSimTestCandidateResult(1, []float64{18, 22}),
	}
	additionalResults := []*BulkSimCandidateResult{
		newBulkSimTestCandidateResult(1, []float64{20, 24}),
		newBulkSimTestCandidateResult(2, []float64{10, 14}),
	}

	carry := bulkSimCarryOverFromResults(2, results[0], results)
	merged := make([]*BulkSimCandidateResult, 0, len(additionalResults))
	for _, additionalResult := range additionalResults {
		merged = append(merged, mergeBulkSimCandidateResults(carry.candidateResult(additionalResult.Candidate.Index), additionalResult))
	}

	if len(merged) != len(additionalResults) {
		t.Fatalf("expected %d merged results, got %d", len(additionalResults), len(merged))
	}
	if merged[0].Candidate.Index != 1 || merged[1].Candidate.Index != 2 {
		t.Fatalf("expected result order [1, 2], got [%d, %d]", merged[0].Candidate.Index, merged[1].Candidate.Index)
	}
	assertFloatEqual(t, "candidate 1 avg", merged[0].DpsMetrics.Avg, 21)
	assertFloatEqual(t, "candidate 2 avg", merged[1].DpsMetrics.Avg, 11)
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
	if !core.WithinToleranceFloat64(expected, actual, 1e-9) {
		t.Fatalf("expected %s %.12f, got %.12f", name, expected, actual)
	}
}

// Candidates share their seed sequence, so a candidate that trails the leader on every
// single iteration is behind for real - the marginal standard errors overlap and would
// keep it, the paired difference culls it.
func TestBulkSimCullingUsesSharedNoise(t *testing.T) {
	leaderValues := []float64{100, 300, 200, 400}
	best := &proto.DistributionMetrics{Avg: 250, Stdev: math.Sqrt(12500), AllValues: leaderValues}
	trailing := &proto.DistributionMetrics{Avg: 240, Stdev: math.Sqrt(12500), AllValues: []float64{90, 290, 190, 390}}

	const iterations int32 = 4
	const intervalMultiplier = 1.0
	bestLowerBound := best.Avg - bulkSimDpsError(best, iterations)*intervalMultiplier

	pairedError, ok := bulkSimPairedDpsError(trailing, best)
	if !ok {
		t.Fatal("expected the runs to be pairable")
	}
	assertFloatEqual(t, "paired error", pairedError, 0)

	if !bulkSimCandidateIsCulled(trailing, best, bestLowerBound, iterations, intervalMultiplier) {
		t.Fatal("expected a candidate trailing on every iteration to be culled")
	}

	// Without the per-iteration values the marginal intervals overlap, so it survives.
	marginalTrailing := &proto.DistributionMetrics{Avg: trailing.Avg, Stdev: trailing.Stdev}
	if bulkSimCandidateIsCulled(marginalTrailing, &proto.DistributionMetrics{Avg: best.Avg, Stdev: best.Stdev}, bestLowerBound, iterations, intervalMultiplier) {
		t.Fatal("expected the marginal comparison to keep the candidate")
	}
}

func TestBulkSimPairedDpsErrorRequiresAlignedValues(t *testing.T) {
	best := &proto.DistributionMetrics{AllValues: []float64{100, 300, 200, 400}}

	if _, ok := bulkSimPairedDpsError(&proto.DistributionMetrics{AllValues: []float64{100, 300}}, best); ok {
		t.Fatal("expected differing iteration counts to be unpairable")
	}
	if _, ok := bulkSimPairedDpsError(&proto.DistributionMetrics{}, best); ok {
		t.Fatal("expected missing values to be unpairable")
	}

	// Independent noise leaves a real difference variance behind.
	noisy := &proto.DistributionMetrics{AllValues: []float64{400, 200, 300, 100}}
	pairedError, ok := bulkSimPairedDpsError(noisy, best)
	if !ok {
		t.Fatal("expected the runs to be pairable")
	}
	if pairedError <= 0 {
		t.Fatalf("expected a positive paired error, got %f", pairedError)
	}
}

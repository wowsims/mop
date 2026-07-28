package bulk

import (
	"fmt"
	"sync"
	"time"

	"github.com/wowsims/mop/sim/core/proto"
)

type BulkSimStageProgressTracker struct {
	mutex                               sync.Mutex
	emitter                             bulkSimStageProgressEmitter
	totalCandidates                     int
	iterations                          int32
	completedSimsBeforeCandidates       int
	completedIterationsBeforeCandidates int32
	completedCandidates                 int
	completedCandidateIterations        int32
	completedIterationsByCandidate      []int32
	lastProgressEmit                    time.Time
}

// Binds the parts of a stage's progress reporting that never change between emits, so
// call sites pass only what actually moves. Stage totals are only known after the
// baseline probe, so a stage uses one emitter for the probe and another for the rest.
type bulkSimStageProgressEmitter struct {
	progress        chan *proto.ProgressMetrics
	stage           proto.BulkSimStage
	totalSims       int
	totalIterations int32
}

func (emitter bulkSimStageProgressEmitter) report(completedSims int, completedIterations int32, dps float64) {
	emitBulkSimStageProgress(emitter.progress, emitter.stage, completedSims, emitter.totalSims, completedIterations, emitter.totalIterations, dps)
}

func emitBulkSimStageProgress(progress chan *proto.ProgressMetrics, stage proto.BulkSimStage, completedSims int, totalSims int, completedIterations int32, totalIterations int32, dps float64) {
	if progress == nil {
		return
	}

	progress <- &proto.ProgressMetrics{
		BulkStage:           stage,
		CompletedSims:       int32(completedSims),
		TotalSims:           int32(totalSims),
		CompletedIterations: completedIterations,
		TotalIterations:     totalIterations,
		Dps:                 dps,
	}
}

func (tracker *BulkSimStageProgressTracker) reportCandidateProgress(position int, progressMetrics *proto.ProgressMetrics) {
	if progressMetrics == nil || progressMetrics.TotalIterations == 0 {
		return
	}
	tracker.report(position, min(progressMetrics.CompletedIterations, tracker.iterations), progressMetrics.Dps, false)
}

func (tracker *BulkSimStageProgressTracker) reportCandidateComplete(position int, result *BulkSimCandidateResult) {
	dps := 0.0
	if result != nil && result.DpsMetrics != nil {
		dps = result.DpsMetrics.Avg
	}
	tracker.report(position, tracker.iterations, dps, true)
}

// Records how far one candidate has got and emits stage progress when an update is due.
// A finished candidate always emits, since sim counts are what the caller is waiting on.
func (tracker *BulkSimStageProgressTracker) report(position int, completedIterations int32, dps float64, candidateFinished bool) {
	if tracker.emitter.progress == nil || position < 0 || position >= tracker.totalCandidates {
		return
	}

	tracker.mutex.Lock()
	shouldEmit := candidateFinished || tracker.shouldEmitProgressLocked()
	if completedIterations > tracker.completedIterationsByCandidate[position] {
		tracker.completedCandidateIterations += completedIterations - tracker.completedIterationsByCandidate[position]
		tracker.completedIterationsByCandidate[position] = completedIterations
		shouldEmit = shouldEmit || tracker.shouldEmitProgressLocked()
	}
	if candidateFinished {
		tracker.completedCandidates++
	}
	totalCompletedIterations := tracker.completedIterationsBeforeCandidates + tracker.completedCandidateIterations
	completedSims := tracker.completedSimsBeforeCandidates + tracker.completedCandidates
	if shouldEmit {
		tracker.lastProgressEmit = time.Now()
	}
	tracker.mutex.Unlock()
	if !shouldEmit {
		return
	}

	tracker.emitter.report(completedSims, totalCompletedIterations, dps)
}

func (tracker *BulkSimStageProgressTracker) shouldEmitProgressLocked() bool {
	return tracker.lastProgressEmit.IsZero() || time.Since(tracker.lastProgressEmit) >= bulkSimProgressThrottle
}

func setBulkSimStageTiming(timings *proto.BulkSimTimings, stage proto.BulkSimStage, durationSeconds float64) {
	switch stage {
	case proto.BulkSimStage_BulkSimStageLow:
		timings.LowStageSeconds = durationSeconds
	case proto.BulkSimStage_BulkSimStageMedium:
		timings.MediumStageSeconds = durationSeconds
	case proto.BulkSimStage_BulkSimStageHigh:
		timings.HighStageSeconds = durationSeconds
	}
}

func formatBulkSimStageStart(config BulkSimStageConfig, candidateCount int, concurrency int, minIterations int32, carriedIterations int32) string {
	return fmt.Sprintf("- Stage: %s - Starting\n"+
		"Sims:\n"+
		"  Candidates: %d\n"+
		"  Total runs: %d-%d (baseline probe, optional baseline, candidates)\n"+
		"Stage config:\n"+
		"  Concurrency: %d\n"+
		"  Per-candidate concurrent sim: %t\n"+
		"  Min iterations: %d\n"+
		"  Carried iterations: %d\n"+
		"  Target error: %.2f%%",
		bulkSimStageLogName(config.Stage),
		candidateCount,
		candidateCount+1,
		candidateCount+2,
		concurrency,
		config.UseConcurrentSim,
		minIterations,
		carriedIterations,
		config.TargetErrorPct,
	)
}

func formatBulkSimStageSummary(status string, metrics *proto.BulkSimStageMetrics, completedSims int) string {
	return fmt.Sprintf("- Stage: %s - %s\n"+
		"Sims:\n"+
		"  Input gear sets: %d\n"+
		"  Completed candidates: %d\n"+
		"  Survivors: %d\n"+
		"Results:\n"+
		"  Iterations: %d\n"+
		"  Target error: %.2f%%\n"+
		"  Observed error: %.2f%%\n"+
		"  Best candidate DPS: %.2f\n"+
		"  Baseline DPS: %.2f\n"+
		"Timing:\n"+
		"  Duration: %.2fs",
		bulkSimStageLogName(metrics.Stage),
		status,
		metrics.InputGearSets,
		completedSims,
		metrics.Survivors,
		metrics.Iterations,
		metrics.TargetErrorPct,
		metrics.ObservedErrorPct,
		metrics.BestCandidateAvgDps,
		metrics.BaselineAvgDps,
		metrics.DurationSeconds,
	)
}

func bulkSimStageLogName(stage proto.BulkSimStage) string {
	switch stage {
	case proto.BulkSimStage_BulkSimStageLow:
		return "low"
	case proto.BulkSimStage_BulkSimStageMedium:
		return "medium"
	case proto.BulkSimStage_BulkSimStageHigh:
		return "high"
	default:
		return stage.String()
	}
}

package bulk

import (
	"sync"

	"github.com/wowsims/mop/sim/core"
	"github.com/wowsims/mop/sim/core/proto"
	"github.com/wowsims/mop/sim/core/simsignals"
	googleProto "google.golang.org/protobuf/proto"
)

type BulkSimStageTask struct {
	Candidate BulkSimCandidate
	Position  int
}

// Describes one pass of candidate sims: how much to run, where its progress sits
// within the stage, and which already-simmed metrics to fold into each result.
type bulkSimCandidateBatchConfig struct {
	iterations              int32
	seedOffset              int32
	concurrency             int
	completedSimsBase       int
	completedIterationsBase int32
	emitter                 bulkSimStageProgressEmitter
	carried                 *bulkSimStageCarryOver
}

// Runs `iterations` for every candidate across `concurrency` workers, folding in any
// carried-over metrics, and returns the collected results. Both the initial stage pass
// and the adaptive extra-iteration passes go through here so their queueing, progress
// accounting, abort handling and merging cannot drift apart.
func runBulkSimCandidateBatch(request *proto.BulkSimRequest, candidates []BulkSimCandidate, config BulkSimStageConfig, batch bulkSimCandidateBatchConfig, signals simsignals.Signals) []*BulkSimCandidateResult {
	jobs := make(chan BulkSimStageTask, len(candidates))
	// Results are written by position rather than collected from a channel: the slots
	// are disjoint, so no synchronisation is needed and the output order is the
	// candidate order instead of the completion order.
	resultsByPosition := make([]*BulkSimCandidateResult, len(candidates))
	progressTracker := &BulkSimStageProgressTracker{
		emitter:                             batch.emitter,
		totalCandidates:                     len(candidates),
		iterations:                          batch.iterations,
		completedSimsBeforeCandidates:       batch.completedSimsBase,
		completedIterationsBeforeCandidates: batch.completedIterationsBase,
		completedIterationsByCandidate:      make([]int32, len(candidates)),
	}
	var wg sync.WaitGroup

	for range max(1, batch.concurrency) {
		wg.Go(func() {
			for task := range jobs {
				if signals.Abort.IsTriggered() {
					return
				}

				candidateResult := runSingleBulkSimCandidate(request, task.Candidate, batch.iterations, batch.seedOffset, signals, config.UseConcurrentSim, func(progressMetrics *proto.ProgressMetrics) {
					progressTracker.reportCandidateProgress(task.Position, progressMetrics)
				})
				candidateResult = mergeBulkSimCandidateResults(batch.carried.candidateResult(task.Candidate.Index), candidateResult)
				progressTracker.reportCandidateComplete(task.Position, candidateResult)
				resultsByPosition[task.Position] = candidateResult
				if candidateResult.Error != nil {
					signals.Abort.Trigger()
				}
			}
		})
	}

	go func() {
		defer close(jobs)
		for idx, candidate := range candidates {
			if signals.Abort.IsTriggered() {
				return
			}
			jobs <- BulkSimStageTask{Candidate: candidate, Position: idx}
		}
	}()
	wg.Wait()

	// Aborted runs leave gaps where a candidate never started.
	return core.FilterSlice(resultsByPosition, func(candidateResult *BulkSimCandidateResult) bool {
		return candidateResult != nil
	})
}

// Runs one gear set start to finish with no progress reporting, for the paths that just
// need a number (the baseline of a run with no candidates).
func runSingleBulkSim(request *proto.BulkSimRequest, candidate BulkSimCandidate, iterations int32, signals simsignals.Signals) *BulkSimCandidateResult {
	return runSingleBulkSimCandidate(request, candidate, iterations, 0, signals, false, nil)
}

// Runs `iterations` for one gear set, starting the RNG `seedOffset` iterations into the
// sequence so a segment can extend an earlier run instead of repeating it.
func runSingleBulkSimCandidate(request *proto.BulkSimRequest, candidate BulkSimCandidate, iterations int32, seedOffset int32, signals simsignals.Signals, useConcurrentSim bool, progressCallback func(*proto.ProgressMetrics)) *BulkSimCandidateResult {
	if signals.Abort.IsTriggered() {
		return &BulkSimCandidateResult{Candidate: candidate, Error: bulkSimAbortedError()}
	}

	simRequest := googleProto.Clone(request.BaseRequest).(*proto.RaidSimRequest)
	simRequest.SimOptions.Iterations = iterations
	simRequest.SimOptions.RandomSeed += int64(seedOffset)
	simRequest.SimOptions.DebugFirstIteration = false
	simRequest.SimOptions.Debug = false
	// Every candidate runs the same seed sequence, so keeping the per-iteration values
	// lets culling compare paired differences instead of marginal errors.
	simRequest.SimOptions.SaveAllValues = true

	player, err := getBulkSimPlayer(simRequest.Raid)
	if err != "" {
		return &BulkSimCandidateResult{Candidate: candidate, Error: &proto.ErrorOutcome{Message: err}}
	}
	player.Equipment = googleProto.Clone(candidate.Gear).(*proto.EquipmentSpec)

	var simProgress chan *proto.ProgressMetrics
	var progressWg sync.WaitGroup
	if progressCallback != nil && !simRequest.SimOptions.IsTest {
		simProgress = make(chan *proto.ProgressMetrics, 16)
		progressWg.Go(func() {
			for progressMetrics := range simProgress {
				progressCallback(progressMetrics)
			}
		})
	}

	var simResult *proto.RaidSimResult
	if useConcurrentSim {
		simResult = core.RunRaidSimConcurrentWithSignals(simRequest, simProgress, signals)
	} else {
		simResult = core.RunSim(simRequest, simProgress, signals)
	}
	if simProgress != nil {
		progressWg.Wait()
	}
	if simResult == nil {
		return &BulkSimCandidateResult{Candidate: candidate, Error: &proto.ErrorOutcome{Message: "Bulk sim did not return a result"}}
	}
	if simResult.Error != nil {
		if simResult.Error.Type == proto.ErrorOutcomeType_ErrorOutcomeAborted && simResult.Error.Message == "" {
			return &BulkSimCandidateResult{Candidate: candidate, Error: bulkSimAbortedError()}
		}
		return &BulkSimCandidateResult{Candidate: candidate, Error: simResult.Error}
	}

	return &BulkSimCandidateResult{
		Candidate:  candidate,
		DpsMetrics: cleanBulkSimDpsMetrics(simResult.RaidMetrics.Dps),
	}
}

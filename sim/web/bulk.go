package main

import (
	"crypto/sha256"
	"log"
	"sync"
	"time"

	"github.com/wowsims/mop/sim/core"
	"github.com/wowsims/mop/sim/core/bulk"
	"github.com/wowsims/mop/sim/core/proto"
	reforgeoptimizer "github.com/wowsims/mop/sim/core/reforge_optimizer"
	"github.com/wowsims/mop/sim/core/simsignals"
	googleProto "google.golang.org/protobuf/proto"
)

const bulkSimReforgeProgressOptimizedCandidateFlushSize = 250
const bulkSimReforgeProgressUpdateInterval = 100 * time.Millisecond

type bulkSimReforgeTask struct {
	position  int
	candidate *proto.BulkGearCandidate
}

type bulkSimReforgeGearHash [sha256.Size]byte

type bulkSimReforgeCandidateCacheKey struct {
	gearKey     bulkSimReforgeGearHash
	includeGems bool
}

// A solve that some worker has already started. Workers handed the same gear join the
// existing solve instead of running their own: candidate de-duplication happens after this
// pre-pass, so duplicate gear sets do reach the optimizer, and a single solve can take
// seconds. gear is written before done is closed, so a waiter that has received from done
// reads it safely.
type bulkSimReforgeInFlightSolve struct {
	done chan struct{}
	gear *proto.EquipmentSpec
}

type bulkSimReforgeOptimizer struct {
	templateRequest    *proto.ReforgeOptimizeRequest
	templateRaid       *proto.Raid
	optimizedGearByKey map[bulkSimReforgeCandidateCacheKey]*proto.EquipmentSpec
	inFlightByKey      map[bulkSimReforgeCandidateCacheKey]*bulkSimReforgeInFlightSolve
	cacheMu            sync.RWMutex
}

func ensureBulkSimCandidatesGenerated(request *proto.BulkSimRequest) error {
	return bulk.EnsureBulkSimCandidatesGenerated(request)
}

func BulkCombinationCount(request *proto.BulkCombinationCountRequest) *proto.BulkCombinationCountResult {
	return bulk.BulkCombinationCount(request)
}

func BulkCandidates(request *proto.BulkCandidatesRequest) *proto.BulkCandidatesResult {
	return bulk.BulkCandidates(request)
}

// Runs entirely on its own goroutine: candidate generation alone can take minutes for a
// large selection, and the HTTP handler has to hand the client its progress id first or
// there is nothing to poll and nothing to cancel.
func BulkSimAsync(request *proto.BulkSimRequest, progress chan *proto.ProgressMetrics, requestId string) {
	go func() {
		// Registered before generation, not after: generation can take minutes, and the
		// client already holds its progress id, so an abort arriving in that window has to
		// land somewhere. bulk.BulkSimAsync registers the same id itself, so the id is
		// handed back before delegating to it.
		signals, err := simsignals.RegisterWithId(requestId)
		if err != nil {
			progress <- &proto.ProgressMetrics{
				BulkStage: proto.BulkSimStage_BulkSimStageError,
				FinalBulkSimResult: &proto.BulkSimResult{
					Error: &proto.ErrorOutcome{Message: "Couldn't register for signal API: " + err.Error()},
				},
			}
			close(progress)
			return
		}
		registered := true
		unregister := func() {
			if registered {
				simsignals.UnregisterId(requestId)
				registered = false
			}
		}
		defer unregister()

		// When all reforge candidates are restored from cache, request.Candidates is
		// intentionally empty and request.OptimizedCandidates is pre-populated.
		// In this case, do not regenerate candidates from bulk settings.
		fullyCachedReforgeRequest :=
			request != nil &&
				request.GetReforgeRequest() != nil &&
				len(request.GetCandidates()) == 0 &&
				len(request.GetOptimizedCandidates()) > 0
		if !fullyCachedReforgeRequest {
			shouldLogReforgeStages := request.GetReforgeRequest() != nil
			candidateGenerationStartedAt := time.Now()
			if shouldLogReforgeStages {
				log.Printf("[Bulk Sim] Candidate generation started")
			}
			if err := ensureBulkSimCandidatesGenerated(request); err != nil {
				progress <- &proto.ProgressMetrics{
					BulkStage: proto.BulkSimStage_BulkSimStageError,
					FinalBulkSimResult: &proto.BulkSimResult{
						Error: &proto.ErrorOutcome{Message: err.Error()},
					},
				}
				close(progress)
				return
			}
			if shouldLogReforgeStages {
				log.Printf("[Bulk Sim] Candidate generation completed total=%s candidates=%d optimizedCandidates=%d", time.Since(candidateGenerationStartedAt), len(request.GetCandidates()), len(request.GetOptimizedCandidates()))
			}
		} else {
			log.Printf("[Bulk Sim] Candidate generation skipped optimizedCandidates=%d", len(request.GetOptimizedCandidates()))
		}
		if signals.Abort.IsTriggered() {
			log.Printf("[Bulk Sim] Cancelled during candidate generation")
			progress <- &proto.ProgressMetrics{
				BulkStage: proto.BulkSimStage_BulkSimStageError,
				FinalBulkSimResult: &proto.BulkSimResult{
					Error: &proto.ErrorOutcome{Type: proto.ErrorOutcomeType_ErrorOutcomeAborted},
				},
			}
			close(progress)
			return
		}
		if request.GetReforgeRequest() == nil {
			unregister()
			bulk.BulkSimAsync(request, progress, requestId)
			return
		}

		optimizeBulkSimReforgeCandidates(request, progress, signals)
		if signals.Abort.IsTriggered() {
			unregister()
			log.Printf("[Bulk Sim] Cancelled during reforge optimization")
			progress <- &proto.ProgressMetrics{
				BulkStage: proto.BulkSimStage_BulkSimStageReforge,
				FinalBulkSimResult: &proto.BulkSimResult{
					OptimizedCandidates: request.GetOptimizedCandidates(),
					Error:               &proto.ErrorOutcome{Type: proto.ErrorOutcomeType_ErrorOutcomeAborted},
				},
			}
			close(progress)
			return
		}
		request.ReforgeRequest = nil
		unregister()
		bulk.BulkSimAsync(request, progress, requestId)
	}()
}

func optimizeBulkSimReforgeCandidates(request *proto.BulkSimRequest, progress chan *proto.ProgressMetrics, signals simsignals.Signals) {
	reforgeRequest := request.GetReforgeRequest()
	if reforgeRequest == nil || request.GetBaseRequest().GetRaid() == nil {
		return
	}

	totalCandidates := countBulkSimReforgeCandidates(request.GetCandidates())
	if totalCandidates == 0 {
		request.Candidates = dedupeBulkSimReforgeCandidates(getBulkSimRequestBaselineGear(request), request.GetOptimizedCandidates())
		request.OptimizedCandidates = nil
		return
	}
	concurrency := bulk.GetBulkSimStageConcurrency(request, bulk.BulkSimStageConfig{Stage: proto.BulkSimStage_BulkSimStageReforge})
	concurrency = max(1, min(concurrency, int(totalCandidates)))
	stageStartedAt := time.Now()
	log.Printf("[Bulk Sim] Reforge optimization started candidates=%d concurrency=%d", totalCandidates, concurrency)
	warmBulkSimReforgeDatabase(request)
	emitBulkSimReforgeProgress(progress, 0, totalCandidates, nil)

	optimizer := newBulkSimReforgeOptimizer(request)
	accumulator := newBulkSimReforgeAccumulator(request.GetCandidates(), totalCandidates, progress != nil)

	jobs := make(chan bulkSimReforgeTask, max(16, 2*concurrency))
	var wg sync.WaitGroup
	workerCount := max(1, concurrency)
	for range workerCount {
		wg.Go(func() {
			for task := range jobs {
				if signals.Abort.IsTriggered() {
					continue
				}

				duration, completed, optimized := optimizeBulkSimReforgeCandidateTask(optimizer, reforgeRequest, task.candidate, signals)
				update := accumulator.complete(task, duration, completed, optimized)
				if update.shouldEmit() {
					emitBulkSimReforgeProgress(progress, update.completedCandidates, totalCandidates, update.candidateBatch)
				}
			}
		})
	}

	for position, candidate := range request.GetCandidates() {
		if signals.Abort.IsTriggered() {
			break
		}
		if candidate == nil || candidate.Gear == nil {
			continue
		}
		jobs <- bulkSimReforgeTask{position: position, candidate: candidate}
	}
	close(jobs)
	wg.Wait()
	// Flush any remaining partial candidates at the end.
	if finalUpdate := accumulator.flush(); finalUpdate.shouldEmit() {
		emitBulkSimReforgeProgress(progress, finalUpdate.completedCandidates, totalCandidates, finalUpdate.candidateBatch)
	}
	completedCandidates, minCandidateDuration, avgCandidateDuration, maxCandidateDuration := accumulator.timings()
	log.Printf("[Bulk Sim] Reforge optimization completed candidates=%d total=%s minCandidate=%s avgCandidate=%s maxCandidate=%s", completedCandidates, time.Since(stageStartedAt), minCandidateDuration, avgCandidateDuration, maxCandidateDuration)

	baselineGear := getBulkSimRequestBaselineGear(request)
	restoredCandidates := request.GetOptimizedCandidates()
	// Everything that finished gets simmed; only the solves that succeeded get reported as
	// optimized, because that list is what the frontend writes into its reforge cache.
	simCandidates := concatBulkGearCandidates(restoredCandidates, compactBulkGearCandidates(accumulator.completedByPosition()))
	optimizedCandidates := concatBulkGearCandidates(restoredCandidates, compactBulkGearCandidates(accumulator.optimizedByPosition()))
	if signals.Abort.IsTriggered() {
		request.OptimizedCandidates = optimizedCandidates
		request.Candidates = nil
		return
	}

	// Deduplicate for simulation: avoid running the same reforged gear twice and exclude
	// gear identical to the baseline (it is already simmed separately).
	request.Candidates = dedupeBulkSimReforgeCandidates(baselineGear, simCandidates)
	// Include ALL optimized candidates (before dedup) so the frontend can write a cache entry
	// for every input gear set, including those whose optimal reforge matched another candidate
	// or the baseline. Without this, filtered runs (e.g. Require 4P) would always miss the
	// cache because the matching entries were never written after the first run.
	request.OptimizedCandidates = optimizedCandidates
}

// Collects reforge pre-pass completions from all workers and decides what progress to
// emit. The mutex has a single owner here, and emitting is deliberately left to the
// caller: emitBulkSimReforgeProgress does a blocking channel send, which must not
// happen under the lock or every worker stalls behind the holder when the consumer
// falls behind.
type bulkSimReforgeAccumulator struct {
	mutex                sync.Mutex
	totalCandidates      int32
	reportProgress       bool
	completedByPositions []*proto.BulkGearCandidate
	// Candidates whose solve actually succeeded. Only these may be reported as optimized
	// candidates; completedByPositions also holds the ones that fell back to their input gear.
	optimizedByPositions []*proto.BulkGearCandidate
	completedCandidates  int32
	totalDuration        time.Duration
	minDuration          time.Duration
	maxDuration          time.Duration
	// Completions are emitted in larger cache-write batches so progress updates stay
	// lightweight even for very large candidate counts.
	candidateBatch   []*proto.BulkGearCandidate
	lastProgressEmit time.Time
}

// What the caller should emit after a completion. A nil batch with emitUpdate false
// means nothing is due yet.
type bulkSimReforgeProgressUpdate struct {
	completedCandidates int32
	candidateBatch      []*proto.BulkGearCandidate
	emitUpdate          bool
}

func (update bulkSimReforgeProgressUpdate) shouldEmit() bool {
	return update.candidateBatch != nil || update.emitUpdate
}

func newBulkSimReforgeAccumulator(candidates []*proto.BulkGearCandidate, totalCandidates int32, reportProgress bool) *bulkSimReforgeAccumulator {
	return &bulkSimReforgeAccumulator{
		totalCandidates:      totalCandidates,
		reportProgress:       reportProgress,
		completedByPositions: make([]*proto.BulkGearCandidate, len(candidates)),
		optimizedByPositions: make([]*proto.BulkGearCandidate, len(candidates)),
		candidateBatch:       make([]*proto.BulkGearCandidate, 0, bulkSimReforgeProgressOptimizedCandidateFlushSize),
		lastProgressEmit:     time.Now(),
	}
}

func (accumulator *bulkSimReforgeAccumulator) complete(task bulkSimReforgeTask, duration time.Duration, completed bool, optimized bool) bulkSimReforgeProgressUpdate {
	accumulator.mutex.Lock()
	defer accumulator.mutex.Unlock()

	accumulator.totalDuration += duration
	var batch []*proto.BulkGearCandidate
	if completed {
		accumulator.completedCandidates++
		accumulator.completedByPositions[task.position] = task.candidate
		if optimized {
			accumulator.optimizedByPositions[task.position] = task.candidate
			accumulator.candidateBatch = append(accumulator.candidateBatch, task.candidate)
		}
		if accumulator.completedCandidates == 1 || duration < accumulator.minDuration {
			accumulator.minDuration = duration
		}
		if duration > accumulator.maxDuration {
			accumulator.maxDuration = duration
		}
		if len(accumulator.candidateBatch) >= bulkSimReforgeProgressOptimizedCandidateFlushSize {
			batch = accumulator.takeBatchLocked()
		}
	}

	update := bulkSimReforgeProgressUpdate{completedCandidates: accumulator.completedCandidates, candidateBatch: batch}
	if batch == nil {
		update.emitUpdate = accumulator.progressUpdateDueLocked()
	}
	return update
}

func (accumulator *bulkSimReforgeAccumulator) flush() bulkSimReforgeProgressUpdate {
	accumulator.mutex.Lock()
	defer accumulator.mutex.Unlock()
	return bulkSimReforgeProgressUpdate{
		completedCandidates: accumulator.completedCandidates,
		candidateBatch:      accumulator.takeBatchLocked(),
	}
}

// Hands the accumulated batch to the caller and starts a fresh one. Ownership must
// transfer rather than the slice being reused, because the batch is emitted after the
// lock is released and other workers keep appending in the meantime.
func (accumulator *bulkSimReforgeAccumulator) takeBatchLocked() []*proto.BulkGearCandidate {
	if len(accumulator.candidateBatch) == 0 {
		return nil
	}
	batch := accumulator.candidateBatch
	accumulator.candidateBatch = make([]*proto.BulkGearCandidate, 0, bulkSimReforgeProgressOptimizedCandidateFlushSize)
	return batch
}

func (accumulator *bulkSimReforgeAccumulator) progressUpdateDueLocked() bool {
	if !accumulator.reportProgress {
		return false
	}
	if accumulator.completedCandidates < accumulator.totalCandidates && time.Since(accumulator.lastProgressEmit) < bulkSimReforgeProgressUpdateInterval {
		return false
	}

	accumulator.lastProgressEmit = time.Now()
	return true
}

func (accumulator *bulkSimReforgeAccumulator) completedByPosition() []*proto.BulkGearCandidate {
	accumulator.mutex.Lock()
	defer accumulator.mutex.Unlock()
	return accumulator.completedByPositions
}

func (accumulator *bulkSimReforgeAccumulator) optimizedByPosition() []*proto.BulkGearCandidate {
	accumulator.mutex.Lock()
	defer accumulator.mutex.Unlock()
	return accumulator.optimizedByPositions
}

func (accumulator *bulkSimReforgeAccumulator) timings() (completed int32, minDuration time.Duration, avgDuration time.Duration, maxDuration time.Duration) {
	accumulator.mutex.Lock()
	defer accumulator.mutex.Unlock()

	avgDuration = time.Duration(0)
	if accumulator.completedCandidates > 0 {
		avgDuration = time.Duration(int64(accumulator.totalDuration) / int64(accumulator.completedCandidates))
	}
	return accumulator.completedCandidates, accumulator.minDuration, avgDuration, accumulator.maxDuration
}

func newBulkSimReforgeOptimizer(request *proto.BulkSimRequest) *bulkSimReforgeOptimizer {
	templateRequest := googleProto.Clone(request.GetReforgeRequest()).(*proto.ReforgeOptimizeRequest)
	if templateRequest.Settings == nil {
		templateRequest.Settings = &proto.ReforgeSettings{}
	}
	templateRequest.Mode = proto.ReforgeOptimizeMode_ReforgeOptimizeModeBulk
	templateRaid := googleProto.Clone(request.GetBaseRequest().GetRaid()).(*proto.Raid)
	return &bulkSimReforgeOptimizer{
		templateRequest:    templateRequest,
		templateRaid:       templateRaid,
		optimizedGearByKey: make(map[bulkSimReforgeCandidateCacheKey]*proto.EquipmentSpec),
		inFlightByKey:      make(map[bulkSimReforgeCandidateCacheKey]*bulkSimReforgeInFlightSolve),
	}
}

func warmBulkSimReforgeDatabase(request *proto.BulkSimRequest) {
	raid := googleProto.Clone(request.GetBaseRequest().GetRaid()).(*proto.Raid)
	result := core.ComputeStats(&proto.ComputeStatsRequest{Raid: raid, SkipRotation: true})
	if result.GetErrorResult() != "" {
		log.Printf("[Bulk Sim] Reforge database warm-up failed: %s", result.GetErrorResult())
	}
}

// Returns whether the candidate is done (and so should be simmed) and, separately, whether
// it was actually optimized. A failed solve still sims with its original gear, but must not
// be reported as an optimized candidate: the frontend writes those into a 14-day reforge
// cache, and caching gear as its own optimization poisons every later run of that gear.
func optimizeBulkSimReforgeCandidateTask(optimizer *bulkSimReforgeOptimizer, reforgeRequest *proto.ReforgeOptimizeRequest, candidate *proto.BulkGearCandidate, signals simsignals.Signals) (duration time.Duration, completed bool, optimized bool) {
	startedAt := time.Now()
	gearKey := bulkSimReforgeGearKey(candidate.Gear)
	// Retry without gems: a gem-inclusive model can be infeasible where the
	// reforge-only one is not.
	includeGems := reforgeRequest.GetSettings().GetIncludeGems()
	optimizedGear := optimizer.optimizeWithKey(candidate.Gear, gearKey, includeGems, signals)
	if optimizedGear == nil && !signals.Abort.IsTriggered() && includeGems {
		optimizedGear = optimizer.optimizeWithKey(candidate.Gear, gearKey, false, signals)
	}
	if optimizedGear == nil {
		if signals.Abort.IsTriggered() {
			return time.Since(startedAt), false, false
		}
		log.Printf("[Bulk Sim] Reforge optimization failed for candidate %d; using original gear", candidate.Index)
		return time.Since(startedAt), true, false
	}

	candidate.Gear = optimizedGear
	return time.Since(startedAt), true, true
}

func countBulkSimReforgeCandidates(candidates []*proto.BulkGearCandidate) int32 {
	var count int32
	for _, candidate := range candidates {
		if candidate != nil && candidate.Gear != nil {
			count++
		}
	}
	return count
}

func emitBulkSimReforgeProgress(progress chan *proto.ProgressMetrics, completed int32, total int32, partialCandidates []*proto.BulkGearCandidate) {
	if progress == nil {
		return
	}

	progress <- &proto.ProgressMetrics{
		BulkStage:           proto.BulkSimStage_BulkSimStageReforge,
		CompletedSims:       completed,
		TotalSims:           total,
		CompletedIterations: completed,
		TotalIterations:     total,
		OptimizedCandidates: partialCandidates,
	}
}

func getBulkSimRequestBaselineGear(request *proto.BulkSimRequest) *proto.EquipmentSpec {
	parties := request.GetBaseRequest().GetRaid().GetParties()
	if len(parties) == 0 || parties[0] == nil {
		return nil
	}
	players := parties[0].GetPlayers()
	if len(players) == 0 || players[0] == nil {
		return nil
	}
	return players[0].GetEquipment()
}

func (optimizer *bulkSimReforgeOptimizer) optimizeWithKey(gear *proto.EquipmentSpec, gearKey bulkSimReforgeGearHash, includeGems bool, signals simsignals.Signals) *proto.EquipmentSpec {
	key := bulkSimReforgeCandidateCacheKey{gearKey: gearKey, includeGems: includeGems}
	optimizer.cacheMu.RLock()
	cachedGear, cached := optimizer.optimizedGearByKey[key]
	optimizer.cacheMu.RUnlock()
	if cached {
		// Clone on the hit path too: the caller assigns the result to candidate.Gear, so
		// handing out the cache's own pointer would let any later in-place edit of one
		// candidate's gear corrupt the entry every other candidate with the same gear reads.
		return cloneEquipmentSpecOrNil(cachedGear)
	}

	optimizer.cacheMu.Lock()
	// Re-check under the write lock: another worker may have finished, or started, in the
	// window since the read lock was dropped.
	if cachedGear, cached := optimizer.optimizedGearByKey[key]; cached {
		optimizer.cacheMu.Unlock()
		return cloneEquipmentSpecOrNil(cachedGear)
	}
	if running := optimizer.inFlightByKey[key]; running != nil {
		optimizer.cacheMu.Unlock()
		<-running.done
		return cloneEquipmentSpecOrNil(running.gear)
	}
	inFlight := &bulkSimReforgeInFlightSolve{done: make(chan struct{})}
	optimizer.inFlightByKey[key] = inFlight
	optimizer.cacheMu.Unlock()

	optimizedGear := optimizer.runReforgeOptimize(gear, key, signals)

	// Publish to the waiters before dropping the map entry. Closing first means a worker that
	// took the entry just before this point still gets the result, and one arriving just after
	// finds the cache entry runReforgeOptimize wrote — so no window reopens a duplicate solve.
	inFlight.gear = optimizedGear
	close(inFlight.done)
	optimizer.cacheMu.Lock()
	delete(optimizer.inFlightByKey, key)
	optimizer.cacheMu.Unlock()

	return cloneEquipmentSpecOrNil(optimizedGear)
}

// runReforgeOptimize runs one solve and records it in the result cache. Returns nil when the
// solve failed or was aborted. An abort is deliberately left uncached: the run is tearing down,
// and caching the empty result would make it look like a genuine failure.
func (optimizer *bulkSimReforgeOptimizer) runReforgeOptimize(gear *proto.EquipmentSpec, key bulkSimReforgeCandidateCacheKey, signals simsignals.Signals) *proto.EquipmentSpec {
	reforgeRequest := optimizer.optimizeRequest(gear, key.includeGems)
	if reforgeRequest == nil {
		return nil
	}

	result := reforgeoptimizer.OptimizeAsync(reforgeRequest, signals)
	if result.GetError() != nil {
		if result.GetError().GetType() == proto.ErrorOutcomeType_ErrorOutcomeAborted {
			return nil
		}
		log.Printf("[Bulk Sim] Reforge optimization failed includeGems=%t: %s", key.includeGems, result.GetError().GetMessage())
		optimizer.storeCachedGear(key, nil)
		return nil
	}
	optimizedGear := result.GetOptimizedGear()
	optimizer.storeCachedGear(key, optimizedGear)
	return optimizedGear
}

func (optimizer *bulkSimReforgeOptimizer) optimizeRequest(gear *proto.EquipmentSpec, includeGems bool) *proto.ReforgeOptimizeRequest {
	reforgeRequest := googleProto.Clone(optimizer.templateRequest).(*proto.ReforgeOptimizeRequest)
	raid := googleProto.Clone(optimizer.templateRaid).(*proto.Raid)
	if len(raid.Parties) == 0 || raid.Parties[0] == nil || len(raid.Parties[0].Players) == 0 || raid.Parties[0].Players[0] == nil {
		return nil
	}

	if reforgeRequest.Settings == nil {
		reforgeRequest.Settings = &proto.ReforgeSettings{}
	}
	reforgeRequest.Settings.IncludeGems = includeGems
	raid.Parties[0].Players[0].Equipment = googleProto.Clone(gear).(*proto.EquipmentSpec)
	reforgeRequest.Raid = raid

	return reforgeRequest
}

func (optimizer *bulkSimReforgeOptimizer) storeCachedGear(key bulkSimReforgeCandidateCacheKey, gear *proto.EquipmentSpec) {
	optimizer.cacheMu.Lock()
	defer optimizer.cacheMu.Unlock()
	optimizer.optimizedGearByKey[key] = cloneEquipmentSpecOrNil(gear)
}

func cloneEquipmentSpecOrNil(gear *proto.EquipmentSpec) *proto.EquipmentSpec {
	if gear == nil {
		return nil
	}
	return googleProto.Clone(gear).(*proto.EquipmentSpec)
}

func dedupeBulkSimReforgeCandidates(baselineGear *proto.EquipmentSpec, candidates []*proto.BulkGearCandidate) []*proto.BulkGearCandidate {
	seen := make(map[bulkSimReforgeGearHash]struct{}, len(candidates)+1)
	if baselineGear != nil {
		seen[bulkSimReforgeGearKey(baselineGear)] = struct{}{}
	}

	deduped := make([]*proto.BulkGearCandidate, 0, len(candidates))
	for _, candidate := range candidates {
		if candidate == nil || candidate.Gear == nil {
			continue
		}

		key := bulkSimReforgeGearKey(candidate.Gear)
		if _, ok := seen[key]; ok {
			continue
		}
		seen[key] = struct{}{}
		deduped = append(deduped, candidate)
	}
	return deduped
}

func compactBulkGearCandidates(candidates []*proto.BulkGearCandidate) []*proto.BulkGearCandidate {
	return core.FilterSlice(candidates, func(candidate *proto.BulkGearCandidate) bool {
		return candidate != nil && candidate.Gear != nil
	})
}

// Always allocates: the sim list and the optimized list both extend the same restored
// slice, and appending onto it twice would have the second call overwrite the first.
func concatBulkGearCandidates(first []*proto.BulkGearCandidate, second []*proto.BulkGearCandidate) []*proto.BulkGearCandidate {
	combined := make([]*proto.BulkGearCandidate, 0, len(first)+len(second))
	combined = append(combined, first...)
	return append(combined, second...)
}

var deterministicProtoMarshalOptions = googleProto.MarshalOptions{Deterministic: true}
var bulkSimReforgeMarshalBufferPool = sync.Pool{
	New: func() any {
		buf := make([]byte, 0, 1024)
		return &buf
	},
}

func bulkSimReforgeGearKey(gear *proto.EquipmentSpec) bulkSimReforgeGearHash {
	if gear == nil {
		return sha256.Sum256(nil)
	}

	bufferPtr := bulkSimReforgeMarshalBufferPool.Get().(*[]byte)
	buffer := (*bufferPtr)[:0]
	data, err := deterministicProtoMarshalOptions.MarshalAppend(buffer, gear)
	if err != nil {
		bulkSimReforgeMarshalBufferPool.Put(bufferPtr)
		return sha256.Sum256([]byte(gear.String()))
	}

	hash := sha256.Sum256(data)
	if cap(data) <= 64*1024 {
		*bufferPtr = data[:0]
		bulkSimReforgeMarshalBufferPool.Put(bufferPtr)
	}
	return hash
}

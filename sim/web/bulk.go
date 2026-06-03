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

type bulkSimReforgeTask struct {
	position  int
	candidate *proto.BulkGearCandidate
}

type bulkSimReforgeGearHash [sha256.Size]byte

type bulkSimReforgeCandidateCacheKey struct {
	gearKey     bulkSimReforgeGearHash
	includeGems bool
}

type bulkSimReforgeOptimizer struct {
	templateRequest    *proto.ReforgeOptimizeRequest
	templateRaid       *proto.Raid
	optimizedGearByKey map[bulkSimReforgeCandidateCacheKey]*proto.EquipmentSpec
	cacheMu            sync.Mutex
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

func BulkSimAsync(request *proto.BulkSimRequest, progress chan *proto.ProgressMetrics, requestId string) {
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
	if request.GetReforgeRequest() == nil {
		bulk.BulkSimAsync(request, progress, requestId)
		return
	}
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

	go func() {
		optimizeBulkSimReforgeCandidates(request, progress, signals)
		if signals.Abort.IsTriggered() {
			simsignals.UnregisterId(requestId)
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
		simsignals.UnregisterId(requestId)
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
	var completedCandidates int32
	var totalCandidateDuration time.Duration
	var minCandidateDuration time.Duration
	var maxCandidateDuration time.Duration
	completedReforgeCandidatesByPosition := make([]*proto.BulkGearCandidate, len(request.GetCandidates()))
	var progressMu sync.Mutex

	// Track completed candidates to emit in larger cache-write batches so progress
	// updates stay lightweight even for very large candidate counts.
	completedCandidateBatch := make([]*proto.BulkGearCandidate, 0, bulkSimReforgeProgressOptimizedCandidateFlushSize)

	flushCandidateBatch := func() bool {
		if len(completedCandidateBatch) == 0 {
			return false
		}
		emitBulkSimReforgeProgress(progress, completedCandidates, totalCandidates, completedCandidateBatch)
		completedCandidateBatch = completedCandidateBatch[:0]
		return true
	}

	emitProgressUpdate := func() {
		if progress == nil {
			return
		}

		emitBulkSimReforgeProgress(progress, completedCandidates, totalCandidates, nil)
	}

	batch := make([]bulkSimReforgeTask, 0, getBulkSimReforgeBatchSize(concurrency))
	flushBatch := func() {
		if len(batch) == 0 {
			return
		}
		emittedCandidates := false
		processBulkSimReforgeBatch(batch, concurrency, signals, func(task bulkSimReforgeTask) {
			duration, completed := optimizeBulkSimReforgeCandidateTask(optimizer, reforgeRequest, task.candidate, signals)
			progressMu.Lock()
			totalCandidateDuration += duration
			if completed {
				completedCandidates++
				completedReforgeCandidatesByPosition[task.position] = task.candidate
				request.Candidates[task.position] = nil
				completedCandidateBatch = append(completedCandidateBatch, task.candidate)
				if completedCandidates == 1 || duration < minCandidateDuration {
					minCandidateDuration = duration
				}
				if duration > maxCandidateDuration {
					maxCandidateDuration = duration
				}
				if len(completedCandidateBatch) >= bulkSimReforgeProgressOptimizedCandidateFlushSize {
					emittedCandidates = flushCandidateBatch()
				}
			}
			progressMu.Unlock()
		})
		progressMu.Lock()
		if !emittedCandidates {
			emitProgressUpdate()
		}
		progressMu.Unlock()
		clear(batch)
		batch = batch[:0]
	}

	for position, candidate := range request.GetCandidates() {
		if signals.Abort.IsTriggered() {
			break
		}
		if candidate == nil || candidate.Gear == nil {
			continue
		}
		batch = append(batch, bulkSimReforgeTask{position: position, candidate: candidate})
		if len(batch) == cap(batch) {
			flushBatch()
		}
	}
	flushBatch()
	// Flush any remaining partial candidates at the end.
	progressMu.Lock()
	flushCandidateBatch()
	progressMu.Unlock()
	avgCandidateDuration := time.Duration(0)
	if completedCandidates > 0 {
		avgCandidateDuration = time.Duration(int64(totalCandidateDuration) / int64(completedCandidates))
	}
	log.Printf("[Bulk Sim] Reforge optimization completed candidates=%d total=%s minCandidate=%s avgCandidate=%s maxCandidate=%s", completedCandidates, time.Since(stageStartedAt), minCandidateDuration, avgCandidateDuration, maxCandidateDuration)

	baselineGear := getBulkSimRequestBaselineGear(request)
	completedReforgeCandidates := compactBulkGearCandidates(completedReforgeCandidatesByPosition)
	allReforgeCandidates := append(request.GetOptimizedCandidates(), completedReforgeCandidates...)
	if signals.Abort.IsTriggered() {
		request.OptimizedCandidates = allReforgeCandidates
		request.Candidates = nil
		return
	}

	// Deduplicate for simulation: avoid running the same reforged gear twice and exclude
	// gear identical to the baseline (it is already simmed separately).
	request.Candidates = dedupeBulkSimReforgeCandidates(baselineGear, allReforgeCandidates)
	// Include ALL reforged candidates (before dedup) so the frontend can write a cache entry
	// for every input gear set, including those whose optimal reforge matched another candidate
	// or the baseline. Without this, filtered runs (e.g. Require 4P) would always miss the
	// cache because the matching entries were never written after the first run.
	request.OptimizedCandidates = allReforgeCandidates
}

func getBulkSimReforgeBatchSize(concurrency int) int {
	return max(16, 2*concurrency)
}

func processBulkSimReforgeBatch(batch []bulkSimReforgeTask, concurrency int, signals simsignals.Signals, optimize func(bulkSimReforgeTask)) {
	jobs := make(chan bulkSimReforgeTask, len(batch))
	var wg sync.WaitGroup
	workerCount := min(concurrency, len(batch))
	for range workerCount {
		wg.Go(func() {
			for task := range jobs {
				if signals.Abort.IsTriggered() {
					return
				}
				optimize(task)
			}
		})
	}
	for _, task := range batch {
		if signals.Abort.IsTriggered() {
			break
		}
		jobs <- task
	}
	close(jobs)
	wg.Wait()
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
	}
}

func warmBulkSimReforgeDatabase(request *proto.BulkSimRequest) {
	raid := googleProto.Clone(request.GetBaseRequest().GetRaid()).(*proto.Raid)
	result := core.ComputeStats(&proto.ComputeStatsRequest{Raid: raid})
	if result.GetErrorResult() != "" {
		log.Printf("[Bulk Sim] Reforge database warm-up failed: %s", result.GetErrorResult())
	}
}

func optimizeBulkSimReforgeCandidateTask(optimizer *bulkSimReforgeOptimizer, reforgeRequest *proto.ReforgeOptimizeRequest, candidate *proto.BulkGearCandidate, signals simsignals.Signals) (time.Duration, bool) {
	startedAt := time.Now()
	optimizedGear := optimizer.optimize(candidate.Gear, true, signals)
	if optimizedGear == nil && !signals.Abort.IsTriggered() && reforgeRequest.GetSettings().GetIncludeGems() {
		optimizedGear = optimizer.optimize(candidate.Gear, false, signals)
	}
	if optimizedGear == nil {
		if signals.Abort.IsTriggered() {
			return time.Since(startedAt), false
		}
		log.Printf("[Bulk Sim] Reforge optimization failed for candidate %d; using original gear", candidate.Index)
		return time.Since(startedAt), true
	}

	candidate.Gear = optimizedGear
	return time.Since(startedAt), true
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

func (optimizer *bulkSimReforgeOptimizer) optimize(gear *proto.EquipmentSpec, includeGems bool, signals simsignals.Signals) *proto.EquipmentSpec {
	key := bulkSimReforgeCandidateCacheKey{gearKey: bulkSimReforgeGearKey(gear), includeGems: includeGems}
	optimizer.cacheMu.Lock()
	if optimizedGear, ok := optimizer.optimizedGearByKey[key]; ok {
		optimizer.cacheMu.Unlock()
		return cloneEquipmentSpecOrNil(optimizedGear)
	}
	optimizer.cacheMu.Unlock()

	reforgeRequest := optimizer.optimizeRequest(gear, includeGems)
	if reforgeRequest == nil {
		return nil
	}

	result := reforgeoptimizer.OptimizeAsync(reforgeRequest, signals)
	if result.GetError() != nil {
		if result.GetError().GetType() == proto.ErrorOutcomeType_ErrorOutcomeAborted {
			return nil
		}
		log.Printf("[Bulk Sim] Reforge optimization failed includeGems=%t: %s", includeGems, result.GetError().GetMessage())
		optimizer.storeCachedGear(key, nil)
		return nil
	}
	optimizedGear := result.GetOptimizedGear()
	optimizer.storeCachedGear(key, optimizedGear)
	return cloneEquipmentSpecOrNil(optimizedGear)
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
	seen := make(map[bulkSimReforgeGearHash]bool, len(candidates)+1)
	if baselineGear != nil {
		seen[bulkSimReforgeGearKey(baselineGear)] = true
	}

	deduped := make([]*proto.BulkGearCandidate, 0, len(candidates))
	for _, candidate := range candidates {
		if candidate == nil || candidate.Gear == nil {
			continue
		}

		key := bulkSimReforgeGearKey(candidate.Gear)
		if seen[key] {
			continue
		}
		seen[key] = true
		deduped = append(deduped, candidate)
	}
	return deduped
}

func compactBulkGearCandidates(candidates []*proto.BulkGearCandidate) []*proto.BulkGearCandidate {
	compacted := make([]*proto.BulkGearCandidate, 0, len(candidates))
	for _, candidate := range candidates {
		if candidate == nil || candidate.Gear == nil {
			continue
		}
		compacted = append(compacted, candidate)
	}
	return compacted
}

func bulkSimReforgeGearKey(gear *proto.EquipmentSpec) bulkSimReforgeGearHash {
	data, err := googleProto.MarshalOptions{Deterministic: true}.Marshal(gear)
	if err != nil {
		if gear == nil {
			return sha256.Sum256(nil)
		}
		return sha256.Sum256([]byte(gear.String()))
	}
	return sha256.Sum256(data)
}

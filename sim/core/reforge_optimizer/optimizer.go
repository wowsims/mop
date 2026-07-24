package reforgeoptimizer

import (
	"context"
	"errors"
	"fmt"
	"log"
	"sync/atomic"
	"time"

	"github.com/wowsims/mop/sim/core"
	"github.com/wowsims/mop/sim/core/proto"
	"github.com/wowsims/mop/sim/core/simsignals"
	"github.com/wowsims/mop/sim/core/stats"
	"google.golang.org/protobuf/encoding/protojson"
	googleProto "google.golang.org/protobuf/proto"
)

var reforgeOptimizeRequestID atomic.Uint64

func Optimize(request *proto.ReforgeOptimizeRequest) *proto.ReforgeOptimizeResult {
	return OptimizeAsync(request, simsignals.CreateSignals())
}

func OptimizeAsync(request *proto.ReforgeOptimizeRequest, signals simsignals.Signals) *proto.ReforgeOptimizeResult {
	requestID := reforgeOptimizeRequestID.Add(1)
	startedAt := time.Now()
	normalizedConfig, err := validateReforgeOptimizeSettings(request)
	if err != nil {
		log.Printf("[reforgeOptimize:%d] failed validating settings after %s: %s", requestID, time.Since(startedAt), err.Error())
		return optimizeError(err.Error())
	}
	settings := normalizedConfig.settings
	debug := request.GetDebug()
	logAbort := request.GetMode() != proto.ReforgeOptimizeMode_ReforgeOptimizeModeBulk || debug
	if debug {
		log.Printf("[reforgeOptimize:%d] started includeGems=%t debug=%t", requestID, settings.GetIncludeGems(), debug)
		logRequestInput(requestID, request, normalizedConfig)
	}

	if request.Raid == nil || len(request.Raid.Parties) == 0 || len(request.Raid.Parties[0].Players) == 0 {
		log.Printf("[reforgeOptimize:%d] failed after %s: missing player", requestID, time.Since(startedAt))
		return optimizeError("Reforge optimizer requires a raid with player 0.")
	}
	if request.Raid.Parties[0].Players[0].Equipment == nil {
		log.Printf("[reforgeOptimize:%d] failed after %s: missing baseline gear", requestID, time.Since(startedAt))
		return optimizeError("Reforge optimizer requires baseline gear.")
	}
	if signals.Abort.IsTriggered() {
		return optimizeAborted()
	}

	optimization, err := newReforgeOptimization(request, normalizedConfig, signals)
	if err != nil {
		if errors.Is(err, context.Canceled) {
			if logAbort {
				log.Printf("[reforgeOptimize:%d] aborted initializing after %s", requestID, time.Since(startedAt))
			}
			return optimizeAborted()
		}
		log.Printf("[reforgeOptimize:%d] failed initializing after %s: %s", requestID, time.Since(startedAt), err.Error())
		return optimizeError(err.Error())
	}
	if debug {
		log.Printf("[reforgeOptimize:%d] computed baseline stats in %s", requestID, time.Since(startedAt))
		log.Printf("[reforgeOptimize:%d] built %d choice groups / %d choices in %s", requestID, len(optimization.slotChoices), countReforgeChoices(optimization.slotChoices), time.Since(startedAt))
	}

	search := optimization.searchState()
	solveStartedAt := time.Now()
	choices, score, solved, err := trySolveWithHiGHS(search, signals)
	if err != nil {
		if errors.Is(err, context.Canceled) {
			if logAbort {
				log.Printf("[reforgeOptimize:%d] aborted solving after %s", requestID, time.Since(startedAt))
			}
			return optimizeAborted()
		}
		gear := request.GetRaid().GetParties()[0].GetPlayers()[0].GetEquipment()
		gearJSON, _ := protojson.Marshal(gear)
		log.Printf("[reforgeOptimize:%d] HiGHS failed after %s: %s gear=%s", requestID, time.Since(solveStartedAt), err.Error(), gearJSON)
		return optimizeError(fmt.Sprintf("HiGHS reforge optimizer failed: %s", err.Error()))
	}
	if !solved {
		gear := request.GetRaid().GetParties()[0].GetPlayers()[0].GetEquipment()
		gearJSON, _ := protojson.Marshal(gear)
		log.Printf("[reforgeOptimize:%d] HiGHS did not return a solution after %s gear=%s", requestID, time.Since(solveStartedAt), gearJSON)
		return optimizeError("HiGHS reforge optimizer did not return a solution.")
	}
	if debug {
		log.Printf("[reforgeOptimize:%d] HiGHS solved in %s score=%.3f", requestID, time.Since(solveStartedAt), score)
	}
	if signals.Abort.IsTriggered() {
		if logAbort {
			log.Printf("[reforgeOptimize:%d] aborted after solving in %s", requestID, time.Since(startedAt))
		}
		return optimizeAborted()
	}

	optimizedGear := optimization.optimizedGear(choices)
	isBulk := request.GetMode() == proto.ReforgeOptimizeMode_ReforgeOptimizeModeBulk

	// Skip the final stats computation in bulk mode — callers only use OptimizedGear.
	var optimizedPlayerStats *proto.PlayerStats
	if !isBulk || debug {
		optimizedRaid := googleProto.Clone(request.Raid).(*proto.Raid)
		optimizedRaid.Parties[0].Players[0].Equipment = optimizedGear
		optimizedResult := computeReforgeStats(&proto.ComputeStatsRequest{Raid: optimizedRaid})
		if optimizedResult.ErrorResult != "" {
			log.Printf("[reforgeOptimize:%d] failed computing optimized stats after %s: %s", requestID, time.Since(startedAt), optimizedResult.ErrorResult)
			return optimizeError(optimizedResult.ErrorResult)
		}
		if debug {
			optimizedStats := protoToCoreUnitStats(optimizedResult.RaidStats.Parties[0].Players[0].FinalStats)
			optimizedCapStats := optimizedStats
			optimizedCapStats.Stats[stats.MasteryRating] += 8 * core.MasteryRatingPerMasteryPoint
			optimizedDelta := subtractUnitStats(optimizedCapStats, optimization.capBaseStats)
			logOptimizedGearSummary(requestID, optimizedGear)
			logCapEvaluation(requestID, search.hardCaps, search.softCaps, optimizedDelta)
		}
		optimizedPlayerStats = optimizedResult.RaidStats.Parties[0].Players[0]
	}
	if !isBulk {
		log.Printf("[Reforge Optimizer] Reforge optimization completed requestID=%d total=%s score=%.3f", requestID, time.Since(startedAt), score)
	}
	if debug {
		log.Printf("[reforgeOptimize:%d] selectedChoices=%d reforgedItems=%d", requestID, len(choices), countSelectedReforges(choices))
		logSelectedChoices(requestID, choices)
	}

	return &proto.ReforgeOptimizeResult{
		OptimizedGear:        optimizedGear,
		OptimizedPlayerStats: optimizedPlayerStats,
		Score:                score,
		PassesDone:           1,
	}
}

// Sets up the full optimization context: strips reforges/gems from base gear, computes
// base stats and stat dependencies in a single environment call, builds hard/soft/relative
// caps, then generates slot choices for the solver.
func newReforgeOptimization(request *proto.ReforgeOptimizeRequest, normalizedConfig *normalizedReforgeOptimizeConfig, signals simsignals.Signals) (*reforgeOptimization, error) {
	request = googleProto.Clone(request).(*proto.ReforgeOptimizeRequest)
	request.Settings = normalizedConfig.settings
	settings := normalizedConfig.settings
	baseRaid := googleProto.Clone(request.Raid).(*proto.Raid)
	originalGear := cloneEquipmentSpec(baseRaid.Parties[0].Players[0].Equipment)
	baseGear := cloneEquipmentSpec(originalGear)
	clearReforges(baseGear, settings)
	if settings.GetIncludeGems() {
		clearGems(baseGear, settings)
	}
	player := baseRaid.Parties[0].Players[0]
	player.Equipment = baseGear

	baseResult, statDeps := computeReforgeStatsAndDeps(&proto.ComputeStatsRequest{Raid: baseRaid})
	if baseResult.ErrorResult != "" {
		return nil, errors.New(baseResult.ErrorResult)
	}
	if signals.Abort.IsTriggered() {
		return nil, context.Canceled
	}

	basePlayerStats := baseResult.RaidStats.Parties[0].Players[0]
	baseStats := protoToCoreUnitStats(basePlayerStats.FinalStats)
	capBaseStats := baseStats
	capBaseStats.Stats[stats.MasteryRating] += 8 * core.MasteryRatingPerMasteryPoint
	weights := validateReforgeWeights(protoToCoreUnitStats(request.PreCapEpWeights), settings, normalizedConfig.softCaps)

	hardCaps := buildReforgeHardCaps(capBaseStats, settings, protoToCoreUnitStats(request.UndershootCaps))
	softCaps := buildReforgeSoftCaps(capBaseStats, normalizedConfig.softCaps)
	relativeCaps := buildRelativeStatCaps(baseRaid, baseGear, capBaseStats, settings)
	weights = applyRelativeStatCapWeights(weights, relativeCaps)
	gemSortWeights := relativeStatCapGemSortWeights(weights, relativeCaps)

	slotChoices, err := buildReforgeSlotChoices(request, baseRaid, baseGear, baseStats, weights, gemSortWeights, hardCaps, softCaps, len(relativeCaps) > 0, statDeps)
	if err != nil {
		return nil, err
	}

	return &reforgeOptimization{
		request:      request,
		settings:     settings,
		player:       player,
		baseRaid:     baseRaid,
		originalGear: originalGear,
		baseGear:     baseGear,
		capBaseStats: capBaseStats,
		weights:      weights,
		hardCaps:     hardCaps,
		softCaps:     softCaps,
		relativeCaps: relativeCaps,
		slotChoices:  slotChoices,
		ampModifier:  amplificationStatModifier(baseGear),
	}, nil
}

func computeReforgeStats(request *proto.ComputeStatsRequest) *proto.ComputeStatsResult {
	request.SkipRotation = true
	return core.ComputeStats(request)
}

func computeReforgeStatsAndDeps(request *proto.ComputeStatsRequest) (*proto.ComputeStatsResult, *stats.StatDependencyManager) {
	request.SkipRotation = true
	return core.ComputeStatsAndDeps(request)
}

// Creates a reforgeSearchState from the optimization, pre-allocating the working raid
// clone and MIP index arrays to avoid repeated allocations across solver passes.
func (optimization *reforgeOptimization) searchState() *reforgeSearchState {
	workingRaid := googleProto.Clone(optimization.baseRaid).(*proto.Raid)
	choiceVarIdx := make([][]int, len(optimization.slotChoices))
	for i, slot := range optimization.slotChoices {
		choiceVarIdx[i] = make([]int, len(slot.choices))
	}
	return &reforgeSearchState{
		request:             optimization.request,
		baseRaid:            optimization.baseRaid,
		baseEquipment:       core.ProtoToEquipment(optimization.baseGear),
		capBaseStats:        optimization.capBaseStats,
		slots:               optimization.slotChoices,
		weights:             optimization.weights,
		hardCaps:            optimization.hardCaps,
		hardCapsByStat:      reforgeHardCapsByStat(optimization.hardCaps),
		softCaps:            optimization.softCaps,
		softCapsByStat:      reforgeSoftCapsByStat(optimization.softCaps),
		relativeCaps:        optimization.relativeCaps,
		workingRaid:         workingRaid,
		workingStatsRequest: &proto.ComputeStatsRequest{Raid: workingRaid},
		choiceVarIdx:        choiceVarIdx,
		uniqueGemIDs:        buildUniqueGemLimitIDs(optimization.slotChoices),
		ampModifier:         optimization.ampModifier,
	}
}

// Applies solver choices to the base gear and calls minimizeRegems to avoid unnecessary
// gem purchases where existing gems can be reused.
func (optimization *reforgeOptimization) optimizedGear(choices []reforgeChoice) *proto.EquipmentSpec {
	gearEditor := newReforgeGearEditor(optimization.baseGear, optimization.originalGear, optimization.player, optimization.settings)
	gearEditor.applyChoices(choices)
	if optimization.settings.GetIncludeGems() {
		gearEditor.minimizeRegems()
	}
	return gearEditor.equipment()
}

func countSelectedReforges(choices []reforgeChoice) int {
	count := 0
	for _, choice := range choices {
		if choice.reforgeID != 0 {
			count++
		}
	}
	return count
}

func countReforgeChoices(slots []reforgeSlotChoices) int {
	count := 0
	for _, slot := range slots {
		count += len(slot.choices)
	}
	return count
}

func optimizeError(message string) *proto.ReforgeOptimizeResult {
	return &proto.ReforgeOptimizeResult{
		Error: &proto.ErrorOutcome{
			Message: message,
		},
	}
}

func optimizeAborted() *proto.ReforgeOptimizeResult {
	return &proto.ReforgeOptimizeResult{
		Error: &proto.ErrorOutcome{
			Type:    proto.ErrorOutcomeType_ErrorOutcomeAborted,
			Message: "Reforge optimization aborted.",
		},
	}
}

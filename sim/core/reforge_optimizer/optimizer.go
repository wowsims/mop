package reforgeoptimizer

import (
	"errors"
	"fmt"
	"log"
	"sync/atomic"
	"time"

	"github.com/wowsims/mop/sim/core"
	"github.com/wowsims/mop/sim/core/proto"
	"github.com/wowsims/mop/sim/core/stats"
	googleProto "google.golang.org/protobuf/proto"
)

var reforgeOptimizeRequestID atomic.Uint64

func Optimize(request *proto.ReforgeOptimizeRequest) *proto.ReforgeOptimizeResult {
	requestID := reforgeOptimizeRequestID.Add(1)
	startedAt := time.Now()
	normalizedConfig, err := validateReforgeOptimizeSettings(request)
	if err != nil {
		log.Printf("[reforgeOptimize:%d] failed validating settings after %s: %s", requestID, time.Since(startedAt), err.Error())
		return optimizeError(err.Error())
	}
	settings := normalizedConfig.settings
	log.Printf("[reforgeOptimize:%d] started includeGems=%t debug=%t", requestID, settings.GetIncludeGems(), request.GetDebug())
	if request.GetDebug() {
		logRequestInput(requestID, request, normalizedConfig)
	}

	if request.Raid == nil || len(request.Raid.Parties) == 0 || len(request.Raid.Parties[0].Players) == 0 {
		log.Printf("[reforgeOptimize:%d] failed after %s: missing player", requestID, time.Since(startedAt))
		return optimizeError("Reforge optimizer requires a raid with player 0.")
	}
	if request.BaselineGear == nil {
		log.Printf("[reforgeOptimize:%d] failed after %s: missing baseline gear", requestID, time.Since(startedAt))
		return optimizeError("Reforge optimizer requires baseline gear.")
	}

	optimization, err := newReforgeOptimization(request, normalizedConfig)
	if err != nil {
		log.Printf("[reforgeOptimize:%d] failed initializing after %s: %s", requestID, time.Since(startedAt), err.Error())
		return optimizeError(err.Error())
	}
	if request.GetDebug() {
		log.Printf("[reforgeOptimize:%d] computed baseline stats in %s", requestID, time.Since(startedAt))
		log.Printf("[reforgeOptimize:%d] built %d choice groups / %d choices in %s", requestID, len(optimization.slotChoices), countReforgeChoices(optimization.slotChoices), time.Since(startedAt))
	}

	search := optimization.searchState()
	solveStartedAt := time.Now()
	choices, score, solved, err := trySolveWithHiGHS(search)
	if err != nil {
		log.Printf("[reforgeOptimize:%d] HiGHS failed after %s: %s", requestID, time.Since(solveStartedAt), err.Error())
		return optimizeError(fmt.Sprintf("HiGHS reforge optimizer failed: %s", err.Error()))
	}
	if !solved {
		log.Printf("[reforgeOptimize:%d] HiGHS did not return a solution after %s", requestID, time.Since(solveStartedAt))
		return optimizeError("HiGHS reforge optimizer did not return a solution.")
	}
	log.Printf("[reforgeOptimize:%d] HiGHS solved in %s score=%.3f", requestID, time.Since(solveStartedAt), score)

	optimizedGear := optimization.optimizedGear(choices)

	optimizedRaid := googleProto.Clone(request.Raid).(*proto.Raid)
	optimizedRaid.Parties[0].Players[0].Equipment = optimizedGear
	optimizedResult := core.ComputeStats(&proto.ComputeStatsRequest{Raid: optimizedRaid})
	if optimizedResult.ErrorResult != "" {
		log.Printf("[reforgeOptimize:%d] failed computing optimized stats after %s: %s", requestID, time.Since(startedAt), optimizedResult.ErrorResult)
		return optimizeError(optimizedResult.ErrorResult)
	}
	optimizedStats := protoToCoreUnitStats(optimizedResult.RaidStats.Parties[0].Players[0].FinalStats)
	optimizedCapStats := optimizedStats
	optimizedCapStats.Stats[stats.MasteryRating] += 8 * core.MasteryRatingPerMasteryPoint
	optimizedDelta := subtractUnitStats(optimizedCapStats, optimization.capBaseStats)
	if request.GetDebug() {
		logOptimizedGearSummary(requestID, optimizedGear)
		logCapEvaluation(requestID, search.hardCaps, search.softCaps, optimizedDelta)
	}
	log.Printf("[reforgeOptimize:%d] completed in %s score=%.3f selectedChoices=%d reforgedItems=%d", requestID, time.Since(startedAt), score, len(choices), countSelectedReforges(choices))
	if request.GetDebug() {
		logSelectedChoices(requestID, choices)
	}

	return &proto.ReforgeOptimizeResult{
		OptimizedGear:        optimizedGear,
		OptimizedPlayerStats: optimizedResult.RaidStats.Parties[0].Players[0],
		Score:                score,
		PassesDone:           1,
	}
}

func newReforgeOptimization(request *proto.ReforgeOptimizeRequest, normalizedConfig *normalizedReforgeOptimizeConfig) (*reforgeOptimization, error) {
	request = googleProto.Clone(request).(*proto.ReforgeOptimizeRequest)
	request.Settings = normalizedConfig.settings
	settings := normalizedConfig.settings
	baseRaid := googleProto.Clone(request.Raid).(*proto.Raid)
	baseGear := cloneEquipmentSpec(request.BaselineGear)
	clearReforges(baseGear, settings)
	if settings.GetIncludeGems() {
		clearGems(baseGear, settings)
	}
	player := baseRaid.Parties[0].Players[0]
	player.Equipment = baseGear

	baseResult := core.ComputeStats(&proto.ComputeStatsRequest{Raid: baseRaid})
	if baseResult.ErrorResult != "" {
		return nil, errors.New(baseResult.ErrorResult)
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

	slotChoices, err := buildReforgeSlotChoices(request, baseRaid, baseGear, baseStats, weights, gemSortWeights, hardCaps, softCaps, len(relativeCaps) > 0)
	if err != nil {
		return nil, err
	}

	return &reforgeOptimization{
		request:      request,
		settings:     settings,
		player:       player,
		baseRaid:     baseRaid,
		baseGear:     baseGear,
		capBaseStats: capBaseStats,
		weights:      weights,
		hardCaps:     hardCaps,
		softCaps:     softCaps,
		relativeCaps: relativeCaps,
		slotChoices:  slotChoices,
	}, nil
}

func (optimization *reforgeOptimization) searchState() *reforgeSearchState {
	return &reforgeSearchState{
		request:        optimization.request,
		baseRaid:       optimization.baseRaid,
		baseEquipment:  core.ProtoToEquipment(optimization.baseGear),
		capBaseStats:   optimization.capBaseStats,
		slots:          optimization.slotChoices,
		weights:        optimization.weights,
		hardCaps:       optimization.hardCaps,
		hardCapsByStat: reforgeHardCapsByStat(optimization.hardCaps),
		softCaps:       optimization.softCaps,
		softCapsByStat: reforgeSoftCapsByStat(optimization.softCaps),
		relativeCaps:   optimization.relativeCaps,
	}
}

func (optimization *reforgeOptimization) optimizedGear(choices []reforgeChoice) *proto.EquipmentSpec {
	gearEditor := newReforgeGearEditor(optimization.baseGear, optimization.request.BaselineGear, optimization.player, optimization.settings)
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

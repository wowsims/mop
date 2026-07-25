package reforgeoptimizer

import (
	"context"
	"errors"
	"log"
	"strings"
	"sync/atomic"
	"time"

	"github.com/wowsims/mop/sim/core"
	"github.com/wowsims/mop/sim/core/proto"
	"github.com/wowsims/mop/sim/core/simsignals"
	"github.com/wowsims/mop/sim/core/stats"
	googleProto "google.golang.org/protobuf/proto"
)

var reforgeOptimizeRequestID atomic.Uint64

// reforgeOptimizer holds the player/settings-derived state that the model-building methods read.
// Built once per request by newReforgeOptimizer.
type reforgeOptimizer struct {
	request  *proto.ReforgeOptimizeRequest
	settings *proto.ReforgeSettings
	player   *proto.Player
	signals  simsignals.Signals

	includeGems     bool
	isBlacksmithing bool
	isHuman         bool
	isGuardianDruid bool
	isHybridCaster  bool
	isTankSpec      bool
	hasJC           bool

	ampModifier       float64
	hasHeartOfTheWild bool

	epStatsSet     map[proto.Stat]bool
	frozenSlots    map[proto.ItemSlot]bool
	undershootCaps core.UnitStats
	relativeCap    *relativeStatCap
	gemOptions     []*proto.ReforgeGemOption

	baseRaidProto     *proto.Raid
	baseStrippedGear  *proto.EquipmentSpec
	originalEquipment *core.Equipment
	baseStats         core.UnitStats
}

func (o *reforgeOptimizer) raidBuffs() *proto.RaidBuffs {
	return o.baseRaidProto.GetBuffs()
}

func Optimize(request *proto.ReforgeOptimizeRequest) *proto.ReforgeOptimizeResult {
	return OptimizeAsync(request, simsignals.CreateSignals())
}

func OptimizeAsync(request *proto.ReforgeOptimizeRequest, signals simsignals.Signals) *proto.ReforgeOptimizeResult {
	requestID := reforgeOptimizeRequestID.Add(1)
	startedAt := time.Now()
	isBulk := request.GetMode() == proto.ReforgeOptimizeMode_ReforgeOptimizeModeBulk
	debug := request.GetDebug()
	logAbort := !isBulk || debug

	if request.Raid == nil || len(request.Raid.Parties) == 0 || len(request.Raid.Parties[0].Players) == 0 {
		return optimizeError("Reforge optimizer requires a raid with player 0.")
	}
	if request.Raid.Parties[0].Players[0].Equipment == nil {
		return optimizeError("Reforge optimizer requires baseline gear.")
	}
	if signals.Abort.IsTriggered() {
		return optimizeAborted()
	}

	optimizer, err := newReforgeOptimizer(request, signals)
	if err != nil {
		if errors.Is(err, context.Canceled) {
			if logAbort {
				log.Printf("[reforgeOptimize:%d] aborted initializing after %s", requestID, time.Since(startedAt))
			}
			return optimizeAborted()
		}
		return optimizeError(err.Error())
	}

	optimizedGear, score, err := optimizer.optimizeReforges()
	if err != nil {
		if errors.Is(err, context.Canceled) {
			if logAbort {
				log.Printf("[reforgeOptimize:%d] aborted solving after %s", requestID, time.Since(startedAt))
			}
			return optimizeAborted()
		}
		return optimizeError(err.Error())
	}
	if signals.Abort.IsTriggered() {
		return optimizeAborted()
	}

	// Skip the final stats computation in bulk mode — callers only use OptimizedGear.
	var optimizedPlayerStats *proto.PlayerStats
	if !isBulk || debug {
		optimizedRaid := googleProto.Clone(request.Raid).(*proto.Raid)
		optimizedRaid.Parties[0].Players[0].Equipment = optimizedGear
		optimizedResult := computeReforgeStats(&proto.ComputeStatsRequest{Raid: optimizedRaid})
		if optimizedResult.ErrorResult != "" {
			return optimizeError(optimizedResult.ErrorResult)
		}
		optimizedPlayerStats = optimizedResult.RaidStats.Parties[0].Players[0]
	}
	if !isBulk {
		log.Printf("[Reforge Optimizer] completed requestID=%d total=%s score=%.3f", requestID, time.Since(startedAt), score)
	}

	return &proto.ReforgeOptimizeResult{
		OptimizedGear:        optimizedGear,
		OptimizedPlayerStats: optimizedPlayerStats,
		Score:                score,
		PassesDone:           1,
	}
}

// newReforgeOptimizer builds the optimizer context from the request: strips reforges/gems for
// the baseline, computes base stats, and derives the player/settings flags (including whether a
// Guardian Druid has Heart of the Wild).
func newReforgeOptimizer(request *proto.ReforgeOptimizeRequest, signals simsignals.Signals) (*reforgeOptimizer, error) {
	settings := request.GetSettings()
	if settings == nil {
		settings = &proto.ReforgeSettings{}
	} else {
		settings = googleProto.Clone(settings).(*proto.ReforgeSettings)
	}

	player := request.Raid.Parties[0].Players[0]

	originalGear := cloneEquipmentSpec(player.Equipment)
	baseStrippedGear := cloneEquipmentSpec(originalGear)
	clearReforges(baseStrippedGear, settings)
	if settings.GetIncludeGems() {
		clearGems(baseStrippedGear, settings)
	}

	baseRaid := googleProto.Clone(request.Raid).(*proto.Raid)
	baseRaid.Parties[0].Players[0].Equipment = baseStrippedGear

	baseResult := computeReforgeStats(&proto.ComputeStatsRequest{Raid: baseRaid})
	if baseResult.ErrorResult != "" {
		return nil, errors.New(baseResult.ErrorResult)
	}
	if signals.Abort.IsTriggered() {
		return nil, context.Canceled
	}

	// Base stats = FinalStats plus the 8 free base-mastery points every character has.
	baseStats := protoToCoreUnitStats(baseResult.RaidStats.Parties[0].Players[0].FinalStats)
	baseStats.Stats[stats.MasteryRating] += 8 * core.MasteryRatingPerMasteryPoint

	originalEquipment := equipmentFromProto(originalGear)
	isGuardian := playerIsGuardianDruid(player)

	optimizer := &reforgeOptimizer{
		request:           request,
		settings:          settings,
		player:            player,
		signals:           signals,
		includeGems:       settings.GetIncludeGems(),
		isBlacksmithing:   playerHasProfession(player, proto.Profession_Blacksmithing),
		isHuman:           player.GetRace() == proto.Race_RaceHuman,
		isGuardianDruid:   isGuardian,
		isHybridCaster:    playerIsHybridCaster(player),
		isTankSpec:        playerIsTankSpec(player),
		hasJC:             playerHasProfession(player, proto.Profession_Jewelcrafting),
		ampModifier:       amplificationStatModifier(baseStrippedGear),
		epStatsSet:        buildEPStatsSet(request.GetPreCapEpWeights()),
		frozenSlots:       frozenItemSlots(settings),
		undershootCaps:    protoToCoreUnitStats(request.GetUndershootCaps()),
		gemOptions:        request.GetGemOptions(),
		baseRaidProto:     baseRaid,
		baseStrippedGear:  baseStrippedGear,
		originalEquipment: originalEquipment,
		baseStats:         baseStats,
	}

	// Heart of the Wild talent (Guardian Agility -> AP/Crit gets an extra 1.06 multiplier).
	// Parsed from the talent string via the shared core helper.
	if isGuardian {
		druidTalents := &proto.DruidTalents{}
		core.FillTalentsProto(druidTalents.ProtoReflect(), player.GetTalentsString())
		optimizer.hasHeartOfTheWild = druidTalents.GetHeartOfTheWild()
	}

	// Relative stat cap (forced RoRo proc), if configured and RoRo is equipped.
	if uiStat := settings.GetRelativeStatCapStat(); uiStat != nil {
		if unitStat, ok := unitStatFromUIStat(uiStat); ok && unitStat.IsStat() {
			forcedStat := proto.Stat(unitStat.StatIdx())
			if isRelevantRelativeStat(forcedStat) && relativeStatCapHasRoRo(*originalEquipment) {
				optimizer.relativeCap = newRelativeStatCap(forcedStat, playerIsFeralDruid(player))
			}
		}
	}

	return optimizer, nil
}

// optimizeReforges runs the full optimization: it derives the effective reforge-only stat caps
// and soft caps, validates the EP weights against them, builds the LP variables and constraints,
// solves the model, and applies the solution. Returns the optimized gear and the LP objective
// score. The pre-cap EP weights, processed stat caps, and soft-cap configs arrive ready-to-use
// on the request.
func (o *reforgeOptimizer) optimizeReforges() (*proto.EquipmentSpec, float64, error) {
	// Effective stat caps for just the reforge contribution.
	reforgeCaps := computeStatCapsDelta(o.baseStats, protoToCoreUnitStats(o.settings.GetStatCaps()))
	if o.isGuardianDruid {
		meleeHaste := stats.UnitStatFromPseudoStat(proto.PseudoStat_PseudoStatMeleeHastePercent)
		reforgeCaps = setUnitStat(reforgeCaps, meleeHaste, getUnitStat(reforgeCaps, meleeHaste)/1.5)
	}

	var softCapConfigs []*proto.StatCapConfig
	if o.settings.GetUseSoftCapBreakpoints() {
		softCapConfigs = o.request.GetSoftCaps()
	}
	reforgeSoftCaps := computeReforgeSoftCaps(o.baseStats, softCapConfigs)

	validatedWeights := checkWeights(protoToCoreUnitStats(o.request.GetPreCapEpWeights()), reforgeCaps, reforgeSoftCaps)
	if o.relativeCap != nil {
		validatedWeights = o.relativeCap.updateWeights(validatedWeights)
	}

	baseEquipment := equipmentFromProto(o.baseStrippedGear)
	variables := o.buildYalpsVariables(*baseEquipment, validatedWeights, reforgeCaps, reforgeSoftCaps)
	constraints := o.buildYalpsConstraints(*baseEquipment, o.baseStats)

	// Add all-or-nothing SocketBonusLink constraints for any link key that isn't already a
	// constraint.
	variables.each(func(_ string, coeffs map[string]float64) {
		for key := range coeffs {
			if strings.HasPrefix(key, "SocketBonusLink_") && !constraints.has(key) {
				constraints.set(key, lessEq(0))
			}
		}
	})

	timeoutSeconds := 30.0
	if o.relativeCap != nil {
		timeoutSeconds = 120.0
	}
	if o.request.GetMode() == proto.ReforgeOptimizeMode_ReforgeOptimizeModeBulk {
		timeoutSeconds /= 4
	}

	selectedVars, score, err := o.solveModel(validatedWeights, reforgeCaps, reforgeSoftCaps, variables, constraints, timeoutSeconds)
	if err != nil {
		return nil, 0, err
	}

	return o.applyLPSolution(selectedVars), score, nil
}

// buildEPStatsSet collects the stats carrying a non-zero EP weight in the (raw, pre-checkWeights)
// request weights. Used to filter valid reforge destinations and gem stats.
func buildEPStatsSet(weights *proto.UnitStats) map[proto.Stat]bool {
	set := map[proto.Stat]bool{}
	if weights == nil {
		return set
	}
	for statIdx, value := range weights.GetStats() {
		if value != 0 {
			set[proto.Stat(statIdx)] = true
		}
	}
	return set
}

func computeReforgeStats(request *proto.ComputeStatsRequest) *proto.ComputeStatsResult {
	request.SkipRotation = true
	return core.ComputeStats(request)
}

func optimizeError(message string) *proto.ReforgeOptimizeResult {
	return &proto.ReforgeOptimizeResult{
		Error: &proto.ErrorOutcome{Message: message},
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

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
	isGuardianDruid bool
	isHybridCaster  bool
	isTrueCaster    bool
	isTankSpec      bool
	hasJC           bool

	ampModifier float64
	// bearFormMult scales a Guardian Druid's crit and haste (1.0 otherwise). Kept as a field
	// because epDivisor (EP internalization) reads it alongside ampModifier.
	bearFormMult float64

	// statRules re-apply, per reforge/gem stat, the character-specific self-multipliers and stat
	// expansions that are NOT baked into the calibrated EP — the amplification trinket, the
	// Human-racial Spirit multiplier, and Guardian Bear Form (crit mult + Agility -> AP/crit%).
	// See reforgeStatRule; assembled in newReforgeOptimizer.
	statRules []reforgeStatRule

	epStatsSet     map[proto.Stat]bool
	frozenSlots    map[proto.ItemSlot]bool
	undershootCaps core.UnitStats
	relativeCap    *relativeStatCap
	gemOptions     []*proto.ReforgeGemOption

	// statDeps is the player's build-phase StatDependencyManager (ComputeStatDependencies). It
	// resolves every stat conversion the sim models and is used by resolveStatDelta to compute
	// each LP variable's cap-space coefficients (the FULL dependency graph), separately from the
	// EP-calibrated objective coefficients produced by applyReforgeStat.
	statDeps *stats.StatDependencyManager

	baseRaidProto     *proto.Raid
	baseStrippedGear  *proto.EquipmentSpec
	originalEquipment *core.Equipment
	baseStats         core.UnitStats
}

// reforgeStatRule is a configurable per-optimize modifier applied in applyReforgeStat. A
// reforge/gem amount of any stat in `stats` is multiplied by `mult`. Rules are applied in list
// order, and a stat may match several (e.g. Spirit gets both the racial and the amp rule) —
// order is load-bearing because reassociating the float multiplies would change the LP text.
// If `expandTo` is non-empty, the multiplied amount is distributed to those coefficients and
// processing stops (the stat's own coefficient is not set) — this models Guardian Agility ->
// AttackPower + PhysicalCrit%.
type reforgeStatRule struct {
	stats    []proto.Stat
	mult     float64
	expandTo []reforgeExpandTerm
}

// reforgeExpandTerm adds amount*factor to one objective coefficient (stat or pseudo-stat).
type reforgeExpandTerm struct {
	target stats.UnitStat
	factor float64
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

	// One environment build yields both FinalStats and the finalized StatDependencyManager
	// (ComputeStatsAndDeps uses the same skip-rotation NewEnvironment as computeReforgeStats),
	// instead of building the character twice for the same base raid.
	baseResult, baseSDM := core.ComputeStatsAndDeps(&proto.ComputeStatsRequest{Raid: baseRaid})
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

	// Resolve the stat conversions the reforge model needs (Human Spirit, Bear Form crit/haste,
	// Guardian Agility) from the player's real stat-dependency graph instead of hardcoded
	// constants. resolveStatMultiplier returns the self-multiplier the dependency graph applies to
	// one unit of a stat (e.g. Bear Form's CritRating×1.5, Mark-of-the-Wild×Heart-of-the-Wild
	// Agility×1.113). baseSDM (from ComputeStatsAndDeps above) already has the build-phase auras
	// re-activated, so these multiplicative deps are live in the manager.
	resolveStatMultiplier := func(s stats.Stat) float64 {
		in := stats.Stats{}
		in[s] = 1
		return baseSDM.ApplyStatDependencies(in)[s]
	}
	ampModifier := amplificationStatModifier(baseStrippedGear)
	// The Spirit self-multiplier (the Human racial is the only source in practice), isolated from the
	// Amplification Trinket multiplier (which the graph also folds into Spirit but the model re-applies
	// separately). 1.0 when there is no such racial.
	spiritSelfMult := resolveStatMultiplier(stats.Spirit) / ampModifier
	bearFormMult := 1.0
	guardianAgilityMult := 1.0
	if isGuardian {
		bearFormMult = resolveStatMultiplier(stats.CritRating)
		guardianAgilityMult = resolveStatMultiplier(stats.Agility)
	}

	// Self-mult / expansion rules for applyReforgeStat. Order matches the historical apply order
	// (racial Spirit, then amp trinket, then Bear Form crit, then the Guardian Agility expansion)
	// so the LP coefficients stay byte-identical.
	statRules := []reforgeStatRule{
		{stats: []proto.Stat{proto.Stat_StatSpirit}, mult: spiritSelfMult},
		{stats: []proto.Stat{proto.Stat_StatHasteRating, proto.Stat_StatMasteryRating, proto.Stat_StatSpirit}, mult: ampModifier},
	}
	if isGuardian {
		statRules = append(statRules,
			reforgeStatRule{stats: []proto.Stat{proto.Stat_StatCritRating}, mult: bearFormMult},
			reforgeStatRule{stats: []proto.Stat{proto.Stat_StatAgility}, mult: guardianAgilityMult, expandTo: []reforgeExpandTerm{
				{target: stats.UnitStatFromStat(stats.AttackPower), factor: 2},
				{target: stats.UnitStatFromPseudoStat(proto.PseudoStat_PseudoStatPhysicalCritPercent), factor: core.CritPerAgiMaxLevel[proto.Class_ClassDruid]},
			}},
		)
	}

	optimizer := &reforgeOptimizer{
		request:           request,
		settings:          settings,
		player:            player,
		signals:           signals,
		includeGems:       settings.GetIncludeGems(),
		isBlacksmithing:   playerHasProfession(player, proto.Profession_Blacksmithing),
		isGuardianDruid:   isGuardian,
		isHybridCaster:    playerIsHybridCaster(player),
		isTrueCaster:      playerIsTrueCaster(player),
		isTankSpec:        playerIsTankSpec(player),
		hasJC:             playerHasProfession(player, proto.Profession_Jewelcrafting),
		ampModifier:       ampModifier,
		bearFormMult:      bearFormMult,
		statRules:         statRules,
		epStatsSet:        buildEPStatsSet(request.GetSettings().GetEpStats(), request.GetPreCapEpWeights()),
		frozenSlots:       frozenItemSlots(settings),
		undershootCaps:    protoToCoreUnitStats(request.GetUndershootCaps()),
		gemOptions:        request.GetGemOptions(),
		statDeps:          baseSDM,
		baseRaidProto:     baseRaid,
		baseStrippedGear:  baseStrippedGear,
		originalEquipment: originalEquipment,
		baseStats:         baseStats,
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

// rootRatingStat maps a unit stat to the rating stat whose Amplification/Bear-Form multiplier
// governs it: a percent pseudo-stat resolves to its parent rating (SpellHaste% -> HasteRating,
// PhysicalCrit% -> CritRating, ...); a rating stat maps to itself; anything else returns an
// out-of-range sentinel that matches no case in epDivisor.
func rootRatingStat(unitStat stats.UnitStat) stats.Stat {
	if unitStat.IsStat() {
		return stats.Stat(unitStat.StatIdx())
	}
	switch proto.PseudoStat(unitStat.PseudoStatIdx()) {
	case proto.PseudoStat_PseudoStatSpellHastePercent,
		proto.PseudoStat_PseudoStatMeleeHastePercent,
		proto.PseudoStat_PseudoStatRangedHastePercent:
		return stats.HasteRating
	case proto.PseudoStat_PseudoStatPhysicalCritPercent,
		proto.PseudoStat_PseudoStatSpellCritPercent:
		return stats.CritRating
	}
	return stats.Stat(stats.ProtoStatsLen) // out-of-range sentinel: matches no case in epDivisor
}

// epDivisor returns the self-multiplier applyReforgeStat re-applies to a stat's reforge coefficient
// and that must therefore be divided back out of the EP weight so the objective stays calibrated:
// the Amplification-trinket modifier on Haste/Mastery (mapped from their percent pseudo-stats too),
// and a Guardian Druid's Bear Form multiplier on crit. Every other stat returns 1. This is the ONE
// place the "which multipliers does the backend own" question is answered; it is deliberately NOT
// the full StatDependencyManager self-multiplier, which would wrongly fold in spec-inherent effects
// (e.g. Fury's 1.5x haste, already baked into the calibrated EP weights).
func (o *reforgeOptimizer) epDivisor(unitStat stats.UnitStat) float64 {
	switch rootRatingStat(unitStat) {
	case stats.HasteRating, stats.MasteryRating:
		return o.ampModifier
	case stats.CritRating:
		if o.isGuardianDruid {
			return o.bearFormMult
		}
	}
	return 1
}

// internalizeEPOffset divides an EP weight by the multiplier applyReforgeStat re-applies to the
// stat's coefficient (Amplification Haste/Mastery, a Guardian's Bear Form crit). The ×mult
// and ÷mult cancel in the objective (coeff*mult * ep/mult = coeff*ep) while the caps still see the
// amplified contribution, so EP weights can be supplied un-offset. epDivisor is 1 for every other
// stat, making this a no-op. Applied to both pre-cap weights and soft-cap post-cap EPs; without it
// the ×mult is uncancelled (e.g. a Guardian's 79% crit soft cap would never halt crit stacking).
//
// Spirit is deliberately absent: applyReforgeStat amplifies it, but its EP weights are supplied
// already amplified, so cancelling here would double-correct.
func (o *reforgeOptimizer) internalizeEPOffset(unitStat stats.UnitStat, value float64) float64 {
	return value / o.epDivisor(unitStat)
}

func (o *reforgeOptimizer) internalizeEPOffsets(weights core.UnitStats) core.UnitStats {
	eachUnitStat(weights, func(unitStat stats.UnitStat, value float64) {
		if o.epDivisor(unitStat) != 1 {
			weights = setUnitStat(weights, unitStat, o.internalizeEPOffset(unitStat, value))
		}
	})
	return weights
}

func (o *reforgeOptimizer) internalizeSoftCapEPOffsets(softCaps []*reforgeSoftCap) {
	for _, softCap := range softCaps {
		for i, ep := range softCap.postCapEPs {
			softCap.postCapEPs[i] = o.internalizeEPOffset(softCap.unitStat, ep)
		}
	}
}

// optimizeReforges runs the full optimization: it derives the effective reforge-only stat caps
// and soft caps, validates the EP weights against them, builds the LP variables and constraints,
// solves the model, and applies the solution. Returns the optimized gear and the LP objective
// score. The pre-cap EP weights, processed stat caps, and soft-cap configs arrive ready-to-use
// on the request.
func (o *reforgeOptimizer) optimizeReforges() (*proto.EquipmentSpec, float64, error) {
	// Effective stat caps for just the reforge contribution. Caps live in resolved sheet-stat
	// space (see computeGapToCap): a Guardian's Bear Form melee-haste scaling is already folded
	// into each variable's haste cap coefficient by resolveStatDelta (via the melee speed
	// multiplier read from baseStats), so no separate Bear-Form cap adjustment is applied here.
	reforgeCaps := computeStatCapsDelta(o.baseStats, protoToCoreUnitStats(o.settings.GetStatCaps()))

	var softCapConfigs []*proto.StatCapConfig
	if o.settings.GetUseSoftCapBreakpoints() {
		softCapConfigs = o.request.GetSoftCaps()
	}
	reforgeSoftCaps := computeReforgeSoftCaps(o.baseStats, softCapConfigs)
	o.internalizeSoftCapEPOffsets(reforgeSoftCaps)

	rawWeights := o.internalizeEPOffsets(protoToCoreUnitStats(o.request.GetPreCapEpWeights()))
	validatedWeights := checkWeights(rawWeights, reforgeCaps, reforgeSoftCaps)
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
	mipRelGap := 0.0
	if o.relativeCap != nil {
		timeoutSeconds = 120.0
		// The relative-stat-cap MIP is slow to prove optimal; a looser gap accepts a solution
		// within a relative gap of the bound for a large speedup. Configurable per request
		// (ReforgeSettings.relative_stat_cap_mip_gap); 0 leaves the HiGHS default (~1e-4, "Precise").
		mipRelGap = o.settings.GetRelativeStatCapMipGap()
	}
	if o.request.GetMode() == proto.ReforgeOptimizeMode_ReforgeOptimizeModeBulk {
		timeoutSeconds /= 4
	}

	selectedVars, score, err := o.solveModel(validatedWeights, reforgeCaps, reforgeSoftCaps, variables, constraints, timeoutSeconds, mipRelGap)
	if err != nil {
		return nil, 0, err
	}

	return o.applyLPSolution(selectedVars), score, nil
}

// Valid reforge destinations and gem stats. The non-zero-weight fallback is an approximation:
// it also drops the expertise reforge paired with a zero-weight hit.
func buildEPStatsSet(epStats []proto.Stat, weights *proto.UnitStats) map[proto.Stat]bool {
	set := map[proto.Stat]bool{}
	if len(epStats) > 0 {
		for _, stat := range epStats {
			set[stat] = true
		}
		return set
	}
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

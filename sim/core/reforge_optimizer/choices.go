package reforgeoptimizer

import (
	"cmp"
	"math"
	"slices"
	"sync"

	"github.com/wowsims/mop/sim/core"
	"github.com/wowsims/mop/sim/core/proto"
	"github.com/wowsims/mop/sim/core/stats"
)

// sortedReforgeStatIDsOnce caches the sorted reforge stat IDs locally so the
// optimizer avoids rebuilding the sorted slice on every candidate. The database
// is populated once before any optimization runs, so this cache is stable.
var (
	sortedReforgeStatIDsOnce   sync.Once
	sortedReforgeStatIDsCached []int32
)

func getSortedReforgeStatIDs() []int32 {
	sortedReforgeStatIDsOnce.Do(func() {
		sortedReforgeStatIDsCached = core.GetSortedReforgeStatIDs()
	})
	return sortedReforgeStatIDsCached
}

func softCapConfiguredFor(softCaps []reforgeSoftCap, unitStat stats.UnitStat) bool {
	for _, softCap := range softCaps {
		if softCap.unitStat == unitStat {
			return true
		}
	}
	return false
}

// Builds one reforgeSlotChoices entry per decision variable: each item slot gets a reforge
// group (no-reforge vs. each valid reforge) and, when gems are enabled, one group per
// non-meta socket (empty vs. each eligible gem) plus an optional socket-bonus group. Slots
// are sorted descending by their best choice score so the MIP solver branches on the
// highest-impact decisions first.
func buildReforgeSlotChoices(request *proto.ReforgeOptimizeRequest, baseRaid *proto.Raid, baseGear *proto.EquipmentSpec, baseStats core.UnitStats, weights core.UnitStats, gemSortWeights core.UnitStats, hardCaps []reforgeHardCap, softCaps []reforgeSoftCap, hasRelativeStatCap bool, statDeps *stats.StatDependencyManager) ([]reforgeSlotChoices, error) {
	frozenSlots := frozenItemSlots(request.GetSettings())
	player := request.Raid.Parties[0].Players[0]
	if statDeps == nil {
		statDeps = core.ComputeStatDependencies(&proto.ComputeStatsRequest{Raid: baseRaid})
	}
	_, isGuardianDruid := player.GetSpec().(*proto.Player_GuardianDruid)
	var agilityMultiplier float64
	if isGuardianDruid {
		agilityMultiplier = resolveStatDelta(statDeps, baseStats, rawUnitStatsFromStats(stats.Stats{stats.Agility: 1})).Stats[stats.Agility]
	}
	spellHitUnitStat := stats.UnitStatFromPseudoStat(proto.PseudoStat_PseudoStatSpellHitPercent)
	spellHitWeight := getUnitStat(weights, spellHitUnitStat)
	spiritToSpellHit := playerIsHybridCaster(player)
	coeffOverrides := func(stat stats.Stat) (core.UnitStats, bool) {
		switch stat {
		case stats.Agility:
			// Guardian Druid special case: Agility converts to 2x Attack Power plus a flat
			// Crit% conversion (matching
			// core.CritPerAgiMaxLevel[Druid]), scaled by any active same-stat Agility
			// multiplier (Heart of the Wild, Mark of the Wild) pulled from the SDM.
			if !isGuardianDruid {
				return core.UnitStats{}, false
			}
			result := core.NewUnitStats()
			result.Stats[stats.AttackPower] = agilityMultiplier * 2
			result = setUnitStat(result, stats.UnitStatFromPseudoStat(proto.PseudoStat_PseudoStatPhysicalCritPercent), agilityMultiplier*core.CritPerAgiMaxLevel[proto.Class_ClassDruid])
			return result, true
		case stats.ExpertiseRating:
			// Expertise has no direct combat value in the EP model; it's scored as a proxy
			// for SpellHitPercent whenever hit itself carries weight.
			if weights.Stats[stat] != 0 || spellHitWeight == 0 {
				return core.UnitStats{}, false
			}
			return setUnitStat(core.NewUnitStats(), spellHitUnitStat, 1/core.SpellHitRatingPerHitPercent), true
		case stats.Spirit:
			// Same SpellHitPercent proxy as Expertise, but only for hybrid casters.
			if !spiritToSpellHit || weights.Stats[stat] != 0 || spellHitWeight == 0 {
				return core.UnitStats{}, false
			}
			return setUnitStat(core.NewUnitStats(), spellHitUnitStat, 1/core.SpellHitRatingPerHitPercent), true
		case stats.HitRating, stats.CritRating, stats.HasteRating:
			// A stat's direct EP weight normally short-circuits buildStatCoefficientTable to
			// an identity coefficient, since only rating-space matters for scoring. But when a
			// soft/threshold cap is configured on one of this stat's percent children, the cap
			// pass loop (updateHiGHSCapPass) rewrites weights.PseudoStats[child] as breakpoints
			// are crossed — and identity-only scoring never reads that slot, silently
			// discarding the updated post-cap value for every later pass. Route through both
			// channels so those updates take effect.
			if weights.Stats[stat] == 0 {
				return core.UnitStats{}, false
			}
			for _, child := range childPseudoStats(stat) {
				childUnitStat := stats.UnitStatFromPseudoStat(child)
				if !softCapConfiguredFor(softCaps, childUnitStat) {
					continue
				}
				result := core.NewUnitStats()
				result.Stats[stat] = 1
				result = setUnitStat(result, childUnitStat, 1/ratingPerPseudoStatPercent(child))
				return result, true
			}
			return core.UnitStats{}, false
		default:
			return core.UnitStats{}, false
		}
	}
	coeffTable := buildStatCoefficientTable(weights, coeffOverrides)
	gemOptions := buildReforgeGemOptions(request, player, gemSortWeights, hardCaps, softCaps, coeffTable, hasRelativeStatCap)
	allowedReforgeToStats := allowedReforgeDestinationStats(request.GetPreCapEpWeights())
	reforgeIDs := getSortedReforgeStatIDs()
	baseEquipment := core.ProtoToEquipment(baseGear)

	allSlots := make([]reforgeSlotChoices, 0, int(core.NumItemSlots))
	for slotIdx := 0; slotIdx < int(core.NumItemSlots); slotIdx++ {
		slot := proto.ItemSlot(slotIdx)
		item := baseEquipment.GetItemBySlot(slot)
		if item.ID == 0 || frozenSlots[slot] {
			continue
		}

		itemReforgeIDs := []int32{0}
		for _, reforgeID := range reforgeIDs {
			reforge := core.GetReforgeStatByID(reforgeID)
			toStat := stats.Stat(reforge.ToStat)
			if !allowedReforgeToStats[toStat] && toStat != stats.ExpertiseRating {
				continue
			}
			if core.ValidateReforging(item, reforge) {
				itemReforgeIDs = append(itemReforgeIDs, reforge.ID)
			}
		}
		if playerIsTrueCaster(player) {
			itemReforgeIDs = preferHitOverExpertiseReforges(itemReforgeIDs)
		}

		choices := make([]reforgeChoice, 0, len(itemReforgeIDs))
		for _, reforgeID := range itemReforgeIDs {
			choice := reforgeChoice{slot: slot, hasReforge: true, reforgeID: reforgeID}
			if reforgeID != 0 {
				choice.objectiveDelta = reforgeDelta(*item, core.GetReforgeStatByID(reforgeID), coeffTable)
				choice.score = dotUnitStats(choice.objectiveDelta, weights)
			}
			choices = append(choices, choice)
		}
		if len(choices) > 1 {
			allSlots = append(allSlots, reforgeSlotChoices{slot: slot, choices: choices})
		}

		if request.GetSettings().GetIncludeGems() {
			socketColors := currentSocketColors(*item, playerHasProfession(player, proto.Profession_Blacksmithing), request.GetSettings())
			forceSocketBonus := shouldForceSocketBonus(*item, socketColors, gemOptions, weights, hardCaps, softCaps, coeffTable)
			socketBonusSocketCount := socketBonusNormalization(socketColors)
			distributedSocketBonusDelta := core.NewUnitStats()
			distributedSocketBonusObjectiveDelta := core.NewUnitStats()
			if forceSocketBonus && socketBonusSocketCount > 0 {
				distributedSocketBonus := item.SocketBonus.Multiply(1 / float64(socketBonusSocketCount))
				distributedSocketBonusDelta = resolveStatDelta(statDeps, baseStats, rawUnitStatsFromStats(distributedSocketBonus))
				distributedSocketBonusObjectiveDelta = unitStatsFromStats(distributedSocketBonus, coeffTable)
			}
			variableSocketIdxs := make([]int, 0, len(socketColors))
			for socketIdx, socketColor := range socketColors {
				if socketColor == proto.GemColor_GemColorMeta {
					continue
				}
				gemChoices := []reforgeChoice{{slot: slot, gems: []reforgeGemChoice{{socketIdx: socketIdx, gemID: 0}}, socketChoice: true, socketIdx: socketIdx}}
				forEachGemOptionForSocket(gemOptions, socketColor, forceSocketBonus, func(gemOption reforgeGemOption) {
					if !gemEligibleForSocket(gemOption.color, socketColor) {
						return
					}
					gem, ok := core.GetGemByID(gemOption.id)
					if !ok {
						return
					}
					choice := reforgeChoice{
						slot:           slot,
						gems:           []reforgeGemChoice{{socketIdx: socketIdx, gemID: gemOption.id}},
						socketChoice:   true,
						socketIdx:      socketIdx,
						socketMatches:  gemMatchesSocket(gemOption.color, socketColor),
						objectiveDelta: unitStatsFromStats(gem.Stats, coeffTable),
					}
					if forceSocketBonus && choice.socketMatches {
						choice.forcedBonusDelta = distributedSocketBonusDelta
						choice.objectiveDelta = addUnitStats(choice.objectiveDelta, distributedSocketBonusObjectiveDelta)
					}
					choice.score = dotUnitStats(choice.objectiveDelta, weights)
					if gemOption.isJewelcrafting {
						choice.jewelcraftingGems = 1
					}
					if gemOption.color == proto.GemColor_GemColorShaTouched {
						choice.shaTouchedGems = 1
					}
					if gemOption.unique {
						choice.uniqueGemIDs = []int32{gemOption.id}
					}
					gemChoices = append(gemChoices, choice)
				})
				if len(gemChoices) > 1 {
					allSlots = append(allSlots, reforgeSlotChoices{slot: slot, choices: gemChoices})
					variableSocketIdxs = append(variableSocketIdxs, socketIdx)
				}
			}
			if !forceSocketBonus && len(variableSocketIdxs) > 0 && hasSocketBonus(*item) {
				socketBonusDelta := resolveStatDelta(statDeps, baseStats, rawUnitStatsFromStats(item.SocketBonus))
				socketBonusObjectiveDelta := unitStatsFromStats(item.SocketBonus, coeffTable)
				allSlots = append(allSlots, reforgeSlotChoices{slot: slot, choices: []reforgeChoice{
					{slot: slot, socketBonus: true},
					{slot: slot, socketBonus: true, bonusSocketIdxs: variableSocketIdxs, delta: socketBonusDelta, objectiveDelta: socketBonusObjectiveDelta, score: dotUnitStats(socketBonusObjectiveDelta, weights)},
				}})
			}
		}
	}

	computeChoiceDeltas(baseGear, allSlots, statDeps, baseStats)

	slices.SortFunc(allSlots, func(a, b reforgeSlotChoices) int {
		return cmp.Compare(maxChoiceScore(b.choices), maxChoiceScore(a.choices))
	})
	return allSlots, nil
}

// Drops any reforge that converts a stat to Expertise when the same source stat can already
// reforge to Hit. Pure casters have zero Expertise EP, so keeping both options only bloats
// the MIP without ever being chosen.
func preferHitOverExpertiseReforges(reforgeIDs []int32) []int32 {
	hitReforgeFromStats := map[stats.Stat]bool{}
	for _, reforgeID := range reforgeIDs {
		reforge := core.ReforgeStatsByID[reforgeID]
		if stats.Stat(reforge.ToStat) == stats.HitRating {
			hitReforgeFromStats[stats.Stat(reforge.FromStat)] = true
		}
	}
	if len(hitReforgeFromStats) == 0 {
		return reforgeIDs
	}
	return core.FilterSlice(reforgeIDs, func(reforgeID int32) bool {
		reforge := core.ReforgeStatsByID[reforgeID]
		return stats.Stat(reforge.ToStat) != stats.ExpertiseRating || !hitReforgeFromStats[stats.Stat(reforge.FromStat)]
	})
}

// Returns the set of stats that may appear as reforge targets, derived from non-zero EP
// weights. ExpertiseRating is always permitted separately by the caller for melee specs
// regardless of its weight.
func allowedReforgeDestinationStats(weights *proto.UnitStats) map[stats.Stat]bool {
	allowedStats := map[stats.Stat]bool{}
	if weights == nil {
		return allowedStats
	}
	for statIdx, weight := range weights.GetStats() {
		if weight != 0 {
			allowedStats[stats.Stat(statIdx)] = true
		}
	}
	return allowedStats
}

// Fills choice.delta — the stat-dependency-resolved delta used by the cap constraint
// evaluator — for every non-trivial choice. Separate from choice.objectiveDelta (the MIP
// objective) because caps are evaluated in raw stat space while the objective is in
// weighted EP space.
func computeChoiceDeltas(baseGear *proto.EquipmentSpec, allSlots []reforgeSlotChoices, sdm *stats.StatDependencyManager, baseStats core.UnitStats) {
	baseEquipment := core.ProtoToEquipment(baseGear)
	for slotIdx := range allSlots {
		for choiceIdx := range allSlots[slotIdx].choices {
			choice := &allSlots[slotIdx].choices[choiceIdx]
			if choice.socketBonus || (choice.hasReforge && choice.reforgeID == 0) || (!choice.hasReforge && len(choice.gems) == 0) || (len(choice.gems) == 1 && choice.gems[0].gemID == 0) {
				continue
			}
			choice.delta = resolveStatDelta(sdm, baseStats, rawChoiceDelta(baseEquipment, choice))
			if !isEmptyUnitStats(choice.forcedBonusDelta) {
				choice.delta = addUnitStats(choice.delta, choice.forcedBonusDelta)
			}
		}
	}
}

func equipmentSpecWithChoices(baseEquipment core.Equipment, choices []reforgeChoice) *proto.EquipmentSpec {
	gear := baseEquipment
	clonedGemSlots := [core.NumItemSlots]bool{}
	for _, choice := range choices {
		if int(choice.slot) < 0 || int(choice.slot) >= int(core.NumItemSlots) || clonedGemSlots[choice.slot] {
			continue
		}
		gear[choice.slot].Gems = slices.Clone(gear[choice.slot].Gems)
		clonedGemSlots[choice.slot] = true
	}
	gearEditor := &reforgeGearEditor{gear: &gear}
	gearEditor.applyChoices(choices)
	return gearEditor.equipment()
}

func hasSocketBonus(item core.Item) bool {
	for _, value := range item.SocketBonus {
		if value != 0 {
			return true
		}
	}
	return false
}

// Returns true when every socket should be constrained to match its color (guaranteeing the
// bonus activates): either matching gems + bonus beats the best unmatched gem, or the bonus
// grants a capped stat and matching is therefore valuable for cap management even if the
// raw EP gain is lower.
func shouldForceSocketBonus(item core.Item, socketColors []proto.GemColor, gemOptions map[proto.GemColor][]reforgeGemOption, weights core.UnitStats, hardCaps []reforgeHardCap, softCaps []reforgeSoftCap, coeffTable statCoefficientTable) bool {
	if !hasSocketBonus(item) {
		return false
	}
	normalization := socketBonusNormalization(socketColors)
	if normalization == 0 {
		return false
	}
	distributedSocketBonus := item.SocketBonus.Multiply(1 / float64(normalization))
	socketBonusDelta := unitStatsFromStats(distributedSocketBonus, coeffTable)
	if isEmptyUnitStats(socketBonusDelta) {
		return false
	}
	if includesStatWithCap(socketBonusDelta, hardCaps, softCaps) && !includesCappedStat(socketBonusDelta, hardCaps) && normalization > 1 {
		return true
	}

	matchedDelta := core.NewUnitStats()
	unmatchedDelta := core.NewUnitStats()
	for _, socketColor := range socketColors {
		if socketColor != proto.GemColor_GemColorRed && socketColor != proto.GemColor_GemColorBlue && socketColor != proto.GemColor_GemColorYellow && socketColor != proto.GemColor_GemColorPrismatic {
			break
		}

		matchedOptions := gemOptions[socketColor]
		unmatchedOptions := gemOptions[proto.GemColor_GemColorPrismatic]
		if len(matchedOptions) == 0 || len(unmatchedOptions) == 0 {
			return false
		}

		matchedGem, ok := core.GemsByID[matchedOptions[len(matchedOptions)-1].id]
		if !ok {
			return false
		}
		matchedDelta = addUnitStats(matchedDelta, unitStatsFromStats(matchedGem.Stats, coeffTable))
		matchedDelta = addUnitStats(matchedDelta, socketBonusDelta)

		unmatchedGem, ok := core.GemsByID[unmatchedOptions[0].id]
		if !ok {
			return false
		}
		unmatchedDelta = addUnitStats(unmatchedDelta, unitStatsFromStats(unmatchedGem.Stats, coeffTable))
	}

	if dotUnitStats(matchedDelta, weights) > dotUnitStats(unmatchedDelta, weights) && (normalization > 1 || (includesStatWithCap(socketBonusDelta, hardCaps, softCaps) && !includesCappedStat(socketBonusDelta, hardCaps))) {
		return true
	}
	return false
}

// Returns the number of non-meta sockets. The bonus is divided by this to distribute it
// evenly across sockets for per-socket EP scoring; meta sockets are excluded because they
// are never candidates for matching.
func socketBonusNormalization(socketColors []proto.GemColor) int {
	normalization := len(socketColors)
	if normalization == 0 {
		return 1
	}
	if normalization > 1 && socketColors[0] == proto.GemColor_GemColorMeta {
		normalization--
	}
	return normalization
}

func includesStatWithCap(delta core.UnitStats, hardCaps []reforgeHardCap, softCaps []reforgeSoftCap) bool {
	for _, hardCap := range hardCaps {
		if getUnitStat(delta, hardCap.unitStat) != 0 {
			return true
		}
	}
	for _, softCap := range softCaps {
		if getUnitStat(delta, softCap.unitStat) != 0 {
			return true
		}
	}
	return false
}

// Returns true if the delta touches a hard-cap stat that is already at or over its cap
// (undershoot=true means we are still short; false means capped/over). Used to skip
// forcing the socket bonus when doing so would waste the bonus on a stat where additional
// rating has no value.
func includesCappedStat(delta core.UnitStats, hardCaps []reforgeHardCap) bool {
	for _, hardCap := range hardCaps {
		if hardCap.undershoot && getUnitStat(delta, hardCap.unitStat) != 0 {
			return true
		}
	}
	return false
}

func gemMatchesSocket(gemColor proto.GemColor, socketColor proto.GemColor) bool {
	if gemColor == socketColor {
		return true
	}
	switch socketColor {
	case proto.GemColor_GemColorBlue:
		return gemColor == proto.GemColor_GemColorPurple || gemColor == proto.GemColor_GemColorGreen || gemColor == proto.GemColor_GemColorPrismatic
	case proto.GemColor_GemColorRed:
		return gemColor == proto.GemColor_GemColorPurple || gemColor == proto.GemColor_GemColorOrange || gemColor == proto.GemColor_GemColorPrismatic
	case proto.GemColor_GemColorYellow:
		return gemColor == proto.GemColor_GemColorOrange || gemColor == proto.GemColor_GemColorGreen || gemColor == proto.GemColor_GemColorPrismatic
	case proto.GemColor_GemColorPrismatic:
		return gemColor == proto.GemColor_GemColorRed || gemColor == proto.GemColor_GemColorOrange || gemColor == proto.GemColor_GemColorYellow || gemColor == proto.GemColor_GemColorGreen || gemColor == proto.GemColor_GemColorBlue || gemColor == proto.GemColor_GemColorPurple
	default:
		return false
	}
}

// Returns the unresolved (pre-stat-dependency) stat delta for a choice, combining any
// reforge and gem stats. Passed to resolveStatDelta to produce the final choice.delta used
// for cap checks; the StatDependencyManager it's resolved against already reflects any
// active Gear/Buffs-phase multiplicative deps (e.g. Amplification Trinkets, Mark of the
// Wild), so no manual modifier is applied here.
func rawChoiceDelta(equipment core.Equipment, choice *reforgeChoice) core.UnitStats {
	rawStats := stats.Stats{}
	if choice.hasReforge && choice.reforgeID != 0 {
		item := equipment.GetItemBySlot(choice.slot)
		rawStats = rawStats.Add(reforgeRawStats(*item, core.ReforgeStatsByID[choice.reforgeID]))
	}
	for _, gemChoice := range choice.gems {
		if gemChoice.gemID == 0 {
			continue
		}
		if gem, ok := core.GemsByID[gemChoice.gemID]; ok {
			rawStats = rawStats.Add(gem.Stats)
		}
	}
	return rawUnitStatsFromStats(rawStats)
}

// Computes the stat change a reforge produces on an item. For random-suffix items, the
// suffix stats (scaled by RandPropPoints) replace base item stats as the reforge source.
func reforgeRawStats(item core.Item, reforge core.ReforgeStat) stats.Stats {
	itemStats := item.Stats
	if item.RandomSuffix.ID != 0 {
		itemStats = item.RandomSuffix.Stats.Multiply(float64(item.RandPropPoints) / 10000).Floor()
	}
	fromStat := stats.Stat(reforge.FromStat)
	reduction := math.Floor(itemStats[fromStat] * reforge.Multiplier)
	delta := stats.Stats{}
	delta[fromStat] -= reduction
	delta[reforge.ToStat] += reduction
	return delta
}

func reforgeDelta(item core.Item, reforge core.ReforgeStat, coeffTable statCoefficientTable) core.UnitStats {
	return unitStatsFromStats(reforgeRawStats(item, reforge), coeffTable)
}

// Converts stats.Stats to UnitStats without expanding ratings into percent pseudo-stats.
// Used for deltas that feed resolveStatDelta (cap constraint space), not the EP objective.
func rawUnitStatsFromStats(statValues stats.Stats) core.UnitStats {
	unitStats := core.NewUnitStats()
	for statIdx := 0; statIdx < int(stats.ProtoStatsLen); statIdx++ {
		amount := statValues[statIdx]
		if amount == 0 {
			continue
		}
		unitStats.Stats[statIdx] += amount
	}
	return unitStats
}

// Converts stats to the optimizer's weighted EP representation using a precomputed
// statCoefficientTable (see buildStatCoefficientTable) — each nonzero input stat contributes
// its fully stat-dependency-resolved UnitStats, scaled by the input amount. This captures
// every dependency the real sim models (Agility→Crit, Bear Form's Crit multiplier, Mark of
// the Wild, Heart of the Wild, Amplification Trinkets, Spirit→Hit for hybrid casters, etc.)
// at O(stats touched) per call instead of re-walking the StatDependencyManager per candidate.
func unitStatsFromStats(statValues stats.Stats, coeffTable statCoefficientTable) core.UnitStats {
	result := core.NewUnitStats()
	for statIdx := 0; statIdx < int(stats.ProtoStatsLen); statIdx++ {
		amount := statValues[statIdx]
		if amount == 0 {
			continue
		}
		result = addUnitStats(result, scaleUnitStats(coeffTable[statIdx], amount))
	}
	return result
}

func maxChoiceScore(choices []reforgeChoice) float64 {
	best := math.Inf(-1)
	for _, choice := range choices {
		best = math.Max(best, choice.score)
	}
	return best
}

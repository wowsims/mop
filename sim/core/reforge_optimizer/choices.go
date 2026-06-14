package reforgeoptimizer

import (
	"cmp"
	"maps"
	"math"
	"slices"
	"sync"

	"github.com/wowsims/mop/sim/common/mop"
	"github.com/wowsims/mop/sim/common/shared"
	"github.com/wowsims/mop/sim/core"
	"github.com/wowsims/mop/sim/core/proto"
	"github.com/wowsims/mop/sim/core/stats"
)

var amplificationTrinketItemIDs = buildAmplificationTrinketItemIDSet()

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

func buildReforgeSlotChoices(request *proto.ReforgeOptimizeRequest, baseRaid *proto.Raid, baseGear *proto.EquipmentSpec, baseStats core.UnitStats, weights core.UnitStats, gemSortWeights core.UnitStats, hardCaps []reforgeHardCap, softCaps []reforgeSoftCap, hasRelativeStatCap bool, statDeps *stats.StatDependencyManager) ([]reforgeSlotChoices, error) {
	frozenSlots := frozenItemSlots(request.GetSettings())
	player := request.Raid.Parties[0].Players[0]
	ampModifier := amplificationStatModifier(baseGear)
	if statDeps == nil {
		statDeps = core.ComputeStatDependencies(&proto.ComputeStatsRequest{Raid: baseRaid})
	}
	spiritToSpellHit := playerIsHybridCaster(player)
	gemOptions := buildReforgeGemOptions(request, player, gemSortWeights, hardCaps, softCaps, ampModifier, hasRelativeStatCap, spiritToSpellHit)
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
				choice.objectiveDelta = reforgeDelta(*item, core.GetReforgeStatByID(reforgeID), weights, ampModifier, spiritToSpellHit)
				choice.score = dotUnitStats(choice.objectiveDelta, weights)
			}
			choices = append(choices, choice)
		}
		if len(choices) > 1 {
			allSlots = append(allSlots, reforgeSlotChoices{slot: slot, choices: choices})
		}

		if request.GetSettings().GetIncludeGems() {
			socketColors := currentSocketColors(*item, playerHasProfession(player, proto.Profession_Blacksmithing), request.GetSettings())
			forceSocketBonus := shouldForceSocketBonus(*item, socketColors, gemOptions, weights, hardCaps, softCaps, ampModifier, spiritToSpellHit)
			socketBonusSocketCount := socketBonusNormalization(socketColors)
			distributedSocketBonusDelta := core.NewUnitStats()
			distributedSocketBonusObjectiveDelta := core.NewUnitStats()
			if forceSocketBonus && socketBonusSocketCount > 0 {
				distributedSocketBonus := item.SocketBonus.Multiply(1 / float64(socketBonusSocketCount))
				distributedSocketBonusDelta = resolveStatDelta(statDeps, baseStats, rawUnitStatsFromStats(distributedSocketBonus, ampModifier))
				distributedSocketBonusObjectiveDelta = unitStatsFromStats(distributedSocketBonus, weights, ampModifier, spiritToSpellHit)
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
						objectiveDelta: unitStatsFromStats(gem.Stats, weights, ampModifier, spiritToSpellHit),
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
				socketBonusDelta := resolveStatDelta(statDeps, baseStats, rawUnitStatsFromStats(item.SocketBonus, ampModifier))
				socketBonusObjectiveDelta := unitStatsFromStats(item.SocketBonus, weights, ampModifier, spiritToSpellHit)
				allSlots = append(allSlots, reforgeSlotChoices{slot: slot, choices: []reforgeChoice{
					{slot: slot, socketBonus: true},
					{slot: slot, socketBonus: true, bonusSocketIdxs: variableSocketIdxs, delta: socketBonusDelta, objectiveDelta: socketBonusObjectiveDelta, score: dotUnitStats(socketBonusObjectiveDelta, weights)},
				}})
			}
		}
	}

	computeChoiceDeltas(baseGear, allSlots, statDeps, baseStats, ampModifier)

	slices.SortFunc(allSlots, func(a, b reforgeSlotChoices) int {
		return cmp.Compare(maxChoiceScore(b.choices), maxChoiceScore(a.choices))
	})
	return allSlots, nil
}

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

func computeChoiceDeltas(baseGear *proto.EquipmentSpec, allSlots []reforgeSlotChoices, sdm *stats.StatDependencyManager, baseStats core.UnitStats, ampModifier float64) {
	baseEquipment := core.ProtoToEquipment(baseGear)
	for slotIdx := range allSlots {
		for choiceIdx := range allSlots[slotIdx].choices {
			choice := &allSlots[slotIdx].choices[choiceIdx]
			if choice.socketBonus || (choice.hasReforge && choice.reforgeID == 0) || (!choice.hasReforge && len(choice.gems) == 0) || (len(choice.gems) == 1 && choice.gems[0].gemID == 0) {
				continue
			}
			choice.delta = resolveStatDelta(sdm, baseStats, rawChoiceDelta(baseEquipment, choice, ampModifier))
			if !isEmptyUnitStats(choice.forcedBonusDelta) {
				choice.delta = addUnitStats(choice.delta, choice.forcedBonusDelta)
			}
		}
	}
}

func equipmentSpecWithChoice(baseEquipment core.Equipment, choice reforgeChoice) *proto.EquipmentSpec {
	gear := baseEquipment
	if int(choice.slot) >= 0 && int(choice.slot) < int(core.NumItemSlots) {
		gear[choice.slot].Gems = slices.Clone(gear[choice.slot].Gems)
	}
	gearEditor := &reforgeGearEditor{gear: &gear}
	gearEditor.applyChoice(choice)
	return gearEditor.equipment()
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

func shouldForceSocketBonus(item core.Item, socketColors []proto.GemColor, gemOptions map[proto.GemColor][]reforgeGemOption, weights core.UnitStats, hardCaps []reforgeHardCap, softCaps []reforgeSoftCap, ampModifier float64, spiritToSpellHit bool) bool {
	if !hasSocketBonus(item) {
		return false
	}
	normalization := socketBonusNormalization(socketColors)
	if normalization == 0 {
		return false
	}
	distributedSocketBonus := item.SocketBonus.Multiply(1 / float64(normalization))
	socketBonusDelta := unitStatsFromStats(distributedSocketBonus, weights, ampModifier, spiritToSpellHit)
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
		matchedDelta = addUnitStats(matchedDelta, unitStatsFromStats(matchedGem.Stats, weights, ampModifier, spiritToSpellHit))
		matchedDelta = addUnitStats(matchedDelta, socketBonusDelta)

		unmatchedGem, ok := core.GemsByID[unmatchedOptions[0].id]
		if !ok {
			return false
		}
		unmatchedDelta = addUnitStats(unmatchedDelta, unitStatsFromStats(unmatchedGem.Stats, weights, ampModifier, spiritToSpellHit))
	}

	if dotUnitStats(matchedDelta, weights) > dotUnitStats(unmatchedDelta, weights) && (normalization > 1 || (includesStatWithCap(socketBonusDelta, hardCaps, softCaps) && !includesCappedStat(socketBonusDelta, hardCaps))) {
		return true
	}
	return false
}

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

func rawChoiceDelta(equipment core.Equipment, choice *reforgeChoice, ampModifier float64) core.UnitStats {
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
	return rawUnitStatsFromStats(rawStats, ampModifier)
}

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

func reforgeDelta(item core.Item, reforge core.ReforgeStat, weights core.UnitStats, ampModifier float64, spiritToSpellHit bool) core.UnitStats {
	return unitStatsFromStats(reforgeRawStats(item, reforge), weights, ampModifier, spiritToSpellHit)
}

func applyAmpModifier(stat stats.Stat, amount, ampModifier float64) float64 {
	if stat == stats.HasteRating || stat == stats.MasteryRating || stat == stats.Spirit {
		return amount * ampModifier
	}
	return amount
}

func rawUnitStatsFromStats(statValues stats.Stats, ampModifier float64) core.UnitStats {
	unitStats := core.NewUnitStats()
	for statIdx := 0; statIdx < int(stats.ProtoStatsLen); statIdx++ {
		amount := statValues[statIdx]
		if amount == 0 {
			continue
		}
		unitStats.Stats[statIdx] += applyAmpModifier(stats.Stat(statIdx), amount, ampModifier)
	}
	return unitStats
}

func unitStatsFromStats(statValues stats.Stats, weights core.UnitStats, ampModifier float64, spiritToSpellHit bool) core.UnitStats {
	unitStats := core.NewUnitStats()
	for statIdx := 0; statIdx < int(stats.ProtoStatsLen); statIdx++ {
		amount := statValues[statIdx]
		if amount == 0 {
			continue
		}
		stat := stats.Stat(statIdx)
		amount = applyAmpModifier(stat, amount, ampModifier)
		if weights.Stats[statIdx] != 0 {
			unitStats.Stats[statIdx] += amount
			continue
		}
		switch stat {
		case stats.Spirit:
			if spiritToSpellHit && getUnitStat(weights, stats.UnitStatFromPseudoStat(proto.PseudoStat_PseudoStatSpellHitPercent)) != 0 {
				unitStats = addPseudoStat(unitStats, proto.PseudoStat_PseudoStatSpellHitPercent, amount/core.SpellHitRatingPerHitPercent)
			}
		case stats.HitRating:
			if getUnitStat(weights, stats.UnitStatFromPseudoStat(proto.PseudoStat_PseudoStatPhysicalHitPercent)) != 0 {
				unitStats = addPseudoStat(unitStats, proto.PseudoStat_PseudoStatPhysicalHitPercent, amount/core.PhysicalHitRatingPerHitPercent)
			}
			if getUnitStat(weights, stats.UnitStatFromPseudoStat(proto.PseudoStat_PseudoStatSpellHitPercent)) != 0 {
				unitStats = addPseudoStat(unitStats, proto.PseudoStat_PseudoStatSpellHitPercent, amount/core.SpellHitRatingPerHitPercent)
			}
		case stats.ExpertiseRating:
			if getUnitStat(weights, stats.UnitStatFromPseudoStat(proto.PseudoStat_PseudoStatSpellHitPercent)) != 0 {
				unitStats = addPseudoStat(unitStats, proto.PseudoStat_PseudoStatSpellHitPercent, amount/core.SpellHitRatingPerHitPercent)
			}
		case stats.CritRating:
			if getUnitStat(weights, stats.UnitStatFromPseudoStat(proto.PseudoStat_PseudoStatPhysicalCritPercent)) != 0 {
				unitStats = addPseudoStat(unitStats, proto.PseudoStat_PseudoStatPhysicalCritPercent, amount/core.CritRatingPerCritPercent)
			}
			if getUnitStat(weights, stats.UnitStatFromPseudoStat(proto.PseudoStat_PseudoStatSpellCritPercent)) != 0 {
				unitStats = addPseudoStat(unitStats, proto.PseudoStat_PseudoStatSpellCritPercent, amount/core.CritRatingPerCritPercent)
			}
		case stats.HasteRating:
			if getUnitStat(weights, stats.UnitStatFromPseudoStat(proto.PseudoStat_PseudoStatMeleeHastePercent)) != 0 {
				unitStats = addPseudoStat(unitStats, proto.PseudoStat_PseudoStatMeleeHastePercent, amount/core.HasteRatingPerHastePercent)
			}
			if getUnitStat(weights, stats.UnitStatFromPseudoStat(proto.PseudoStat_PseudoStatRangedHastePercent)) != 0 {
				unitStats = addPseudoStat(unitStats, proto.PseudoStat_PseudoStatRangedHastePercent, amount/core.HasteRatingPerHastePercent)
			}
			if getUnitStat(weights, stats.UnitStatFromPseudoStat(proto.PseudoStat_PseudoStatSpellHastePercent)) != 0 {
				unitStats = addPseudoStat(unitStats, proto.PseudoStat_PseudoStatSpellHastePercent, amount/core.HasteRatingPerHastePercent)
			}
		}
	}
	return unitStats
}

func addPseudoStat(unitStats core.UnitStats, pseudoStat proto.PseudoStat, value float64) core.UnitStats {
	unitStat := stats.UnitStatFromPseudoStat(pseudoStat)
	return setUnitStat(unitStats, unitStat, getUnitStat(unitStats, unitStat)+value)
}

func amplificationStatModifier(equipment *proto.EquipmentSpec) float64 {
	modifier := 1.0
	for _, slot := range core.TrinketSlots() {
		if int(slot) >= len(equipment.Items) || equipment.Items[slot] == nil {
			continue
		}
		itemSpec := equipment.Items[slot]
		itemID := itemSpec.GetId()
		if !isAmplificationTrinket(itemID) {
			continue
		}
		modifier *= 1 + core.GetItemEffectScaling(itemID, 0.00176999997, itemSpec.GetUpgradeStep())/100
	}
	return modifier
}

func isAmplificationTrinket(itemID int32) bool {
	_, ok := amplificationTrinketItemIDs[itemID]
	return ok
}

func buildAmplificationTrinketItemIDSet() map[int32]struct{} {
	itemIDs := make(map[int32]struct{}, len(mop.MeleeAmplificationTrinketItemIDs)+len(mop.CasterAmplificationTrinketItemIDs)+len(mop.HealerAmplificationTrinketItemIDs))
	for _, itemVersionMap := range []shared.ItemVersionMap{
		mop.MeleeAmplificationTrinketItemIDs,
		mop.CasterAmplificationTrinketItemIDs,
		mop.HealerAmplificationTrinketItemIDs,
	} {
		for itemID := range maps.Values(itemVersionMap) {
			itemIDs[itemID] = struct{}{}
		}
	}
	return itemIDs
}

func maxChoiceScore(choices []reforgeChoice) float64 {
	best := math.Inf(-1)
	for _, choice := range choices {
		best = math.Max(best, choice.score)
	}
	return best
}

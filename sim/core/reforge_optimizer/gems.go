package reforgeoptimizer

import (
	"cmp"
	"slices"
	"strings"

	"github.com/wowsims/mop/sim/core"
	"github.com/wowsims/mop/sim/core/proto"
	"github.com/wowsims/mop/sim/core/stats"
)

func buildReforgeGemOptions(request *proto.ReforgeOptimizeRequest, player *proto.Player, weights core.UnitStats, hardCaps []reforgeHardCap, softCaps []reforgeSoftCap, ampModifier float64, hasRelativeStatCap bool, spiritToSpellHit bool) map[proto.GemColor][]reforgeGemOption {
	options := make(map[proto.GemColor][]reforgeGemOption)
	if !request.GetSettings().GetIncludeGems() {
		return options
	}

	for _, socketColor := range []proto.GemColor{
		proto.GemColor_GemColorPrismatic,
		proto.GemColor_GemColorShaTouched,
		proto.GemColor_GemColorCogwheel,
		proto.GemColor_GemColorRed,
		proto.GemColor_GemColorBlue,
		proto.GemColor_GemColorYellow,
	} {
		candidates := filteredGemCandidatesForSocket(request.GetGemOptions(), player, socketColor, weights, hardCaps, softCaps, ampModifier, spiritToSpellHit)
		options[socketColor] = selectGemCandidates(candidates, socketColor, playerIsTankSpec(player), hardCaps, softCaps, hasRelativeStatCap)
	}
	return options
}

func forEachGemOptionForSocket(gemOptions map[proto.GemColor][]reforgeGemOption, socketColor proto.GemColor, forceSocketBonus bool, visit func(reforgeGemOption)) {
	var gemColorKeys [2]proto.GemColor
	gemColorKeyCount := 0
	switch socketColor {
	case proto.GemColor_GemColorPrismatic, proto.GemColor_GemColorCogwheel, proto.GemColor_GemColorShaTouched:
		gemColorKeys[gemColorKeyCount] = socketColor
		gemColorKeyCount++
	case proto.GemColor_GemColorRed, proto.GemColor_GemColorBlue, proto.GemColor_GemColorYellow:
		gemColorKeys[gemColorKeyCount] = socketColor
		gemColorKeyCount++
		if forceSocketBonus {
			break
		}
		gemColorKeys[gemColorKeyCount] = proto.GemColor_GemColorPrismatic
		gemColorKeyCount++
	default:
		return
	}

	var seenGemIDs [16]int32
	seenGemIDCount := 0
	var overflowSeenGemIDs map[int32]bool
	for _, gemColorKey := range gemColorKeys[:gemColorKeyCount] {
		for _, option := range gemOptions[gemColorKey] {
			if gemOptionSeen(option.id, seenGemIDs[:seenGemIDCount], overflowSeenGemIDs) {
				continue
			}
			if seenGemIDCount < len(seenGemIDs) {
				seenGemIDs[seenGemIDCount] = option.id
				seenGemIDCount++
			} else {
				if overflowSeenGemIDs == nil {
					overflowSeenGemIDs = make(map[int32]bool, len(seenGemIDs)+1)
					for _, seenGemID := range seenGemIDs {
						overflowSeenGemIDs[seenGemID] = true
					}
				}
				overflowSeenGemIDs[option.id] = true
			}
			visit(option)
		}
	}
}

func gemOptionSeen(gemID int32, seenGemIDs []int32, overflowSeenGemIDs map[int32]bool) bool {
	if overflowSeenGemIDs != nil {
		return overflowSeenGemIDs[gemID]
	}
	return slices.Contains(seenGemIDs, gemID)
}

func filteredGemCandidatesForSocket(gems []*proto.ReforgeGemOption, player *proto.Player, socketColor proto.GemColor, weights core.UnitStats, hardCaps []reforgeHardCap, softCaps []reforgeSoftCap, ampModifier float64, spiritToSpellHit bool) []reforgeGemOption {
	candidates := make([]reforgeGemOption, 0)
	hasJewelcrafting := playerHasProfession(player, proto.Profession_Jewelcrafting)
	for _, gem := range gems {
		if gem.GetId() == 0 || strings.Contains(gem.GetName(), "Perfect") || !gemMatchesSocket(gem.GetColor(), socketColor) {
			continue
		}
		isJewelcrafting := gem.GetRequiredProfession() == proto.Profession_Jewelcrafting
		if isJewelcrafting && (!hasJewelcrafting || (!playerIsTankSpec(player) && !gemHasPrimaryStat(gem))) {
			continue
		}
		if playerIsHybridCaster(player) && len(gem.GetStats()) > int(stats.HitRating) && gem.GetStats()[stats.HitRating] != 0 {
			continue
		}

		gemStats := stats.FromProtoArray(gem.GetStats())
		if !gemStatsAllowed(gemStats, weights, ampModifier, spiritToSpellHit) {
			continue
		}
		delta := unitStatsFromStats(gemStats, weights, ampModifier, spiritToSpellHit)
		candidates = append(candidates, reforgeGemOption{
			id:              gem.GetId(),
			color:           gem.GetColor(),
			isJewelcrafting: isJewelcrafting,
			unique:          gem.GetUnique(),
			score:           dotUnitStats(delta, weights),
			cappedStats:     cappedGemStats(delta, hardCaps, softCaps),
		})
	}
	slices.SortStableFunc(candidates, func(a, b reforgeGemOption) int {
		return cmp.Compare(b.score, a.score)
	})
	return candidates
}

func selectGemCandidates(candidates []reforgeGemOption, socketColor proto.GemColor, isTank bool, hardCaps []reforgeHardCap, softCaps []reforgeSoftCap, hasRelativeStatCap bool) []reforgeGemOption {
	maxGemOptionsForStat := 4
	if isTank {
		maxGemOptionsForStat = 3
	}
	if socketColor == proto.GemColor_GemColorYellow && !hasRelativeStatCap && !hasCritOrHasteCap(hardCaps, softCaps) {
		maxGemOptionsForStat = 1
	}

	included := make([]reforgeGemOption, 0, len(candidates))
	foundUncappedJCGem := false
	foundUncappedNormalGem := false
	numUncappedNormalGems := 0
	numGemOptionsForStat := make(map[stats.UnitStat]int)
	for _, gem := range candidates {
		isRedundantGem := false
		for _, cappedStat := range gem.cappedStats {
			if numGemOptionsForStat[cappedStat] == maxGemOptionsForStat {
				isRedundantGem = true
			} else if !gem.isJewelcrafting {
				numGemOptionsForStat[cappedStat]++
			}
		}

		if (!gem.isJewelcrafting || !foundUncappedJCGem) && !isRedundantGem && (len(gem.cappedStats) == 0 || !foundUncappedNormalGem) {
			included = append(included, gem)
		}

		if len(gem.cappedStats) == 0 && socketColor != proto.GemColor_GemColorCogwheel {
			if gem.isJewelcrafting {
				foundUncappedJCGem = true
			} else {
				foundUncappedNormalGem = true
				numUncappedNormalGems++
				if !hasRelativeStatCap || numUncappedNormalGems == 3 {
					break
				}
			}
		}
	}
	return included
}

func gemStatsAllowed(gemStats stats.Stats, weights core.UnitStats, ampModifier float64, spiritToSpellHit bool) bool {
	for statIdx := 0; statIdx < int(stats.ProtoStatsLen); statIdx++ {
		if gemStats[statIdx] == 0 {
			continue
		}
		if stats.Stat(statIdx) == stats.ExpertiseRating {
			continue
		}
		statValues := stats.Stats{}
		statValues[statIdx] = gemStats[statIdx]
		if isEmptyUnitStats(unitStatsFromStats(statValues, weights, ampModifier, spiritToSpellHit)) {
			return false
		}
	}
	return true
}

func cappedGemStats(delta core.UnitStats, hardCaps []reforgeHardCap, softCaps []reforgeSoftCap) []stats.UnitStat {
	cappedStats := make([]stats.UnitStat, 0)
	seen := make(map[stats.UnitStat]bool)
	addIfPresent := func(unitStat stats.UnitStat) {
		if !seen[unitStat] && getUnitStat(delta, unitStat) != 0 {
			seen[unitStat] = true
			cappedStats = append(cappedStats, unitStat)
		}
	}
	for _, hardCap := range hardCaps {
		addIfPresent(hardCap.unitStat)
	}
	for _, softCap := range softCaps {
		addIfPresent(softCap.unitStat)
	}
	return cappedStats
}

func gemHasPrimaryStat(gem *proto.ReforgeGemOption) bool {
	for _, stat := range []stats.Stat{stats.Strength, stats.Agility, stats.Intellect} {
		if len(gem.GetStats()) > int(stat) && gem.GetStats()[stat] != 0 {
			return true
		}
	}
	return false
}

func currentSocketColors(item core.Item, isBlacksmithing bool, settings *proto.ReforgeSettings) []proto.GemColor {
	socketColors := slices.Clone(item.GemSockets)
	if !settings.GetIncludeEotbGemSocket() && hasEndOfTierBonusSocket(item) && len(socketColors) > 0 {
		socketColors = socketColors[:len(socketColors)-1]
	}
	if isBlacksmithing && (item.Type == proto.ItemType_ItemTypeWrist || item.Type == proto.ItemType_ItemTypeHands) {
		socketColors = append(socketColors, proto.GemColor_GemColorPrismatic)
	}
	return socketColors
}

func hasEndOfTierBonusSocket(item core.Item) bool {
	for _, socketColor := range item.GemSockets {
		if socketColor == proto.GemColor_GemColorShaTouched {
			return true
		}
	}
	return strings.HasSuffix(item.Name, ", Reborn")
}

func gemEligibleForSocket(gemColor proto.GemColor, socketColor proto.GemColor) bool {
	switch socketColor {
	case proto.GemColor_GemColorMeta:
		return gemColor == proto.GemColor_GemColorMeta
	case proto.GemColor_GemColorCogwheel:
		return gemColor == proto.GemColor_GemColorCogwheel
	case proto.GemColor_GemColorShaTouched:
		return gemColor == proto.GemColor_GemColorShaTouched
	default:
		return gemColor != proto.GemColor_GemColorMeta && gemColor != proto.GemColor_GemColorCogwheel && gemColor != proto.GemColor_GemColorShaTouched
	}
}

func clearGems(equipment *proto.EquipmentSpec, settings *proto.ReforgeSettings) {
	frozenSlots := frozenItemSlots(settings)
	for slotIdx, item := range equipment.Items {
		slot := proto.ItemSlot(slotIdx)
		if item == nil || frozenSlots[slot] {
			continue
		}

		for gemIdx, gemID := range item.Gems {
			if gemID == 0 {
				continue
			}
			if isHeadMetaSocket(item, slot, gemIdx) {
				continue
			}
			if gem, ok := core.GemsByID[gemID]; !ok || gem.Color != proto.GemColor_GemColorMeta {
				item.Gems[gemIdx] = 0
			}
		}
	}
}

func isHeadMetaSocket(item *proto.ItemSpec, slot proto.ItemSlot, gemIdx int) bool {
	if slot != proto.ItemSlot_ItemSlotHead {
		return false
	}
	if dbItem, ok := core.ItemsByID[item.GetId()]; ok && gemIdx < len(dbItem.GemSockets) {
		return dbItem.GemSockets[gemIdx] == proto.GemColor_GemColorMeta
	}
	return gemIdx == 0
}

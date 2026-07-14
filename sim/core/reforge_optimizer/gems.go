package reforgeoptimizer

import (
	"cmp"
	"slices"
	"strings"

	"github.com/wowsims/mop/sim/core"
	"github.com/wowsims/mop/sim/core/proto"
	"github.com/wowsims/mop/sim/core/stats"
)

// Builds the per-socket-color gem option lists used during slot choice construction.
// Each socket color gets a filtered, scored, and pruned list of eligible gems.
func buildReforgeGemOptions(request *proto.ReforgeOptimizeRequest, player *proto.Player, weights core.UnitStats, hardCaps []reforgeHardCap, softCaps []reforgeSoftCap, coeffTable statCoefficientTable, hasRelativeStatCap bool) map[proto.GemColor][]reforgeGemOption {
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
		candidates := filteredGemCandidatesForSocket(request.GetGemOptions(), player, socketColor, weights, hardCaps, softCaps, coeffTable)
		options[socketColor] = selectGemCandidates(candidates, socketColor, playerIsTankSpec(player), hardCaps, softCaps, hasRelativeStatCap)
	}
	return options
}

// Visits unique gem options eligible for a socket: colored sockets see their own list
// plus prismatic options (unless forceSocketBonus is set, which restricts to matching
// colors only). Uses an inline array for dedup to avoid a map allocation for <16 gems.
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

// Filters the gem list to those eligible for the socket color, removes JC-only gems if
// the player lacks Jewelcrafting or the gem has no primary stat (for DPS), excludes
// HitRating gems for hybrid casters (Spirit already covers hit), and sorts descending
// by EP score.
func filteredGemCandidatesForSocket(gems []*proto.ReforgeGemOption, player *proto.Player, socketColor proto.GemColor, weights core.UnitStats, hardCaps []reforgeHardCap, softCaps []reforgeSoftCap, coeffTable statCoefficientTable) []reforgeGemOption {
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
		if !gemStatsAllowed(gemStats, weights, coeffTable) {
			continue
		}
		delta := unitStatsFromStats(gemStats, coeffTable)
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

// Prunes candidates to keep at most maxGemOptionsForStat per capped stat (4 normally, 3
// for tanks, 1 for Yellow sockets with no crit/haste cap) to limit MIP variable count.
// Stops early once a top-N of uncapped gems is found.
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
			}
		}

		if (!gem.isJewelcrafting || !foundUncappedJCGem) && !isRedundantGem && (len(gem.cappedStats) == 0 || !foundUncappedNormalGem) {
			included = append(included, gem)

			// Only gems that actually made it into the candidate list consume per-stat
			// option slots; otherwise a gem rejected for one capped stat can crowd out
			// pure gems of its other capped stats.
			if !gem.isJewelcrafting {
				for _, cappedStat := range gem.cappedStats {
					numGemOptionsForStat[cappedStat]++
				}
			}
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

// Returns true if every stat on the gem maps to a non-zero-weighted EP stat or pseudo-stat,
// once resolved through the stat dependency graph. Gems with a stat that contributes
// nothing to the weighted objective are excluded from the solver.
func gemStatsAllowed(gemStats stats.Stats, weights core.UnitStats, coeffTable statCoefficientTable) bool {
	for statIdx := 0; statIdx < int(stats.ProtoStatsLen); statIdx++ {
		if gemStats[statIdx] == 0 {
			continue
		}
		if stats.Stat(statIdx) == stats.ExpertiseRating {
			continue
		}
		statValues := stats.Stats{}
		statValues[statIdx] = gemStats[statIdx]
		if dotUnitStats(unitStatsFromStats(statValues, coeffTable), weights) == 0 {
			return false
		}
	}
	return true
}

// Returns the subset of hard/soft cap stats that this gem contributes to. Used by
// selectGemCandidates to count how many options per capped stat have been included.
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

// Returns true if the gem grants Strength, Agility, or Intellect. JC-only gems are only
// included for non-tank DPS specs when they carry a primary stat.
func gemHasPrimaryStat(gem *proto.ReforgeGemOption) bool {
	for _, stat := range []stats.Stat{stats.Strength, stats.Agility, stats.Intellect} {
		if len(gem.GetStats()) > int(stat) && gem.GetStats()[stat] != 0 {
			return true
		}
	}
	return false
}

// Returns the effective socket colors: drops the end-of-tier bonus socket when disabled,
// and appends a Prismatic bonus socket for Blacksmiths on wrists/hands.
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

// Detects a Throne of Thunder end-of-tier bonus socket. Sha-Touched socket color is the
// direct signal; the ", Reborn" name suffix catches LFR tier pieces which share the same
// bonus but use a standard socket color.
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

// Removes all non-meta gems from unfrozen slots for baseline stat computation. The head
// meta socket is preserved because the optimizer never changes meta gems.
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
			if gem, ok := core.GetGemByID(gemID); !ok || gem.Color != proto.GemColor_GemColorMeta {
				item.Gems[gemIdx] = 0
			}
		}
	}
}

// Returns true when gemIdx is the meta socket in the head slot. Falls back to gemIdx==0
// when the item isn't in the DB, since meta is always the first socket on helms.
func isHeadMetaSocket(item *proto.ItemSpec, slot proto.ItemSlot, gemIdx int) bool {
	if slot != proto.ItemSlot_ItemSlotHead {
		return false
	}
	if dbItem := core.GetItemByID(item.GetId()); dbItem != nil && gemIdx < len(dbItem.GemSockets) {
		return dbItem.GemSockets[gemIdx] == proto.GemColor_GemColorMeta
	}
	return gemIdx == 0
}

package reforgeoptimizer

import (
	"math"

	"github.com/wowsims/mop/sim/core"
	"github.com/wowsims/mop/sim/core/proto"
	"github.com/wowsims/mop/sim/core/stats"
)

var relativeStatCapStats = []stats.Stat{stats.CritRating, stats.HasteRating, stats.MasteryRating}

// Builds constraints ensuring the forced stat (Crit, Haste, or Mastery) remains strictly
// above each of the other two in {Crit, Haste, Mastery}. Feral Druids get an extra
// Haste > Crit constraint on top of the Mastery-forced set.
func buildRelativeStatCaps(baseRaid *proto.Raid, baseGear *proto.EquipmentSpec, capBaseStats core.UnitStats, settings *proto.ReforgeSettings) []reforgeRelativeStatCap {
	if settings == nil || settings.GetRelativeStatCapStat() == nil {
		return nil
	}
	forcedStat, ok := relativeStatCapStat(settings.GetRelativeStatCapStat())
	if !ok {
		return nil
	}

	baseStats := relativeStatCapBaseStats(baseRaid, capBaseStats)
	forcedUnitStat := stats.UnitStatFromStat(forcedStat)
	relativeCaps := make([]reforgeRelativeStatCap, 0, len(relativeStatCapStats))
	for _, constrainedStat := range relativeStatCapStats {
		if constrainedStat == forcedStat {
			continue
		}
		constrainedUnitStat := stats.UnitStatFromStat(constrainedStat)
		minDelta := 1 - (getUnitStat(baseStats, forcedUnitStat) - getUnitStat(baseStats, constrainedUnitStat))
		minDelta += relativeStatCapProcOffset(baseGear, constrainedStat)
		relativeCaps = append(relativeCaps, reforgeRelativeStatCap{forcedStat: forcedUnitStat, constrainedStat: constrainedUnitStat, minDelta: minDelta, actualMinDelta: minDelta, adjustWeight: true})
	}

	if forcedStat == stats.MasteryRating && playerIsFeralDruid(baseRaid.GetParties()[0].GetPlayers()[0]) {
		minDelta := getUnitStat(baseStats, stats.UnitStatFromStat(stats.CritRating)) - getUnitStat(baseStats, stats.UnitStatFromStat(stats.HasteRating)) + 1
		relativeCaps = append(relativeCaps, reforgeRelativeStatCap{forcedStat: stats.UnitStatFromStat(stats.HasteRating), constrainedStat: stats.UnitStatFromStat(stats.CritRating), minDelta: minDelta, actualMinDelta: minDelta})
	}
	return relativeCaps
}

// Validates and extracts the relative cap stat, rejecting anything outside
// {CritRating, HasteRating, MasteryRating}.
func relativeStatCapStat(uiStat *proto.UIStat) (stats.Stat, bool) {
	unitStat, ok := unitStatFromUIStat(uiStat)
	if !ok || !unitStat.IsStat() {
		return 0, false
	}
	stat := stats.Stat(unitStat.StatIdx())
	for _, relevantStat := range relativeStatCapStats {
		if stat == relevantStat {
			return stat, true
		}
	}
	return 0, false
}

// Strips the 8 free mastery points (always present) and any raid mastery buff so the
// relative gap is computed on reforge-only contributions, not base/buff mastery.
func relativeStatCapBaseStats(baseRaid *proto.Raid, capBaseStats core.UnitStats) core.UnitStats {
	baseStats := capBaseStats
	baseStats.Stats[stats.MasteryRating] -= 8 * core.MasteryRatingPerMasteryPoint
	if raidHasMasteryBuff(baseRaid) {
		baseStats.Stats[stats.MasteryRating] -= core.MasteryRaidBuffStrength
	}
	return baseStats
}

func raidHasMasteryBuff(raid *proto.Raid) bool {
	if raid == nil || raid.GetBuffs() == nil {
		return false
	}
	buffs := raid.GetBuffs()
	return buffs.GetRoarOfCourage() || buffs.GetSpiritBeastBlessing() || buffs.GetBlessingOfMight() || buffs.GetGraceOfAir()
}

// Adds the average proc contribution of specific on-proc trinkets (two Crit proc IDs and
// two Haste proc IDs) to the relative cap gap. Without this offset the optimizer counts
// proc stats as permanent reforge budget and over-invests in the forced stat.
func relativeStatCapProcOffset(baseGear *proto.EquipmentSpec, constrainedStat stats.Stat) float64 {
	procOffsets := map[stats.Stat]map[int32]float64{
		stats.CritRating: {
			69167: 460,
			68995: 410,
		},
		stats.HasteRating: {
			69112: 1730,
			68927: 1532,
		},
	}
	statOffsets := procOffsets[constrainedStat]
	if len(statOffsets) == 0 || baseGear == nil {
		return 0
	}
	for _, slot := range core.TrinketSlots() {
		if int(slot) >= len(baseGear.GetItems()) {
			continue
		}
		if offset, ok := statOffsets[baseGear.GetItems()[slot].GetId()]; ok {
			return offset
		}
	}
	return 0
}

// Lowers the forced stat's EP weight to just below the smallest constrained stat EP.
// This makes the optimizer maximize constrained stats up to the cap before investing
// further in the forced stat, preventing over-investment in the less-constrained stat.
func applyRelativeStatCapWeights(weights core.UnitStats, relativeCaps []reforgeRelativeStatCap) core.UnitStats {
	constrainedWeightsByForcedStat := make(map[stats.UnitStat][]float64)
	for _, relativeCap := range relativeCaps {
		if relativeCap.adjustWeight {
			constrainedWeightsByForcedStat[relativeCap.forcedStat] = append(constrainedWeightsByForcedStat[relativeCap.forcedStat], getUnitStat(weights, relativeCap.constrainedStat))
		}
	}
	for forcedStat, constrainedWeights := range constrainedWeightsByForcedStat {
		if len(constrainedWeights) == 0 {
			continue
		}
		smallestConstrainedWeight := math.Inf(1)
		for _, weight := range constrainedWeights {
			smallestConstrainedWeight = math.Min(smallestConstrainedWeight, weight)
		}
		weights = setUnitStat(weights, forcedStat, math.Min(getUnitStat(weights, forcedStat), smallestConstrainedWeight-0.01))
	}
	return weights
}

// Returns gem sort weights with the forced stat's EP replaced by the constrained stat's
// EP so gems are ranked by their constrained-stat value, not the (lowered) forced-stat EP.
func relativeStatCapGemSortWeights(weights core.UnitStats, relativeCaps []reforgeRelativeStatCap) core.UnitStats {
	for _, relativeCap := range relativeCaps {
		if !relativeCap.adjustWeight {
			continue
		}
		return setUnitStat(weights, relativeCap.forcedStat, getUnitStat(weights, relativeCap.constrainedStat))
	}
	return weights
}

func playerIsFeralDruid(player *proto.Player) bool {
	_, ok := player.GetSpec().(*proto.Player_FeralDruid)
	return ok
}

package reforgeoptimizer

import (
	"math"

	"github.com/wowsims/mop/sim/core"
	"github.com/wowsims/mop/sim/core/proto"
	"github.com/wowsims/mop/sim/core/stats"
)

// relativeStatCap forces a particular proc from trinkets like Rune of Re-Origination (RoRo): the
// reforge solution must keep the "forced highest" secondary stat above the others so RoRo procs
// the intended stat.

var relativeStatCapRelevantStats = []proto.Stat{
	proto.Stat_StatCritRating,
	proto.Stat_StatHasteRating,
	proto.Stat_StatMasteryRating,
}

// relativeStatCapProcOffsets records how much rating a forced-proc trinket contributes to a
// constrained stat; that contribution must be added to the ordering margin.
var relativeStatCapProcOffsets = map[proto.Stat]map[int32]float64{
	proto.Stat_StatCritRating:    {69167: 460, 68995: 410},   // Vessel of Acceleration (H/N)
	proto.Stat_StatHasteRating:   {69112: 1730, 68927: 1532}, // The Hungerer (H/N)
	proto.Stat_StatMasteryRating: {},
}

var relativeStatCapRoRoTrinkets = []int32{95802, 94532, 96546, 96174, 96918}

type relativeStatCap struct {
	forcedStat       proto.Stat
	forcedUnitStat   stats.UnitStat
	constrainedStats []proto.Stat // relevantStats minus the forced stat, in relevantStats order
	constraintKeys   []string     // "<forcedShort>Minus<constrainedShort>"
	isFeralDruid     bool
}

func relativeStatCapHasRoRo(equipment core.Equipment) bool {
	for _, slot := range core.TrinketSlots() {
		item := equipment.GetItemBySlot(slot)
		if item == nil {
			continue
		}
		for _, id := range relativeStatCapRoRoTrinkets {
			if item.ID == id {
				return true
			}
		}
	}
	return false
}

func isRelevantRelativeStat(stat proto.Stat) bool {
	for _, s := range relativeStatCapRelevantStats {
		if s == stat {
			return true
		}
	}
	return false
}

// newRelativeStatCap constructs a relativeStatCap. Returns nil if forcedStat is not one of
// Crit/Haste/Mastery.
func newRelativeStatCap(forcedStat proto.Stat, isFeralDruid bool) *relativeStatCap {
	if !isRelevantRelativeStat(forcedStat) {
		return nil
	}
	rsc := &relativeStatCap{
		forcedStat:     forcedStat,
		forcedUnitStat: stats.UnitStatFromStat(stats.Stat(int32(forcedStat))),
		isFeralDruid:   isFeralDruid,
	}
	for _, stat := range relativeStatCapRelevantStats {
		if stat == forcedStat {
			continue
		}
		rsc.constrainedStats = append(rsc.constrainedStats, stat)
		rsc.constraintKeys = append(rsc.constraintKeys, relativeStatShortName(forcedStat)+"Minus"+relativeStatShortName(stat))
	}
	return rsc
}

// updateCoefficients accumulates the forced stat positively and each constrained stat negatively
// into the ordering constraint's coefficient.
func (rsc *relativeStatCap) updateCoefficients(coeffs map[string]float64, stat proto.Stat, amount float64) {
	if !isRelevantRelativeStat(stat) {
		return
	}

	for idx, constrained := range rsc.constrainedStats {
		key := rsc.constraintKeys[idx]
		if rsc.forcedStat == stat {
			coeffs[key] += amount
		} else if constrained == stat {
			coeffs[key] -= amount
		}
	}

	// Feral Druid with Mastery forced additionally requires Haste > Crit.
	if stat != proto.Stat_StatMasteryRating && rsc.forcedStat == proto.Stat_StatMasteryRating && rsc.isFeralDruid {
		if stat == proto.Stat_StatHasteRating {
			coeffs["HasteMinusCrit"] += amount
		} else {
			coeffs["HasteMinusCrit"] -= amount
		}
	}
}

// updateConstraints adds the ">= minReforge" ordering constraints, using base stats (with the
// free base mastery and any mastery raid buff removed) plus any forced-proc trinket offset.
func (rsc *relativeStatCap) updateConstraints(constraints *lpConstraints, equipment core.Equipment, baseStats core.UnitStats, raidBuffs *proto.RaidBuffs) {
	masteryUnitStat := stats.UnitStatFromStat(stats.MasteryRating)
	adjusted := setUnitStat(baseStats, masteryUnitStat, getUnitStat(baseStats, masteryUnitStat)-8*core.MasteryRatingPerMasteryPoint)
	// The Mastery raid buff does not count toward the RoRo calculation.
	if raidBuffs != nil && (raidBuffs.GetRoarOfCourage() || raidBuffs.GetBlessingOfMight() || raidBuffs.GetSpiritBeastBlessing() || raidBuffs.GetGraceOfAir()) {
		adjusted = setUnitStat(adjusted, masteryUnitStat, getUnitStat(adjusted, masteryUnitStat)-core.MasteryRaidBuffStrength)
	}

	forcedVal := getUnitStat(adjusted, rsc.forcedUnitStat)
	for idx, constrained := range rsc.constrainedStats {
		constrainedVal := getUnitStat(adjusted, stats.UnitStatFromStat(stats.Stat(int32(constrained))))
		minReforgeContribution := 1 - (forcedVal - constrainedVal)

		offsets := relativeStatCapProcOffsets[constrained]
		for _, slot := range core.TrinketSlots() {
			item := equipment.GetItemBySlot(slot)
			if item == nil {
				continue
			}
			if offset, ok := offsets[item.ID]; ok {
				minReforgeContribution += offset
				break
			}
		}

		constraints.set(rsc.constraintKeys[idx], greaterEq(minReforgeContribution))
	}

	if rsc.forcedStat == proto.Stat_StatMasteryRating && rsc.isFeralDruid {
		critVal := getUnitStat(adjusted, stats.UnitStatFromStat(stats.CritRating))
		hasteVal := getUnitStat(adjusted, stats.UnitStatFromStat(stats.HasteRating))
		constraints.set("HasteMinusCrit", greaterEq(critVal-hasteVal+1))
	}
}

// updateWeights clamps the forced stat's EP weight to just below the smallest constrained stat's
// weight so the LP objective does not itself prefer stacking the forced stat past the ordering
// requirement.
func (rsc *relativeStatCap) updateWeights(weights core.UnitStats) core.UnitStats {
	c0 := getUnitStat(weights, stats.UnitStatFromStat(stats.Stat(int32(rsc.constrainedStats[0]))))
	c1 := getUnitStat(weights, stats.UnitStatFromStat(stats.Stat(int32(rsc.constrainedStats[1]))))
	smallest := math.Min(c0, c1)
	forcedWeight := getUnitStat(weights, rsc.forcedUnitStat)
	return setUnitStat(weights, rsc.forcedUnitStat, math.Min(forcedWeight, smallest-0.01))
}

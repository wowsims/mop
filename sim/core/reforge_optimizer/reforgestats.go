package reforgeoptimizer

import (
	"slices"

	"github.com/wowsims/mop/sim/core"
	"github.com/wowsims/mop/sim/core/proto"
	"github.com/wowsims/mop/sim/core/stats"
)

// This file implements the stat/UnitStat math the reforge optimizer relies on. Stat vectors use
// core.UnitStats (a Stats array plus a PseudoStats slice); the LP coefficient maps in model.go
// are string-keyed by the proto enum names so a coefficient key can be mapped back to its stat.

// ---------------------------------------------------------------------------
// core.UnitStats helpers
// ---------------------------------------------------------------------------

func protoToCoreUnitStats(protoStats *proto.UnitStats) core.UnitStats {
	if protoStats == nil {
		return core.NewUnitStats()
	}
	return core.UnitStats{
		Stats:       stats.FromUnitStatsProto(protoStats),
		PseudoStats: slices.Clone(protoStats.PseudoStats),
	}
}

func getUnitStat(unitStats core.UnitStats, unitStat stats.UnitStat) float64 {
	if unitStat.IsStat() {
		return unitStats.Stats[unitStat.StatIdx()]
	}
	pseudoStatIdx := unitStat.PseudoStatIdx()
	if pseudoStatIdx >= len(unitStats.PseudoStats) {
		return 0
	}
	return unitStats.PseudoStats[pseudoStatIdx]
}

// setUnitStat returns a copy of unitStats with unitStat set to value. Note: the Stats array is
// a value type (copied), but PseudoStats is a slice; we reallocate it so callers never alias.
func setUnitStat(unitStats core.UnitStats, unitStat stats.UnitStat, value float64) core.UnitStats {
	result := unitStats
	result.PseudoStats = slices.Clone(unitStats.PseudoStats)
	if unitStat.IsStat() {
		result.Stats[unitStat.StatIdx()] = value
		return result
	}
	pseudoStatIdx := unitStat.PseudoStatIdx()
	for len(result.PseudoStats) <= pseudoStatIdx {
		result.PseudoStats = append(result.PseudoStats, 0)
	}
	result.PseudoStats[pseudoStatIdx] = value
	return result
}

func addUnitStats(a core.UnitStats, b core.UnitStats) core.UnitStats {
	result := a
	result.Stats = a.Stats.Add(b.Stats)
	maxLen := max(len(a.PseudoStats), len(b.PseudoStats))
	result.PseudoStats = make([]float64, maxLen)
	copy(result.PseudoStats, a.PseudoStats)
	for idx, value := range b.PseudoStats {
		result.PseudoStats[idx] += value
	}
	return result
}

func subtractUnitStats(a core.UnitStats, b core.UnitStats) core.UnitStats {
	result := a
	result.Stats = a.Stats.Subtract(b.Stats)
	maxLen := max(len(a.PseudoStats), len(b.PseudoStats))
	result.PseudoStats = make([]float64, maxLen)
	copy(result.PseudoStats, a.PseudoStats)
	for idx, value := range b.PseudoStats {
		result.PseudoStats[idx] -= value
	}
	return result
}

func scaleUnitStats(unitStats core.UnitStats, factor float64) core.UnitStats {
	result := unitStats
	result.Stats = unitStats.Stats.Multiply(factor)
	result.PseudoStats = make([]float64, len(unitStats.PseudoStats))
	for idx, value := range unitStats.PseudoStats {
		result.PseudoStats[idx] = value * factor
	}
	return result
}

func isEmptyUnitStats(unitStats core.UnitStats) bool {
	for statIdx := 0; statIdx < int(stats.ProtoStatsLen); statIdx++ {
		if unitStats.Stats[statIdx] != 0 {
			return false
		}
	}
	for _, value := range unitStats.PseudoStats {
		if value != 0 {
			return false
		}
	}
	return true
}

// computeEP is the EP dot product of a stat vector against the EP weights, over both stats and
// pseudo-stats.
func computeEP(vec core.UnitStats, weights core.UnitStats) float64 {
	total := 0.0
	for statIdx := 0; statIdx < int(stats.ProtoStatsLen); statIdx++ {
		total += vec.Stats[statIdx] * weights.Stats[statIdx]
	}
	for idx, value := range vec.PseudoStats {
		if idx < len(weights.PseudoStats) {
			total += value * weights.PseudoStats[idx]
		}
	}
	return total
}

// eachUnitStat iterates every stat first, then every pseudo-stat, in that order.
func eachUnitStat(vec core.UnitStats, fn func(unitStat stats.UnitStat, value float64)) {
	for statIdx := 0; statIdx < int(stats.ProtoStatsLen); statIdx++ {
		fn(stats.UnitStatFromStat(stats.Stat(statIdx)), vec.Stats[statIdx])
	}
	for pseudoStatIdx := 0; pseudoStatIdx < int(stats.PseudoStatsLen); pseudoStatIdx++ {
		value := 0.0
		if pseudoStatIdx < len(vec.PseudoStats) {
			value = vec.PseudoStats[pseudoStatIdx]
		}
		fn(stats.UnitStatFromPseudoStat(proto.PseudoStat(pseudoStatIdx)), value)
	}
}

// eachBuffedStat iterates the base Stats array (NOT pseudo-stats) and yields only strictly
// positive entries, in stat-index order.
func eachBuffedStat(s stats.Stats, fn func(stat stats.Stat, value float64)) {
	for statIdx := 0; statIdx < int(stats.ProtoStatsLen); statIdx++ {
		if s[statIdx] > 0 {
			fn(stats.Stat(statIdx), s[statIdx])
		}
	}
}

// ---------------------------------------------------------------------------
// UnitStat children + rating <-> percent conversions
// ---------------------------------------------------------------------------

// childPseudoStats maps a rating stat to its percent pseudo-stat children, e.g.
// HitRating -> {PhysicalHit%, SpellHit%}.
func childPseudoStats(parent stats.Stat) []proto.PseudoStat {
	switch parent {
	case stats.HitRating:
		return []proto.PseudoStat{proto.PseudoStat_PseudoStatPhysicalHitPercent, proto.PseudoStat_PseudoStatSpellHitPercent}
	case stats.CritRating:
		return []proto.PseudoStat{proto.PseudoStat_PseudoStatPhysicalCritPercent, proto.PseudoStat_PseudoStatSpellCritPercent}
	case stats.HasteRating:
		return []proto.PseudoStat{proto.PseudoStat_PseudoStatMeleeHastePercent, proto.PseudoStat_PseudoStatRangedHastePercent, proto.PseudoStat_PseudoStatSpellHastePercent}
	default:
		return nil
	}
}

// ratingPerPseudoStatPercent is the amount of rating equal to 1% of the given pseudo-stat, i.e.
// the divisor used to convert rating into percent.
func ratingPerPseudoStatPercent(pseudoStat proto.PseudoStat) float64 {
	switch pseudoStat {
	case proto.PseudoStat_PseudoStatPhysicalHitPercent:
		return core.PhysicalHitRatingPerHitPercent
	case proto.PseudoStat_PseudoStatSpellHitPercent:
		return core.SpellHitRatingPerHitPercent
	case proto.PseudoStat_PseudoStatPhysicalCritPercent, proto.PseudoStat_PseudoStatSpellCritPercent:
		return core.CritRatingPerCritPercent
	case proto.PseudoStat_PseudoStatMeleeHastePercent, proto.PseudoStat_PseudoStatRangedHastePercent, proto.PseudoStat_PseudoStatSpellHastePercent:
		return core.HasteRatingPerHastePercent
	default:
		return 1
	}
}

// convertRatingToPercent converts a rating value into the pseudo-stat child's percent.
func convertRatingToPercent(pseudoStat proto.PseudoStat, ratingValue float64) float64 {
	return ratingValue / ratingPerPseudoStatPercent(pseudoStat)
}

// ---------------------------------------------------------------------------
// Gap-to-cap math
// ---------------------------------------------------------------------------

// computeGapToCap returns the delta needed to reach cap, with haste% pseudo-stats divided by
// their speed multiplier (reforge haste rating enters the LP in raw percent, so the cap gap must
// be expressed in that same pre-speed-multiplier space). Returns 1e-12 (not 0) when already at
// cap so the resulting constraint stays active.
func computeGapToCap(baseStats core.UnitStats, unitStat stats.UnitStat, cap float64) float64 {
	statDelta := cap - getUnitStat(baseStats, unitStat)
	if unitStat.IsPseudoStat() {
		switch proto.PseudoStat(unitStat.PseudoStatIdx()) {
		case proto.PseudoStat_PseudoStatMeleeHastePercent:
			statDelta /= getUnitStat(baseStats, stats.UnitStatFromPseudoStat(proto.PseudoStat_PseudoStatMeleeSpeedMultiplier))
		case proto.PseudoStat_PseudoStatRangedHastePercent:
			statDelta /= getUnitStat(baseStats, stats.UnitStatFromPseudoStat(proto.PseudoStat_PseudoStatRangedSpeedMultiplier))
		case proto.PseudoStat_PseudoStatSpellHastePercent:
			statDelta /= getUnitStat(baseStats, stats.UnitStatFromPseudoStat(proto.PseudoStat_PseudoStatCastSpeedMultiplier))
		}
	}
	if statDelta == 0 {
		return 1e-12
	}
	return statDelta
}

// computeStatCapsDelta returns the per-unit-stat gap-to-cap, but only for caps whose configured
// value is > 0 (a cap of 0 maps to 0 and means "no cap").
func computeStatCapsDelta(baseStats core.UnitStats, statCaps core.UnitStats) core.UnitStats {
	result := core.NewUnitStats()
	for statIdx := 0; statIdx < int(stats.ProtoStatsLen); statIdx++ {
		if cap := statCaps.Stats[statIdx]; cap > 0 {
			unitStat := stats.UnitStatFromStat(stats.Stat(statIdx))
			result = setUnitStat(result, unitStat, computeGapToCap(baseStats, unitStat, cap))
		}
	}
	for pseudoStatIdx := 0; pseudoStatIdx < int(stats.PseudoStatsLen); pseudoStatIdx++ {
		cap := 0.0
		if pseudoStatIdx < len(statCaps.PseudoStats) {
			cap = statCaps.PseudoStats[pseudoStatIdx]
		}
		if cap > 0 {
			unitStat := stats.UnitStatFromPseudoStat(proto.PseudoStat(pseudoStatIdx))
			result = setUnitStat(result, unitStat, computeGapToCap(baseStats, unitStat, cap))
		}
	}
	return result
}

// ---------------------------------------------------------------------------
// proto helpers
// ---------------------------------------------------------------------------

// getProtoUnitStat reads a stat or pseudo-stat value from proto.UnitStats by index (0 for nil
// or out-of-range).
func getProtoUnitStat(unitStats *proto.UnitStats, unitStat stats.UnitStat) float64 {
	if unitStats == nil {
		return 0
	}
	if unitStat.IsStat() {
		statIdx := unitStat.StatIdx()
		if statIdx >= len(unitStats.GetStats()) {
			return 0
		}
		return unitStats.GetStats()[statIdx]
	}
	pseudoStatIdx := unitStat.PseudoStatIdx()
	if pseudoStatIdx >= len(unitStats.GetPseudoStats()) {
		return 0
	}
	return unitStats.GetPseudoStats()[pseudoStatIdx]
}

// unitStatFromUIStat converts the proto.UIStat oneof (Stat or PseudoStat) to stats.UnitStat.
func unitStatFromUIStat(uiStat *proto.UIStat) (stats.UnitStat, bool) {
	if uiStat == nil {
		return 0, false
	}
	switch unitStat := uiStat.UnitStat.(type) {
	case *proto.UIStat_Stat:
		return stats.UnitStatFromStat(stats.Stat(unitStat.Stat)), true
	case *proto.UIStat_PseudoStat:
		return stats.UnitStatFromPseudoStat(unitStat.PseudoStat), true
	default:
		return 0, false
	}
}

// ---------------------------------------------------------------------------
// LP coefficient-key scheme
// ---------------------------------------------------------------------------
//
// Coefficients are keyed by the proto enum NAME (e.g. "StatMasteryRating",
// "PseudoStatSpellHitPercent", "ItemSlotHead") so checkCaps can recover the stat from a key
// (a key containing "PseudoStat" -> pseudo-stat, else one containing "Stat" -> stat). Slot keys
// ("ItemSlot...") and special keys (SocketBonusLink_*, ShaTouchedGem, JewelcraftingGem, cogwheel
// IDs, score, *Minus*) are not stat names and parse to (_, false).

func statCoeffKey(stat proto.Stat) string {
	return proto.Stat_name[int32(stat)]
}

func pseudoStatCoeffKey(pseudoStat proto.PseudoStat) string {
	return proto.PseudoStat_name[int32(pseudoStat)]
}

func slotCoeffKey(slot proto.ItemSlot) string {
	return proto.ItemSlot_name[int32(slot)]
}

// unitStatFromCoeffKey recovers the stat from a coefficient key, or (_, false) for non-stat
// keys. PseudoStat and Stat names occupy disjoint namespaces so lookup order is irrelevant.
func unitStatFromCoeffKey(key string) (stats.UnitStat, bool) {
	if value, ok := proto.PseudoStat_value[key]; ok {
		return stats.UnitStatFromPseudoStat(proto.PseudoStat(value)), true
	}
	if value, ok := proto.Stat_value[key]; ok {
		return stats.UnitStatFromStat(stats.Stat(value)), true
	}
	return 0, false
}

// coeffKeyForUnitStat returns the coefficient/constraint key for a unit stat: its proto enum
// name.
func coeffKeyForUnitStat(unitStat stats.UnitStat) string {
	if unitStat.IsStat() {
		return statCoeffKey(proto.Stat(unitStat.StatIdx()))
	}
	return pseudoStatCoeffKey(proto.PseudoStat(unitStat.PseudoStatIdx()))
}

// relativeStatShortName returns the short, "Stat"-free label used to build relative-stat-cap
// constraint keys for Crit, Haste, and Mastery.
func relativeStatShortName(stat proto.Stat) string {
	switch stat {
	case proto.Stat_StatCritRating:
		return "Crit"
	case proto.Stat_StatHasteRating:
		return "Haste"
	case proto.Stat_StatMasteryRating:
		return "Mastery"
	default:
		return proto.Stat_name[int32(stat)]
	}
}

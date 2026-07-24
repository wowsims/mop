package reforgeoptimizer

import (
	"slices"

	"github.com/wowsims/mop/sim/core"
	"github.com/wowsims/mop/sim/core/proto"
	"github.com/wowsims/mop/sim/core/stats"
)

// hasteRatingSpeedMultiplierPairs maps each haste% pseudo-stat to the speed multiplier
// pseudo-stat stored by GetPseudoStatsProto (MeleeSpeedMult * AttackSpeedMult, etc.).
var hasteRatingSpeedMultiplierPairs = [3]struct {
	hastePS     proto.PseudoStat
	speedMultPS proto.PseudoStat
}{
	{proto.PseudoStat_PseudoStatMeleeHastePercent, proto.PseudoStat_PseudoStatMeleeSpeedMultiplier},
	{proto.PseudoStat_PseudoStatRangedHastePercent, proto.PseudoStat_PseudoStatRangedSpeedMultiplier},
	{proto.PseudoStat_PseudoStatSpellHastePercent, proto.PseudoStat_PseudoStatCastSpeedMultiplier},
}

func protoToCoreUnitStats(protoStats *proto.UnitStats) core.UnitStats {
	if protoStats == nil {
		return core.NewUnitStats()
	}
	return core.UnitStats{
		Stats:       stats.FromUnitStatsProto(protoStats),
		PseudoStats: slices.Clone(protoStats.PseudoStats),
	}
}

func addUnitStats(unitStats core.UnitStats, other core.UnitStats) core.UnitStats {
	result := unitStats
	result.Stats = unitStats.Stats.Add(other.Stats)
	maxLen := max(len(unitStats.PseudoStats), len(other.PseudoStats))
	result.PseudoStats = make([]float64, maxLen)
	copy(result.PseudoStats, unitStats.PseudoStats)
	for idx, value := range other.PseudoStats {
		result.PseudoStats[idx] += value
	}
	return result
}

func subtractUnitStats(unitStats core.UnitStats, other core.UnitStats) core.UnitStats {
	result := unitStats
	result.Stats = unitStats.Stats.Subtract(other.Stats)
	maxLen := max(len(unitStats.PseudoStats), len(other.PseudoStats))
	result.PseudoStats = make([]float64, maxLen)
	copy(result.PseudoStats, unitStats.PseudoStats)
	for idx, value := range other.PseudoStats {
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

// statCoefficientTable holds, per input Stat index, the UnitStats produced by a single unit
// of that stat, for use by unitStatsFromStats when scoring the EP objective. Building this
// once per optimize call lets unitStatsFromStats score any candidate's raw stat delta in
// O(stats touched) instead of recomputing per-stat conversions on every reforge/gem
// candidate.
type statCoefficientTable []core.UnitStats

// buildStatCoefficientTable builds, for every stat, the UnitStats produced by a single unit
// of that stat, for EP-objective scoring (unitStatsFromStats) — NOT to be confused with
// resolveStatDelta, which additionally applies dependencies like Agility→Crit and Haste's
// speed-multiplier scaling for cap-check accuracy. Those extra dependencies are deliberately
// excluded here: EP weights (preCapEpWeights) are calibrated externally (via stat-weight
// sims) assuming a "typical" raid-buffed state, and that calibration already bakes in
// whatever multiplicative effects (e.g. haste speed multipliers) were active during the
// calibration sim. Reapplying resolveStatDelta's speed-multiplier boost on top of an
// already-calibrated EP weight double-counts that boost, inflating the stat's effective
// value beyond what the weight was meant to represent — the same rating-space score ends up
// paired with a percent-space delta computed on a different basis than the weight was.
//
// weights must already be the validateReforgeWeights-processed weights (its Stats[parent]
// zeroed and the corresponding PseudoStats[child] set, for any rating stat whose child
// pseudo-stat carries a configured cap). For such a stat, this mirrors that same flat
// ratingPerPseudoStatPercent conversion here, so the weight and the delta being scored stay
// on a consistent basis. Every other stat with a nonzero direct EP weight gets an identity
// coefficient (1 unit in, 1 unit of itself out): EP presets are calibrated assuming a stat's
// direct weight already captures its full value, so crediting a same-call derived
// contribution too (e.g. Stamina's own weight plus its Health conversion, both nonzero)
// would double-count it the same way.
//
// overrides lets a caller hardcode a specific stat's coefficient instead of taking either
// default — e.g. Guardian Druid's Agility, whose direct EP weight is a generic placeholder
// while its real value (2x Attack Power, plus a flat Crit% conversion) is hardcoded instead.
// May be nil.
//
// ampModifier is the Amplification Trinket multiplier (>1 when such a trinket is equipped,
// else 1). The UI pre-divides the flat Haste and Mastery EP weights by this modifier (see
// ui/mage/frost/sim.ts) so that the optimizer can re-apply it here through the same
// multiplicative stat dependency the sim uses (NewDynamicMultiplyStat on Haste/Mastery/
// Spirit). Without re-applying it the objective under-values those gems — pure Intellect
// wins red sockets it shouldn't. Crit and Intellect are never divided and are never scaled
// here, matching which stats the trinket actually amplifies.
func buildStatCoefficientTable(weights core.UnitStats, ampModifier float64, overrides func(stats.Stat) (core.UnitStats, bool)) statCoefficientTable {
	table := make(statCoefficientTable, stats.ProtoStatsLen)
	for statIdx := 0; statIdx < int(stats.ProtoStatsLen); statIdx++ {
		stat := stats.Stat(statIdx)
		if overrides != nil {
			if value, ok := overrides(stat); ok {
				table[statIdx] = value
				continue
			}
		}

		identity := core.NewUnitStats()
		identity.Stats[statIdx] = 1

		if weights.Stats[statIdx] != 0 {
			table[statIdx] = identity
			continue
		}

		coefficient := identity
		for _, child := range childPseudoStats(stat) {
			unitStat := stats.UnitStatFromPseudoStat(child)
			if getUnitStat(weights, unitStat) == 0 {
				continue
			}
			coefficient = setUnitStat(coefficient, unitStat, 1/ratingPerPseudoStatPercent(child))
		}
		table[statIdx] = coefficient
	}

	// Re-apply the Amplification Trinket boost the UI divided out of the flat weights. The
	// trinket multiplies Haste, Mastery, and Spirit (not Crit, not Intellect), so only those
	// coefficients are scaled — every downstream contribution (identity or rating→percent
	// expansion) rides along.
	if ampModifier != 1 {
		for _, ampedStat := range []stats.Stat{stats.HasteRating, stats.MasteryRating, stats.Spirit} {
			table[ampedStat] = scaleUnitStats(table[ampedStat], ampModifier)
		}
	}
	return table
}

func dotUnitStats(unitStats core.UnitStats, weights core.UnitStats) float64 {
	score := 0.0
	for statIdx := 0; statIdx < int(stats.ProtoStatsLen); statIdx++ {
		score += unitStats.Stats[statIdx] * weights.Stats[statIdx]
	}
	for idx, value := range unitStats.PseudoStats {
		if idx < len(weights.PseudoStats) {
			score += value * weights.PseudoStats[idx]
		}
	}
	return score
}

func getUnitStat(unitStats core.UnitStats, unitStat stats.UnitStat) float64 {
	if unitStat.IsStat() {
		return unitStats.Stats[unitStat.StatIdx()]
	}
	pseudoStatIdx := int(unitStat.PseudoStatIdx())
	if pseudoStatIdx >= len(unitStats.PseudoStats) {
		return 0
	}
	return unitStats.PseudoStats[pseudoStatIdx]
}

func setUnitStat(unitStats core.UnitStats, unitStat stats.UnitStat, value float64) core.UnitStats {
	if unitStat.IsStat() {
		unitStats.Stats[unitStat.StatIdx()] = value
		return unitStats
	}
	pseudoStatIdx := int(unitStat.PseudoStatIdx())
	for len(unitStats.PseudoStats) <= pseudoStatIdx {
		unitStats.PseudoStats = append(unitStats.PseudoStats, 0)
	}
	unitStats.PseudoStats[pseudoStatIdx] = value
	return unitStats
}

// resolveStatDelta applies the character's stat dependency graph to delta, resolving
// conversions such as Agility → PhysicalCritPercent and Intellect → SpellCritPercent.
// It also mirrors the resolved Stats values back to their corresponding PseudoStats
// so that LP constraint evaluation (which reads PseudoStats for crit/hit/haste/block caps)
// sees the correct contribution.
//
// Haste% is multiplicative with a speed multiplier that is not captured by the dep
// manager. We read it from baseStats.PseudoStats (populated by GetPseudoStatsProto):
//
//	Δhaste% = speedMult * ΔHasteRating / HasteRatingPerHastePercent
func resolveStatDelta(sdm *stats.StatDependencyManager, baseStats core.UnitStats, delta core.UnitStats) core.UnitStats {
	if isEmptyUnitStats(delta) {
		return delta
	}
	delta.Stats = sdm.ApplyStatDependencies(delta.Stats)

	// Mirror dual-stored stats from Stats back to PseudoStats so cap constraints
	// that evaluate via PseudoStat indices see the resolved values.
	delta = setUnitStat(delta, stats.UnitStatFromPseudoStat(proto.PseudoStat_PseudoStatPhysicalCritPercent), delta.Stats[stats.PhysicalCritPercent])
	delta = setUnitStat(delta, stats.UnitStatFromPseudoStat(proto.PseudoStat_PseudoStatSpellCritPercent), delta.Stats[stats.SpellCritPercent])
	delta = setUnitStat(delta, stats.UnitStatFromPseudoStat(proto.PseudoStat_PseudoStatPhysicalHitPercent), delta.Stats[stats.PhysicalHitPercent])
	delta = setUnitStat(delta, stats.UnitStatFromPseudoStat(proto.PseudoStat_PseudoStatSpellHitPercent), delta.Stats[stats.SpellHitPercent])
	delta = setUnitStat(delta, stats.UnitStatFromPseudoStat(proto.PseudoStat_PseudoStatBlockPercent), delta.Stats[stats.BlockPercent])

	// Haste% pseudo-stats: read speed multipliers from baseStats.PseudoStats, which
	// are populated by GetPseudoStatsProto (MeleeSpeedMultiplier = MeleeSpeedMult *
	// AttackSpeedMult, etc.). Δhaste% = speedMult * ΔHR / HasteRatingPerHastePercent.
	if hasteRatingDelta := delta.Stats[stats.HasteRating]; hasteRatingDelta != 0 {
		for _, p := range hasteRatingSpeedMultiplierPairs {
			speedMult := getUnitStat(baseStats, stats.UnitStatFromPseudoStat(p.speedMultPS))
			delta = setUnitStat(delta, stats.UnitStatFromPseudoStat(p.hastePS), speedMult*hasteRatingDelta/core.HasteRatingPerHastePercent)
		}
	}

	return delta
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

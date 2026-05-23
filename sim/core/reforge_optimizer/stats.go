package reforgeoptimizer

import (
	"slices"

	"github.com/wowsims/mop/sim/core"
	"github.com/wowsims/mop/sim/core/proto"
	"github.com/wowsims/mop/sim/core/stats"
)

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

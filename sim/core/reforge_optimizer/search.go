package reforgeoptimizer

import (
	"github.com/wowsims/mop/sim/core"
	"github.com/wowsims/mop/sim/core/proto"
	"github.com/wowsims/mop/sim/core/stats"
)

func canAddChoice(choice reforgeChoice, jewelcraftingGems int, shaTouchedGems int, uniqueGemIDs map[int32]bool) bool {
	if jewelcraftingGems+choice.jewelcraftingGems > 2 || shaTouchedGems+choice.shaTouchedGems > 1 {
		return false
	}
	if len(choice.uniqueGemIDs) == 0 {
		return true
	}
	if len(choice.uniqueGemIDs) == 1 {
		return !uniqueGemIDs[choice.uniqueGemIDs[0]]
	}
	seen := make(map[int32]bool, len(choice.uniqueGemIDs))
	for _, gemID := range choice.uniqueGemIDs {
		if uniqueGemIDs[gemID] || seen[gemID] {
			return false
		}
		seen[gemID] = true
	}
	return true
}

func (search *reforgeSearchState) evaluate(delta core.UnitStats) (float64, bool) {
	score := 0.0

	for statIdx := 0; statIdx < int(stats.ProtoStatsLen); statIdx++ {
		unitStat := stats.UnitStatFromStat(stats.Stat(statIdx))
		statScore, ok := search.evaluateUnitStat(unitStat, getUnitStat(delta, unitStat), getUnitStat(search.weights, unitStat))
		if !ok {
			return 0, false
		}
		score += statScore
	}
	for pseudoStatIdx := 0; pseudoStatIdx < int(stats.PseudoStatsLen); pseudoStatIdx++ {
		unitStat := stats.UnitStatFromPseudoStat(proto.PseudoStat(pseudoStatIdx))
		statScore, ok := search.evaluateUnitStat(unitStat, getUnitStat(delta, unitStat), getUnitStat(search.weights, unitStat))
		if !ok {
			return 0, false
		}
		score += statScore
	}

	return score, true
}

func (search *reforgeSearchState) evaluateUnitStat(unitStat stats.UnitStat, value float64, weight float64) (float64, bool) {
	if cap, ok := search.hardCapsByStat[unitStat]; ok && cap.cap != 0 {
		if cap.undershoot && value > cap.cap+1e-9 {
			return 0, false
		}
		if !cap.undershoot && value > cap.cap {
			return cap.cap * weight, true
		}
	}
	if cap, ok := search.softCapsByStat[unitStat]; ok {
		return scoreSoftCap(value, weight, cap), true
	}
	return value * weight, true
}

func reforgeHardCapsByStat(hardCaps []reforgeHardCap) map[stats.UnitStat]reforgeHardCap {
	byStat := make(map[stats.UnitStat]reforgeHardCap, len(hardCaps))
	for _, cap := range hardCaps {
		byStat[cap.unitStat] = cap
	}
	return byStat
}

func reforgeSoftCapsByStat(softCaps []reforgeSoftCap) map[stats.UnitStat]reforgeSoftCap {
	byStat := make(map[stats.UnitStat]reforgeSoftCap, len(softCaps))
	for _, cap := range softCaps {
		byStat[cap.unitStat] = cap
	}
	return byStat
}

func scoreSoftCap(value float64, preCapWeight float64, cap reforgeSoftCap) float64 {
	if len(cap.breakpoints) == 0 {
		return value * preCapWeight
	}

	score := 0.0
	previousBreakpoint := 0.0
	currentWeight := preCapWeight
	for idx, breakpoint := range cap.breakpoints {
		if value <= breakpoint {
			return score + (value-previousBreakpoint)*currentWeight
		}
		score += (breakpoint - previousBreakpoint) * currentWeight
		previousBreakpoint = breakpoint
		if idx < len(cap.postCapEPs) {
			currentWeight = cap.postCapEPs[idx]
		}
	}
	return score + (value-previousBreakpoint)*currentWeight
}

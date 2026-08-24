package reforgeoptimizer

import (
	"slices"
	"strings"

	"github.com/wowsims/mop/sim/core"
	"github.com/wowsims/mop/sim/core/proto"
	"github.com/wowsims/mop/sim/core/stats"
)

// reforgeSoftCap represents a soft cap or threshold expressed in reforge-relative (gap-to-cap)
// breakpoints. breakpoints/postCapEPs are mutated in place across solver passes as breakpoints
// are consumed.
type reforgeSoftCap struct {
	unitStat    stats.UnitStat
	breakpoints []float64
	capType     proto.StatCapType
	postCapEPs  []float64
}

// computeReforgeSoftCaps converts each configured soft cap's absolute breakpoints into
// reforge-relative gap-to-cap deltas. For TypeThreshold caps the breakpoints are reversed
// (largest gap evaluated first) and every post-cap EP is set to the FIRST configured value,
// which is interpreted as the residual stat value just after passing a threshold discontinuity.
//
// configs should be the (already breakpoint-limited) request soft caps when the optimizer is
// using soft-cap breakpoints, and nil/empty otherwise; the decision of which soft caps are
// allowed to override is made upstream and baked into the request.
func computeReforgeSoftCaps(baseStats core.UnitStats, configs []*proto.StatCapConfig) []*reforgeSoftCap {
	result := make([]*reforgeSoftCap, 0, len(configs))
	for _, config := range configs {
		unitStat, ok := unitStatFromUIStat(config.GetUnitStat())
		if !ok {
			continue
		}

		weights := slices.Clone(config.GetPostCap_EPs())
		relativeBreakpoints := make([]float64, 0, len(config.GetBreakpoints()))
		for _, breakpoint := range config.GetBreakpoints() {
			relativeBreakpoints = append(relativeBreakpoints, computeGapToCap(baseStats, unitStat, breakpoint))
		}

		if config.GetCapType() == proto.StatCapType_TypeThreshold {
			slices.Reverse(relativeBreakpoints)
			first := 0.0
			if len(weights) > 0 {
				first = weights[0]
			}
			weights = make([]float64, len(relativeBreakpoints))
			for i := range weights {
				weights[i] = first
			}
		}

		result = append(result, &reforgeSoftCap{
			unitStat:    unitStat,
			breakpoints: relativeBreakpoints,
			capType:     config.GetCapType(),
			postCapEPs:  weights,
		})
	}
	return result
}

// checkWeights: for each of Hit/Crit/Haste rating stats, route the pure-rating EP into the
// school-specific percent pseudo-stat when a cap is configured for that pseudo-stat, and zero
// the parent rating EP to avoid double counting.
func checkWeights(weights core.UnitStats, reforgeCaps core.UnitStats, reforgeSoftCaps []*reforgeSoftCap) core.UnitStats {
	validated := weights
	for _, parent := range []stats.Stat{stats.HitRating, stats.CritRating, stats.HasteRating} {
		children := childPseudoStats(parent)
		if len(children) == 0 {
			continue
		}

		hasSchoolWeight := false
		for _, child := range children {
			if getUnitStat(validated, stats.UnitStatFromPseudoStat(child)) != 0 {
				hasSchoolWeight = true
				break
			}
		}
		if hasSchoolWeight {
			validated.Stats[parent] = 0
			continue
		}

		parentWeight := validated.Stats[parent]
		if parentWeight == 0 {
			continue
		}
		for _, child := range children {
			if pseudoStatHasCap(child, reforgeCaps, reforgeSoftCaps) {
				validated = setUnitStat(validated, stats.UnitStatFromPseudoStat(child), parentWeight*ratingPerPseudoStatPercent(child))
				validated.Stats[parent] = 0
				break
			}
		}
	}
	return validated
}

// ---------------------------------------------------------------------------
// Cap-detection helpers: statHasCap / pseudoStatHasCap / statIsCapped / pseudoStatIsCapped.
// reforgeCaps is a gap-to-cap vector (the remaining rating room before each hard cap).
// ---------------------------------------------------------------------------

func pseudoStatHasCap(pseudoStat proto.PseudoStat, reforgeCaps core.UnitStats, softCaps []*reforgeSoftCap) bool {
	unitStat := stats.UnitStatFromPseudoStat(pseudoStat)
	if getUnitStat(reforgeCaps, unitStat) != 0 {
		return true
	}
	for _, softCap := range softCaps {
		if softCap.unitStat == unitStat {
			return true
		}
	}
	return false
}

func statHasCap(stat stats.Stat, reforgeCaps core.UnitStats, softCaps []*reforgeSoftCap) bool {
	unitStat := stats.UnitStatFromStat(stat)
	if getUnitStat(reforgeCaps, unitStat) != 0 {
		return true
	}
	for _, softCap := range softCaps {
		if softCap.unitStat == unitStat {
			return true
		}
	}
	return false
}

func pseudoStatIsCapped(pseudoStat proto.PseudoStat, reforgeCaps core.UnitStats, softCaps []*reforgeSoftCap) bool {
	unitStat := stats.UnitStatFromPseudoStat(pseudoStat)
	if getUnitStat(reforgeCaps, unitStat) < 0 {
		return true
	}
	for _, softCap := range softCaps {
		if softCap.unitStat == unitStat {
			// A soft-capped pseudo-stat is treated as capped only when its hard-cap gap is
			// negative; the soft-cap branch itself never flags it, since a pseudo-stat index is
			// never negative and this comparison is therefore always false.
			return unitStat.PseudoStatIdx() < 0
		}
	}
	return false
}

func statIsCapped(stat stats.Stat, reforgeCaps core.UnitStats, softCaps []*reforgeSoftCap) bool {
	unitStat := stats.UnitStatFromStat(stat)
	if getUnitStat(reforgeCaps, unitStat) < 0 {
		return true
	}
	for _, softCap := range softCaps {
		if softCap.unitStat == unitStat {
			return unitStat.StatIdx() < 0 // effectively always false (see pseudoStatIsCapped)
		}
	}
	return false
}

// includesStatWithCap reports whether any key in the coefficient map names a stat that has a
// configured cap.
func includesStatWithCap(coeffs map[string]float64, reforgeCaps core.UnitStats, softCaps []*reforgeSoftCap) bool {
	for key := range coeffs {
		if unitStat, ok := unitStatFromCoeffKey(key); ok {
			if unitStat.IsPseudoStat() {
				if pseudoStatHasCap(proto.PseudoStat(unitStat.PseudoStatIdx()), reforgeCaps, softCaps) {
					return true
				}
			} else if statHasCap(stats.Stat(unitStat.StatIdx()), reforgeCaps, softCaps) {
				return true
			}
		} else if strings.Contains(key, "Minus") {
			return true
		}
	}
	return false
}

// includesCappedStat reports whether any key in the coefficient map names a stat that is already
// capped.
func includesCappedStat(coeffs map[string]float64, reforgeCaps core.UnitStats, softCaps []*reforgeSoftCap) bool {
	for key := range coeffs {
		if unitStat, ok := unitStatFromCoeffKey(key); ok {
			if unitStat.IsPseudoStat() {
				if pseudoStatIsCapped(proto.PseudoStat(unitStat.PseudoStatIdx()), reforgeCaps, softCaps) {
					return true
				}
			} else if statIsCapped(stats.Stat(unitStat.StatIdx()), reforgeCaps, softCaps) {
				return true
			}
		} else if strings.Contains(key, "Minus") {
			return true
		}
	}
	return false
}

// getCappedStatKeys returns the coefficient keys whose stat has a configured cap (hard or soft).
// Order is irrelevant to callers (used only for per-stat quota counting in gem selection).
func getCappedStatKeys(coeffs map[string]float64, reforgeCaps core.UnitStats, softCaps []*reforgeSoftCap) []string {
	var keys []string
	for key := range coeffs {
		unitStat, ok := unitStatFromCoeffKey(key)
		if !ok {
			continue
		}
		if unitStat.IsPseudoStat() {
			if pseudoStatHasCap(proto.PseudoStat(unitStat.PseudoStatIdx()), reforgeCaps, softCaps) {
				keys = append(keys, key)
			}
		} else if statHasCap(stats.Stat(unitStat.StatIdx()), reforgeCaps, softCaps) {
			keys = append(keys, key)
		}
	}
	return keys
}

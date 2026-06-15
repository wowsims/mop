package reforgeoptimizer

import (
	"cmp"
	"fmt"
	"slices"

	"github.com/wowsims/mop/sim/core"
	"github.com/wowsims/mop/sim/core/proto"
	"github.com/wowsims/mop/sim/core/stats"
	googleProto "google.golang.org/protobuf/proto"
)

// Validates and normalizes soft cap configs: applies breakpoint limits, strips out-of-
// range breakpoints, and sorts caps deterministically so the optimizer sees a stable config.
func validateReforgeOptimizeSettings(request *proto.ReforgeOptimizeRequest) (*normalizedReforgeOptimizeConfig, error) {
	settings := request.GetSettings()
	if settings == nil {
		settings = &proto.ReforgeSettings{}
	} else {
		settings = googleProto.Clone(settings).(*proto.ReforgeSettings)
	}

	normalizedSoftCaps := make([]*proto.StatCapConfig, 0, len(request.GetSoftCaps()))
	if settings.GetUseSoftCapBreakpoints() {
		for _, config := range request.GetSoftCaps() {
			unitStat, ok := unitStatFromUIStat(config.GetUnitStat())
			if !ok {
				return nil, fmt.Errorf("reforge optimizer soft cap is missing a stat")
			}

			breakpointLimit := getProtoUnitStat(settings.GetBreakpointLimits(), unitStat)
			if breakpointLimit == 0 {
				breakpointLimit = inferThresholdBreakpointLimit(config)
			}
			breakpoints, postCapEPs := normalizeSoftCapBreakpoints(config, breakpointLimit)
			normalizedSoftCaps = append(normalizedSoftCaps, &proto.StatCapConfig{
				UnitStat:    config.GetUnitStat(),
				Breakpoints: breakpoints,
				PostCap_EPs: postCapEPs,
				CapType:     config.GetCapType(),
			})
		}
	}
	slices.SortStableFunc(normalizedSoftCaps, func(a, b *proto.StatCapConfig) int {
		left := formatUIStat(a.GetUnitStat())
		right := formatUIStat(b.GetUnitStat())
		if left == right {
			return cmp.Compare(a.GetCapType(), b.GetCapType())
		}
		return cmp.Compare(left, right)
	})
	return &normalizedReforgeOptimizeConfig{settings: settings, softCaps: normalizedSoftCaps}, nil
}

// For TypeThreshold caps, returns the second-highest positive breakpoint as the effective
// limit — the last meaningful tier before an unreachable ceiling breakpoint.
func inferThresholdBreakpointLimit(config *proto.StatCapConfig) float64 {
	if config.GetCapType() != proto.StatCapType_TypeThreshold {
		return 0
	}

	maxSeen := 0.0
	for _, breakpoint := range config.GetBreakpoints() {
		if breakpoint > maxSeen {
			maxSeen = breakpoint
			continue
		}
		if breakpoint > 0 {
			return breakpoint
		}
	}
	return 0
}

// Reads either a stat or pseudo-stat value from proto.UnitStats by index, returning 0 for
// nil input or out-of-bounds indices.
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

// Converts absolute cap values from settings into gap-to-cap deltas relative to base
// stats. undershootCaps marks stats where the cap is a ceiling (stay below) rather than
// a floor (reach at least).
func buildReforgeHardCaps(baseStats core.UnitStats, settings *proto.ReforgeSettings, undershootCaps core.UnitStats) []reforgeHardCap {
	if settings == nil || settings.StatCaps == nil {
		return nil
	}

	statCaps := protoToCoreUnitStats(settings.StatCaps)
	caps := make([]reforgeHardCap, 0)
	for statIdx := 0; statIdx < int(stats.ProtoStatsLen); statIdx++ {
		unitStat := stats.UnitStatFromStat(stats.Stat(statIdx))
		if cap := getUnitStat(statCaps, unitStat); cap > 0 {
			caps = append(caps, reforgeHardCap{unitStat: unitStat, cap: computeSheetGapToCap(baseStats, unitStat, cap), undershoot: getUnitStat(undershootCaps, unitStat) > 0})
		}
	}
	for pseudoStatIdx := 0; pseudoStatIdx < int(stats.PseudoStatsLen); pseudoStatIdx++ {
		unitStat := stats.UnitStatFromPseudoStat(proto.PseudoStat(pseudoStatIdx))
		if cap := getUnitStat(statCaps, unitStat); cap > 0 {
			caps = append(caps, reforgeHardCap{unitStat: unitStat, cap: computeSheetGapToCap(baseStats, unitStat, cap), undershoot: getUnitStat(undershootCaps, unitStat) > 0})
		}
	}
	return caps
}

// Converts soft cap configs into gap-to-cap deltas. TypeThreshold caps have their
// breakpoints and post-cap EPs reversed so the optimizer evaluates from largest gap to
// smallest — highest-reward breakpoints are applied first.
func buildReforgeSoftCaps(baseStats core.UnitStats, configs []*proto.StatCapConfig) []reforgeSoftCap {
	softCaps := make([]reforgeSoftCap, 0, len(configs))
	for _, config := range configs {
		unitStat, ok := unitStatFromUIStat(config.GetUnitStat())
		if !ok {
			continue
		}

		breakpoints := make([]float64, 0, len(config.GetBreakpoints()))
		for _, breakpoint := range config.GetBreakpoints() {
			breakpoints = append(breakpoints, computeSheetGapToCap(baseStats, unitStat, breakpoint))
		}
		postCapEPs := slices.Clone(config.GetPostCap_EPs())
		if config.CapType == proto.StatCapType_TypeThreshold {
			slices.Reverse(breakpoints)
			if len(postCapEPs) == len(breakpoints) {
				slices.Reverse(postCapEPs)
			} else if len(postCapEPs) > 0 {
				postCapEPs = fillFloat64(len(breakpoints), postCapEPs[0])
			}
		}
		softCaps = append(softCaps, reforgeSoftCap{unitStat: unitStat, breakpoints: breakpoints, postCapEPs: postCapEPs, capType: config.CapType})
	}
	return softCaps
}

// Promotes a rating EP weight to its percent pseudo-stat equivalents when a cap is
// configured for those pseudo-stats. This ensures cap enforcement happens in percent space
// rather than rating space and zeros the parent rating weight to avoid double-counting.
func validateReforgeWeights(weights core.UnitStats, settings *proto.ReforgeSettings, softCapConfigs []*proto.StatCapConfig) core.UnitStats {
	validatedWeights := weights
	for _, parent := range []stats.Stat{stats.HitRating, stats.CritRating, stats.HasteRating} {
		children := childPseudoStats(parent)
		if len(children) == 0 {
			continue
		}

		hasSchoolWeight := false
		for _, child := range children {
			if getUnitStat(validatedWeights, stats.UnitStatFromPseudoStat(child)) != 0 {
				hasSchoolWeight = true
				break
			}
		}
		if hasSchoolWeight {
			validatedWeights.Stats[parent] = 0
			continue
		}

		parentWeight := validatedWeights.Stats[parent]
		if parentWeight == 0 {
			continue
		}
		for _, child := range children {
			unitStat := stats.UnitStatFromPseudoStat(child)
			if !unitStatHasConfiguredCap(settings, softCapConfigs, unitStat) {
				continue
			}
			validatedWeights = setUnitStat(validatedWeights, unitStat, parentWeight*ratingPerPseudoStatPercent(child))
			validatedWeights.Stats[parent] = 0
			break
		}
	}
	return validatedWeights
}

// Maps a rating stat to its percent pseudo-stat children (e.g. HitRating →
// {PhysicalHitPercent, SpellHitPercent}). Used by validateReforgeWeights.
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

func unitStatHasConfiguredCap(settings *proto.ReforgeSettings, softCapConfigs []*proto.StatCapConfig, unitStat stats.UnitStat) bool {
	if settings != nil && getProtoUnitStat(settings.GetStatCaps(), unitStat) > 0 {
		return true
	}
	for _, config := range softCapConfigs {
		configUnitStat, ok := unitStatFromUIStat(config.GetUnitStat())
		if ok && configUnitStat == unitStat {
			return true
		}
	}
	return false
}

type softCapBreakpoint struct {
	breakpoint float64
	postCapEP  float64
	hasPostEP  bool
}

// Clips breakpoints to the limit, inserting the limit itself as an explicit post-cap EP=0
// boundary if it wasn't already present, then returns the sorted breakpoints and their
// corresponding post-cap EPs as parallel slices.
func normalizeSoftCapBreakpoints(config *proto.StatCapConfig, breakpointLimit float64) ([]float64, []float64) {
	allBreakpoints := config.GetBreakpoints()
	breakpoints := make([]softCapBreakpoint, 0, len(config.GetBreakpoints()))
	limitIncluded := breakpointLimit == 0
	for idx, breakpoint := range allBreakpoints {
		if breakpointLimit > 0 && breakpoint == breakpointLimit {
			limitIncluded = true
		}
		if breakpointLimit > 0 && breakpoint > breakpointLimit {
			continue
		}
		entry := softCapBreakpoint{breakpoint: breakpoint}
		if postCapEP, ok := postCapEPForBreakpoint(config, idx, len(allBreakpoints)); ok {
			entry.postCapEP = postCapEP
			entry.hasPostEP = true
		}
		breakpoints = append(breakpoints, entry)
	}
	if breakpointLimit > 0 && !limitIncluded {
		breakpoints = append(breakpoints, softCapBreakpoint{breakpoint: breakpointLimit, postCapEP: 0, hasPostEP: true})
	}

	slices.SortStableFunc(breakpoints, func(a, b softCapBreakpoint) int {
		return cmp.Compare(a.breakpoint, b.breakpoint)
	})

	rawBreakpoints := make([]float64, 0, len(breakpoints))
	postCapEPs := make([]float64, 0, len(breakpoints))
	for _, breakpoint := range breakpoints {
		rawBreakpoints = append(rawBreakpoints, breakpoint.breakpoint)
		if breakpoint.hasPostEP {
			postCapEPs = append(postCapEPs, breakpoint.postCapEP)
		}
	}
	return rawBreakpoints, postCapEPs
}

// Returns the post-cap EP for a given breakpoint index. For TypeThreshold caps, the last
// EP in the list applies to the final (highest) breakpoint, not just the one at that index.
func postCapEPForBreakpoint(config *proto.StatCapConfig, breakpointIdx int, breakpointCount int) (float64, bool) {
	postCapEPs := config.GetPostCap_EPs()
	if breakpointIdx < len(postCapEPs) {
		return postCapEPs[breakpointIdx], true
	}
	if config.GetCapType() == proto.StatCapType_TypeThreshold && len(postCapEPs) > 1 && breakpointIdx == breakpointCount-1 {
		return postCapEPs[len(postCapEPs)-1], true
	}
	return 0, false
}

// Returns the delta needed to reach cap from base stats. Returns 1e-12 (rather than 0)
// when already at the cap so the MIP constraint remains active with a non-zero RHS.
func computeSheetGapToCap(baseStats core.UnitStats, unitStat stats.UnitStat, cap float64) float64 {
	statDelta := cap - getUnitStat(baseStats, unitStat)
	if statDelta == 0 {
		return 1e-12
	}
	return statDelta
}

// Converts the proto.UIStat oneof (Stat or PseudoStat) to the internal stats.UnitStat handle.
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

func fillFloat64(length int, value float64) []float64 {
	result := make([]float64, length)
	for idx := range result {
		result[idx] = value
	}
	return result
}

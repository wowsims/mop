package reforgeoptimizer

import (
	"math"
	"reflect"
	"testing"

	"github.com/wowsims/mop/sim/core"
	"github.com/wowsims/mop/sim/core/proto"
	"github.com/wowsims/mop/sim/core/stats"
)

func TestNormalizeSoftCapBreakpointsSortsAndAppliesLimit(t *testing.T) {
	config := &proto.StatCapConfig{
		Breakpoints: []float64{37.520, 62.470, 87.441, 50.000},
		PostCap_EPs: []float64{1, 2, 3, 4},
		CapType:     proto.StatCapType_TypeSoftCap,
	}

	breakpoints, postCapEPs := normalizeSoftCapBreakpoints(config, 50)

	if !reflect.DeepEqual(breakpoints, []float64{37.520, 50.000}) {
		t.Fatalf("unexpected breakpoints: got %v", breakpoints)
	}
	if !reflect.DeepEqual(postCapEPs, []float64{1, 4}) {
		t.Fatalf("unexpected post-cap EPs: got %v", postCapEPs)
	}
}

func TestNormalizeSoftCapBreakpointsSortsWithoutLimit(t *testing.T) {
	config := &proto.StatCapConfig{
		Breakpoints: []float64{37.520, 62.470, 87.441, 50.000},
		PostCap_EPs: []float64{1, 2, 3, 4},
		CapType:     proto.StatCapType_TypeSoftCap,
	}

	breakpoints, postCapEPs := normalizeSoftCapBreakpoints(config, 0)

	if !reflect.DeepEqual(breakpoints, []float64{37.520, 50.000, 62.470, 87.441}) {
		t.Fatalf("unexpected breakpoints: got %v", breakpoints)
	}
	if !reflect.DeepEqual(postCapEPs, []float64{1, 4, 2, 3}) {
		t.Fatalf("unexpected post-cap EPs: got %v", postCapEPs)
	}
}

func TestNormalizeSoftCapBreakpointsAddsExplicitLimit(t *testing.T) {
	config := &proto.StatCapConfig{
		CapType: proto.StatCapType_TypeSoftCap,
	}

	breakpoints, postCapEPs := normalizeSoftCapBreakpoints(config, 24.982)

	if !reflect.DeepEqual(breakpoints, []float64{24.982}) {
		t.Fatalf("unexpected breakpoints: got %v", breakpoints)
	}
	if !reflect.DeepEqual(postCapEPs, []float64{0.0}) {
		t.Fatalf("unexpected post-cap EPs: got %v", postCapEPs)
	}
}

func TestValidateReforgeOptimizeSettingsReturnsNormalizedSoftCaps(t *testing.T) {
	breakpointLimits := make([]float64, int(proto.PseudoStat_PseudoStatSpellHastePercent)+1)
	breakpointLimits[proto.PseudoStat_PseudoStatSpellHastePercent] = 50
	request := &proto.ReforgeOptimizeRequest{
		Settings: &proto.ReforgeSettings{
			UseSoftCapBreakpoints: true,
			BreakpointLimits: &proto.UnitStats{
				PseudoStats: breakpointLimits,
			},
		},
		SoftCaps: []*proto.StatCapConfig{{
			UnitStat:    &proto.UIStat{UnitStat: &proto.UIStat_PseudoStat{PseudoStat: proto.PseudoStat_PseudoStatSpellHastePercent}},
			Breakpoints: []float64{37.520, 62.470, 87.441, 50.000},
			PostCap_EPs: []float64{204, 195.5, 180, 170},
			CapType:     proto.StatCapType_TypeThreshold,
		}},
	}

	normalizedConfig, err := validateReforgeOptimizeSettings(request)
	if err != nil {
		t.Fatalf("unexpected validation error: %v", err)
	}
	normalizedSoftCaps := normalizedConfig.softCaps

	if !reflect.DeepEqual(normalizedSoftCaps[0].Breakpoints, []float64{37.520, 50.000}) {
		t.Fatalf("unexpected normalized breakpoints: got %v", normalizedSoftCaps[0].Breakpoints)
	}
	if !reflect.DeepEqual(normalizedSoftCaps[0].PostCap_EPs, []float64{204.0, 170.0}) {
		t.Fatalf("unexpected normalized post-cap EPs: got %v", normalizedSoftCaps[0].PostCap_EPs)
	}
	if !reflect.DeepEqual(request.SoftCaps[0].Breakpoints, []float64{37.520, 62.470, 87.441, 50.000}) {
		t.Fatalf("request breakpoints were mutated: got %v", request.SoftCaps[0].Breakpoints)
	}
}

func TestValidateReforgeOptimizeSettingsInfersThresholdLimit(t *testing.T) {
	request := &proto.ReforgeOptimizeRequest{
		Settings: &proto.ReforgeSettings{UseSoftCapBreakpoints: true},
		SoftCaps: []*proto.StatCapConfig{onStatCapConfig(proto.PseudoStat_PseudoStatSpellHastePercent, proto.StatCapType_TypeThreshold,
			[]float64{37.520, 62.470, 87.441, 50.000}, []float64{204, 170})},
	}

	normalizedConfig, err := validateReforgeOptimizeSettings(request)
	if err != nil {
		t.Fatalf("unexpected validation error: %v", err)
	}
	normalizedSoftCaps := normalizedConfig.softCaps

	if !reflect.DeepEqual(normalizedSoftCaps[0].Breakpoints, []float64{37.520, 50.000}) {
		t.Fatalf("unexpected normalized breakpoints: got %v", normalizedSoftCaps[0].Breakpoints)
	}
	if !reflect.DeepEqual(normalizedSoftCaps[0].PostCap_EPs, []float64{204.0, 170.0}) {
		t.Fatalf("unexpected normalized post-cap EPs: got %v", normalizedSoftCaps[0].PostCap_EPs)
	}

	unitStat := stats.UnitStatFromPseudoStat(proto.PseudoStat_PseudoStatSpellHastePercent)
	if limit := getProtoUnitStat(request.GetSettings().GetBreakpointLimits(), unitStat); limit != 0 {
		t.Fatalf("request breakpoint limits were mutated: got %v", limit)
	}
}

func TestNormalizeThresholdBreakpointsUsesFinalPostCapEPForFinalBreakpoint(t *testing.T) {
	config := &proto.StatCapConfig{
		Breakpoints: []float64{37.520, 62.470, 87.441, 50.000},
		PostCap_EPs: []float64{204, 170},
		CapType:     proto.StatCapType_TypeThreshold,
	}

	breakpoints, postCapEPs := normalizeSoftCapBreakpoints(config, 50)

	if !reflect.DeepEqual(breakpoints, []float64{37.520, 50.000}) {
		t.Fatalf("unexpected breakpoints: got %v", breakpoints)
	}
	if !reflect.DeepEqual(postCapEPs, []float64{204.0, 170.0}) {
		t.Fatalf("unexpected post-cap EPs: got %v", postCapEPs)
	}
}

func TestBuildReforgeSoftCapsPreservesThresholdPostCapPairings(t *testing.T) {
	request := &proto.ReforgeOptimizeRequest{
		Settings: &proto.ReforgeSettings{UseSoftCapBreakpoints: true, BreakpointLimits: &proto.UnitStats{PseudoStats: make([]float64, int(proto.PseudoStat_PseudoStatSpellHastePercent)+1)}},
		SoftCaps: []*proto.StatCapConfig{onStatCapConfig(proto.PseudoStat_PseudoStatSpellHastePercent, proto.StatCapType_TypeThreshold,
			[]float64{37.520, 62.470, 87.441, 50.000}, []float64{204, 195.5, 180, 170})},
	}
	request.Settings.BreakpointLimits.PseudoStats[proto.PseudoStat_PseudoStatSpellHastePercent] = 50

	normalizedConfig, err := validateReforgeOptimizeSettings(request)
	if err != nil {
		t.Fatalf("unexpected validation error: %v", err)
	}
	normalizedSoftCaps := normalizedConfig.softCaps
	softCaps := buildReforgeSoftCaps(core.NewUnitStats(), normalizedSoftCaps)

	if len(softCaps) != 1 {
		t.Fatalf("expected 1 soft cap, got %d", len(softCaps))
	}
	if !reflect.DeepEqual(softCaps[0].breakpoints, []float64{50.000, 37.520}) {
		t.Fatalf("unexpected solver breakpoints: got %v", softCaps[0].breakpoints)
	}
	if !reflect.DeepEqual(softCaps[0].postCapEPs, []float64{170.0, 204.0}) {
		t.Fatalf("unexpected solver post-cap EPs: got %v", softCaps[0].postCapEPs)
	}
}

func TestBuildReforgeSoftCapsUsesSheetGapForHasteBreakpoints(t *testing.T) {
	baseStats := core.NewUnitStats()
	baseStats = setUnitStat(baseStats, stats.UnitStatFromPseudoStat(proto.PseudoStat_PseudoStatSpellHastePercent), 40)
	baseStats = setUnitStat(baseStats, stats.UnitStatFromPseudoStat(proto.PseudoStat_PseudoStatCastSpeedMultiplier), 1.07)
	softCaps := buildReforgeSoftCaps(baseStats, []*proto.StatCapConfig{
		onStatCapConfig(proto.PseudoStat_PseudoStatSpellHastePercent, proto.StatCapType_TypeThreshold, []float64{50}, []float64{170}),
	})

	if len(softCaps) != 1 {
		t.Fatalf("expected 1 soft cap, got %d", len(softCaps))
	}
	if !reflect.DeepEqual(softCaps[0].breakpoints, []float64{10.0}) {
		t.Fatalf("unexpected solver breakpoints: got %v", softCaps[0].breakpoints)
	}
}

func TestUpdateHiGHSCapPassKeepsLaterSoftCaps(t *testing.T) {
	crit := stats.UnitStatFromPseudoStat(proto.PseudoStat_PseudoStatSpellCritPercent)
	haste := stats.UnitStatFromPseudoStat(proto.PseudoStat_PseudoStatSpellHastePercent)
	search := &reforgeSearchState{}
	delta := core.NewUnitStats()
	delta = setUnitStat(delta, crit, 4)
	delta = setUnitStat(delta, haste, 6)
	softCaps := []reforgeSoftCap{
		{unitStat: crit, breakpoints: []float64{3, 5}, postCapEPs: []float64{10, 8}, capType: proto.StatCapType_TypeSoftCap},
		{unitStat: haste, breakpoints: []float64{5}, postCapEPs: []float64{7}, capType: proto.StatCapType_TypeThreshold},
	}

	updated, _, remainingSoftCaps, _, _ := updateHiGHSCapPass(search, 0, delta, core.NewUnitStats(), softCaps, nil, nil, map[stats.UnitStat]bool{})

	if !updated {
		t.Fatal("expected soft-cap pass update")
	}
	if len(remainingSoftCaps) != 2 {
		t.Fatalf("expected remaining crit and haste soft caps, got %d", len(remainingSoftCaps))
	}
	if remainingSoftCaps[0].unitStat != crit || !reflect.DeepEqual(remainingSoftCaps[0].breakpoints, []float64{5.0}) {
		t.Fatalf("unexpected remaining crit soft cap: %+v", remainingSoftCaps[0])
	}
	if remainingSoftCaps[1].unitStat != haste || !reflect.DeepEqual(remainingSoftCaps[1].breakpoints, []float64{5.0}) {
		t.Fatalf("unexpected remaining haste soft cap: %+v", remainingSoftCaps[1])
	}
}

func TestUpdateHiGHSCapPassTightensViolatedExistingConstraint(t *testing.T) {
	haste := stats.UnitStatFromPseudoStat(proto.PseudoStat_PseudoStatSpellHastePercent)
	delta := core.NewUnitStats()
	delta = setUnitStat(delta, haste, 9.9)
	statConstraints := []mipStatConstraint{{unitStat: haste, lower: 10, upper: math.Inf(1), actualLower: 10, hasActualLower: true}}

	updated, _, _, updatedConstraints, _ := updateHiGHSCapPass(&reforgeSearchState{}, 0, delta, core.NewUnitStats(), nil, statConstraints, nil, map[stats.UnitStat]bool{})

	if !updated {
		t.Fatal("expected violated constraint to be tightened")
	}
	if len(updatedConstraints) != 1 || updatedConstraints[0].lower <= 10 {
		t.Fatalf("expected lower constraint to be tightened, got %+v", updatedConstraints)
	}
}

func onStatCapConfig(pseudoStat proto.PseudoStat, capType proto.StatCapType, breakpoints []float64, postCapEPs []float64) *proto.StatCapConfig {
	return &proto.StatCapConfig{
		UnitStat:    &proto.UIStat{UnitStat: &proto.UIStat_PseudoStat{PseudoStat: pseudoStat}},
		Breakpoints: breakpoints,
		PostCap_EPs: postCapEPs,
		CapType:     capType,
	}
}

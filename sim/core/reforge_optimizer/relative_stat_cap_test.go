package reforgeoptimizer

import (
	"math"
	"testing"
	"time"

	"github.com/wowsims/mop/sim/core"
	"github.com/wowsims/mop/sim/core/proto"
	"github.com/wowsims/mop/sim/core/stats"
)

func TestApplyRelativeStatCapWeightsLowersForcedStat(t *testing.T) {
	weights := core.NewUnitStats()
	weights.Stats[stats.CritRating] = 2
	weights.Stats[stats.HasteRating] = 1.4
	weights.Stats[stats.MasteryRating] = 1.8

	weights = applyRelativeStatCapWeights(weights, []reforgeRelativeStatCap{
		{forcedStat: stats.UnitStatFromStat(stats.MasteryRating), constrainedStat: stats.UnitStatFromStat(stats.CritRating), adjustWeight: true},
		{forcedStat: stats.UnitStatFromStat(stats.MasteryRating), constrainedStat: stats.UnitStatFromStat(stats.HasteRating), adjustWeight: true},
	})

	if got, want := weights.Stats[stats.MasteryRating], 1.39; math.Abs(got-want) > 1e-9 {
		t.Fatalf("mastery weight = %f, want %f", got, want)
	}
}

func TestBuildChoiceMIPModelAddsRelativeStatCapConstraint(t *testing.T) {
	mastery := stats.UnitStatFromStat(stats.MasteryRating)
	crit := stats.UnitStatFromStat(stats.CritRating)
	choiceDelta := core.NewUnitStats()
	choiceDelta.Stats[stats.MasteryRating] = 12
	choiceDelta.Stats[stats.CritRating] = -4

	search := &reforgeSearchState{
		slots: []reforgeSlotChoices{{slot: proto.ItemSlot_ItemSlotHead, choices: []reforgeChoice{{delta: choiceDelta}}}},
		relativeCaps: []reforgeRelativeStatCap{
			{forcedStat: mastery, constrainedStat: crit, minDelta: 10, actualMinDelta: 10},
		},
	}

	model := buildChoiceMIPModel(search, core.NewUnitStats(), nil, search.relativeCaps, math.Inf(1))
	for _, constraint := range model.constraints {
		if constraint.lower == 10 && constraint.upper == math.Inf(1) {
			if got, want := constraint.values[0], 16.0; got != want {
				t.Fatalf("relative constraint coefficient = %f, want %f", got, want)
			}
			return
		}
	}
	t.Fatalf("relative stat cap constraint not found in model: %#v", model.constraints)
}

func TestExactRelativeCapViolationDetectsFailedCap(t *testing.T) {
	mastery := stats.UnitStatFromStat(stats.MasteryRating)
	crit := stats.UnitStatFromStat(stats.CritRating)
	delta := core.NewUnitStats()
	delta.Stats[stats.MasteryRating] = 4
	delta.Stats[stats.CritRating] = 2
	relativeCaps := []reforgeRelativeStatCap{{forcedStat: mastery, constrainedStat: crit, minDelta: 3, actualMinDelta: 3}}

	_, value, violated := exactRelativeCapViolation(relativeCaps, delta)

	if !violated {
		t.Fatalf("relative stat cap violation was not detected")
	}
	if got, want := value, 2.0; math.Abs(got-want) > 1e-9 {
		t.Fatalf("relative cap value = %f, want %f", got, want)
	}
}

func TestExactRelativeCapViolationUsesOriginalRequirement(t *testing.T) {
	mastery := stats.UnitStatFromStat(stats.MasteryRating)
	crit := stats.UnitStatFromStat(stats.CritRating)
	delta := core.NewUnitStats()
	delta.Stats[stats.MasteryRating] = 5
	delta.Stats[stats.CritRating] = 2
	relativeCaps := []reforgeRelativeStatCap{{forcedStat: mastery, constrainedStat: crit, minDelta: 5, actualMinDelta: 3}}

	_, _, violated := exactRelativeCapViolation(relativeCaps, delta)

	if violated {
		t.Fatalf("relative stat cap failed even though exact value satisfies the original requirement")
	}
}

func TestUpdateHiGHSCapPassTightensRelativeStatCap(t *testing.T) {
	mastery := stats.UnitStatFromStat(stats.MasteryRating)
	crit := stats.UnitStatFromStat(stats.CritRating)
	delta := core.NewUnitStats()
	delta.Stats[stats.MasteryRating] = 4
	delta.Stats[stats.CritRating] = 2
	relativeCaps := []reforgeRelativeStatCap{{forcedStat: mastery, constrainedStat: crit, minDelta: 3, actualMinDelta: 3}}
	startingMinDelta := relativeCaps[0].minDelta

	updated, _, _, _, nextRelativeCaps := updateHiGHSCapPass(&reforgeSearchState{}, 0, delta, core.NewUnitStats(), nil, nil, relativeCaps, nil)

	if !updated {
		t.Fatalf("relative stat cap violation did not request another HiGHS pass")
	}
	if got, want := len(nextRelativeCaps), 1; got != want {
		t.Fatalf("relative cap count = %d, want %d", got, want)
	}
	if nextRelativeCaps[0].minDelta <= startingMinDelta {
		t.Fatalf("relative cap minDelta was not tightened: got %f, started %f", nextRelativeCaps[0].minDelta, startingMinDelta)
	}
}

func TestBuildRelativeStatCapsOnlyForcesConfiguredStatForWindwalker(t *testing.T) {
	baseStats := core.NewUnitStats()
	baseStats.Stats[stats.CritRating] = 333
	baseStats.Stats[stats.HasteRating] = 333
	baseStats.Stats[stats.MasteryRating] = 334 + 8*core.MasteryRatingPerMasteryPoint
	baseRaid := &proto.Raid{Parties: []*proto.Party{{Players: []*proto.Player{{Spec: &proto.Player_WindwalkerMonk{WindwalkerMonk: &proto.WindwalkerMonk{}}}}}}}
	settings := &proto.ReforgeSettings{RelativeStatCapStat: &proto.UIStat{UnitStat: &proto.UIStat_Stat{Stat: proto.Stat_StatMasteryRating}}}

	relativeCaps := buildRelativeStatCaps(baseRaid, &proto.EquipmentSpec{}, baseStats, settings)

	if got, want := len(relativeCaps), 2; got != want {
		t.Fatalf("relative cap count = %d, want %d", got, want)
	}
	for _, relativeCap := range relativeCaps {
		if relativeCap.forcedStat != stats.UnitStatFromStat(stats.MasteryRating) {
			t.Fatalf("unexpected non-mastery forced cap: %#v", relativeCap)
		}
		if relativeCap.constrainedStat != stats.UnitStatFromStat(stats.CritRating) && relativeCap.constrainedStat != stats.UnitStatFromStat(stats.HasteRating) {
			t.Fatalf("unexpected constrained stat: %#v", relativeCap)
		}
	}
}

func TestHiGHSOptimizerTimeoutMatchesJSTimeoutSettings(t *testing.T) {
	search := &reforgeSearchState{request: &proto.ReforgeOptimizeRequest{Settings: &proto.ReforgeSettings{IncludeTimeout: true}}}
	if got, want := highsOptimizerTimeout(search), optimizerTimeout; got != want {
		t.Fatalf("timeout without relative cap = %s, want %s", got, want)
	}

	search.relativeCaps = []reforgeRelativeStatCap{{}}
	if got, want := highsOptimizerTimeout(search), relativeStatCapOptimizerTimeout; got != want {
		t.Fatalf("timeout with relative cap = %s, want %s", got, want)
	}

	search.request.Settings.IncludeTimeout = false
	if got, want := highsOptimizerTimeout(search), optimizerNoTimeout; got != want {
		t.Fatalf("timeout disabled = %s, want %s", got, want)
	}
}

func TestHiGHSPassTimeoutUsesRemainingBudgetWithMinimum(t *testing.T) {
	if got := highsOptimizerPassTimeout(time.Now().Add(2500 * time.Millisecond)); got < 2*time.Second || got > 3*time.Second {
		t.Fatalf("remaining pass timeout = %s, want about 2.5s", got)
	}
	if got, want := highsOptimizerPassTimeout(time.Now().Add(-time.Second)), time.Second; got != want {
		t.Fatalf("expired pass timeout = %s, want %s", got, want)
	}
}

func TestRelativeStatCapBalanceRunsOnlyWhenTimeoutDisabled(t *testing.T) {
	search := &reforgeSearchState{
		request:      &proto.ReforgeOptimizeRequest{Settings: &proto.ReforgeSettings{IncludeTimeout: true}},
		relativeCaps: []reforgeRelativeStatCap{{}},
	}
	if shouldRunRelativeStatCapBalance(search) {
		t.Fatalf("relative-cap balance should not run when timeout is enabled")
	}

	search.request.Settings.IncludeTimeout = false
	if !shouldRunRelativeStatCapBalance(search) {
		t.Fatalf("relative-cap balance should run when timeout is disabled")
	}
}

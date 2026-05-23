package reforgeoptimizer

import (
	"testing"

	"github.com/wowsims/mop/sim/core"
	"github.com/wowsims/mop/sim/core/proto"
	"github.com/wowsims/mop/sim/core/stats"
)

func TestBuildChoiceMIPModelUsesAnalyticChoiceDeltaForObjective(t *testing.T) {
	exactDelta := core.NewUnitStats()
	exactDelta = setUnitStat(exactDelta, stats.UnitStatFromStat(stats.MasteryRating), 10)
	analyticDelta := core.NewUnitStats()
	analyticDelta = setUnitStat(analyticDelta, stats.UnitStatFromPseudoStat(proto.PseudoStat_PseudoStatSpellCritPercent), 10)
	weights := core.NewUnitStats()
	weights = setUnitStat(weights, stats.UnitStatFromStat(stats.MasteryRating), 1)
	weights = setUnitStat(weights, stats.UnitStatFromPseudoStat(proto.PseudoStat_PseudoStatSpellCritPercent), 100)
	search := &reforgeSearchState{
		slots: []reforgeSlotChoices{{
			slot: proto.ItemSlot_ItemSlotHead,
			choices: []reforgeChoice{
				{slot: proto.ItemSlot_ItemSlotHead, hasReforge: true},
				{slot: proto.ItemSlot_ItemSlotHead, hasReforge: true, reforgeID: 113, delta: exactDelta, objectiveDelta: analyticDelta},
			},
		}},
	}

	model := buildChoiceMIPModel(search, weights, nil, nil)

	if len(model.variables) != 1 {
		t.Fatalf("expected 1 MIP variable, got %d", len(model.variables))
	}
	if model.variables[0].objective != 1000 {
		t.Fatalf("expected analytic delta objective 1000, got %v", model.variables[0].objective)
	}
}

func TestBuildChoiceMIPModelUsesExactChoiceDeltaForConstraints(t *testing.T) {
	unitStat := stats.UnitStatFromPseudoStat(proto.PseudoStat_PseudoStatSpellCritPercent)
	exactDelta := core.NewUnitStats()
	exactDelta = setUnitStat(exactDelta, unitStat, 10)
	analyticDelta := core.NewUnitStats()
	analyticDelta = setUnitStat(analyticDelta, unitStat, 20)
	search := &reforgeSearchState{
		slots: []reforgeSlotChoices{{
			slot: proto.ItemSlot_ItemSlotHead,
			choices: []reforgeChoice{
				{slot: proto.ItemSlot_ItemSlotHead, hasReforge: true},
				{slot: proto.ItemSlot_ItemSlotHead, hasReforge: true, reforgeID: 113, delta: exactDelta, objectiveDelta: analyticDelta},
			},
		}},
	}
	constraints := []mipStatConstraint{{unitStat: unitStat, lower: 5, upper: 100}}

	model := buildChoiceMIPModel(search, core.NewUnitStats(), constraints, nil)

	if len(model.constraints) != 2 {
		t.Fatalf("expected choice and stat constraints, got %d", len(model.constraints))
	}
	statConstraint := model.constraints[1]
	if len(statConstraint.values) != 1 || statConstraint.values[0] != 10 {
		t.Fatalf("expected exact delta constraint coefficient 10, got %v", statConstraint.values)
	}
}

func TestBuildChoiceMIPModelUsesAnalyticChoiceDeltaForRelativeCapConstraints(t *testing.T) {
	forcedStat := stats.UnitStatFromStat(stats.MasteryRating)
	constrainedStat := stats.UnitStatFromStat(stats.CritRating)
	exactDelta := core.NewUnitStats()
	exactDelta = setUnitStat(exactDelta, forcedStat, 10)
	analyticDelta := core.NewUnitStats()
	analyticDelta = setUnitStat(analyticDelta, forcedStat, 20)
	analyticDelta = setUnitStat(analyticDelta, constrainedStat, 5)
	search := &reforgeSearchState{
		slots: []reforgeSlotChoices{{
			slot: proto.ItemSlot_ItemSlotHead,
			choices: []reforgeChoice{
				{slot: proto.ItemSlot_ItemSlotHead, hasReforge: true},
				{slot: proto.ItemSlot_ItemSlotHead, hasReforge: true, reforgeID: 113, delta: exactDelta, objectiveDelta: analyticDelta},
			},
		}},
	}
	relativeCaps := []reforgeRelativeStatCap{{forcedStat: forcedStat, constrainedStat: constrainedStat, minDelta: 1}}

	model := buildChoiceMIPModel(search, core.NewUnitStats(), nil, relativeCaps)

	if len(model.constraints) != 2 {
		t.Fatalf("expected choice and relative cap constraints, got %d", len(model.constraints))
	}
	relativeConstraint := model.constraints[1]
	if len(relativeConstraint.values) != 1 || relativeConstraint.values[0] != 15 {
		t.Fatalf("expected analytic relative cap coefficient 15, got %v", relativeConstraint.values)
	}
}
